import { useCallback, useState } from "react";
import { invokeChat } from "@/lib/ai/invokeChat";

export interface PedidosCopilotSource {
  tipo: string;
  id: string | number;
  label: string;
}

export interface PedidosCopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: PedidosCopilotSource[];
  meta?: { unverifiable_count?: number };
  created_at: string;
}

export interface PedidosCopilotScope {
  date_from?: string; // YYYY-MM-DD
  date_to?: string;
  etapa?: string;
}

export function usePedidosCopilot(scope: PedidosCopilotScope) {
  const [messages, setMessages] = useState<PedidosCopilotMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;
      setErrorMsg(null);
      const userMsg: PedidosCopilotMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      try {
        const { data, error } = await invokeChat<{
          reply?: string;
          sources?: PedidosCopilotSource[];
          meta?: { copilot_v2?: { unverifiable_count?: number } };
        }>("pedidos-copilot-v2", { user_message: trimmed, scope }, { timeoutMs: 120_000 });
        if (error) {
          setErrorMsg(error.userMessage);
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: `_Não foi possível responder: ${error.userMessage}_`,
              created_at: new Date().toISOString(),
            },
          ]);
        } else if (data) {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: data.reply ?? "_Sem resposta._",
              sources: data.sources ?? [],
              meta: { unverifiable_count: data.meta?.copilot_v2?.unverifiable_count },
              created_at: new Date().toISOString(),
            },
          ]);
        }
      } finally {
        setLoading(false);
      }
    },
    [loading, scope],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setErrorMsg(null);
  }, []);

  return { messages, loading, errorMsg, send, reset };
}
