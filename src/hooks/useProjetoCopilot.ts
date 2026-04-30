import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CopilotSource {
  tipo: string;
  id: string;
  label: string;
}

export interface CopilotMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  sources?: CopilotSource[] | null;
  created_at: string;
}

export function useProjetoCopilot(projetoId: string | null) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [sending, setSending] = useState(false);

  async function loadThread(id: string) {
    setThreadId(id);
    const { data, error } = await supabase
      .from("projeto_copilot_mensagens")
      .select("id, role, content, sources, created_at")
      .eq("thread_id", id)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Não foi possível carregar a conversa.");
      return;
    }
    setMessages((data ?? []) as CopilotMessage[]);
  }

  function newThread() {
    setThreadId(null);
    setMessages([]);
  }

  async function send(text: string) {
    if (!projetoId) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    const optimistic: CopilotMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    try {
      const { data, error } = await supabase.functions.invoke("projeto-copilot", {
        body: {
          projeto_id: projetoId,
          thread_id: threadId ?? undefined,
          user_message: trimmed,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const newThreadId = data.thread_id as string;
      setThreadId(newThreadId);
      const assistant: CopilotMessage = {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content: data.reply ?? "",
        sources: data.sources ?? [],
        created_at: new Date().toISOString(),
      };
      setMessages((m) => [...m, assistant]);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao consultar o copiloto.");
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  }

  return { threadId, messages, sending, send, loadThread, newThread };
}
