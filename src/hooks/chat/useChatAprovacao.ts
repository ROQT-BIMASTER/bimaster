/**
 * useChatAprovacao — carrega 1 aprovação por id e expõe ações de decisão.
 * Realtime via postgres_changes na tabela chat_aprovacoes (publication
 * já adicionada na migration). Decisão usa as RPCs rpc_chat_aprovacao_*.
 */
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime/channelName";
import { toast } from "sonner";

export interface ChatAprovacao {
  id: string;
  conversa_id: string;
  mensagem_id: string | null;
  solicitante_id: string;
  titulo: string;
  descricao: string | null;
  status: "pendente" | "aprovado" | "rejeitado" | "cancelado";
  decidido_por: string | null;
  decidido_em: string | null;
  motivo: string | null;
  created_at: string;
}

export function useChatAprovacao(aprovacaoId: string | null) {
  const qc = useQueryClient();
  const queryKey = ["chat-aprovacao", aprovacaoId];

  const query = useQuery({
    queryKey,
    enabled: !!aprovacaoId,
    staleTime: 15_000,
    queryFn: async (): Promise<ChatAprovacao | null> => {
      if (!aprovacaoId) return null;
      const { data, error } = await supabase
        .from("chat_aprovacoes" as any)
        .select("*")
        .eq("id", aprovacaoId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as ChatAprovacao) ?? null;
    },
  });

  // Realtime — invalida ao receber UPDATE da aprovação
  useEffect(() => {
    if (!aprovacaoId) return;
    const ch = supabase
      .channel(uniqueChannelName(`aprovacao-${aprovacaoId}`))
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_aprovacoes", filter: `id=eq.${aprovacaoId}` },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [aprovacaoId, qc]);

  const decidir = useMutation({
    mutationFn: async (args: { status: "aprovado" | "rejeitado"; motivo?: string }) => {
      if (!aprovacaoId) throw new Error("sem aprovacao_id");
      const { error } = await supabase.rpc("rpc_chat_aprovacao_decidir" as any, {
        p_aprovacao_id: aprovacaoId,
        p_status: args.status,
        p_motivo: args.motivo ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Decisão registrada");
    },
    onError: (e: any) => toast.error("Erro: " + (e?.message ?? "falha")),
  });

  return { ...query, decidir };
}

export function useCriarAprovacao() {
  return useMutation({
    mutationFn: async (args: { conversaId: string; titulo: string; descricao?: string }): Promise<string> => {
      const { data, error } = await supabase.rpc("rpc_chat_aprovacao_criar" as any, {
        p_conversa_id: args.conversaId,
        p_titulo: args.titulo,
        p_descricao: args.descricao ?? null,
      } as any);
      if (error) throw error;
      return data as unknown as string;
    },
    onError: (e: any) => toast.error("Erro ao solicitar: " + (e?.message ?? "falha")),
  });
}
