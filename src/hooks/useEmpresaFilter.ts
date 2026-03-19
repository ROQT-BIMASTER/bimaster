import { useEmpresaContext } from "@/contexts/EmpresaContext";
import { useCallback } from "react";

/**
 * Hook para filtrar queries por empresa.
 * 
 * Uso:
 * ```ts
 * const { empresaIds, aplicarFiltroEmpresa } = useEmpresaFilter();
 * 
 * // Opção 1: usar empresaIds diretamente
 * const query = supabase.from("contas_pagar").select("*").in("empresa_id", empresaIds);
 * 
 * // Opção 2: usar aplicarFiltroEmpresa
 * let query = supabase.from("contas_pagar").select("*");
 * query = aplicarFiltroEmpresa(query);
 * ```
 */
export function useEmpresaFilter() {
  const {
    empresaSelecionada,
    empresasDoUsuario,
    empresaIds,
    setEmpresaSelecionada,
    loading,
    hasEmpresas,
  } = useEmpresaContext();

  /**
   * Aplica filtro .in("empresa_id", empresaIds) em uma query do Supabase.
   * Se empresaIds estiver vazio, retorna a query sem filtro (evita erro do .in com array vazio).
   */
  const aplicarFiltroEmpresa = useCallback(
    <T extends { in: (column: string, values: number[]) => T }>(
      query: T,
      column: string = "empresa_id"
    ): T => {
      if (empresaIds.length === 0) return query;
      return query.in(column, empresaIds);
    },
    [empresaIds]
  );

  return {
    empresaSelecionada,
    empresasDoUsuario,
    empresaIds,
    setEmpresaSelecionada,
    loading,
    hasEmpresas,
    aplicarFiltroEmpresa,
  };
}
