import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface TarefaComentario {
  id: string;
  tarefa_id: string;
  user_id: string;
  conteudo: string;
  created_at: string;
  autor?: { nome: string; avatar_url: string | null };
}

export interface TarefaAnexo {
  id: string;
  tarefa_id: string;
  user_id: string;
  nome: string;
  storage_path: string;
  tipo_arquivo: string | null;
  tamanho: number | null;
  created_at: string;
}

export function useProjetoTarefaDetalhe(tarefaId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Comentários
  const { data: comentarios = [], isLoading: comentariosLoading } = useQuery({
    queryKey: ["tarefa-comentarios", tarefaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_tarefa_comentarios")
        .select("*")
        .eq("tarefa_id", tarefaId!)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const userIds = [...new Set((data as TarefaComentario[]).map(c => c.user_id))];
      let profiles: Record<string, { nome: string; avatar_url: string | null }> = {};
      if (userIds.length > 0) {
        const { data: p } = await supabase.from("profiles").select("id, nome, avatar_url").in("id", userIds);
        if (p) profiles = Object.fromEntries(p.map(x => [x.id, { nome: x.nome, avatar_url: x.avatar_url }]));
      }

      return (data as TarefaComentario[]).map(c => ({
        ...c,
        autor: profiles[c.user_id] || { nome: "Usuário", avatar_url: null },
      }));
    },
    enabled: !!tarefaId && !!user,
  });

  const addComentario = useMutation({
    mutationFn: async (conteudo: string) => {
      const { error } = await supabase.from("projeto_tarefa_comentarios").insert({
        tarefa_id: tarefaId!,
        user_id: user!.id,
        conteudo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefa-comentarios", tarefaId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Anexos
  const { data: anexos = [], isLoading: anexosLoading } = useQuery({
    queryKey: ["tarefa-anexos", tarefaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_tarefa_anexos")
        .select("*")
        .eq("tarefa_id", tarefaId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as TarefaAnexo[];
    },
    enabled: !!tarefaId && !!user,
  });

  const uploadAnexo = useMutation({
    mutationFn: async (file: File) => {
      const filePath = `${tarefaId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("projeto-anexos")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { error } = await supabase.from("projeto_tarefa_anexos").insert({
        tarefa_id: tarefaId!,
        user_id: user!.id,
        nome: file.name,
        storage_path: filePath,
        tipo_arquivo: file.type,
        tamanho: file.size,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefa-anexos", tarefaId] });
      toast.success("Anexo enviado!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteAnexo = useMutation({
    mutationFn: async (anexo: TarefaAnexo) => {
      await supabase.storage.from("projeto-anexos").remove([anexo.storage_path]);
      const { error } = await supabase.from("projeto_tarefa_anexos").delete().eq("id", anexo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefa-anexos", tarefaId] });
      toast.success("Anexo removido!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const getAnexoUrl = async (storagePath: string) => {
    const { data } = await supabase.storage.from("projeto-anexos").createSignedUrl(storagePath, 3600);
    return data?.signedUrl || "";
  };

  return {
    comentarios,
    comentariosLoading,
    addComentario,
    anexos,
    anexosLoading,
    uploadAnexo,
    deleteAnexo,
    getAnexoUrl,
  };
}
