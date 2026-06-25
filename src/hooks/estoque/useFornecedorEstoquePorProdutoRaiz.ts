import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Soma `fornecedor_caixas` (view `v_estoque_fornecedor_integrado`) por produto-raiz
 * para a lista de raízes visíveis na tela Estoque Unificado.
 *
 * Join: `sku` (texto) da view ↔ `produto_raiz` (numérico) do Unificado.
 * Aditivo — não altera nenhum hook ou query existente.
 */
export function useFornecedorEstoquePorProdutoRaiz(produtoRaizes: number[]) {
  const ids = Array.from(new Set(produtoRaizes.filter((n) => n != null))).map(String).sort();
  const key = ids.join(',');

  return useQuery({
    queryKey: ['fornecedor-cx-por-produto-raiz', key],
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_estoque_fornecedor_integrado')
        .select('sku, fornecedor_caixas')
        .in('sku', ids)
        .gt('fornecedor_caixas', 0);
      if (error) throw error;

      const map = new Map<string, number>();
      for (const r of (data ?? []) as Array<{ sku: string | null; fornecedor_caixas: number | null }>) {
        if (!r.sku) continue;
        const k = String(r.sku).trim();
        const v = Number(r.fornecedor_caixas ?? 0);
        if (!Number.isFinite(v)) continue;
        map.set(k, (map.get(k) ?? 0) + v);
      }
      return map;
    },
  });
}
