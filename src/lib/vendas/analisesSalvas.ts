import type { Dimensao } from "@/lib/vendas/analisePresets";
import type { Metrica } from "@/lib/charts/corporateTheme";
import type { AnaliseChartTipo } from "@/components/vendas/AnaliseChart";

const KEY = "vendas:analises-salvas";

export interface AnaliseSalva {
  id: string;
  titulo: string;
  metrica: Metrica;
  dimensao: Dimensao;
  tipo: AnaliseChartTipo;
  createdAt: string;
}

export function loadAnalisesSalvas(): AnaliseSalva[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AnaliseSalva[]) : [];
  } catch {
    return [];
  }
}

export function saveAnalise(a: Omit<AnaliseSalva, "id" | "createdAt">): AnaliseSalva {
  const list = loadAnalisesSalvas();
  const item: AnaliseSalva = {
    ...a,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  list.unshift(item);
  window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
  return item;
}

export function removeAnalise(id: string) {
  const list = loadAnalisesSalvas().filter((a) => a.id !== id);
  window.localStorage.setItem(KEY, JSON.stringify(list));
}
