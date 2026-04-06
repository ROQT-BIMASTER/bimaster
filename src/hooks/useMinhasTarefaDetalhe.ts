import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useEffect } from "react";

export interface MinhaTarefaAnexo {
  id: string;
  tarefa_id: string;
  user_id: string;
  nome: string;
  storage_path: string;
  tipo_arquivo: string | null;
  tamanho: number | null;
  created_at: string;
}

export interface MinhaTarefaMessage {
  id: string;
  tarefa_id: string;
  user_id: string;
  conteudo: string;
  mentions: string[];
  created_at: string;
  autor?: { nome: string; avatar_url: string | null };
}

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv",
];

export function useMinhasTarefaDetalhe(tarefaId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Anexos
  const { data: anexos = [] } = useQuery({
    queryKey: ["minha-tarefa-anexos", tarefaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_tarefa_anexos")
        .select("*")
        .eq("tarefa_id", tarefaId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MinhaTarefaAnexo[];
    },
    enabled: !!tarefaId && !!user,
  });

  const uploadAnexo = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`Arquivo excede 20MB (${(file.size / 1048576).toFixed(1)}MB).`);
      }
      if (ALLOWED_TYPES.length > 0 && !ALLOWED_TYPES.includes(file.type) && file.type !== "") {
        throw new Error(`Tipo não permitido: ${file.type}`);
      }
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
      queryClient.invalidateQueries({ queryKey: ["minha-tarefa-anexos", tarefaId] });
      toast.success("Anexo enviado!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteAnexo = useMutation({
    mutationFn: async (anexo: MinhaTarefaAnexo) => {
      await supabase.storage.from("projeto-anexos").remove([anexo.storage_path]);
      const { error } = await supabase.from("projeto_tarefa_anexos").delete().eq("id", anexo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["minha-tarefa-anexos", tarefaId] });
      toast.success("Anexo removido!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const getAnexoUrl = async (storagePath: string) => {
    const { data } = await supabase.storage.from("projeto-anexos").createSignedUrl(storagePath, 3600);
    return data?.signedUrl || "";
  };

  // Messages
  const { data: messages = [] } = useQuery({
    queryKey: ["minha-tarefa-messages", tarefaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_tarefa_messages" as any)
        .select("*")
        .eq("tarefa_id", tarefaId!)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const userIds = [...new Set((data as any[]).map(m => m.user_id))];
      let profiles: Record<string, { nome: string; avatar_url: string | null }> = {};
      if (userIds.length > 0) {
        const { data: p } = await supabase.from("profiles").select("id, nome, avatar_url").in("id", userIds);
        if (p) profiles = Object.fromEntries(p.map(x => [x.id, { nome: x.nome, avatar_url: x.avatar_url }]));
      }

      return (data as any[]).map(m => ({
        ...m,
        mentions: m.mentions || [],
        autor: profiles[m.user_id] || { nome: "Usuário", avatar_url: null },
      })) as MinhaTarefaMessage[];
    },
    enabled: !!tarefaId && !!user,
  });

  // Realtime messages
  useEffect(() => {
    if (!tarefaId) return;
    const channel = supabase
      .channel(`minha-tarefa-chat-${tarefaId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "projeto_tarefa_messages",
        filter: `tarefa_id=eq.${tarefaId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["minha-tarefa-messages", tarefaId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tarefaId, queryClient]);

  const sendMessage = useMutation({
    mutationFn: async ({ conteudo, mentions }: { conteudo: string; mentions?: string[] }) => {
      const { error } = await supabase.from("projeto_tarefa_messages" as any).insert({
        tarefa_id: tarefaId!,
        user_id: user!.id,
        conteudo,
        mentions: mentions || [],
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["minha-tarefa-messages", tarefaId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Team members for mentions
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members-mentions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url")
        .order("nome");
      return (data || []) as { id: string; nome: string; avatar_url: string | null }[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  return {
    anexos,
    uploadAnexo,
    deleteAnexo,
    getAnexoUrl,
    messages,
    sendMessage,
    teamMembers,
  };
}
