import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useIsGerenteGeralProjetos } from "@/hooks/useIsGerenteGeralProjetos";

export type InboxScope = "produto" | "generico" | "hibrido";

/**
 * Decide qual visão da Caixa de Entrada o usuário recebe.
 *
 * - hibrido: admin ou gerente geral de Projetos → vê tudo + toggle.
 * - produto: o usuário acessa pelo menos um projeto vinculado a produto
 *            (qualquer tipo diferente de "generico").
 * - generico: usuário só tem projetos do tipo "generico".
 *
 * A consulta é leve (só `tipo`) e respeita as RLS de `projetos`.
 */
export function useInboxScope(): {
  scope: InboxScope;
  isLoading: boolean;
} {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { isGerenteGeral } = useIsGerenteGeralProjetos();

  const fullView = isAdmin || isGerenteGeral;

  const { data, isLoading } = useQuery({
    queryKey: ["inbox-scope-tipos", user?.id],
    enabled: !!user && !fullView,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("tipo")
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((r) => r.tipo as string);
    },
  });

  if (fullView) return { scope: "hibrido", isLoading: false };
  if (isLoading) return { scope: "generico", isLoading: true };

  const tipos = data ?? [];
  const temProduto = tipos.some((t) => t && t !== "generico");
  return { scope: temProduto ? "produto" : "generico", isLoading: false };
}
