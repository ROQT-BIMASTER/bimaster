/**
 * useMergedChinaChecklist
 * ------------------------------------------------------------------
 * Hook único que devolve o checklist EFETIVO de uma submissão China,
 * já consolidando:
 *   - Categorias e itens padrão (CHINA_DOCUMENT_TYPES + DOCUMENT_CATEGORIES)
 *   - Categorias custom criadas para a submissão (china_checklist_custom_categorias)
 *   - Itens custom (china_checklist_custom_itens)
 *   - Itens/categorias ocultos (china_checklist_itens_ocultos — chave "tipo_key" ou "cat:KEY")
 *   - Overrides de label de categoria padrão (china_checklist_cat_overrides)
 *
 * Esse mesmo merge é usado pelo Modo Foco; este hook permite que TODOS
 * os ambientes do sistema (resumo da ficha, painel de aprovação,
 * pasta digital, cofre, sidepanels) reflitam a mesma estrutura.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createElement } from "react";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  CHINA_DOCUMENT_TYPES,
  DOCUMENT_CATEGORIES,
} from "@/lib/china-document-types";
import type { DocumentSlotConfig } from "@/components/china/ChinaDocumentSlot";

export interface MergedChecklistCategory {
  key: string;
  labelPt: string;
  labelCn: string;
  labelEn?: string;
  tipos: string[];
  fluxo: "china_envia" | "brasil_envia";
  isCustom: boolean;
  customId?: string;
}

export type MergedChecklistDocType = DocumentSlotConfig & { isCustom?: boolean };

export interface MergedChinaChecklist {
  categories: MergedChecklistCategory[];
  categoriesChinaEnvia: MergedChecklistCategory[];
  categoriesBrasilEnvia: MergedChecklistCategory[];
  docTypes: MergedChecklistDocType[];
  hiddenSet: Set<string>;
  isLoading: boolean;
  /** Devolve a configuração completa de um tipo (custom ou padrão). */
  getDocType: (tipo: string) => MergedChecklistDocType | undefined;
}

const EMPTY: MergedChinaChecklist = {
  categories: DOCUMENT_CATEGORIES.map((c) => ({ ...c, isCustom: false })),
  categoriesChinaEnvia: DOCUMENT_CATEGORIES.filter((c) => c.fluxo === "china_envia").map(
    (c) => ({ ...c, isCustom: false }),
  ),
  categoriesBrasilEnvia: DOCUMENT_CATEGORIES.filter((c) => c.fluxo === "brasil_envia").map(
    (c) => ({ ...c, isCustom: false }),
  ),
  docTypes: CHINA_DOCUMENT_TYPES.map((d) => ({ ...d, isCustom: false })),
  hiddenSet: new Set<string>(),
  isLoading: false,
  getDocType: (tipo) => CHINA_DOCUMENT_TYPES.find((d) => d.tipo === tipo),
};

export function useMergedChinaChecklist(
  submissaoId: string | null | undefined,
): MergedChinaChecklist {
  const enabled = !!submissaoId;

  const customCats = useQuery({
    queryKey: ["checklist-custom-cats", submissaoId],
    enabled,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("china_checklist_custom_categorias")
        .select("*")
        .eq("submissao_id", submissaoId)
        .order("ordem");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const customItems = useQuery({
    queryKey: ["checklist-custom-items", submissaoId],
    enabled,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("china_checklist_custom_itens")
        .select("*")
        .eq("submissao_id", submissaoId)
        .order("created_at");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const hidden = useQuery({
    queryKey: ["checklist-hidden-items", submissaoId],
    enabled,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("china_checklist_itens_ocultos")
        .select("tipo_key")
        .eq("submissao_id", submissaoId);
      if (error) throw error;
      return (data || []) as { tipo_key: string }[];
    },
  });

  const overrides = useQuery({
    queryKey: ["china-cat-overrides", submissaoId],
    enabled,
      queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("china_checklist_cat_overrides")
        .select("categoria_key,label_pt,label_cn,label_en")
        .eq("submissao_id", submissaoId);
      if (error) throw error;
      return (data || []) as { categoria_key: string; label_pt: string; label_cn: string; label_en?: string }[];
    },
  });

  return useMemo<MergedChinaChecklist>(() => {
    if (!enabled) return EMPTY;

    const cCats = customCats.data || [];
    const cItens = customItems.data || [];
    const hiddenSet = new Set<string>((hidden.data || []).map((h) => h.tipo_key));
    const overrideMap = new Map(
      (overrides.data || []).map((o) => [o.categoria_key, o] as const),
    );

    const docTypes: MergedChecklistDocType[] = [
      ...CHINA_DOCUMENT_TYPES.map((d) => ({ ...d, isCustom: false })),
      ...cItens.map((i: any) => ({
        tipo: i.tipo_key,
        labelPt: i.label_pt,
        labelCn: i.label_cn || "",
        icon: createElement(FileText, { className: "h-5 w-5 text-muted-foreground" }),
        accept: i.accept || undefined,
        multiple: i.multiple || false,
        isCustom: true,
      })),
    ];

    const defaultMerged: MergedChecklistCategory[] = DOCUMENT_CATEGORIES.map((cat) => {
      const ov = overrideMap.get(cat.key);
      const extras = cItens
        .filter((i: any) => i.categoria_default_key === cat.key && !i.categoria_custom_id)
        .map((i: any) => i.tipo_key);
      return {
        key: cat.key,
        labelPt: ov?.label_pt || cat.labelPt,
        labelCn: ov?.label_cn ?? cat.labelCn,
        tipos: [...cat.tipos, ...extras],
        fluxo: cat.fluxo,
        isCustom: false,
      };
    });

    const customMerged: MergedChecklistCategory[] = cCats.map((c: any) => ({
      key: `custom_${c.id}`,
      labelPt: c.label_pt,
      labelCn: c.label_cn || "",
      tipos: cItens
        .filter((i: any) => i.categoria_custom_id === c.id)
        .map((i: any) => i.tipo_key),
      fluxo: c.fluxo as "china_envia" | "brasil_envia",
      isCustom: true,
      customId: c.id,
    }));

    const all = [...defaultMerged, ...customMerged];
    const visible = all.filter((c) => !hiddenSet.has(`cat:${c.key}`));
    const visibleWithFilteredTipos = visible.map((c) => ({
      ...c,
      tipos: c.tipos.filter((t) => !hiddenSet.has(t)),
    }));

    return {
      categories: visibleWithFilteredTipos,
      categoriesChinaEnvia: visibleWithFilteredTipos.filter((c) => c.fluxo === "china_envia"),
      categoriesBrasilEnvia: visibleWithFilteredTipos.filter((c) => c.fluxo === "brasil_envia"),
      docTypes,
      hiddenSet,
      isLoading:
        customCats.isLoading ||
        customItems.isLoading ||
        hidden.isLoading ||
        overrides.isLoading,
      getDocType: (tipo: string) => docTypes.find((d) => d.tipo === tipo),
    };
  }, [
    enabled,
    customCats.data,
    customItems.data,
    hidden.data,
    overrides.data,
    customCats.isLoading,
    customItems.isLoading,
    hidden.isLoading,
    overrides.isLoading,
  ]);
}
