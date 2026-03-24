import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProcessFieldPermission {
  id: string;
  process_step: string;
  module: string;
  field: string;
  origin_role: "china" | "brasil";
  can_view: boolean;
  can_edit: boolean;
  can_approve: boolean;
}

/**
 * Hook para consultar permissões de campo por etapa do processo.
 * Retorna helpers para checar se um campo é editável/visível para china ou brasil.
 */
export function useProcessFieldPermissions(processStep: string | undefined, originRole: "china" | "brasil") {
  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ["process-field-permissions", processStep, originRole],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("process_field_permissions" as any)
        .select("*")
        .eq("process_step", processStep!)
        .eq("origin_role", originRole) as any);
      if (error) throw error;
      return (data || []) as ProcessFieldPermission[];
    },
    enabled: !!processStep,
    staleTime: 10 * 60 * 1000,
  });

  const canEditField = (module: string, field: string): boolean => {
    const rule = permissions.find(p => p.module === module && p.field === field);
    return rule ? rule.can_edit : true; // default allow if no rule
  };

  const canViewField = (module: string, field: string): boolean => {
    const rule = permissions.find(p => p.module === module && p.field === field);
    return rule ? rule.can_view : true;
  };

  const canApproveField = (module: string, field: string): boolean => {
    const rule = permissions.find(p => p.module === module && p.field === field);
    return rule ? rule.can_approve : false;
  };

  return {
    permissions,
    isLoading,
    canEditField,
    canViewField,
    canApproveField,
  };
}
