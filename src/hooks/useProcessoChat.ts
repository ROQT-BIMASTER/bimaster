import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { toast } from "sonner";
import { useModulosDespacho } from "@/hooks/useModulosDespacho";
import { useSystemProfiles } from "@/hooks/useSystemProfiles";

export interface ProcessChatMessage {
  id: string;
  process_id: string;
  user_id: string;
  user_nome: string;
  conteudo: string;
  modulo_origem: string | null;
  tipo: string;
  documento_ids: string[];
  documento_oficializado_id: string | null;
  fase_processo: string | null;
  metadata: Record<string, any>;
  visibilidade: string;
  destinatarios_ids: string[];
  created_at: string;
}

export function useProcessoChat(processId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const queryKey = ["process-chat", processId];

  // Messages query
  const { data: messages = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("process_chat_messages" as any)
        .select("*")
        .eq("process_id", processId!)
        .order("created_at", { ascending: true }) as any);
      if (error) throw error;
      return (data || []) as ProcessChatMessage[];
    },
    enabled: !!processId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!processId) return;
    const channel = supabase
      .channel(`process-chat-${processId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "process_chat_messages", filter: `process_id=eq.${processId}` },
        () => {
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [processId, queryClient]);

  // Get user profile name
  const getUserNome = async (): Promise<string> => {
    if (!user?.id) return "Usuário";
    const { data } = await supabase.from("profiles").select("nome").eq("id", user.id).maybeSingle();
    return data?.nome || user.email || "Usuário";
  };

  // Send message
  const sendMessage = useMutation({
    mutationFn: async (input: {
      conteudo: string;
      modulo_origem?: string;
      documento_ids?: string[];
      tipo?: string;
      fase_processo?: string;
      metadata?: Record<string, any>;
    }) => {
      if (!processId || !user?.id) throw new Error("Sem processo ou usuário");
      const nome = await getUserNome();
      const { error } = await (supabase
        .from("process_chat_messages" as any)
        .insert({
          process_id: processId,
          user_id: user.id,
          user_nome: nome,
          conteudo: input.conteudo,
          modulo_origem: input.modulo_origem || null,
          tipo: input.tipo || "mensagem",
          documento_ids: input.documento_ids || [],
          fase_processo: input.fase_processo || null,
          metadata: input.metadata || {},
        }) as any);
      if (error) throw error;
    },
    onError: (e: any) => toast.error("Erro ao enviar: " + e.message),
  });

  // Oficializar documento — creates juntada event + system message
  const oficializarDocumento = useMutation({
    mutationFn: async (input: {
      documento_id: string;
      documento_titulo: string;
      fase: string;
      modulo_origem: string;
    }) => {
      if (!processId || !user?.id) throw new Error("Sem processo ou usuário");
      const nome = await getUserNome();

      // Register process event
      await (supabase.from("process_events" as any).insert({
        process_id: processId,
        tipo_evento: "juntada",
        descricao: `${nome} oficializou "${input.documento_titulo}" como documento oficial — Fase: ${input.fase}`,
        modulo_origem: input.modulo_origem,
        usuario_id: user.id,
        usuario_nome: nome,
        metadata: { documento_id: input.documento_id, fase: input.fase, via: "chat" },
      }) as any);

      // Post system message in chat
      await (supabase.from("process_chat_messages" as any).insert({
        process_id: processId,
        user_id: user.id,
        user_nome: nome,
        conteudo: `📋 Documento "${input.documento_titulo}" oficializado como documento oficial do processo — Fase: ${input.fase}`,
        modulo_origem: input.modulo_origem,
        tipo: "juntada",
        documento_oficializado_id: input.documento_id,
        fase_processo: input.fase,
        metadata: { documento_titulo: input.documento_titulo },
      }) as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["process-events", processId] });
      toast.success("Documento oficializado no processo");
    },
    onError: (e: any) => toast.error("Erro ao oficializar: " + e.message),
  });

  // Mentions data
  const { data: modulos = [] } = useModulosDespacho();
  const { data: profiles = [] } = useSystemProfiles();

  const mentionUsers = profiles.map(p => ({
    id: p.id,
    nome: p.nome || p.email,
    avatar_url: null as string | null,
  }));

  const mentionModulos = modulos
    .filter(m => m.ambiente_habilitado)
    .map(m => ({
      id: m.key,
      nome: m.label,
      avatar_url: null as string | null,
    }));

  return {
    messages,
    isLoading,
    sendMessage,
    oficializarDocumento,
    mentionUsers,
    mentionModulos,
  };
}
