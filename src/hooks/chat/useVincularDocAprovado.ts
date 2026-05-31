/**
 * useVincularDocAprovado — vincula um documento aprovado do chat a um dos
 * cofres oficiais (Submissão China, Briefing, Cofre do Projeto, Tarefa).
 *
 * Em todos os casos:
 *   1. baixa o blob do bucket `aprovacao-documentos`
 *   2. faz upload no bucket destino com path estruturado iniciado pelo UID
 *      do usuário (exigido pelas policies de storage)
 *   3. chama a RPC `rpc_vincular_aprovacao_*` que valida acesso real ao
 *      destino, cria a linha no cofre correto, registra o vínculo
 *      (auditoria/dedupe) e posta msg de sistema na conversa origem.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const APROV_BUCKET = "aprovacao-documentos";

interface DocBase {
  documento_id: string;
  storage_path_origem: string;
  nome_arquivo: string;
  mime_type: string | null;
  size_bytes: number | null;
}

async function downloadAprovacaoBlob(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(APROV_BUCKET).download(path);
  if (error || !data) throw error ?? new Error("Falha ao baixar documento origem");
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

/** Traduz códigos de erro vindos das RPCs para mensagens amigáveis. */
function translateError(e: any): string {
  const msg: string = (e?.message ?? "").toString();
  if (msg.includes("sem_acesso_submissao")) return "Você não tem acesso a esta submissão da China.";
  if (msg.includes("sem_acesso_projeto")) return "Você não tem acesso a este projeto.";
  if (msg.includes("sem_acesso_briefing")) return "Você não tem acesso a este briefing.";
  if (msg.includes("tarefa_invalida")) return "Tarefa não pertence ao projeto selecionado.";
  if (msg.includes("categoria_obrigatoria")) return "Selecione a categoria do cofre.";
  if (msg.includes("tipo_documento_obrigatorio")) return "Selecione o tipo de documento.";
  if (msg.includes("documento_nao_encontrado_ou_sem_acesso"))
    return "Documento não encontrado ou você perdeu acesso à conversa.";
  return msg || "Falha ao arquivar no cofre";
}

export type VincDestino = "china_checklist" | "briefing" | "projeto" | "tarefa";

export function useVincularDocAprovado() {
  const qc = useQueryClient();

  // 1) Checklist China ----------------------------------------------------------
  const vincularChina = useMutation({
    mutationFn: async (input: DocBase & {
      submissao_id: string;
      tipo_documento: string;
    }) => {
      const uid = await currentUid();
      const blob = await downloadAprovacaoBlob(input.storage_path_origem);
      // path começa com UID p/ satisfazer china_storage_insert_owned
      const path = `${uid}/aprovacao-chat/${input.submissao_id}/${input.tipo_documento}/${Date.now()}_${safe(input.nome_arquivo)}`;
      const { error: upErr } = await supabase.storage
        .from("china-documentos")
        .upload(path, blob, {
          contentType: input.mime_type || "application/octet-stream",
          upsert: false,
        });
      if (upErr) throw new Error(`Falha ao gravar no cofre China: ${upErr.message}`);
      const { data, error } = await (supabase.rpc as any)(
        "rpc_vincular_aprovacao_checklist_china",
        {
          p_documento_id: input.documento_id,
          p_submissao_id: input.submissao_id,
          p_tipo_documento: input.tipo_documento,
          p_novo_arquivo_path: path,
          p_nome_arquivo: input.nome_arquivo,
        },
      );
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success("Documento arquivado no cofre da Submissão China");
      qc.invalidateQueries({ queryKey: ["china-produto-documentos"] });
      qc.invalidateQueries({ queryKey: ["china-ficha-docs"] });
    },
    onError: (e: any) =>
      toast.error("Erro ao vincular", { description: translateError(e) }),
  });

  // 2) Briefing -----------------------------------------------------------------
  const vincularBriefing = useMutation({
    mutationFn: async (input: DocBase & {
      briefing_id: string;
      categoria: string;
    }) => {
      const blob = await downloadAprovacaoBlob(input.storage_path_origem);
      // briefing-cofre policy exige primeiro segmento = briefing_id
      const path = `${input.briefing_id}/${input.categoria}/${Date.now()}_${safe(input.nome_arquivo)}`;
      const { error: upErr } = await supabase.storage
        .from("briefing-cofre")
        .upload(path, blob, {
          contentType: input.mime_type || "application/octet-stream",
          upsert: false,
        });
      if (upErr) throw new Error(`Falha ao gravar no cofre do briefing: ${upErr.message}`);
      const { data, error } = await (supabase.rpc as any)(
        "rpc_vincular_aprovacao_briefing",
        {
          p_documento_id: input.documento_id,
          p_briefing_id: input.briefing_id,
          p_categoria: input.categoria,
          p_novo_arquivo_path: path,
          p_nome_arquivo: input.nome_arquivo,
          p_mime: input.mime_type,
          p_size: input.size_bytes,
        },
      );
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success("Documento arquivado no cofre do Briefing");
      qc.invalidateQueries({ queryKey: ["briefing-documentos"] });
    },
    onError: (e: any) =>
      toast.error("Erro ao vincular", { description: translateError(e) }),
  });

  // 3) Projeto (raiz) -----------------------------------------------------------
  const vincularProjeto = useMutation({
    mutationFn: async (input: DocBase & {
      projeto_id: string;
      categoria: string;
    }) => {
      const uid = await currentUid();
      const blob = await downloadAprovacaoBlob(input.storage_path_origem);
      // projeto-anexos policy exige primeiro segmento = auth.uid()
      const path = `${uid}/aprovacao-chat/${input.projeto_id}/${input.categoria}/${Date.now()}_${safe(input.nome_arquivo)}`;
      const { error: upErr } = await supabase.storage
        .from("projeto-anexos")
        .upload(path, blob, {
          contentType: input.mime_type || "application/octet-stream",
          upsert: false,
        });
      if (upErr) throw new Error(`Falha ao gravar no cofre do projeto: ${upErr.message}`);
      const { data, error } = await (supabase.rpc as any)(
        "rpc_vincular_aprovacao_projeto",
        {
          p_documento_id: input.documento_id,
          p_projeto_id: input.projeto_id,
          p_categoria: input.categoria,
          p_novo_arquivo_path: path,
          p_nome_arquivo: input.nome_arquivo,
          p_mime: input.mime_type,
          p_size: input.size_bytes,
        },
      );
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success("Documento arquivado no cofre do Projeto");
      qc.invalidateQueries({ queryKey: ["projeto-cofre-documentos"] });
    },
    onError: (e: any) =>
      toast.error("Erro ao vincular", { description: translateError(e) }),
  });

  // 4) Tarefa -------------------------------------------------------------------
  const vincularTarefa = useMutation({
    mutationFn: async (input: DocBase & {
      projeto_id: string;
      tarefa_id: string;
      categoria: string;
    }) => {
      const uid = await currentUid();
      const blob = await downloadAprovacaoBlob(input.storage_path_origem);
      const path = `${uid}/aprovacao-chat/${input.projeto_id}/${input.tarefa_id}/${Date.now()}_${safe(input.nome_arquivo)}`;
      const { error: upErr } = await supabase.storage
        .from("projeto-anexos")
        .upload(path, blob, {
          contentType: input.mime_type || "application/octet-stream",
          upsert: false,
        });
      if (upErr) throw new Error(`Falha ao gravar no anexo da tarefa: ${upErr.message}`);
      const { data, error } = await (supabase.rpc as any)(
        "rpc_vincular_aprovacao_tarefa",
        {
          p_documento_id: input.documento_id,
          p_projeto_id: input.projeto_id,
          p_tarefa_id: input.tarefa_id,
          p_categoria: input.categoria,
          p_novo_arquivo_path: path,
          p_nome_arquivo: input.nome_arquivo,
          p_mime: input.mime_type,
          p_size: input.size_bytes,
        },
      );
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success("Documento arquivado no cofre da Tarefa");
      qc.invalidateQueries({ queryKey: ["tarefa-anexos"] });
    },
    onError: (e: any) =>
      toast.error("Erro ao vincular", { description: translateError(e) }),
  });

  return { vincularChina, vincularBriefing, vincularProjeto, vincularTarefa };
}
