import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MeuProjetoRecente {
  id: string;
  nome: string;
  cor: string;
  icone: string;
  status: string;
  total_tarefas: number;
  concluidas: number;
  atrasadas: number;
  minhas_pendentes: number;
}

/**
 * Fase 2 — métricas agregadas server-side via RPC `get_meus_projetos_metrics`.
 * Antes o hook trazia toda a tabela de tarefas dos projetos do usuário para
 * calcular contadores no cliente; agora a RPC devolve a contagem pronta.
 */
export function useMeusProjetosRecentes() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["meus-projetos-recentes", user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as MeuProjetoRecente[];

      const { data, error } = await supabase.rpc("get_meus_projetos_metrics", {
        p_limit: 200,
      });
      if (error) throw error;

      return (data || []).map((p: any): MeuProjetoRecente => ({
        id: p.id,
        nome: p.nome,
        cor: p.cor || "#6366f1",
        icone: p.icone || "FolderKanban",
        status: p.status,
        total_tarefas: p.total_tarefas || 0,
        concluidas: p.concluidas || 0,
        atrasadas: p.atrasadas || 0,
        minhas_pendentes: p.minhas_pendentes || 0,
      }));
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}
