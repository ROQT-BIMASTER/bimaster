import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Lista valores distintos de Marca (rr_produtos.marca) e Linha
 * (erp_estoque_distribuidora.nome_linha) para popular os filtros
 * da tela Estoque Unificado.
 */
export function useMarcasLinhasOptions() {
  return useQuery({
    queryKey: ['estoque-unificado-marcas-linhas-options'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const [marcasRes, linhasRes] = await Promise.all([
        supabase.from('rr_produtos').select('marca').not('marca', 'is', null).range(0, 9999),
        supabase
          .from('erp_estoque_distribuidora')
          .select('nome_linha')
          .not('nome_linha', 'is', null)
          .range(0, 19999),
      ]);

      const marcas = Array.from(
        new Set(((marcasRes.data ?? []) as any[]).map((r) => String(r.marca).trim()).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

      const linhas = Array.from(
        new Set(((linhasRes.data ?? []) as any[]).map((r) => String(r.nome_linha).trim()).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

      return { marcas, linhas };
    },
  });
}
