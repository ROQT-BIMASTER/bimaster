import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ProjetoSecao {
  id: string;
  projeto_id: string;
  nome: string;
  ordem: number;
  created_at: string;
}

export interface ProjetoTarefa {
  id: string;
  projeto_id: string;
  secao_id: string;
  parent_tarefa_id: string | null;
  titulo: string;
  descricao: string | null;
  responsavel_id: string | null;
  status: string;
  prioridade: string;
  data_prazo: string | null;
  data_conclusao: string | null;
  codigo: string | null;
  visibilidade: string;
  ordem: number;
  created_at: string;
  updated_at: string;
  subtarefas?: ProjetoTarefa[];
  responsavel?: { id: string; nome: string; avatar_url: string | null } | null;
  colaboradores?: { user_id: string; nome: string; avatar_url: string | null }[];
}

export function useProjetoTarefas(projetoId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: secoes = [], isLoading: secoesLoading } = useQuery({
    queryKey: ["projeto-secoes", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_secoes")
        .select("*")
        .eq("projeto_id", projetoId!)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data as ProjetoSecao[];
    },
    enabled: !!projetoId && !!user,
  });

  const { data: tarefas = [], isLoading: tarefasLoading } = useQuery({
    queryKey: ["projeto-tarefas", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_tarefas")
        .select("*")
        .eq("projeto_id", projetoId!)
        .order("ordem", { ascending: true });
      if (error) throw error;
      
      // Fetch responsaveis
      const responsavelIds = [...new Set((data as ProjetoTarefa[]).filter(t => t.responsavel_id).map(t => t.responsavel_id!))];
      let profiles: Record<string, { id: string; nome: string; avatar_url: string | null }> = {};
      
      if (responsavelIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, nome, avatar_url")
          .in("id", responsavelIds);
        if (profilesData) {
          profiles = Object.fromEntries(profilesData.map(p => [p.id, p]));
        }
      }

      // Fetch colaboradores
      const tarefaIds = (data as ProjetoTarefa[]).map(t => t.id);
      let colabMap: Record<string, { user_id: string; nome: string; avatar_url: string | null }[]> = {};
      
      if (tarefaIds.length > 0) {
        const { data: colabs } = await supabase
          .from("projeto_tarefa_colaboradores")
          .select("tarefa_id, user_id")
          .in("tarefa_id", tarefaIds);
        
        if (colabs && colabs.length > 0) {
          const colabUserIds = [...new Set(colabs.map(c => c.user_id))];
          const { data: colabProfiles } = await supabase
            .from("profiles")
            .select("id, nome, avatar_url")
            .in("id", colabUserIds);
          
          const colabProfileMap = Object.fromEntries((colabProfiles || []).map(p => [p.id, p]));
          
          for (const c of colabs) {
            if (!colabMap[c.tarefa_id]) colabMap[c.tarefa_id] = [];
            const profile = colabProfileMap[c.user_id];
            if (profile) {
              colabMap[c.tarefa_id].push({ user_id: c.user_id, nome: profile.nome, avatar_url: profile.avatar_url });
            }
          }
        }
      }

      return (data as ProjetoTarefa[]).map(t => ({
        ...t,
        responsavel: t.responsavel_id ? profiles[t.responsavel_id] || null : null,
        colaboradores: colabMap[t.id] || [],
      }));
    },
    enabled: !!projetoId && !!user,
  });

  // Organize: parent tasks per section, subtasks nested
  const tarefasPorSecao = (secaoId: string) => {
    const parentTasks = tarefas.filter(t => t.secao_id === secaoId && !t.parent_tarefa_id);
    return parentTasks.map(t => ({
      ...t,
      subtarefas: tarefas.filter(st => st.parent_tarefa_id === t.id),
    }));
  };

  const createTarefa = useMutation({
    mutationFn: async (tarefa: { titulo: string; secao_id: string; parent_tarefa_id?: string }) => {
      const maxOrdem = tarefas.filter(t => t.secao_id === tarefa.secao_id).length;
      const { data, error } = await supabase
        .from("projeto_tarefas")
        .insert({
          ...tarefa,
          projeto_id: projetoId!,
          ordem: maxOrdem,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas", projetoId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateTarefa = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProjetoTarefa> & { id: string }) => {
      const { error } = await supabase
        .from("projeto_tarefas")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas", projetoId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleTarefaCompleta = useMutation({
    mutationFn: async (tarefa: ProjetoTarefa) => {
      const isCompleting = tarefa.status !== "concluida";
      const { error } = await supabase
        .from("projeto_tarefas")
        .update({
          status: isCompleting ? "concluida" : "pendente",
          data_conclusao: isCompleting ? new Date().toISOString().split("T")[0] : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tarefa.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas", projetoId] });
    },
  });

  const createSecao = useMutation({
    mutationFn: async (nome: string) => {
      const maxOrdem = secoes.length;
      const { error } = await supabase
        .from("projeto_secoes")
        .insert({ projeto_id: projetoId!, nome, ordem: maxOrdem });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-secoes", projetoId] });
      toast.success("Seção criada!");
    },
  });

  return {
    secoes,
    tarefas,
    secoesLoading,
    tarefasLoading,
    tarefasPorSecao,
    createTarefa,
    updateTarefa,
    toggleTarefaCompleta,
    createSecao,
  };
}
