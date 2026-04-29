import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EmpresaOption { id: number; nome: string }

export function useEstoqueOptions() {
  return useQuery({
    queryKey: ['estoque-filter-options'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      // Buscar valores distintos via fetch paginado limitado
      const { data, error } = await supabase
        .from('erp_estoque_distribuidora')
        .select('empresa_par,abrev_par,nome_linha,unidade_medida')
        .limit(10000);
      if (error) throw error;

      const empresasMap = new Map<number, string>();
      const linhas = new Set<string>();
      const unidades = new Set<string>();
      (data ?? []).forEach((r: any) => {
        if (r.empresa_par != null) empresasMap.set(r.empresa_par, r.abrev_par || `Empresa ${r.empresa_par}`);
        if (r.nome_linha) linhas.add(r.nome_linha);
        if (r.unidade_medida) unidades.add(r.unidade_medida);
      });
      const empresas: EmpresaOption[] = Array.from(empresasMap.entries())
        .map(([id, nome]) => ({ id, nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
      return {
        empresas,
        linhas: Array.from(linhas).sort(),
        unidades: Array.from(unidades).sort(),
      };
    },
  });
}
