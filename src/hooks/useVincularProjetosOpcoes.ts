import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ProjetoVinculavel {
  id: string;
  nome: string;
  cor: string;
  tipo: string;
}

export function useVincularProjetosOpcoes(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["projetos-vincular-tarefa", user?.id],
    queryFn: async (): Promise<ProjetoVinculavel[]> => {
      const { data, error } = await (supabase as any).rpc(
        "listar_projetos_para_vincular_tarefa",
      );
      if (error) throw error;
      return (data || []) as ProjetoVinculavel[];
    },
    enabled: !!user?.id && enabled,
    staleTime: 60_000,
  });
}
