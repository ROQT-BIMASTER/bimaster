/**
 * useTemAcessoBriefings — heurística leve para decidir se o usuário enxerga
 * a aba "Briefing" no Chat. Retorna true se for membro de ao menos um
 * briefing OU se for admin/gerente (que sempre podem acessar).
 *
 * RLS de briefing_membros já restringe ao próprio user_id, então um count
 * filtrado pelo auth.uid() é seguro.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

export function useTemAcessoBriefings() {
  const { user } = useAuth();
  const { isAdmin, isGerente } = useUserRole();

  const { data: temMembership = false } = useQuery({
    queryKey: ["tem-acesso-briefings", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("briefing_membros")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id);
      if (error) return false;
      return (count ?? 0) > 0;
    },
  });

  return Boolean(temMembership || isAdmin || isGerente);
}
