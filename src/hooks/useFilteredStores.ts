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
  const { isAdminOrSupervisor, loading: roleLoading } = useUserRole();
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

  const effectiveIsAdminOrSupervisor = useMemo(() => {
    if (isImpersonating && impersonatedPermissions) {
      return impersonatedPermissions.isAdmin || impersonatedPermissions.role === 'supervisor';
    }
    return isAdminOrSupervisor;
  }, [isImpersonating, impersonatedPermissions, isAdminOrSupervisor]);

  const activeOnly = options?.activeOnly !== false; // Default true

  // Query para buscar lojas
  const { data: stores = [], isLoading, refetch: queryRefetch } = useQuery({
    queryKey: ['filtered-stores', effectiveUserId, effectiveIsAdminOrSupervisor, activeOnly],
    queryFn: async (): Promise<FilteredStore[]> => {
      // Se admin/supervisor, retorna todas as lojas
      if (effectiveIsAdminOrSupervisor) {
        let query = supabase
          .from("stores")
          .select("id, name, code, cnpj, city, address, state, status, vendedor_id")
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

      // Para não-admins, buscar apenas lojas vinculadas
      if (!effectiveUserId) {
        console.warn("[useFilteredStores] Usuário não identificado");
        return [];
      }

      // 1. Buscar IDs das lojas vinculadas via store_sellers
      const { data: storeSellersData, error: sellersError } = await supabase
        .from("store_sellers")
        .select("store_id")
        .eq("vendedor_id", effectiveUserId);

      if (sellersError) {
        console.error("[useFilteredStores] Erro ao buscar store_sellers:", sellersError);
      }

      const linkedStoreIds = storeSellersData?.map(ss => ss.store_id) || [];

      // 2. Construir query para buscar lojas onde:
      //    - vendedor_id = usuário atual OU
      //    - id está na lista de store_sellers
      let query = supabase
        .from("stores")
        .select("id, name, code, cnpj, city, address, state, status, vendedor_id")
        .order("name");

      if (activeOnly) {
        query = query.eq("status", "active");
      }

      // Construir filtro OR
      if (linkedStoreIds.length > 0) {
        // Usar filter OR para vendedor_id = userId OU id IN (linkedStoreIds)
        query = query.or(`vendedor_id.eq.${effectiveUserId},id.in.(${linkedStoreIds.join(',')})`);
      } else {
        // Apenas lojas onde vendedor_id = userId
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
