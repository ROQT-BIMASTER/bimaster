/**
 * useArquivarAnexoChat — arquiva um anexo comum do chat (bucket `chat-anexos`)
 * em um dos cofres oficiais: Submissão China, Briefing, Cofre do Projeto ou
 * Anexo oficial da Tarefa.
 *
 * Fluxo:
 *   1. baixa o blob do bucket `chat-anexos`
 *   2. faz upload no bucket destino com path estruturado (primeiro segmento
 *      satisfaz a policy de cada bucket — UID em projeto-anexos/china-documentos,
 *      briefing_id em briefing-cofre)
 *   3. chama a RPC `rpc_arquivar_anexo_chat_*` que valida acesso à conversa
 *      origem, valida acesso ao destino, cria a linha no cofre, registra o
 *      arquivamento (auditoria/dedupe) e posta msg de sistema na conversa.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CHAT_BUCKET = "chat-anexos";

interface AnexoBase {
  anexo_id: string;
  storage_path_origem: string;
  nome_arquivo: string;
  mime_type: string | null;
  size_bytes: number | null;
}

async function downloadAnexoBlob(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(CHAT_BUCKET).download(path);
  if (error || !data) throw error ?? new Error("Falha ao baixar anexo origem");
  return data;
}

async function currentUid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error("Sessão expirada");
  return uid;
}

function safe(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 80);
}

function translateError(e: any): string {
  const msg: string = (e?.message ?? "").toString();
  if (msg.includes("sem_acesso_submissao")) return "Você não tem acesso a esta submissão da China.";
  if (msg.includes("sem_acesso_projeto")) return "Você não tem acesso a este projeto.";
  if (msg.includes("sem_acesso_briefing")) return "Você não tem acesso a este briefing.";
  if (msg.includes("tarefa_invalida")) return "Tarefa não pertence ao projeto selecionado.";
  if (msg.includes("categoria_obrigatoria")) return "Selecione a categoria do cofre.";
  if (msg.includes("tipo_documento_obrigatorio")) return "Selecione o tipo de documento.";
  if (msg.includes("anexo_nao_encontrado_ou_sem_acesso"))
    return "Anexo não encontrado ou você perdeu acesso à conversa.";
  return msg || "Falha ao arquivar no cofre";
}

export type ArqDestino = "china_checklist" | "briefing" | "projeto" | "tarefa";

export function useArquivarAnexoChat() {
  const qc = useQueryClient();

  const arquivarChina = useMutation({
    mutationFn: async (input: AnexoBase & { submissao_id: string; tipo_documento: string }) => {
      const uid = await currentUid();
      const blob = await downloadAnexoBlob(input.storage_path_origem);
      const path = `${uid}/anexo-chat/${input.submissao_id}/${input.tipo_documento}/${Date.now()}_${safe(input.nome_arquivo)}`;
      const { error: upErr } = await supabase.storage.from("china-documentos").upload(path, blob, {
        contentType: input.mime_type || "application/octet-stream",
        upsert: false,
      });
      if (upErr) throw new Error(`Falha ao gravar no cofre China: ${upErr.message}`);
      const { data, error } = await (supabase.rpc as any)("rpc_arquivar_anexo_chat_china", {
        p_anexo_id: input.anexo_id,
        p_submissao_id: input.submissao_id,
        p_tipo_documento: input.tipo_documento,
        p_novo_arquivo_path: path,
        p_nome_arquivo: input.nome_arquivo,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success("Anexo arquivado no cofre da Submissão China");
      qc.invalidateQueries({ queryKey: ["china-produto-documentos"] });
      qc.invalidateQueries({ queryKey: ["china-ficha-docs"] });
    },
    onError: (e: any) => toast.error("Erro ao arquivar", { description: translateError(e) }),
  });

  const arquivarBriefing = useMutation({
    mutationFn: async (input: AnexoBase & { briefing_id: string; categoria: string }) => {
      const blob = await downloadAnexoBlob(input.storage_path_origem);
      const path = `${input.briefing_id}/${input.categoria}/${Date.now()}_${safe(input.nome_arquivo)}`;
      const { error: upErr } = await supabase.storage.from("briefing-cofre").upload(path, blob, {
        contentType: input.mime_type || "application/octet-stream",
        upsert: false,
      });
      if (upErr) throw new Error(`Falha ao gravar no cofre do briefing: ${upErr.message}`);
      const { data, error } = await (supabase.rpc as any)("rpc_arquivar_anexo_chat_briefing", {
        p_anexo_id: input.anexo_id,
        p_briefing_id: input.briefing_id,
        p_categoria: input.categoria,
        p_novo_arquivo_path: path,
        p_nome_arquivo: input.nome_arquivo,
        p_mime: input.mime_type,
        p_size: input.size_bytes,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success("Anexo arquivado no cofre do Briefing");
      qc.invalidateQueries({ queryKey: ["briefing-documentos"] });
    },
    onError: (e: any) => toast.error("Erro ao arquivar", { description: translateError(e) }),
  });

  const arquivarProjeto = useMutation({
    mutationFn: async (input: AnexoBase & { projeto_id: string; categoria: string }) => {
      const uid = await currentUid();
      const blob = await downloadAnexoBlob(input.storage_path_origem);
      const path = `${uid}/anexo-chat/${input.projeto_id}/${input.categoria}/${Date.now()}_${safe(input.nome_arquivo)}`;
      const { error: upErr } = await supabase.storage.from("projeto-anexos").upload(path, blob, {
        contentType: input.mime_type || "application/octet-stream",
        upsert: false,
      });
      if (upErr) throw new Error(`Falha ao gravar no cofre do projeto: ${upErr.message}`);
      const { data, error } = await (supabase.rpc as any)("rpc_arquivar_anexo_chat_projeto", {
        p_anexo_id: input.anexo_id,
        p_projeto_id: input.projeto_id,
        p_categoria: input.categoria,
        p_novo_arquivo_path: path,
        p_nome_arquivo: input.nome_arquivo,
        p_mime: input.mime_type,
        p_size: input.size_bytes,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success("Anexo arquivado no cofre do Projeto");
      qc.invalidateQueries({ queryKey: ["projeto-cofre-documentos"] });
    },
    onError: (e: any) => toast.error("Erro ao arquivar", { description: translateError(e) }),
  });

  const arquivarTarefa = useMutation({
    mutationFn: async (input: AnexoBase & { projeto_id: string; tarefa_id: string; categoria: string }) => {
      const uid = await currentUid();
      const blob = await downloadAnexoBlob(input.storage_path_origem);
      const path = `${uid}/anexo-chat/${input.projeto_id}/${input.tarefa_id}/${Date.now()}_${safe(input.nome_arquivo)}`;
      const { error: upErr } = await supabase.storage.from("projeto-anexos").upload(path, blob, {
        contentType: input.mime_type || "application/octet-stream",
        upsert: false,
      });
      if (upErr) throw new Error(`Falha ao gravar no anexo da tarefa: ${upErr.message}`);
      const { data, error } = await (supabase.rpc as any)("rpc_arquivar_anexo_chat_tarefa", {
        p_anexo_id: input.anexo_id,
        p_projeto_id: input.projeto_id,
        p_tarefa_id: input.tarefa_id,
        p_categoria: input.categoria,
        p_novo_arquivo_path: path,
        p_nome_arquivo: input.nome_arquivo,
        p_mime: input.mime_type,
        p_size: input.size_bytes,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success("Anexo arquivado no cofre da Tarefa");
      qc.invalidateQueries({ queryKey: ["tarefa-anexos"] });
    },
    onError: (e: any) => toast.error("Erro ao arquivar", { description: translateError(e) }),
  });

  return { arquivarChina, arquivarBriefing, arquivarProjeto, arquivarTarefa };
}
