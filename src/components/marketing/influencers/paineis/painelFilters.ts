export interface PainelFiltros {
  busca?: string;
  marcas?: string[];
  nichos?: string[];
  plataformas?: string[];
  regioes?: string[];
  ufs?: string[];
  followersMin?: number;
  followersMax?: number;
  engajamentoMin?: number;
  engajamentoMax?: number;
  scoreMin?: number;
  scoreMax?: number;
  fraudMax?: number;
}

export interface FilteredInfluencer {
  username: string;
  display_name: string | null;
  platform: string;
  followers_count: number;
  engagement_rate: number;
  composite_score?: number | null;
  fraud_score?: number | null;
  regiao?: string | null;
  uf?: string | null;
  marca?: string | null;
  nicho?: string | null;
  notes?: string | null;
}

const PAINEL_GERAL_ID = "__geral__";
export const PAINEL_GERAL = PAINEL_GERAL_ID;

export function isPainelGeral(id: string | null | undefined): boolean {
  return !id || id === PAINEL_GERAL_ID;
}

/**
 * Aplica um conjunto de filtros sobre uma lista já carregada de influenciadores.
 * Pura — sem efeitos. Vazio = passa tudo.
 */
export function aplicarFiltrosPainel<T extends FilteredInfluencer>(
  lista: T[],
  filtros: PainelFiltros | null | undefined,
): T[] {
  if (!filtros) return lista;
  const termos = (filtros.busca || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  return lista.filter((i) => {
    if (termos.length > 0) {
      const haystack = [
        i.username,
        i.display_name || "",
        i.notes || "",
        i.marca || "",
        i.nicho || "",
      ]
        .join(" ")
        .toLowerCase();
      const matchAll = termos.every((t) => haystack.includes(t));
      if (!matchAll) return false;
    }

    if (filtros.marcas?.length && !filtros.marcas.includes(i.marca || ""))
      return false;
    if (filtros.nichos?.length && !filtros.nichos.includes(i.nicho || ""))
      return false;
    if (filtros.plataformas?.length && !filtros.plataformas.includes(i.platform))
      return false;
    if (filtros.regioes?.length && !filtros.regioes.includes(i.regiao || ""))
      return false;
    if (filtros.ufs?.length && !filtros.ufs.includes(i.uf || "")) return false;

    if (typeof filtros.followersMin === "number" && i.followers_count < filtros.followersMin)
      return false;
    if (typeof filtros.followersMax === "number" && i.followers_count > filtros.followersMax)
      return false;
    if (typeof filtros.engajamentoMin === "number" && Number(i.engagement_rate) < filtros.engajamentoMin)
      return false;
    if (typeof filtros.engajamentoMax === "number" && Number(i.engagement_rate) > filtros.engajamentoMax)
      return false;
    if (typeof filtros.scoreMin === "number" && (i.composite_score || 0) < filtros.scoreMin)
      return false;
    if (typeof filtros.scoreMax === "number" && (i.composite_score || 0) > filtros.scoreMax)
      return false;
    if (typeof filtros.fraudMax === "number" && (i.fraud_score || 0) > filtros.fraudMax)
      return false;

    return true;
  });
}

export function contarFiltrosAtivos(f: PainelFiltros | null | undefined): number {
  if (!f) return 0;
  let c = 0;
  if (f.busca?.trim()) c++;
  if (f.marcas?.length) c++;
  if (f.nichos?.length) c++;
  if (f.plataformas?.length) c++;
  if (f.regioes?.length) c++;
  if (f.ufs?.length) c++;
  if (typeof f.followersMin === "number" || typeof f.followersMax === "number") c++;
  if (typeof f.engajamentoMin === "number" || typeof f.engajamentoMax === "number") c++;
  if (typeof f.scoreMin === "number" || typeof f.scoreMax === "number") c++;
  if (typeof f.fraudMax === "number") c++;
  return c;
}
