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
    mutationFn: async (projeto: { nome: string; descricao?: string; cor?: string; icone?: string; template?: TemplateKey }) => {
      if (!user) throw new Error("Não autenticado");
      
      const { template, ...projetoData } = projeto;
      const { data, error } = await supabase
        .from("projetos")
        .insert({ ...projetoData, criador_id: user.id })
        .select()
        .single();
      if (error) throw error;

      // Auto-insert creator as coordinator
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
