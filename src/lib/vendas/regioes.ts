import type { UfYoyRow } from "@/hooks/vendas/useVendasUfYoy";

export type Regiao =
  | "Sudeste"
  | "Sul"
  | "Nordeste"
  | "Centro-Oeste"
  | "Norte"
  | "Não informado";

export const UF_REGIAO: Record<string, Regiao> = {
  AC: "Norte", AP: "Norte", AM: "Norte", PA: "Norte", RO: "Norte", RR: "Norte", TO: "Norte",
  AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste",
  PE: "Nordeste", PI: "Nordeste", RN: "Nordeste", SE: "Nordeste",
  DF: "Centro-Oeste", GO: "Centro-Oeste", MT: "Centro-Oeste", MS: "Centro-Oeste",
  ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
  PR: "Sul", RS: "Sul", SC: "Sul",
};

export function regiaoDeUf(uf: string | null | undefined): Regiao {
  if (!uf) return "Não informado";
  const key = uf.trim().toUpperCase();
  if (!key || key === "—" || key === "-") return "Não informado";
  return UF_REGIAO[key] ?? "Não informado";
}

export interface GrupoRegiao {
  regiao: Regiao;
  total_atual: number;
  total_anterior: number;
  variacao: number | null;
  rows: UfYoyRow[];
}

/** Agrupa por região e ordena por faturamento total desc. */
export function agruparPorRegiao(rows: UfYoyRow[]): GrupoRegiao[] {
  const map = new Map<Regiao, GrupoRegiao>();
  for (const r of rows) {
    const reg = regiaoDeUf(r.uf);
    const g =
      map.get(reg) ??
      { regiao: reg, total_atual: 0, total_anterior: 0, variacao: null, rows: [] };
    g.total_atual += r.fat_atual;
    g.total_anterior += r.fat_anterior;
    g.rows.push(r);
    map.set(reg, g);
  }
  const grupos = Array.from(map.values()).map((g) => ({
    ...g,
    variacao: g.total_anterior > 0 ? g.total_atual / g.total_anterior - 1 : null,
  }));
  grupos.sort((a, b) => b.total_atual - a.total_atual);
  return grupos;
}
