import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ChecklistB2CItem {
  id: string;
  submissao_id: string;
  template_id: string | null;
  categoria: string;
  nome_documento: string;
  descricao: string | null;
  obrigatorio: boolean;
  sla_dias: number | null;
  status:
    | "pendente"
    | "em_preparacao"
    | "enviado_china"
    | "recebido_china"
    | "aprovado_china"
    | "devolvido_china"
    | "arquivado";
  arquivo_path: string | null;
  arquivo_nome: string | null;
  arquivo_tamanho_bytes: number | null;
  motivo_devolucao: string | null;
  responsavel_brasil_id: string | null;
  projeto_tarefa_id: string | null;
  enviado_em: string | null;
  recebido_em: string | null;
  respondido_em: string | null;
  respondido_por: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Lista o checklist Brasil → China de uma submissão. */
export function useChecklistB2C(submissaoId: string | null | undefined) {
  return useQuery({
    queryKey: ["china-checklist-b2c", submissaoId],
    enabled: !!submissaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_checklist_brasil_china" as any)
        .select("*")
        .eq("submissao_id", submissaoId!)
        .order("categoria", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ChecklistB2CItem[];
    },
  });
}

/** Templates disponíveis para popular o checklist B→C. */
export function useTemplatesB2C() {
  return useQuery({
    queryKey: ["china-checklist-b2c-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_checklist_brasil_china_templates" as any)
        .select("id, nome, descricao, itens, ativo")
        .eq("ativo", true)
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        id: string;
        nome: string;
        descricao: string | null;
        itens: any[];
        ativo: boolean;
      }>;
    },
  });
}

/** Cria um novo item B→C manualmente (sem template). */
export function useCriarItemB2C() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      submissaoId: string;
      categoria: string;
      nomeDocumento: string;
      descricao?: string;
      obrigatorio?: boolean;
      slaDias?: number | null;
      responsavelBrasilId?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("china_checklist_brasil_china" as any)
        .insert({
          submissao_id: args.submissaoId,
          categoria: args.categoria,
          nome_documento: args.nomeDocumento,
          descricao: args.descricao ?? null,
          obrigatorio: args.obrigatorio ?? true,
          sla_dias: args.slaDias ?? null,
          responsavel_brasil_id: args.responsavelBrasilId ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ChecklistB2CItem;
    },
    onSuccess: (row) => {
      toast.success("Item adicionado");
      qc.invalidateQueries({ queryKey: ["china-checklist-b2c", row.submissao_id] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao adicionar item"),
  });
}

/** Faz upload do arquivo + grava arquivo_path no item B→C. */
export function useUploadArquivoB2C() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { item: ChecklistB2CItem; file: File }) => {
      const sessionRes = await supabase.auth.getUser();
      const uid = sessionRes.data.user?.id;
      if (!uid) throw new Error("Sessão expirada");

      // path: <uid>/b2c/<submissao>/<item>/<timestamp>-<filename>
      const safeName = args.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${uid}/b2c/${args.item.submissao_id}/${args.item.id}/${Date.now()}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from("china-documentos")
        .upload(path, args.file, { upsert: false });
      if (upErr) throw upErr;

      const { data, error } = await supabase
        .from("china_checklist_brasil_china" as any)
        .update({
          arquivo_path: path,
          arquivo_nome: args.file.name,
          arquivo_tamanho_bytes: args.file.size,
          status: args.item.status === "pendente" ? "em_preparacao" : args.item.status,
        })
        .eq("id", args.item.id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ChecklistB2CItem;
    },
    onSuccess: async (row) => {
      toast.success(
        row.projeto_tarefa_id ? "Arquivo anexado · tarefa atualizada no projeto" : "Arquivo anexado"
      );
      qc.invalidateQueries({ queryKey: ["china-checklist-b2c", row.submissao_id] });
      qc.invalidateQueries({ queryKey: ["projeto-tarefas"] });
      qc.invalidateQueries({ queryKey: ["projeto-secoes"] });

      // Notificação por email ao responsável Brasil (best-effort, não bloqueia UI)
      try {
        if (!row.projeto_tarefa_id || !row.responsavel_brasil_id) return;

        const [{ data: prof }, { data: sub }, { data: tarefa }] = await Promise.all([
          supabase
            .from("profiles")
            .select("email, nome")
            .eq("id", row.responsavel_brasil_id)
            .maybeSingle(),
          supabase
            .from("china_produto_submissoes" as any)
            .select("codigo, produto_nome")
            .eq("id", row.submissao_id)
            .maybeSingle(),
          supabase
            .from("projeto_tarefas" as any)
            .select("projeto_id, data_prazo")
            .eq("id", row.projeto_tarefa_id)
            .maybeSingle(),
        ]);

        const email = (prof as any)?.email as string | undefined;
        if (!email) return;

        const projetoId = (tarefa as any)?.projeto_id as string | undefined;
        const tarefaUrl = projetoId
          ? `${window.location.origin}/projetos/${projetoId}?tarefa=${row.projeto_tarefa_id}`
          : undefined;

        const prazoIso = (tarefa as any)?.data_prazo as string | undefined;
        const prazo = prazoIso
          ? new Date(prazoIso + "T00:00:00").toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
          : undefined;

        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "b2c-tarefa-criada",
            recipientEmail: email,
            idempotencyKey: `b2c-tarefa-${row.projeto_tarefa_id}-${row.id}`,
            templateData: {
              responsavelNome: (prof as any)?.nome ?? null,
              documentoNome: row.nome_documento,
              categoria: row.categoria,
              submissaoCodigo: (sub as any)?.codigo ?? null,
              produtoNome: (sub as any)?.produto_nome ?? null,
              prazo,
              tarefaUrl,
            },
          },
        });
      } catch (err) {
        console.warn("[b2c] falha ao enviar notificação por email:", err);
      }
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao anexar"),
  });
}


/** Brasil → China: marca como enviado. */
export function useEnviarDocB2C() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await supabase.rpc("rpc_china_enviar_doc_b2c" as any, {
        p_item_id: itemId,
      });
      if (error) throw error;
      return data as unknown as ChecklistB2CItem;
    },
    onSuccess: (row) => {
      toast.success("Enviado à China");
      qc.invalidateQueries({ queryKey: ["china-checklist-b2c", row.submissao_id] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao enviar"),
  });
}

/** Resposta da China: aprovar ou devolver com motivo. */
export function useResponderDocB2C() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { itemId: string; decisao: "aprovado" | "devolvido"; motivo?: string }) => {
      const { data, error } = await supabase.rpc("rpc_china_responder_doc_b2c" as any, {
        p_item_id: args.itemId,
        p_decisao: args.decisao,
        p_motivo: args.motivo ?? null,
      });
      if (error) throw error;
      return data as unknown as ChecklistB2CItem;
    },
    onSuccess: (row, args) => {
      toast.success(args.decisao === "aprovado" ? "Documento aprovado" : "Documento devolvido");
      qc.invalidateQueries({ queryKey: ["china-checklist-b2c", row.submissao_id] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao responder"),
  });
}
