import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { logger } from "@/lib/logger";
import { uniqueChannelName } from "@/lib/realtime/channelName";

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
 * Combina regras por role e por departamento (departamento sobrepõe role).
 *
 * Reflete mudanças do admin sem espera de cache:
 *  - staleTime curto (60s) + refetchOnWindowFocus
 *  - assinatura Realtime em `public.ui_permissions` filtrada por `tela_codigo`
 */
export function useUIPermissions(telaCodigo: string) {
  const { session } = useAuth();
  const { role } = usePermissions();
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["ui-permissions", telaCodigo, session?.user?.id, role],
    queryFn: async () => {
      if (!session?.user?.id) return [];

      const { data: profile } = await supabase
        .from("profiles")
        .select("departamento_id")
        .eq("id", session.user.id)
        .single();

      const deptId = profile?.departamento_id;

      const conditions: string[] = [];
      if (role) conditions.push(`role.eq.${role}`);
      if (deptId) conditions.push(`departamento_id.eq.${deptId}`);

      if (conditions.length === 0) return [];

      const { data, error } = await supabase
        .from("ui_permissions")
        .select("*")
        .eq("tela_codigo", telaCodigo)
        .or(conditions.join(","));

      if (error) {
        logger.error("Error fetching UI permissions:", error);
        return [];
      }

      return (data || []) as UIPermissionRule[];
    },
    enabled: !!session?.user?.id,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!session?.user?.id) return;
    const channel = supabase
      .channel(uniqueChannelName(`ui-permissions-${telaCodigo}`))
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ui_permissions",
          filter: `tela_codigo=eq.${telaCodigo}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["ui-permissions", telaCodigo],
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [telaCodigo, session?.user?.id, queryClient]);

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
