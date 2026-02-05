import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useImpersonation } from "@/contexts/ImpersonationContext";

export interface FilteredStore {
  id: string;
  name: string;
  code: string;
  cnpj?: string;
  city?: string;
  address?: string;
  state?: string;
  status?: string;
  vendedor_id?: string;
  classification?: string;
}

interface UseFilteredStoresOptions {
  activeOnly?: boolean;
  includeFields?: string[];
}

interface UseFilteredStoresResult {
  stores: FilteredStore[];
  loading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Hook centralizado para buscar lojas filtradas por permissão do usuário.
 * 
 * Regras:
 * - Admin/Supervisor: vê todas as lojas
 * - Vendedor/Promotor: vê apenas lojas onde é vendedor principal OU está vinculado via store_sellers
 * - Lojas sem vendedor: visíveis apenas para Admins/Supervisores
 * 
 * Respeita o contexto de impersonação (Visualizar como Usuário)
 */
export function useFilteredStores(options?: UseFilteredStoresOptions): UseFilteredStoresResult {
  const { isAdmin, isSupervisor, isGerente, loading: roleLoading } = useUserRole();
  const { isImpersonating, impersonatedUser, impersonatedPermissions } = useImpersonation();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Obter userId atual do supabase
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getUser();
  }, []);

  // Calcular valores efetivos considerando impersonação
  const effectiveUserId = useMemo(() => {
    if (isImpersonating && impersonatedUser) {
      return impersonatedUser.id;
    }
    return currentUserId;
  }, [isImpersonating, impersonatedUser, currentUserId]);

  const effectiveIsAdmin = useMemo(() => {
    if (isImpersonating && impersonatedPermissions) {
      return impersonatedPermissions.isAdmin;
    }
    return isAdmin;
  }, [isImpersonating, impersonatedPermissions, isAdmin]);

  const effectiveIsSupervisor = useMemo(() => {
    if (isImpersonating && impersonatedPermissions) {
      return impersonatedPermissions.role === 'supervisor' || impersonatedPermissions.role === 'gerente';
    }
    return isSupervisor || isGerente;
  }, [isImpersonating, impersonatedPermissions, isSupervisor, isGerente]);

  const activeOnly = options?.activeOnly !== false; // Default true

  // Query para buscar lojas
  const { data: stores = [], isLoading, refetch: queryRefetch } = useQuery({
    queryKey: ['filtered-stores', effectiveUserId, effectiveIsAdmin, effectiveIsSupervisor, activeOnly],
    queryFn: async (): Promise<FilteredStore[]> => {
      // Admin: retorna todas as lojas (RLS já permite)
      if (effectiveIsAdmin) {
        let query = supabase
          .from("stores")
          .select("id, name, code, cnpj, city, address, state, status, vendedor_id, classification")
          .order("name");

        if (activeOnly) {
          query = query.eq("status", "active");
        }

        const { data, error } = await query;
        if (error) {
          console.error("[useFilteredStores] Erro ao buscar lojas (admin):", error);
          throw error;
        }
        return data || [];
      }

      if (!effectiveUserId) {
        console.warn("[useFilteredStores] Usuário não identificado");
        return [];
      }

      // Supervisor: buscar subordinados e filtrar lojas por hierarquia
      if (effectiveIsSupervisor) {
        // 1. Buscar subordinados diretos
        const { data: subordinados, error: subError } = await supabase
          .rpc('get_subordinados', { _user_id: effectiveUserId });

        if (subError) {
          console.error("[useFilteredStores] Erro ao buscar subordinados:", subError);
        }

        const subordinadoIds = subordinados?.map((s: { subordinado_id: string }) => s.subordinado_id) || [];
        const allTeamIds = [effectiveUserId, ...subordinadoIds];

        // 2. Buscar IDs de lojas vinculadas via store_sellers
        const { data: storeSellersData } = await supabase
          .from("store_sellers")
          .select("store_id")
          .in("vendedor_id", allTeamIds);

        const linkedStoreIds = storeSellersData?.map(ss => ss.store_id) || [];

        // 3. Buscar lojas onde:
        //    - supervisor_id = supervisor OU
        //    - vendedor_id IN equipe OU
        //    - created_by IN equipe OU
        //    - id IN lojas vinculadas via store_sellers
        let query = supabase
          .from("stores")
          .select("id, name, code, cnpj, city, address, state, status, vendedor_id, classification")
          .order("name");

        if (activeOnly) {
          query = query.eq("status", "active");
        }

        const orFilters = [
          `supervisor_id.eq.${effectiveUserId}`,
          ...allTeamIds.map(id => `vendedor_id.eq.${id}`),
          ...allTeamIds.map(id => `created_by.eq.${id}`),
        ];

        if (linkedStoreIds.length > 0) {
          orFilters.push(`id.in.(${linkedStoreIds.join(',')})`);
        }

        query = query.or(orFilters.join(','));

        const { data, error } = await query;
        if (error) {
          console.error("[useFilteredStores] Erro ao buscar lojas (supervisor):", error);
          throw error;
        }
        return data || [];
      }

      // Vendedor/Promotor: apenas lojas vinculadas
      // 1. Buscar IDs das lojas vinculadas via store_sellers
      const { data: storeSellersData, error: sellersError } = await supabase
        .from("store_sellers")
        .select("store_id")
        .eq("vendedor_id", effectiveUserId);

      if (sellersError) {
        console.error("[useFilteredStores] Erro ao buscar store_sellers:", sellersError);
      }

      const linkedStoreIds = storeSellersData?.map(ss => ss.store_id) || [];

      let query = supabase
        .from("stores")
        .select("id, name, code, cnpj, city, address, state, status, vendedor_id, classification")
        .order("name");

      if (activeOnly) {
        query = query.eq("status", "active");
      }

      if (linkedStoreIds.length > 0) {
        query = query.or(`vendedor_id.eq.${effectiveUserId},id.in.(${linkedStoreIds.join(',')})`);
      } else {
        query = query.eq("vendedor_id", effectiveUserId);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error("[useFilteredStores] Erro ao buscar lojas filtradas:", error);
        throw error;
      }

      return data || [];
    },
    enabled: !roleLoading && !!effectiveUserId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  const refetch = useCallback(async () => {
    await queryRefetch();
  }, [queryRefetch]);

  return {
    stores,
    loading: isLoading || roleLoading,
    refetch,
  };
}
