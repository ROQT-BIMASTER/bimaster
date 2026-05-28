import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Retorna (e cria, se preciso) o projeto Pessoal do usuário. */
export function useProjetoPessoal(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["projeto-pessoal", user?.id],
    queryFn: async (): Promise<{ projeto_id: string; secao_id: string } | null> => {
      const { data, error } = await (supabase as any).rpc("get_or_create_projeto_pessoal");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row ?? null;
    },
    enabled: !!user?.id && enabled,
    staleTime: 5 * 60_000,
  });
}
