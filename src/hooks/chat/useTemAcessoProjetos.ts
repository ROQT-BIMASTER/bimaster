/**
 * useTemAcessoProjetos — decide se o usuário enxerga a aba "Projetos" no
 * Chat. Retorna true se for membro de ao menos 1 projeto OU admin/gerente.
 *
 * RLS de projeto_membros já restringe ao próprio user_id; um count filtrado
 * pelo auth.uid() é seguro e leve.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

export function useTemAcessoProjetos() {
  const { user } = useAuth();
  const { isAdmin, isGerente } = useUserRole();

  const { data: temMembership = false } = useQuery({
    queryKey: ["tem-acesso-projetos", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("projeto_membros")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id);
      if (error) return false;
      return (count ?? 0) > 0;
    },
  });

  return Boolean(temMembership || isAdmin || isGerente);
}
