import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { toast } from "sonner";
import { uniqueChannelName } from "@/lib/realtime/channelName";

export interface ProjetoChatMessage {
  id: string;
  projeto_id: string;
  user_id: string | null;
  conteudo: string;
  tipo: "mensagem" | "resumo_diario" | "sistema";
  metadata: Record<string, unknown>;
  created_at: string;
  autor?: { nome: string | null; avatar_url: string | null } | null;
}

export function useProjetoChat(projetoId: string | null) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const queryKey = ["projeto-chat", projetoId];

  const { data: messages = [], isLoading } = useQuery({
    queryKey,
    enabled: !!projetoId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("projeto_chat_messages")
        .select("*")
        .eq("projeto_id", projetoId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      const list = (data || []) as ProjetoChatMessage[];
      const ids = [...new Set(list.map((m) => m.user_id).filter(Boolean))] as string[];
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, nome, avatar_url").in("id", ids);
        const map = new Map((profs || []).map((p) => [p.id, p]));
        return list.map((m) => ({ ...m, autor: m.user_id ? map.get(m.user_id) ?? null : null }));
      }
      return list;
    },
  });

  useEffect(() => {
    if (!projetoId) return;
    const ch = supabase
      .channel(uniqueChannelName(`projeto-chat-${projetoId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "projeto_chat_messages", filter: `projeto_id=eq.${projetoId}` }, () => qc.invalidateQueries({ queryKey }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projetoId, qc]);

  const sendMessage = useMutation({
    mutationFn: async (input: string | { conteudo: string; mentions?: string[] }) => {
      if (!projetoId || !user?.id) throw new Error("Sem projeto/usuário");
      const conteudo = typeof input === "string" ? input : input.conteudo;
      const mentions = typeof input === "string" ? [] : (input.mentions || []);
      const { error } = await (supabase as any).from("projeto_chat_messages").insert({
        projeto_id: projetoId,
        user_id: user.id,
        conteudo,
        tipo: "mensagem",
        mentions,
      });
      if (error) throw error;
    },
    onError: (e: any) => toast.error("Erro ao enviar: " + e.message),
  });

  const gerarResumoHoje = useMutation({
    mutationFn: async () => {
      if (!projetoId) return;
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.functions.invoke("projeto-resumo-diario", {
        body: { projeto_id: projetoId, data: today },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Resumo do dia atualizado");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  return { messages, isLoading, sendMessage, gerarResumoHoje };
}
