import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useState, useEffect } from "react";

interface AccessRecord {
  tabela_id: string;
  can_view: boolean;
  can_edit: boolean;
  can_approve: boolean;
  linha: string | null;
  produto_id: string | null;
}

/**
 * Hook para verificar as permissões de tabelas de preço do usuário.
 * Suporta controle granular por tabela, linha de produto ou produto individual.
 * Hierarquia: produto_id > linha > tabela inteira.
 */
export function useUserPriceTableAccess() {
  const { isAdmin, role, loading: permLoading } = usePermissions();
  const { isImpersonating, impersonatedUser, impersonatedPermissions } = useImpersonation();
  const [realUserId, setRealUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setRealUserId(user?.id || null);
    };
    getUserId();
  }, []);

  const userId = isImpersonating && impersonatedUser ? impersonatedUser.id : realUserId;
  const effectiveRole = isImpersonating && impersonatedPermissions ? impersonatedPermissions.role : role;
  const effectiveIsAdmin = isImpersonating && impersonatedPermissions ? impersonatedPermissions.isAdmin : isAdmin;
  const hasFullAccess = effectiveIsAdmin || effectiveRole === "supervisor";

  const { data: userAccess, isLoading: accessLoading } = useQuery({
    queryKey: ["user-price-table-access", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("user_price_table_access")
        .select("tabela_id, can_view, can_edit, can_approve, linha, produto_id")
        .eq("user_id", userId);

      if (error) throw error;
      return (data || []) as AccessRecord[];
    },
    enabled: !!userId && !hasFullAccess,
  });

  const hasTableRestrictions = !hasFullAccess && (userAccess?.length ?? 0) > 0;

  const allowedTableIds = userAccess
    ?.filter((a) => a.can_view)
    ?.map((a) => a.tabela_id) || [];

  // Get rules for a specific table
  const getRulesForTable = (tabelaId: string): AccessRecord[] => {
    return userAccess?.filter(a => a.tabela_id === tabelaId) || [];
  };

  // Check if table has granular (linha/produto) restrictions
  const hasGranularRules = (tabelaId: string): boolean => {
    const rules = getRulesForTable(tabelaId);
    return rules.some(r => r.linha !== null || r.produto_id !== null);
  };

  // Check if user has a table-wide rule (linha=null, produto_id=null)
  const hasTableWideRule = (tabelaId: string): boolean => {
    const rules = getRulesForTable(tabelaId);
    return rules.some(r => r.linha === null && r.produto_id === null);
  };

  const filterTablesByAccess = <T extends { id: string }>(tables: T[]): T[] => {
    if (hasFullAccess) return tables;
    if (!hasTableRestrictions) return tables;
    const uniqueTableIds = [...new Set(allowedTableIds)];
    return tables.filter((t) => uniqueTableIds.includes(t.id));
  };

  const canViewTable = (tabelaId: string): boolean => {
    if (hasFullAccess) return true;
    if (!hasTableRestrictions) return true;
    return allowedTableIds.includes(tabelaId);
  };

  const canEditTable = (tabelaId: string): boolean => {
    if (hasFullAccess) return true;
    if (!hasTableRestrictions) return true;
    return userAccess?.some((a) => a.tabela_id === tabelaId && a.can_edit) ?? false;
  };

  const canApproveTable = (tabelaId: string): boolean => {
    if (hasFullAccess) return true;
    if (!hasTableRestrictions) return true;
    return userAccess?.some((a) => a.tabela_id === tabelaId && a.can_approve) ?? false;
  };

  /**
   * Verifica se o usuário pode ver um produto específico dentro de uma tabela.
   * Hierarquia: regra por produto > regra por linha > regra por tabela inteira.
   */
  const canViewProduct = (tabelaId: string, linha: string | null, produtoId: string): boolean => {
    if (hasFullAccess) return true;
    if (!hasTableRestrictions) return true;

    const rules = getRulesForTable(tabelaId);
    if (rules.length === 0) return false;

    // 1. Check product-specific rule
    const productRule = rules.find(r => r.produto_id === produtoId);
    if (productRule) return productRule.can_view;

    // 2. Check line-specific rule
    if (linha) {
      const lineRule = rules.find(r => r.linha === linha && r.produto_id === null);
      if (lineRule) return lineRule.can_view;
    }

    // 3. Check table-wide rule (linha=null, produto_id=null)
    const tableRule = rules.find(r => r.linha === null && r.produto_id === null);
    if (tableRule) return tableRule.can_view;

    // If there are only granular rules and none match, deny
    return false;
  };

  /**
   * Filtra lista de produtos baseado nas restrições granulares do usuário.
   */
  const filterProductsByAccess = <T extends { id: string; linha?: string | null }>(
    tabelaId: string,
    produtos: T[]
  ): T[] => {
    if (hasFullAccess) return produtos;
    if (!hasTableRestrictions) return produtos;

    const rules = getRulesForTable(tabelaId);
    if (rules.length === 0) return [];

    // If user has table-wide rule with can_view and no granular rules, return all
    if (hasTableWideRule(tabelaId) && !hasGranularRules(tabelaId)) {
      const tableRule = rules.find(r => r.linha === null && r.produto_id === null);
      return tableRule?.can_view ? produtos : [];
    }

    return produtos.filter(p => canViewProduct(tabelaId, p.linha ?? null, p.id));
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
    canViewProduct,
    filterProductsByAccess,
    userAccess: userAccess || [],
  };
}
