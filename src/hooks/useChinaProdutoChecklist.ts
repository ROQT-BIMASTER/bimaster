import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ChecklistColuna {
  key: string;
  label_pt: string;
  label_cn: string;
  ordem: number;
}

export interface ChecklistCelula {
  id: string;
  checklist_id: string;
  cor_id: string;
  coluna_key: string;
  marcado: boolean;
  mockup_path: string | null;
}

export interface Checklist {
  id: string;
  submissao_id: string;
  colunas: ChecklistColuna[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistTemplate {
  id: string;
  marca: string | null;
  nome: string;
  colunas: ChecklistColuna[];
  created_by: string | null;
  created_at: string;
}

export const COLUNAS_PADRAO: ChecklistColuna[] = [
  { key: "embalagem_primaria", label_pt: "Embalagem primária", label_cn: "主包装", ordem: 0 },
  { key: "sleeve_lacre", label_pt: "Sleeve / Lacre", label_cn: "收缩膜/封口", ordem: 1 },
  { key: "cartucho", label_pt: "Cartucho", label_cn: "纸盒", ordem: 2 },
  { key: "vacuum_forming", label_pt: "Vacuum Forming", label_cn: "真空吸塑", ordem: 3 },
  { key: "display_inner", label_pt: "Display / Inner", label_cn: "内盒", ordem: 4 },
  { key: "etiqueta_bula", label_pt: "Etiqueta bula", label_cn: "说明书贴纸", ordem: 5 },
  { key: "etiqueta_fundo", label_pt: "Etiqueta de fundo", label_cn: "底部贴纸", ordem: 6 },
  { key: "etiqueta_provador", label_pt: "Etiqueta provador", label_cn: "测试装贴纸", ordem: 7 },
  { key: "embalagem_provador", label_pt: "Embalagem provador", label_cn: "测试装包装", ordem: 8 },
];

export function useChinaProdutoChecklist(submissaoId: string | undefined) {
  return useQuery({
    queryKey: ["china-checklist", submissaoId],
    enabled: !!submissaoId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("china_produto_checklist")
        .select("*")
        .eq("submissao_id", submissaoId)
        .maybeSingle();
      if (error) throw error;
      return data as Checklist | null;
    },
  });
}

export function useChinaChecklistCelulas(checklistId: string | undefined) {
  return useQuery({
    queryKey: ["china-checklist-celulas", checklistId],
    enabled: !!checklistId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("china_produto_checklist_celulas")
        .select("*")
        .eq("checklist_id", checklistId);
      if (error) throw error;
      return (data || []) as ChecklistCelula[];
    },
  });
}

export function useEnsureChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (submissaoId: string): Promise<Checklist> => {
      const { data: existing } = await (supabase as any)
        .from("china_produto_checklist")
        .select("*")
        .eq("submissao_id", submissaoId)
        .maybeSingle();
      if (existing) return existing as Checklist;
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any)
        .from("china_produto_checklist")
        .insert({
          submissao_id: submissaoId,
          colunas: COLUNAS_PADRAO,
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Checklist;
    },
    onSuccess: (_data, submissaoId) => {
      qc.invalidateQueries({ queryKey: ["china-checklist", submissaoId] });
    },
  });
}

export function useUpdateChecklistColunas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { checklistId: string; colunas: ChecklistColuna[] }) => {
      const { error } = await (supabase as any)
        .from("china_produto_checklist")
        .update({ colunas: params.colunas })
        .eq("id", params.checklistId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["china-checklist"] });
    },
  });
}

export function useUpsertCelula() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      checklistId: string;
      corId: string;
      colunaKey: string;
      marcado?: boolean;
      mockupPath?: string | null;
    }) => {
      const payload: any = {
        checklist_id: params.checklistId,
        cor_id: params.corId,
        coluna_key: params.colunaKey,
      };
      if (params.marcado !== undefined) payload.marcado = params.marcado;
      if (params.mockupPath !== undefined) payload.mockup_path = params.mockupPath;
      const { error } = await (supabase as any)
        .from("china_produto_checklist_celulas")
        .upsert(payload, { onConflict: "checklist_id,cor_id,coluna_key" });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["china-checklist-celulas", vars.checklistId] });
    },
  });
}

export function useChecklistTemplates(marca: string | null | undefined) {
  return useQuery({
    queryKey: ["china-checklist-templates", marca || "_all"],
    queryFn: async () => {
      let q = (supabase as any).from("china_checklist_templates").select("*").order("created_at", { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      const all = (data || []) as ChecklistTemplate[];
      if (!marca) return all;
      // Show templates of same marca first, then global ones
      return all.sort((a, b) => {
        const am = a.marca === marca ? 0 : a.marca == null ? 1 : 2;
        const bm = b.marca === marca ? 0 : b.marca == null ? 1 : 2;
        return am - bm;
      });
    },
  });
}

export function useSaveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { nome: string; marca: string | null; colunas: ChecklistColuna[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("china_checklist_templates")
        .insert({
          nome: params.nome,
          marca: params.marca,
          colunas: params.colunas,
          created_by: user?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["china-checklist-templates"] });
      toast.success("Template salvo 模板已保存");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar template"),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("china_checklist_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["china-checklist-templates"] });
      toast.success("Template removido");
    },
  });
}
