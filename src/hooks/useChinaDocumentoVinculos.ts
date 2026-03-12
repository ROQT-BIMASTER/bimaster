import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useDocumentosDaSubmissao(submissaoId: string | null) {
  return useQuery({
    queryKey: ["china-docs-submissao", submissaoId],
    enabled: !!submissaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_produto_documentos")
        .select("*")
        .eq("submissao_id", submissaoId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCoresDaSubmissao(submissaoId: string | null) {
  return useQuery({
    queryKey: ["china-cores-submissao", submissaoId],
    enabled: !!submissaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_produto_cores")
        .select("*")
        .eq("submissao_id", submissaoId!)
        .order("ordem");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useDocVinculosExistentes(projetoId: string | null) {
  return useQuery({
    queryKey: ["china-doc-vinculos", projetoId],
    enabled: !!projetoId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("china_documento_tarefa_vinculos" as any)
        .select("*")
        .eq("projeto_id", projetoId!) as any);
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        documento_id: string;
        tarefa_id: string;
        secao_id: string | null;
        projeto_id: string;
        created_by: string | null;
        created_at: string;
      }>;
    },
  });
}

export function useCreateDocVinculo() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      documento_id: string;
      tarefa_id: string;
      secao_id: string | null;
      projeto_id: string;
      responsavel_id?: string | null;
    }) => {
      const { error } = await (supabase
        .from("china_documento_tarefa_vinculos" as any)
        .insert({
          ...params,
          created_by: user?.id || null,
        }) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["china-doc-vinculos"] });
      toast.success("Documento vinculado com sucesso");
    },
    onError: (err: any) => {
      if (err?.code === "23505") {
        toast.error("Este documento já está vinculado a esta tarefa");
      } else {
        toast.error("Erro ao vincular documento");
      }
    },
  });
}

export function useDeleteDocVinculo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("china_documento_tarefa_vinculos" as any)
        .delete()
        .eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["china-doc-vinculos"] });
      toast.success("Vínculo de documento removido");
    },
    onError: () => {
      toast.error("Erro ao remover vínculo");
    },
  });
}
