import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Empresa {
  id: number;
  nome: string;
  cnpj?: string;
  uf?: string;
  ativa: boolean;
}

export interface UserEmpresa {
  empresa_id: number;
  is_primary: boolean;
  empresa: Empresa;
}

/**
 * Hook para buscar empresas/filiais vinculadas ao usuário atual
 */
export function useUserEmpresas() {
  return useQuery({
    queryKey: ["user-empresas"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("user_empresas")
        .select(`
          empresa_id,
          is_primary,
          empresa:empresas(id, nome, cnpj, uf, ativa)
        `)
        .eq("user_id", user.id);

      if (error) throw error;
      
      return (data || []).map(item => ({
        empresa_id: item.empresa_id,
        is_primary: item.is_primary,
        empresa: item.empresa as unknown as Empresa,
      })) as UserEmpresa[];
    },
  });
}

/**
 * Hook para buscar todas as empresas ativas (para admins/supervisores)
 */
export function useAllEmpresas() {
  return useQuery({
    queryKey: ["all-empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("*")
        .eq("ativa", true)
        .order("nome");

      if (error) throw error;
      return (data || []) as Empresa[];
    },
  });
}

/**
 * Hook para obter a empresa principal do usuário
 */
export function usePrimaryEmpresa() {
  const { data: userEmpresas, isLoading } = useUserEmpresas();

  const primaryEmpresa = userEmpresas?.find(ue => ue.is_primary)?.empresa 
    || userEmpresas?.[0]?.empresa 
    || null;

  return {
    primaryEmpresa,
    isLoading,
  };
}
