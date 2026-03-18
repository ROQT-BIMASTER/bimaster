import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface FeatureFlag {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  roles_permitidos: string[];
  departamentos_permitidos: string[];
}

/**
 * Hook para verificar se uma feature flag está ativa para o usuário atual.
 */
export function useFeatureFlag(codigo: string): { enabled: boolean; isLoading: boolean } {
  const { session } = useAuth();

  const { data: enabled = false, isLoading } = useQuery({
    queryKey: ["feature-flag", codigo, session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return false;

      const { data: flag } = await supabase
        .from("feature_flags")
        .select("*")
        .eq("codigo", codigo)
        .maybeSingle();

      if (!flag || !flag.ativo) return false;

      const rolesPermitidos = (flag.roles_permitidos as string[]) || [];
      const deptsPermitidos = (flag.departamentos_permitidos as string[]) || [];

      // If no restrictions, feature is enabled for everyone
      if (rolesPermitidos.length === 0 && deptsPermitidos.length === 0) return true;

      // Check role
      if (rolesPermitidos.length > 0) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (roleData && rolesPermitidos.includes(roleData.role)) return true;
      }

      // Check department
      if (deptsPermitidos.length > 0) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("departamento_id")
          .eq("id", session.user.id)
          .single();

        if (profile?.departamento_id && deptsPermitidos.includes(profile.departamento_id)) return true;
      }

      return false;
    },
    enabled: !!session?.user?.id,
    staleTime: 5 * 60 * 1000,
  });

  return { enabled, isLoading };
}

/**
 * Hook para listar todas as feature flags (admin).
 */
export function useAllFeatureFlags() {
  return useQuery({
    queryKey: ["all-feature-flags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_flags")
        .select("*")
        .order("nome");

      if (error) throw error;
      return (data || []) as FeatureFlag[];
    },
  });
}
