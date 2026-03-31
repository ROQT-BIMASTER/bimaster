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

export function useMeusProjetosRecentes() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["meus-projetos-recentes", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get projects where user is a member or creator
      const { data: membros } = await supabase
        .from("projeto_membros")
        .select("projeto_id")
        .eq("user_id", user.id);

      const { data: criados } = await supabase
        .from("projetos")
        .select("id")
        .eq("criador_id", user.id);

      const projetoIds = new Set<string>();
      (membros || []).forEach(m => projetoIds.add(m.projeto_id));
      (criados || []).forEach(p => projetoIds.add(p.id));

      if (projetoIds.size === 0) return [];

      const ids = Array.from(projetoIds);

      const { data: projetos } = await supabase
        .from("projetos")
        .select("id, nome, cor, icone, status")
        .in("id", ids)
        .neq("status", "finalizado")
        .order("updated_at", { ascending: false })
        .limit(6);

      if (!projetos?.length) return [];

      // Get task metrics for these projects
      const { data: tarefas } = await supabase
        .from("projeto_tarefas")
        .select("id, projeto_id, status, data_prazo, responsavel_id")
        .in("projeto_id", projetos.map(p => p.id))
        .is("excluida_em", null);

      const now = new Date();

      return projetos.map(p => {
        const pTarefas = (tarefas || []).filter(t => t.projeto_id === p.id);
        const concluidas = pTarefas.filter(t => t.status === "concluida").length;
        const atrasadas = pTarefas.filter(t => t.status !== "concluida" && t.data_prazo && new Date(t.data_prazo) < now).length;
        const minhasPendentes = pTarefas.filter(t => t.responsavel_id === user.id && t.status !== "concluida").length;

        return {
          id: p.id,
          nome: p.nome,
          cor: p.cor || "#6366f1",
          icone: p.icone || "FolderKanban",
          status: p.status,
          total_tarefas: pTarefas.length,
          concluidas,
          atrasadas,
          minhas_pendentes: minhasPendentes,
        } as MeuProjetoRecente;
      });
    },
    enabled: !!user?.id,
  });
}
