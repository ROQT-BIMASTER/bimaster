import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CopilotSource {
  tipo: string;
  id: string;
  label: string;
}

export interface CopilotProposal {
  id: string;
  tipo: "criar_tarefa" | "ajustar_prazo" | "reatribuir" | "mudar_status" | "mudar_prioridade" | string;
  payload: any;
  resumo: string;
  diff?: { campo: string; de: any; para: any }[];
  status?: "proposta" | "aplicada" | "descartada" | "falhou" | "expirada";
}

export interface CopilotReport {
  relatorio_id: string;
  signed_url: string;
  nome_arquivo: string;
  formato: "pdf" | "xlsx";
  tipo: string;
}

export interface CopilotMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  sources?: CopilotSource[] | null;
  proposals?: CopilotProposal[];
  reports?: CopilotReport[];
  model?: string | null;
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
      .select("id, role, content, sources, model, created_at")
      .eq("thread_id", id)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Não foi possível carregar a conversa.");
      return;
    }
    setMessages((data ?? []) as unknown as CopilotMessage[]);
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
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Falha no copiloto.");
      const newThreadId = data.thread_id as string;
      setThreadId(newThreadId);
      const assistant: CopilotMessage = {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content: data.reply ?? "",
        sources: data.sources ?? [],
        proposals: (data.proposals ?? []) as CopilotProposal[],
        reports: (data.reports ?? []) as CopilotReport[],
        model: data.model ?? null,
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

  async function applyProposal(acaoId: string, password: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke("projeto-copilot-aplicar", {
        body: { acao_id: acaoId, password },
      });
      if (error) throw error;
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Falha ao aplicar.");
      // marca proposta como aplicada localmente
      setMessages((ms) =>
        ms.map((m) => ({
          ...m,
          proposals: m.proposals?.map((p) => (p.id === acaoId ? { ...p, status: "aplicada" } : p)),
        })),
      );
      toast.success("Ação aplicada com sucesso.");
      return true;
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível aplicar a ação.");
      return false;
    }
  }

  async function discardProposal(acaoId: string) {
    // marca local + atualiza no banco via RPC genérica seria ideal; aqui chamamos update direto na tabela
    // (RLS nega — usamos approach: simplesmente marcar localmente)
    setMessages((ms) =>
      ms.map((m) => ({
        ...m,
        proposals: m.proposals?.map((p) => (p.id === acaoId ? { ...p, status: "descartada" } : p)),
      })),
    );
  }

  return { threadId, messages, sending, send, loadThread, newThread, applyProposal, discardProposal };
}
