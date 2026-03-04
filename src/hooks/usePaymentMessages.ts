import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { toast } from "sonner";

export interface PaymentMessage {
  id: string;
  payment_queue_id: string;
  usuario_id: string;
  usuario_nome: string;
  conteudo: string;
  tipo: "solicitante" | "financeiro";
  anexos: { name: string; url: string; type: string; size: number }[];
  lida_por: string[];
  created_at: string;
}

export function usePaymentMessages(paymentQueueId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ["payment-messages", paymentQueueId];

  const { data: messages = [], isLoading } = useQuery({
    queryKey,
    enabled: !!paymentQueueId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_payment_messages")
        .select("*")
        .eq("payment_queue_id", paymentQueueId!)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []).map((m: any) => ({
        ...m,
        anexos: (m.anexos as any) || [],
        lida_por: (m.lida_por as any) || [],
      })) as PaymentMessage[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    if (!paymentQueueId) return;

    const channel = supabase
      .channel(`payment-messages-${paymentQueueId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "financial_payment_messages",
          filter: `payment_queue_id=eq.${paymentQueueId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [paymentQueueId, queryClient]);

  const sendMessage = useMutation({
    mutationFn: async ({
      conteudo,
      tipo,
      anexos = [],
    }: {
      conteudo: string;
      tipo: "solicitante" | "financeiro";
      anexos?: PaymentMessage["anexos"];
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      // Get user name
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", userData.user.id)
        .single();

      const { error } = await supabase
        .from("financial_payment_messages")
        .insert({
          payment_queue_id: paymentQueueId!,
          usuario_id: userData.user.id,
          usuario_nome: profile?.nome || "Usuário",
          conteudo,
          tipo,
          anexos: anexos as any,
        } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => {
      toast.error("Erro ao enviar mensagem");
    },
  });

  const markAsRead = useMutation({
    mutationFn: async (messageIds: string[]) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const userId = userData.user.id;

      for (const msgId of messageIds) {
        const msg = messages.find(m => m.id === msgId);
        if (msg && !msg.lida_por.includes(userId)) {
          const updatedLidaPor = [...msg.lida_por, userId];
          await supabase
            .from("financial_payment_messages")
            .update({ lida_por: updatedLidaPor } as any)
            .eq("id", msgId);
        }
      }
    },
  });

  return {
    messages,
    isLoading,
    sendMessage: sendMessage.mutateAsync,
    isSending: sendMessage.isPending,
    markAsRead: markAsRead.mutate,
  };
}

// Hook to get unread message counts for payment queue items
export function usePaymentMessageCounts(paymentQueueIds: string[]) {
  return useQuery({
    queryKey: ["payment-message-counts", paymentQueueIds.sort().join(",")],
    enabled: paymentQueueIds.length > 0,
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return {};

      const { data, error } = await supabase
        .from("financial_payment_messages")
        .select("id, payment_queue_id, lida_por")
        .in("payment_queue_id", paymentQueueIds);

      if (error) throw error;

      const counts: Record<string, { total: number; unread: number }> = {};
      for (const msg of data || []) {
        const qId = msg.payment_queue_id;
        if (!counts[qId]) counts[qId] = { total: 0, unread: 0 };
        counts[qId].total++;
        const lidaPor = (msg.lida_por as string[]) || [];
        if (!lidaPor.includes(userData.user.id)) {
          counts[qId].unread++;
        }
      }
      return counts;
    },
    staleTime: 30000,
  });
}

export interface PaymentQueueItem {
  id: string;
  fornecedor: string;
  descricao: string;
  valor: number;
  vencimento: string;
  source_type: string;
  financial_status: string;
}

export function useAvailablePaymentQueues(existingQueueIds: string[]) {
  return useQuery({
    queryKey: ["available-payment-queues", existingQueueIds.sort().join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_payment_queue")
        .select("id, fornecedor, descricao, valor, vencimento, source_type, financial_status")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || [])
        .filter((item: any) => !existingQueueIds.includes(item.id))
        .map((item: any) => ({
          id: item.id,
          fornecedor: item.fornecedor || "—",
          descricao: item.descricao || "",
          valor: item.valor || 0,
          vencimento: item.vencimento || "",
          source_type: item.source_type || "",
          financial_status: item.financial_status || "",
        })) as PaymentQueueItem[];
    },
  });
}

export interface PaymentConversation {
  paymentQueueId: string;
  fornecedor: string;
  descricao: string;
  sourceType: string;
  status: string;
  totalMessages: number;
  unread: number;
  lastMessage: string;
  lastMessageDate: string;
  lastSender: string;
}

export function useAllPaymentConversations() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["all-payment-conversations"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return [];
      const userId = userData.user.id;

      // Get all messages
      const { data: messages, error: msgError } = await supabase
        .from("financial_payment_messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (msgError) throw msgError;
      if (!messages || messages.length === 0) return [];

      // Group by payment_queue_id
      const grouped = new Map<string, any[]>();
      for (const m of messages) {
        const arr = grouped.get(m.payment_queue_id) || [];
        arr.push(m);
        grouped.set(m.payment_queue_id, arr);
      }

      // Get payment queue items for metadata
      const queueIds = [...grouped.keys()];
      const { data: queueItems } = await supabase
        .from("financial_payment_queue")
        .select("id, fornecedor, descricao, source_type, financial_status")
        .in("id", queueIds);

      const queueMap = new Map<string, any>();
      (queueItems || []).forEach((q: any) => queueMap.set(q.id, q));

      const conversations: PaymentConversation[] = [];

      for (const [qId, msgs] of grouped) {
        const queueItem = queueMap.get(qId);
        const lastMsg = msgs[0]; // already sorted desc
        const unread = msgs.filter((m: any) => {
          const lidaPor = (m.lida_por as string[]) || [];
          return !lidaPor.includes(userId) && m.usuario_id !== userId;
        }).length;

        conversations.push({
          paymentQueueId: qId,
          fornecedor: queueItem?.fornecedor || "—",
          descricao: queueItem?.descricao || "",
          sourceType: queueItem?.source_type || "",
          status: queueItem?.financial_status || "",
          totalMessages: msgs.length,
          unread,
          lastMessage: lastMsg.conteudo,
          lastMessageDate: lastMsg.created_at,
          lastSender: lastMsg.usuario_nome,
        });
      }

      // Sort: unread first, then by date
      conversations.sort((a, b) => {
        if (a.unread > 0 && b.unread === 0) return -1;
        if (a.unread === 0 && b.unread > 0) return 1;
        return new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime();
      });

      return conversations;
    },
    staleTime: 15000,
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("all-payment-conversations-rt")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "financial_payment_messages",
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["all-payment-conversations"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}
