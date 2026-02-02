import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useState, useEffect } from "react";

/**
 * Hook para verificar as permissões de tabelas de preço do usuário.
 * Usuários admin/supervisor têm acesso a todas as tabelas.
 * Outros usuários só veem tabelas que possuem permissão em user_price_table_access.
 * Respeita o modo de impersonação quando ativo.
 */
export function useUserPriceTableAccess() {
  const { isAdmin, role, loading: permLoading } = usePermissions();
  const { isImpersonating, impersonatedUser, impersonatedPermissions } = useImpersonation();
  const [realUserId, setRealUserId] = useState<string | null>(null);

  // Buscar userId do usuário real
  useEffect(() => {
    const getUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setRealUserId(user?.id || null);
    };
    getUserId();
  }, []);

  // Usar o ID do usuário impersonado se estiver ativo, senão usar o real
  const userId = isImpersonating && impersonatedUser ? impersonatedUser.id : realUserId;

  // Verificar role efetivo (impersonado ou real)
  const effectiveRole = isImpersonating && impersonatedPermissions ? impersonatedPermissions.role : role;
  const effectiveIsAdmin = isImpersonating && impersonatedPermissions ? impersonatedPermissions.isAdmin : isAdmin;

  // Supervisores também têm acesso total
  const hasFullAccess = effectiveIsAdmin || effectiveRole === "supervisor";

  // Buscar permissões do usuário nas tabelas
  const { data: userAccess, isLoading: accessLoading } = useQuery({
    queryKey: ["user-price-table-access", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("user_price_table_access")
        .select("tabela_id, can_view, can_edit, can_approve")
        .eq("user_id", userId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && !hasFullAccess,
  });

  // Verificar se o usuário tem restrições de tabela
  const hasTableRestrictions = !hasFullAccess && (userAccess?.length ?? 0) > 0;

  // IDs das tabelas que o usuário pode visualizar
  const allowedTableIds = userAccess
    ?.filter((a) => a.can_view)
    ?.map((a) => a.tabela_id) || [];

  // Função para filtrar tabelas baseado nas permissões
  const filterTablesByAccess = <T extends { id: string }>(tables: T[]): T[] => {
    // Admin/supervisor vê todas
    if (hasFullAccess) return tables;
    
    // Se não tem restrições configuradas, vê todas (comportamento padrão)
    if (!hasTableRestrictions) return tables;

    // Filtra apenas tabelas permitidas
    return tables.filter((t) => allowedTableIds.includes(t.id));
  };

  // Verifica se usuário pode visualizar uma tabela específica
  const canViewTable = (tabelaId: string): boolean => {
    if (hasFullAccess) return true;
    if (!hasTableRestrictions) return true;
    return allowedTableIds.includes(tabelaId);
  };

  // Verifica se usuário pode editar uma tabela específica
  const canEditTable = (tabelaId: string): boolean => {
    if (hasFullAccess) return true;
    if (!hasTableRestrictions) return true;
    return userAccess?.some((a) => a.tabela_id === tabelaId && a.can_edit) ?? false;
  };

  // Verifica se usuário pode aprovar uma tabela específica
  const canApproveTable = (tabelaId: string): boolean => {
    if (hasFullAccess) return true;
    if (!hasTableRestrictions) return true;
    return userAccess?.some((a) => a.tabela_id === tabelaId && a.can_approve) ?? false;
  };

  return {
    loading: permLoading || accessLoading || !userId,
    hasFullAccess,
    hasTableRestrictions,
    allowedTableIds,
    filterTablesByAccess,
    canViewTable,
    canEditTable,
    canApproveTable,
  };
}
