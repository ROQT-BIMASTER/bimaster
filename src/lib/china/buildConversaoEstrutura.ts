/**
 * Carrega o checklist mergeado da submissão China e devolve a estrutura
 * hierárquica (categoria → itens) usada pela RPC
 * `rpc_china_criar_projeto_espelho` (parâmetro `p_estrutura`).
 *
 * Espelha exatamente a lógica do hook `useMergedChinaChecklist`, mas em
 * modo imperativo (sem React Query) para ser invocável por serviços.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  CHINA_DOCUMENT_TYPES,
  DOCUMENT_CATEGORIES,
} from "@/lib/china-document-types";

export interface ProjetoConversaoTipo {
  tipo_key: string;
  label: string;
  ordem: number;
}

export interface ProjetoConversaoEstruturaCategoria {
  categoria_key: string;
  categoria_label: string;
  ordem: number;
  tipos: ProjetoConversaoTipo[];
}

export async function loadConversaoEstrutura(
  submissaoId: string,
): Promise<ProjetoConversaoEstruturaCategoria[]> {
  if (!submissaoId) return [];

  const [customCatsRes, customItensRes, hiddenRes, overridesRes] = await Promise.all([
    (supabase as any)
      .from("china_checklist_custom_categorias")
      .select("*")
      .eq("submissao_id", submissaoId)
      .order("ordem"),
    (supabase as any)
      .from("china_checklist_custom_itens")
      .select("*")
      .eq("submissao_id", submissaoId)
      .order("created_at"),
    (supabase as any)
      .from("china_checklist_itens_ocultos")
      .select("tipo_key")
      .eq("submissao_id", submissaoId),
    (supabase as any)
      .from("china_checklist_cat_overrides")
      .select("categoria_key,label_pt,label_cn,label_en")
      .eq("submissao_id", submissaoId),
  ]);

  const customCats = (customCatsRes.data ?? []) as any[];
  const customItens = (customItensRes.data ?? []) as any[];
  const hiddenSet = new Set<string>(
    ((hiddenRes.data ?? []) as { tipo_key: string }[]).map((h) => h.tipo_key),
  );
  const overrideMap = new Map<string, { label_pt: string }>(
    ((overridesRes.data ?? []) as { categoria_key: string; label_pt: string }[]).map(
      (o) => [o.categoria_key, o] as const,
    ),
  );

  const labelForTipo = (tipoKey: string): string => {
    const custom = customItens.find((i) => i.tipo_key === tipoKey);
    if (custom) return custom.label_pt || tipoKey;
    const def = CHINA_DOCUMENT_TYPES.find((d) => d.tipo === tipoKey);
    return def?.labelPt || tipoKey;
  };

  const out: ProjetoConversaoEstruturaCategoria[] = [];
  let ordemCat = 0;

  // Categorias padrão (com overrides e extras custom)
  for (const cat of DOCUMENT_CATEGORIES) {
    if (hiddenSet.has(`cat:${cat.key}`)) continue;

    const extras = customItens
      .filter((i) => i.categoria_default_key === cat.key && !i.categoria_custom_id)
      .map((i) => i.tipo_key as string);

    const tipos = [...cat.tipos, ...extras]
      .filter((t) => !hiddenSet.has(t))
      .map<ProjetoConversaoTipo>((tipoKey, idx) => ({
        tipo_key: tipoKey,
        label: labelForTipo(tipoKey),
        ordem: idx + 1,
      }));

    if (tipos.length === 0) continue;

    ordemCat += 1;
    out.push({
      categoria_key: cat.key,
      categoria_label: overrideMap.get(cat.key)?.label_pt || cat.labelPt,
      ordem: ordemCat,
      tipos,
    });
  }

  // Categorias custom
  for (const c of customCats) {
    const catKey = `custom_${c.id}`;
    if (hiddenSet.has(`cat:${catKey}`)) continue;

    const tipos = customItens
      .filter((i) => i.categoria_custom_id === c.id)
      .map((i) => i.tipo_key as string)
      .filter((t) => !hiddenSet.has(t))
      .map<ProjetoConversaoTipo>((tipoKey, idx) => ({
        tipo_key: tipoKey,
        label: labelForTipo(tipoKey),
        ordem: idx + 1,
      }));

    if (tipos.length === 0) continue;

    ordemCat += 1;
    out.push({
      categoria_key: catKey,
      categoria_label: c.label_pt || "Categoria",
      ordem: ordemCat,
      tipos,
    });
  }

  return out;
}
