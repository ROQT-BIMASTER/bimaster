import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface DelegadaTarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  prioridade: string | null;
  data_inicio_planejada: string | null;
  data_prazo: string | null;
  data_conclusao: string | null;
  projeto_id: string;
  projeto_nome: string;
  projeto_cor: string;
  estagio: string | null;
  criador_id: string | null;
  visibilidade: string | null;
  secao_id: string | null;
  secao_nome: string | null;
  ordem: number;
  parent_tarefa_id: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  responsavel_avatar_url: string | null;
  codigo: string | null;
  produto_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useMinhasDelegadas() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["minhas-delegadas", user?.id],
    queryFn: async (): Promise<DelegadaTarefa[]> => {
      if (!user?.id) return [];
      const { data, error } = await supabase.rpc("get_minhas_delegadas_central");
      if (error) throw error;
      return ((data || []) as any[]).map((t) => ({
        id: t.id,
        titulo: t.titulo,
        descricao: t.descricao,
        status: t.status,
        prioridade: t.prioridade,
        data_inicio_planejada: t.data_inicio_planejada,
        data_prazo: t.data_prazo,
        data_conclusao: t.data_conclusao,
        projeto_id: t.projeto_id,
        projeto_nome: t.projeto_nome || "Sem projeto",
        projeto_cor: t.projeto_cor || "#6366f1",
        estagio: t.estagio,
        criador_id: t.criador_id,
        visibilidade: t.visibilidade,
        secao_id: t.secao_id,
        secao_nome: t.secao_nome,
        ordem: t.ordem || 0,
        parent_tarefa_id: t.parent_tarefa_id,
        responsavel_id: t.responsavel_id,
        responsavel_nome: t.responsavel_nome,
        responsavel_avatar_url: t.responsavel_avatar_url,
        codigo: t.codigo,
        produto_id: t.produto_id,
        created_at: t.created_at,
        updated_at: t.updated_at,
      }));
    },
    enabled: !!user?.id,
  });
}
