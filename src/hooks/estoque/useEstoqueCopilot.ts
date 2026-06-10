import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeChat } from "@/lib/ai/invokeChat";
import { useCopilotV2Flag } from "@/hooks/useCopilotV2Flag";
import { toast } from "sonner";

export interface EstoqueCopilotFiltros {
  empresaIds: number[];
  marcas: string[];
  linhas: string[];
  busca: string;
  somenteComSaldo: boolean;
  consolidar: boolean;
  modo: "fisico" | "cx" | "bx" | "un";
}

export interface EstoqueCopilotKpisSnapshot {
  caixas?: number;
  displays?: number;
  unidades?: number;
  total_un?: number;
  bloqueado?: number;
  disponivel?: number;
  pendente?: number;
  equivalente_cx?: number;
}

export interface EstoqueCopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface EstoqueCopilotThread {
  id: string;
  titulo: string;
  salvo: boolean;
  updated_at: string;
  created_at: string;
}

interface UseEstoqueCopilotArgs {
  filtros: EstoqueCopilotFiltros;
  kpisSnapshot?: EstoqueCopilotKpisSnapshot;
  enabled: boolean;
}

export function useEstoqueCopilot({ filtros, kpisSnapshot, enabled }: UseEstoqueCopilotArgs) {
  const v2 = useCopilotV2Flag("estoque");
  const [threads, setThreads] = useState<EstoqueCopilotThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<EstoqueCopilotMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const reloadThreads = useCallback(async () => {
    const { data, error } = await supabase
      .from("estoque_copilot_threads" as any)
      .select("id, titulo, salvo, updated_at, created_at")
      .order("updated_at", { ascending: false })
      .limit(40);
    if (error) return;
    setThreads((data ?? []) as any);
  }, []);

  const loadThread = useCallback(async (threadId: string) => {
    setActiveThreadId(threadId);
    setLoading(true);
    const { data, error } = await supabase
      .from("estoque_copilot_mensagens" as any)
      .select("id, role, content, created_at")
      .eq("thread_id", threadId)
      .in("role", ["user", "assistant"])
      .order("created_at", { ascending: true })
      .limit(200);
    setLoading(false);
    if (error) {
      toast.error("Falha ao carregar conversa.");
      return;
    }
    setMessages((data ?? []) as any);
  }, []);

  const newThread = useCallback(() => {
    setActiveThreadId(null);
    setMessages([]);
  }, []);

  const deleteThread = useCallback(
    async (threadId: string) => {
      const { error } = await supabase.from("estoque_copilot_threads" as any).delete().eq("id", threadId);
      if (error) {
        toast.error("Falha ao excluir conversa.");
        return;
      }
      if (activeThreadId === threadId) newThread();
      reloadThreads();
    },
    [activeThreadId, newThread, reloadThreads],
  );

  const toggleSalvo = useCallback(
    async (threadId: string, salvo: boolean) => {
      const { error } = await supabase
        .from("estoque_copilot_threads" as any)
        .update({ salvo })
        .eq("id", threadId);
      if (error) {
        toast.error("Falha ao atualizar conversa.");
        return;
      }
      reloadThreads();
    },
    [reloadThreads],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;
      setSending(true);
      const optimistic: EstoqueCopilotMessage = {
        id: `optimistic-${Date.now()}`,
        role: "user",
        content: trimmed,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);

      const { data, error } = await invokeChat<{ thread_id: string; reply: string }>(
        v2 ? "estoque-copilot-v2" : "estoque-copilot",
        {
          thread_id: activeThreadId ?? undefined,
          user_message: trimmed,
          filtros,
          kpis_snapshot: kpisSnapshot ?? {},
        },
        { timeoutMs: 90_000 },
      );

      setSending(false);

      if (error || !data) {
        toast.error(error?.userMessage ?? "Falha no copiloto.");
        // remove a mensagem otimista para o usuário poder reenviar
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        return;
      }

      if (!activeThreadId) {
        setActiveThreadId(data.thread_id);
        reloadThreads();
      } else {
        reloadThreads();
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.reply ?? "",
          created_at: new Date().toISOString(),
        },
      ]);
    },
    [activeThreadId, filtros, kpisSnapshot, reloadThreads, sending],
  );

  useEffect(() => {
    if (enabled) reloadThreads();
  }, [enabled, reloadThreads]);

  return {
    threads,
    activeThreadId,
    messages,
    loading,
    sending,
    sendMessage,
    loadThread,
    newThread,
    deleteThread,
    toggleSalvo,
    reloadThreads,
  };
}
