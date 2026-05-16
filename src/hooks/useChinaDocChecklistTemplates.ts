import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CHINA_DOCUMENT_TYPES, DOCUMENT_CATEGORIES } from "@/lib/china-document-types";

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
  label_en?: string;
  fluxo: "china_envia" | "brasil_envia";
  ordem: number;
  /** se true, esta categoria é nova (não existia nas defaults) */
  custom: boolean;
}

export interface TemplateItem {
  tipo_key: string;
  label_pt: string;
  label_cn: string;
  label_en?: string;
  categoria_key: string;
  /** se true, item é custom; se false, é item padrão e só serve para indicar visibilidade */
  custom: boolean;
  accept?: string | null;
  multiple?: boolean;
  /** governança opcional capturada no momento do salvamento do modelo */
  peso_percentual?: number;
  obrigatorio?: boolean;
  /** dias relativos à data de aplicação do template */
  prazo_dias?: number | null;
}

export interface TemplateEstrutura {
  categorias: TemplateCategoria[];
  itens: TemplateItem[];
  /** chaves de itens/categorias padrão a esconder neste template (cat:KEY ou tipo_KEY) */
  ocultos: string[];
  /** overrides de label de categorias padrão */
  overrides_categoria: { categoria_key: string; label_pt: string; label_cn: string; label_en?: string }[];
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
 * Aplica um template a uma submissão: SUBSTITUI a estrutura existente.
 * Preserva apenas categorias/itens custom que já possuem documentos
 * anexados (ex.: a planilha inicial de cadastro). Nunca apaga arquivos.
 */
export async function aplicarTemplateNaSubmissao(
  submissaoId: string,
  estrutura: TemplateEstrutura,
) {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  // 0) Reset com preservação por documento
  // 0.a) Tipos com documento anexado (qualquer status != planejado)
  const { data: docs } = await (supabase as any)
    .from("china_produto_documentos")
    .select("tipo_documento,status")
    .eq("submissao_id", submissaoId);
  const tiposComDoc = new Set<string>(
    ((docs || []) as any[])
      .filter((d) => d.status !== "planejado")
      .map((d) => d.tipo_documento),
  );

  // 0.b) Itens custom atuais — apaga os que NÃO têm documento
  const { data: itensAtuais } = await (supabase as any)
    .from("china_checklist_custom_itens")
    .select("id,tipo_key,categoria_custom_id")
    .eq("submissao_id", submissaoId);
  const itensRemover = ((itensAtuais || []) as any[])
    .filter((i) => !tiposComDoc.has(i.tipo_key));
  if (itensRemover.length > 0) {
    await (supabase as any)
      .from("china_checklist_custom_itens")
      .delete()
      .in("id", itensRemover.map((i) => i.id));
  }
  const itensPreservados = ((itensAtuais || []) as any[])
    .filter((i) => tiposComDoc.has(i.tipo_key));
  const catCustomIdsPreservadas = new Set<string>(
    itensPreservados.map((i) => i.categoria_custom_id).filter(Boolean),
  );

  // 0.c) Categorias custom sem itens preservados → apaga
  const { data: catsAtuais } = await (supabase as any)
    .from("china_checklist_custom_categorias")
    .select("id,label_pt,fluxo")
    .eq("submissao_id", submissaoId);
  const catsRemover = ((catsAtuais || []) as any[])
    .filter((c) => !catCustomIdsPreservadas.has(c.id));
  if (catsRemover.length > 0) {
    await (supabase as any)
      .from("china_checklist_custom_categorias")
      .delete()
      .in("id", catsRemover.map((c) => c.id));
  }

  // 0.d) Limpa ocultos e overrides (serão reaplicados pelo template)
  await (supabase as any)
    .from("china_checklist_itens_ocultos")
    .delete()
    .eq("submissao_id", submissaoId);
  await (supabase as any)
    .from("china_checklist_cat_overrides")
    .delete()
    .eq("submissao_id", submissaoId);

  // Set de label+fluxo das categorias preservadas (dedup ao aplicar template)
  const catsPreservadasKey = new Set<string>(
    ((catsAtuais || []) as any[])
      .filter((c) => catCustomIdsPreservadas.has(c.id))
      .map((c) => `${c.fluxo}|${c.label_pt.trim().toLowerCase()}`),
  );
  const tiposPreservados = new Set<string>(itensPreservados.map((i) => i.tipo_key));

  // 1) Criar categorias custom (pulando duplicatas com preservadas)
  const customCats = estrutura.categorias.filter((c) => c.custom);
  const catKeyMap = new Map<string, string>(); // template key -> novo customId

  for (const cat of customCats) {
    const dedupKey = `${cat.fluxo}|${cat.label_pt.trim().toLowerCase()}`;
    if (catsPreservadasKey.has(dedupKey)) {
      // já existe categoria preservada equivalente — reaproveita o id
      const preservada = ((catsAtuais || []) as any[]).find(
        (c) =>
          catCustomIdsPreservadas.has(c.id) &&
          c.fluxo === cat.fluxo &&
          c.label_pt.trim().toLowerCase() === cat.label_pt.trim().toLowerCase(),
      );
      if (preservada) {
        catKeyMap.set(cat.key, preservada.id);
        continue;
      }
    }
    const { data, error } = await (supabase as any)
      .from("china_checklist_custom_categorias")
      .insert({
        submissao_id: submissaoId,
        label_pt: cat.label_pt,
        label_cn: cat.label_cn,
        label_en: cat.label_en || cat.label_pt,
        fluxo: cat.fluxo,
        ordem: cat.ordem,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    catKeyMap.set(cat.key, data.id);
  }

  // 2) Criar itens custom (pulando duplicatas por label dentro da categoria preservada)
  // Mapa template.tipo_key -> tipo_key efetivo no banco (necessário para reconciliar
  // pesos depois, já que itens custom recebem chaves novas a cada aplicação).
  const tipoKeyMap = new Map<string, string>();
  const customItens = estrutura.itens.filter((i) => i.custom);
  for (const item of customItens) {
    const targetCat = estrutura.categorias.find((c) => c.key === item.categoria_key);
    const isCustomCat = targetCat?.custom ?? false;
    const catCustomId = isCustomCat ? catKeyMap.get(item.categoria_key) || null : null;

    // Se a categoria-alvo é uma preservada, evita recriar item com mesmo label
    if (catCustomId) {
      const jaExiste = itensPreservados.some(
        (p) => p.categoria_custom_id === catCustomId,
      );
      if (jaExiste) {
        // checa por label
        const { data: existentes } = await (supabase as any)
          .from("china_checklist_custom_itens")
          .select("id,tipo_key,label_pt")
          .eq("submissao_id", submissaoId)
          .eq("categoria_custom_id", catCustomId);
        const dup = ((existentes || []) as any[]).find(
          (e) => e.label_pt.trim().toLowerCase() === item.label_pt.trim().toLowerCase(),
        );
        if (dup) {
          tipoKeyMap.set(item.tipo_key, dup.tipo_key);
          continue;
        }
      }
    }

    const novoTipoKey = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${item.label_pt
      .toLowerCase()
      .replace(/\s+/g, "_")
      .substring(0, 24)}`;

    const { error } = await (supabase as any)
      .from("china_checklist_custom_itens")
      .insert({
        submissao_id: submissaoId,
        categoria_custom_id: catCustomId,
        categoria_default_key: isCustomCat ? null : item.categoria_key,
        tipo_key: novoTipoKey,
        label_pt: item.label_pt,
        label_cn: item.label_cn,
        label_en: item.label_en || item.label_pt,
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
      label_en: o.label_en || o.label_pt,
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
        label_en?: string;
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
      labelEn?: string;
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
            label_en: params.labelEn || params.labelPt,
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
