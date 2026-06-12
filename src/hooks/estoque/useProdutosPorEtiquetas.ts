import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Lista cod_produto vinculados às etiquetas selecionadas (união).
 * Retorna `null` quando nenhuma etiqueta está selecionada (sem filtro).
 */
export function useProdutosPorEtiquetas(etiquetaIds: string[]) {
  const ids = [...etiquetaIds].sort();
  return useQuery({
    queryKey: ['produtos-por-etiquetas', ids],
    enabled: ids.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<number[]> => {
      const { data, error } = await (supabase as any)
        .from('estoque_etiqueta_produtos')
        .select('cod_produto')
        .in('etiqueta_id', ids)
        .range(0, 49999);
      if (error) throw error;
      const set = new Set<number>();
      for (const r of (data ?? []) as { cod_produto: number }[]) {
        const n = Number(r.cod_produto);
        if (Number.isFinite(n)) set.add(n);
      }
      return Array.from(set);
    },
  });
}
