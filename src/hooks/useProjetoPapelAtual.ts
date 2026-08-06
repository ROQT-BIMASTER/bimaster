import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Papel do usuário logado dentro de um projeto (`projeto_membros.papel`).
 *
 * Usado para liberar ações de gestão (ex.: excluir seções) a coordenadores,
 * e não apenas a quem criou o projeto.
 */
export function useProjetoPapelAtual(projetoId?: string) {
  const { user } = useAuth();

  const { data: papel = null, isLoading } = useQuery({
    queryKey: ["projeto-papel-atual", projetoId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_membros")
        .select("papel")
        .eq("projeto_id", projetoId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) return null;
      return (data?.papel as string | undefined) ?? null;
    },
    enabled: !!projetoId && !!user?.id,
    staleTime: 60_000,
  });

  const isCoordenador = papel === "coordenador" || papel === "gestor";

  return { papel, isCoordenador, isLoading };
}
