import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCopilotV2Flag } from "@/hooks/useCopilotV2Flag";
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
      const { data, error } = await supabase.functions.invoke(
        v2 ? "projeto-copilot-v2" : "projeto-copilot",
        {
          body: {
            projeto_id: projetoId,
            thread_id: threadId ?? undefined,
            user_message: trimmed,
          },
        },
      );
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

  const listThreads = useCallback(async () => {
    if (!projetoId) return [];
    const { data, error } = await supabase
      .from("projeto_copilot_threads")
      .select("id, titulo, salvo, created_at, updated_at, expires_at")
      .eq("projeto_id", projetoId)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) {
      toast.error("Não foi possível carregar conversas anteriores.");
      return [];
    }
    return data ?? [];
  }, [projetoId]);

  const setThreadSalvo = useCallback(async (id: string, salvo: boolean) => {
    const { error } = await (supabase as any).rpc("copilot_set_thread_salvo", {
      _thread_id: id, _salvo: salvo,
    });
    if (error) { toast.error("Falha ao atualizar conversa."); return false; }
    toast.success(salvo ? "Conversa salva (não expira)." : "Conversa volta a expirar em 30 dias.");
    return true;
  }, []);

  const salvarRelatorio = useCallback(async (
    relatorio_id: string,
    opts: { salvo?: boolean; nome_personalizado?: string; tarefa_id?: string } = {},
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke("projeto-copilot-salvar-relatorio", {
        body: { relatorio_id, ...opts },
      });
      if (error) throw error;
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Falha ao salvar.");
      toast.success(opts.tarefa_id ? "Relatório vinculado à tarefa." : (opts.salvo ? "Relatório salvo." : "Atualizado."));
      return true;
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar.");
      return false;
    }
  }, []);

  return {
    threadId, messages, sending, send, loadThread, newThread, applyProposal, discardProposal,
    listThreads, setThreadSalvo, salvarRelatorio,
  };
}
