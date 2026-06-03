import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EmpresaOption { id: number; nome: string }

/**
 * Catálogo de opções dos filtros da Visão de Estoque (filiais, linhas, unidades).
 * Usa a RPC `estoque_filtro_opcoes` (SECURITY DEFINER) que devolve valores
 * distintos respeitando as permissões do usuário — admin/gerente vê todas as
 * filiais, demais usuários veem apenas as suas (`user_empresas`).
 */
export function useEstoqueOptions() {
  return useQuery({
    queryKey: ['estoque-filter-options'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('estoque_filtro_opcoes' as any);
      if (error) throw error;

      const row: any = Array.isArray(data) ? data[0] : data;
      const empresasRaw: Array<{ id: number; nome: string }> = Array.isArray(row?.empresas)
        ? row.empresas
        : [];
      const empresas: EmpresaOption[] = empresasRaw
        .map((e) => ({ id: Number(e.id), nome: e.nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome));

      return {
        empresas,
        linhas: (row?.linhas ?? []) as string[],
        unidades: (row?.unidades ?? []) as string[],
      };
    },
  });
}
