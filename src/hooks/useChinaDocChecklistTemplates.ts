import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DocChecklistTemplate {
  id: string;
  nome: string;
  descricao: string | null;
  escopo: "pessoal" | "global";
  estrutura: TemplateEstrutura;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateCategoria {
  /** key original (ex.: dados_oficiais) ou gerado para custom */
  key: string;
  label_pt: string;
  label_cn: string;
  fluxo: "china_envia" | "brasil_envia";
  ordem: number;
  /** se true, esta categoria é nova (não existia nas defaults) */
  custom: boolean;
}

export interface TemplateItem {
  tipo_key: string;
  label_pt: string;
  label_cn: string;
  categoria_key: string;
  /** se true, item é custom; se false, é item padrão e só serve para indicar visibilidade */
  custom: boolean;
  accept?: string | null;
  multiple?: boolean;
}

export interface TemplateEstrutura {
  categorias: TemplateCategoria[];
  itens: TemplateItem[];
  /** chaves de itens/categorias padrão a esconder neste template (cat:KEY ou tipo_KEY) */
  ocultos: string[];
  /** overrides de label de categorias padrão */
  overrides_categoria: { categoria_key: string; label_pt: string; label_cn: string }[];
}

export function useDocChecklistTemplates() {
  return useQuery({
    queryKey: ["china-doc-checklist-templates"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("china_doc_checklist_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as DocChecklistTemplate[];
    },
  });
}

export function useSaveDocChecklistTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      nome: string;
      descricao?: string;
      escopo: "pessoal" | "global";
      estrutura: TemplateEstrutura;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("china_doc_checklist_templates")
        .insert({
          nome: params.nome,
          descricao: params.descricao || null,
          escopo: params.escopo,
          estrutura: params.estrutura,
          created_by: user?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["china-doc-checklist-templates"] });
      toast.success("Modelo de checklist salvo");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar modelo"),
  });
}

export function useDeleteDocChecklistTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("china_doc_checklist_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["china-doc-checklist-templates"] });
      toast.success("Modelo removido");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao remover modelo"),
  });
}

/**
 * Aplica um template a uma submissão: cria categorias custom, itens custom e
 * registra ocultos + overrides. Não apaga conteúdo já enviado.
 */
export async function aplicarTemplateNaSubmissao(
  submissaoId: string,
  estrutura: TemplateEstrutura,
) {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  // 1) Criar categorias custom
  const customCats = estrutura.categorias.filter((c) => c.custom);
  const catKeyMap = new Map<string, string>(); // template key -> novo customId

  for (const cat of customCats) {
    const { data, error } = await (supabase as any)
      .from("china_checklist_custom_categorias")
      .insert({
        submissao_id: submissaoId,
        label_pt: cat.label_pt,
        label_cn: cat.label_cn,
        fluxo: cat.fluxo,
        ordem: cat.ordem,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    catKeyMap.set(cat.key, data.id);
  }

  // 2) Criar itens custom
  const customItens = estrutura.itens.filter((i) => i.custom);
  for (const item of customItens) {
    const targetCat = estrutura.categorias.find((c) => c.key === item.categoria_key);
    const isCustomCat = targetCat?.custom ?? false;
    const novoTipoKey = `custom_${Date.now()}_${item.label_pt
      .toLowerCase()
      .replace(/\s+/g, "_")
      .substring(0, 30)}`;

    const { error } = await (supabase as any)
      .from("china_checklist_custom_itens")
      .insert({
        submissao_id: submissaoId,
        categoria_custom_id: isCustomCat ? catKeyMap.get(item.categoria_key) || null : null,
        categoria_default_key: isCustomCat ? null : item.categoria_key,
        tipo_key: novoTipoKey,
        label_pt: item.label_pt,
        label_cn: item.label_cn,
        accept: item.accept || "image/*,.pdf",
        multiple: item.multiple ?? true,
        created_by: userId,
      });
    if (error) throw error;
  }

  // 3) Ocultos
  if (estrutura.ocultos?.length) {
    const rows = estrutura.ocultos.map((k) => ({
      submissao_id: submissaoId,
      tipo_key: k,
      hidden_by: userId,
    }));
    // ignora conflitos
    await (supabase as any)
      .from("china_checklist_itens_ocultos")
      .upsert(rows, { onConflict: "submissao_id,tipo_key", ignoreDuplicates: true });
  }

  // 4) Overrides de categoria
  if (estrutura.overrides_categoria?.length) {
    const rows = estrutura.overrides_categoria.map((o) => ({
      submissao_id: submissaoId,
      categoria_key: o.categoria_key,
      label_pt: o.label_pt,
      label_cn: o.label_cn,
      created_by: userId,
    }));
    await (supabase as any)
      .from("china_checklist_cat_overrides")
      .upsert(rows, { onConflict: "submissao_id,categoria_key" });
  }
}

export function useCategoriaOverrides(submissaoId: string | undefined) {
  return useQuery({
    queryKey: ["china-cat-overrides", submissaoId],
    enabled: !!submissaoId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("china_checklist_cat_overrides")
        .select("*")
        .eq("submissao_id", submissaoId);
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        categoria_key: string;
        label_pt: string;
        label_cn: string;
      }>;
    },
  });
}

export function useUpsertCategoriaOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      submissaoId: string;
      categoriaKey: string;
      labelPt: string;
      labelCn: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("china_checklist_cat_overrides")
        .upsert(
          {
            submissao_id: params.submissaoId,
            categoria_key: params.categoriaKey,
            label_pt: params.labelPt,
            label_cn: params.labelCn,
            created_by: user?.id,
          },
          { onConflict: "submissao_id,categoria_key" },
        );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["china-cat-overrides", vars.submissaoId] });
      toast.success("Categoria atualizada");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao atualizar categoria"),
  });
}
