import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";

interface UIPermissionRule {
  id: string;
  role: string | null;
  departamento_id: string | null;
  tela_codigo: string;
  componente_codigo: string;
  visivel: boolean;
  editavel: boolean;
}

/**
 * Hook para controle granular de componentes/ações por tela.
 * Combina regras por role e por departamento.
 * Departamento tem prioridade sobre role.
 */
export function useUIPermissions(telaCodigo: string) {
  const { session } = useAuth();
  const { role } = usePermissions();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["ui-permissions", telaCodigo, session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];

      // Get user's department
      const { data: profile } = await supabase
        .from("profiles")
        .select("departamento_id")
        .eq("id", session.user.id)
        .single();

      // Get user's role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();

      const userRole = roleData?.role;
      const deptId = profile?.departamento_id;

      // Build OR filter for matching rules
      const conditions: string[] = [];
      if (userRole) conditions.push(`role.eq.${userRole}`);
      if (deptId) conditions.push(`departamento_id.eq.${deptId}`);

      if (conditions.length === 0) return [];

      const { data, error } = await supabase
        .from("ui_permissions")
        .select("*")
        .eq("tela_codigo", telaCodigo)
        .or(conditions.join(","));

      if (error) {
        console.error("Error fetching UI permissions:", error);
        return [];
      }

      return (data || []) as UIPermissionRule[];
    },
    enabled: !!session?.user?.id,
    staleTime: 5 * 60 * 1000,
  });

  /**
   * Resolve a rule for a component. Department rules take priority over role rules.
   */
  const getRule = (componenteCodigo: string): UIPermissionRule | undefined => {
    const deptRule = rules.find(
      (r) => r.componente_codigo === componenteCodigo && r.departamento_id != null
    );
    if (deptRule) return deptRule;
    return rules.find(
      (r) => r.componente_codigo === componenteCodigo && r.role != null
    );
  };

  const isComponentVisible = (componenteCodigo: string): boolean => {
    const rule = getRule(componenteCodigo);
    return rule ? rule.visivel : true;
  };

  const isComponentEditable = (componenteCodigo: string): boolean => {
    const rule = getRule(componenteCodigo);
    return rule ? rule.editavel : true;
  };

  // Convenience shortcuts
  const canView = (componenteCodigo: string) => isComponentVisible(componenteCodigo);
  const canEdit = (componenteCodigo: string) => isComponentEditable(componenteCodigo);

  return {
    isComponentVisible,
    isComponentEditable,
    canView,
    canEdit,
    rules,
    isLoading,
  };
}
