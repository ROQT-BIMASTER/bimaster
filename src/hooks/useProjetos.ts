import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { TEMPLATES, type TemplateKey } from "@/components/projetos/NovoProjetoDialog";

export interface Projeto {
  id: string;
  nome: string;
  descricao: string | null;
  cor: string;
  icone: string;
  criador_id: string;
  status: string;
  visibilidade: string;
  created_at: string;
  updated_at: string;
  bg_cor?: string | null;
  tipo: string;
}

export interface ProjetoMembro {
  user_id: string;
  papel: string;
  nome: string | null;
  avatar_url: string | null;
}

export interface ProjetoMetrics {
  projeto_id: string;
  total_tarefas: number;
  concluidas: number;
  atrasadas: number;
}

export function useProjetos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: projetos = [], isLoading } = useQuery({
    queryKey: ["projetos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Projeto[];
    },
    enabled: !!user,
  });

  // Fetch task metrics per project using RPC (avoids 1000-row limit)
  const { data: projetoMetrics = [] } = useQuery({
    queryKey: ["projetos-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_projeto_metrics" as any);
      if (error) throw error;
      return (data || []) as ProjetoMetrics[];
    },
    enabled: !!user,
  });

  // Fetch members per project using secure RPC
  const { data: projetoMembros = [] } = useQuery({
    queryKey: ["projetos-membros"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_projetos_member_avatars" as any);
      if (error) throw error;
      return (data || []).map((m: any) => ({
        projeto_id: m.projeto_id,
        user_id: m.user_id,
        papel: "membro",
        profiles: { nome: m.nome, avatar_url: m.avatar_url },
      })) as Array<{
        projeto_id: string;
        user_id: string;
        papel: string;
        profiles: { nome: string | null; avatar_url: string | null } | null;
      }>;
    },
    enabled: !!user,
  });

  // Fetch task collaborators per project (from Asana sync)
  const { data: projetoColaboradores = [] } = useQuery({
    queryKey: ["projetos-colaboradores"],
    queryFn: async () => {
      // Get all collaborators with their task's projeto_id
      const { data: tarefas, error: tErr } = await supabase
        .from("projeto_tarefas")
        .select("id, projeto_id")
        .is("excluida_em", null);
      if (tErr) throw tErr;

      const tarefaIds = (tarefas || []).map(t => t.id);
      if (tarefaIds.length === 0) return [];

      // Fetch in batches of 500 to avoid query limits
      const allCollabs: Array<{ tarefa_id: string; user_id: string }> = [];
      for (let i = 0; i < tarefaIds.length; i += 500) {
        const batch = tarefaIds.slice(i, i + 500);
        const { data: collabs } = await supabase
          .from("projeto_tarefa_colaboradores")
          .select("tarefa_id, user_id")
          .in("tarefa_id", batch);
        if (collabs) allCollabs.push(...collabs);
      }

      // Map tarefa_id -> projeto_id
      const tarefaProjetoMap = new Map((tarefas || []).map(t => [t.id, t.projeto_id]));

      // Unique collaborators per project
      const projetoCollabMap = new Map<string, Set<string>>();
      for (const c of allCollabs) {
        const projetoId = tarefaProjetoMap.get(c.tarefa_id);
        if (!projetoId) continue;
        if (!projetoCollabMap.has(projetoId)) projetoCollabMap.set(projetoId, new Set());
        projetoCollabMap.get(projetoId)!.add(c.user_id);
      }

      // Get all unique user ids
      const allUserIds = [...new Set(allCollabs.map(c => c.user_id))];
      const { data: profiles } = allUserIds.length > 0
        ? await supabase.from("profiles").select("id, nome, avatar_url").in("id", allUserIds)
        : { data: [] as Array<{ id: string; nome: string | null; avatar_url: string | null }> };

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      const result: Array<{ projeto_id: string; user_id: string; nome: string | null; avatar_url: string | null }> = [];
      for (const [projetoId, userIds] of projetoCollabMap) {
        for (const userId of userIds) {
          const profile = profileMap.get(userId);
          result.push({
            projeto_id: projetoId,
            user_id: userId,
            nome: profile?.nome || null,
            avatar_url: profile?.avatar_url || null,
          });
        }
      }
      return result;
    },
    enabled: !!user,
  });

  const createProjeto = useMutation({
    mutationFn: async (projeto: { nome: string; descricao?: string; cor?: string; icone?: string; template?: TemplateKey; marca?: string; categoriaLinha?: string; origemProjeto?: string }) => {
      if (!user) throw new Error("Não autenticado");
      
      const { template, marca, categoriaLinha, origemProjeto, ...projetoData } = projeto;
      const tipo = template || "generico";
      const { data, error } = await supabase
        .from("projetos")
        .insert({
          ...projetoData,
          criador_id: user.id,
          tipo,
          ...(marca ? { marca } : {}),
          ...(categoriaLinha ? { categoria_linha: categoriaLinha } : {}),
          ...(origemProjeto ? { origem_projeto: origemProjeto } : {}),
        } as any)
        .select()
        .single();
      if (error) throw error;

      await supabase
        .from("projeto_membros")
        .insert({ projeto_id: data.id, user_id: user.id, papel: "coordenador" });

      const sections = TEMPLATES[template || "generico"].secoes;
      
      const { error: secError } = await supabase
        .from("projeto_secoes")
        .insert(sections.map((nome, i) => ({
          projeto_id: data.id,
          nome,
          ordem: i,
        })));
      if (secError) throw secError;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projetos"] });
      queryClient.invalidateQueries({ queryKey: ["projetos-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["projetos-membros"] });
      toast.success("Projeto criado com sucesso!");
    },
    onError: (err: Error) => {
      toast.error("Erro ao criar projeto: " + err.message);
    },
  });

  const deleteProjeto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projetos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projetos"] });
      queryClient.invalidateQueries({ queryKey: ["projetos-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["projetos-membros"] });
      toast.success("Projeto excluído!");
    },
  });

  const finalizarProjeto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("projetos")
        .update({ status: "finalizado" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projetos"] });
      toast.success("Projeto finalizado!");
    },
  });

  return { projetos, isLoading, createProjeto, deleteProjeto, finalizarProjeto, projetoMetrics, projetoMembros, projetoColaboradores };
}
