import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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

  const createProjeto = useMutation({
    mutationFn: async (projeto: { nome: string; descricao?: string; cor?: string; icone?: string }) => {
      if (!user) throw new Error("Não autenticado");
      
      const { data, error } = await supabase
        .from("projetos")
        .insert({ ...projeto, criador_id: user.id })
        .select()
        .single();
      if (error) throw error;

      // Create default sections
      const defaultSections = [
        "Atribuídas recentemente",
        "A fazer hoje",
        "A fazer na próxima semana",
        "A fazer mais tarde",
      ];
      
      const { error: secError } = await supabase
        .from("projeto_secoes")
        .insert(defaultSections.map((nome, i) => ({
          projeto_id: data.id,
          nome,
          ordem: i,
        })));
      if (secError) throw secError;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projetos"] });
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
      toast.success("Projeto excluído!");
    },
  });

  return { projetos, isLoading, createProjeto, deleteProjeto };
}
