import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProdutoCatalogoSimulador {
  id: string;
  codigo: string | null;
  nome: string;
  linha: string | null;
  foto_url: string | null;
  custo_unitario: number | null;
}

/** Produtos oficiais do catálogo usados apenas como ponto de partida da simulação. */
export function useProdutosCatalogoSimulador() {
  return useQuery({
    queryKey: ["simulador-catalogo-produtos"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ProdutoCatalogoSimulador[]> => {
      const { data, error } = await supabase
        .from("fabrica_produtos")
        .select("id, codigo, nome, linha, foto_url, custo_unitario")
        .eq("ativo", true)
        .order("nome")
        .limit(2000);
      if (error) throw error;
      return ((data as any[]) || []).map((p) => ({
        id: p.id,
        codigo: p.codigo ?? null,
        nome: p.nome,
        linha: p.linha ?? null,
        foto_url: p.foto_url ?? null,
        custo_unitario: p.custo_unitario != null ? Number(p.custo_unitario) : null,
      }));
    },
  });
}

/** Linhas distintas do catálogo, para rotular produtos hipotéticos. */
export function useLinhasProdutos() {
  const { data = [], ...rest } = useProdutosCatalogoSimulador();
  const linhas = Array.from(
    new Set(data.map((p) => (p.linha || "").trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  return { linhas, ...rest };
}
