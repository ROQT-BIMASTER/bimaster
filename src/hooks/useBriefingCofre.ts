// src/hooks/useBriefingCofre.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Dispara push incremental dos documentos do cofre para a página RR-Tasks da
// agência, se o briefing já tiver sido enviado (rrtask_page_id != null).
// Falhas (incluindo task_not_created) são silenciosas — é um best-effort.
let _rrtaskSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();
async function triggerRRTaskDocsSync(briefingId: string) {
  const existing = _rrtaskSyncTimers.get(briefingId);
  if (existing) clearTimeout(existing);
  const t = setTimeout(async () => {
    _rrtaskSyncTimers.delete(briefingId);
    try {
      const { data: b } = await (supabase as any)
        .from("briefings")
        .select("rrtask_page_id")
        .eq("id", briefingId)
        .maybeSingle();
      if (!b?.rrtask_page_id) return;
      await supabase.functions.invoke("rrtask-sync-documentos", {
        body: { briefing_id: briefingId },
      });
    } catch {
      // silencioso — sync de docs é best-effort
    }
  }, 500);
  _rrtaskSyncTimers.set(briefingId, t);
}


export type BriefingDocStatus = "pendente" | "recebido" | "aprovado" | "rejeitado";

export type DriveSyncStatus = "desabilitado" | "pendente" | "enviado" | "erro";

export interface BriefingDocumento {
  id: string;
  briefing_id: string;
  template_item_id: string | null;
  categoria: string;
  nome: string;
  descricao: string | null;
  status: BriefingDocStatus;
  fornecedor_id: string | null;
  fornecedor_nome: string | null;
  lote: string | null;
  data_entrega: string | null;
  storage_path: string | null;
  mime_type: string | null;
  tamanho_bytes: number | null;
  notion_file_url: string | null;
  notion_page_id: string | null;
  enviado_notion_em: string | null;
  is_oficial: boolean;
  is_checklist_item: boolean;
  origem: "upload" | "chat" | "template" | "evidencia";
  created_by: string;
  created_at: string;
  updated_at: string;
  // Google Drive
  google_drive_file_id?: string | null;
  google_drive_url?: string | null;
  google_drive_folder_id?: string | null;
  enviado_drive_em?: string | null;
  drive_sync_status?: DriveSyncStatus;
  drive_sync_error?: string | null;
}

export interface ChecklistTemplate {
  id: string;
  tipo_briefing: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  itens?: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  template_id: string;
  ordem: number;
  categoria: string;
  nome: string;
  descricao: string | null;
  obrigatorio: boolean;
}

export const CATEGORIA_LABELS: Record<string, string> = {
  geral: "Geral",
  orcamento: "Orçamento",
  nf: "Nota Fiscal",
  art: "ART",
  embalagem: "Embalagem",
  materia_prima: "Matéria-prima",
  evidencia: "Evidência",
  contrato: "Contrato",
  briefing: "Briefing",
};

export const STATUS_LABELS: Record<BriefingDocStatus, string> = {
  pendente: "Pendente",
  recebido: "Recebido",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
};

export function useBriefingDocumentos(briefingId: string | undefined) {
  return useQuery({
    queryKey: ["briefing-documentos", briefingId],
    enabled: !!briefingId,
    queryFn: async (): Promise<BriefingDocumento[]> => {
      const { data, error } = await (supabase as any)
        .from("briefing_documentos")
        .select("*")
        .eq("briefing_id", briefingId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BriefingDocumento[];
    },
  });
}

export function useChecklistTemplates(tipoBriefing: string | undefined) {
  return useQuery({
    queryKey: ["briefing-cofre-templates", tipoBriefing],
    enabled: !!tipoBriefing,
    queryFn: async (): Promise<ChecklistTemplate[]> => {
      const { data, error } = await (supabase as any)
        .from("briefing_doc_checklist_templates")
        .select("*, itens:briefing_doc_checklist_itens(*)")
        .eq("ativo", true)
        .in("tipo_briefing", [tipoBriefing!, "*"])
        .order("nome");
      if (error) throw error;
      return (data ?? []) as ChecklistTemplate[];
    },
  });
}

export function useAplicarTemplate(briefingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Sessão expirada");

      const { data: itens, error } = await (supabase as any)
        .from("briefing_doc_checklist_itens")
        .select("id, categoria, nome, descricao")
        .eq("template_id", templateId)
        .order("ordem");
      if (error) throw error;
      if (!itens?.length) throw new Error("Template sem itens");

      const rows = (itens as any[]).map((it) => ({
        briefing_id: briefingId,
        template_item_id: it.id,
        categoria: it.categoria,
        nome: it.nome,
        descricao: it.descricao,
        status: "pendente" as BriefingDocStatus,
        created_by: uid,
      }));
      const { error: insErr } = await (supabase as any)
        .from("briefing_documentos")
        .insert(rows);
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["briefing-documentos", briefingId] });
      toast.success("Checklist aplicado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAtualizarDocumento(briefingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; patch: Partial<BriefingDocumento> }) => {
      const { error } = await (supabase as any)
        .from("briefing_documentos")
        .update(args.patch)
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["briefing-documentos", briefingId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useExcluirDocumento(briefingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: BriefingDocumento) => {
      if (doc.storage_path) {
        await supabase.storage.from("briefing-cofre").remove([doc.storage_path]);
      }
      const { error } = await (supabase as any)
        .from("briefing_documentos")
        .delete()
        .eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["briefing-documentos", briefingId] });
      toast.success("Documento removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
