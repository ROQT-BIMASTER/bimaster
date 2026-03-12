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

  // Fetch task metrics per project
  const { data: projetoMetrics = [] } = useQuery({
    queryKey: ["projetos-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_tarefas")
        .select("projeto_id, status, data_prazo, excluida_em")
        .is("excluida_em", null);
      if (error) throw error;

      const metricsMap = new Map<string, ProjetoMetrics>();
      const now = new Date();

      for (const t of data || []) {
        if (!metricsMap.has(t.projeto_id)) {
          metricsMap.set(t.projeto_id, { projeto_id: t.projeto_id, total_tarefas: 0, concluidas: 0, atrasadas: 0 });
        }
        const m = metricsMap.get(t.projeto_id)!;
        m.total_tarefas++;
        if (t.status === "concluida") m.concluidas++;
        else if (t.data_prazo && new Date(t.data_prazo) < now) m.atrasadas++;
      }

      return Array.from(metricsMap.values());
    },
    enabled: !!user,
  });

  // Fetch members per project with profiles
  const { data: projetoMembros = [] } = useQuery({
    queryKey: ["projetos-membros"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_membros")
        .select("projeto_id, user_id, papel, profiles:user_id(nome, avatar_url)");
      if (error) throw error;
      return data as Array<{
        projeto_id: string;
        user_id: string;
        papel: string;
        profiles: { nome: string | null; avatar_url: string | null } | null;
      }>;
    },
    enabled: !!user,
  });

  const createProjeto = useMutation({
    mutationFn: async (projeto: { nome: string; descricao?: string; cor?: string; icone?: string; template?: TemplateKey }) => {
      if (!user) throw new Error("Não autenticado");
      
      const { template, ...projetoData } = projeto;
      const tipo = template || "generico";
      const { data, error } = await supabase
        .from("projetos")
        .insert({ ...projetoData, criador_id: user.id, tipo })
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

  return { projetos, isLoading, createProjeto, deleteProjeto, finalizarProjeto, projetoMetrics, projetoMembros };
}
