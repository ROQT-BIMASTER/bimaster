import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useEffect } from "react";

export interface TarefaComentario {
  id: string;
  tarefa_id: string;
  user_id: string;
  conteudo: string;
  mentions: string[];
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

export interface TarefaMessage {
  id: string;
  tarefa_id: string;
  user_id: string;
  conteudo: string;
  mentions: string[];
  created_at: string;
  autor?: { nome: string; avatar_url: string | null };
}

export interface ProdutoAcabado {
  id: string;
  codigo: string;
  nome: string;
  marca: string | null;
  linha: string | null;
}

export function useProjetoTarefaDetalhe(tarefaId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ===== Comentários =====
  const { data: comentarios = [] } = useQuery({
    queryKey: ["tarefa-comentarios", tarefaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_tarefa_comentarios")
        .select("*")
        .eq("tarefa_id", tarefaId!)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const userIds = [...new Set((data as any[]).map(c => c.user_id))];
      let profiles: Record<string, { nome: string; avatar_url: string | null }> = {};
      if (userIds.length > 0) {
        const { data: p } = await supabase.from("profiles").select("id, nome, avatar_url").in("id", userIds);
        if (p) profiles = Object.fromEntries(p.map(x => [x.id, { nome: x.nome, avatar_url: x.avatar_url }]));
      }

      return (data as any[]).map(c => ({
        ...c,
        mentions: c.mentions || [],
        autor: profiles[c.user_id] || { nome: "Usuário", avatar_url: null },
      })) as TarefaComentario[];
    },
    enabled: !!tarefaId && !!user,
  });

  const addComentario = useMutation({
    mutationFn: async ({ conteudo, mentions }: { conteudo: string; mentions?: string[] }) => {
      const { error } = await supabase.from("projeto_tarefa_comentarios").insert({
        tarefa_id: tarefaId!,
        user_id: user!.id,
        conteudo,
        mentions: mentions || [],
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefa-comentarios", tarefaId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ===== Anexos =====
  const { data: anexos = [] } = useQuery({
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

  // ===== Send to Cofre =====
  const sendToCofre = useMutation({
    mutationFn: async ({ anexoIds, produtoId, categoria }: { anexoIds: string[]; produtoId: string; categoria: string }) => {
      const selectedAnexos = anexos.filter(a => anexoIds.includes(a.id));
      
      for (const anexo of selectedAnexos) {
        // Copy file from projeto-anexos to fabrica-cotacoes (same bucket used by cofre)
        const destPath = `cofre/${produtoId}/${Date.now()}_${anexo.nome}`;
        const { data: signedUrl } = await supabase.storage.from("projeto-anexos").createSignedUrl(anexo.storage_path, 60);
        
        if (!signedUrl?.signedUrl) throw new Error("Erro ao acessar arquivo");

        const response = await fetch(signedUrl.signedUrl);
        const blob = await response.blob();
        
        const { error: uploadErr } = await supabase.storage
          .from("projeto-anexos")
          .upload(destPath, blob);
        if (uploadErr) throw uploadErr;

        // Insert into cofre
        await supabase.from("fabrica_revisao_documentos" as any).insert({
          produto_id: produtoId,
          nome_arquivo: anexo.nome,
          arquivo_path: destPath,
          tipo_arquivo: anexo.tipo_arquivo,
          tamanho: anexo.tamanho,
          categoria,
          status: "ativo",
          enviado_por: user!.id,
        } as any);
      }
    },
    onSuccess: () => {
      toast.success("Documentos enviados ao Cofre!");
    },
    onError: (err: Error) => toast.error("Erro ao enviar ao Cofre: " + err.message),
  });

  // ===== Chat Messages (Realtime) =====
  const { data: messages = [] } = useQuery({
    queryKey: ["tarefa-messages", tarefaId],
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
      })) as TarefaMessage[];
    },
    enabled: !!tarefaId && !!user,
  });

  // Realtime subscription for messages
  useEffect(() => {
    if (!tarefaId) return;
    const channel = supabase
      .channel(`tarefa-chat-${tarefaId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "projeto_tarefa_messages",
        filter: `tarefa_id=eq.${tarefaId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["tarefa-messages", tarefaId] });
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
      queryClient.invalidateQueries({ queryKey: ["tarefa-messages", tarefaId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ===== Produtos Acabados search =====
  const searchProdutos = async (query: string): Promise<ProdutoAcabado[]> => {
    const { data } = await supabase
      .from("fabrica_produtos" as any)
      .select("id, codigo, nome, marca, linha")
      .or(`nome.ilike.%${query}%,codigo.ilike.%${query}%`)
      .limit(10);
    return (data || []) as unknown as ProdutoAcabado[];
  };

  // ===== Team members for @mention =====
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
    comentarios,
    addComentario,
    anexos,
    uploadAnexo,
    deleteAnexo,
    getAnexoUrl,
    sendToCofre,
    messages,
    sendMessage,
    searchProdutos,
    teamMembers,
  };
}
