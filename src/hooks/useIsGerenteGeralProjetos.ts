import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

const DEPT_PROJETOS_ID = "9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130";

/**
 * "Gerente Geral" = role gerente, sem supervisor_id e do depto Projetos.
 * Enxerga o departamento inteiro (equivalente ao admin nesta tela).
 */
export function useIsGerenteGeralProjetos() {
  const { user } = useAuth();
  const { isAdmin, isGerente } = useUserRole();

  const { data = false } = useQuery({
    queryKey: ["is-gerente-geral-projetos", user?.id],
    queryFn: async () => {
      if (!user || !isGerente) return false;
      const { data: perfil } = await supabase
        .from("profiles")
        .select("supervisor_id, departamento_id")
        .eq("id", user.id)
        .maybeSingle();
      return (
        !!perfil &&
        perfil.supervisor_id == null &&
        perfil.departamento_id === DEPT_PROJETOS_ID
      );
    },
    enabled: !!user && isGerente,
    staleTime: 5 * 60 * 1000,
  });

  // Admin sempre tem visão total
  return { isGerenteGeral: data, hasFullView: isAdmin || data };
}
