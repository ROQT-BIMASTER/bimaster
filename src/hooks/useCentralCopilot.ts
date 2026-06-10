import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { toast } from "sonner";

export interface CentralSource { tipo: string; id: string; label: string }
export interface CentralProposal {
  id: string;
  tipo: string;
  payload: any;
  resumo: string;
  diff?: { campo: string; de: any; para: any }[];
  status?: "proposta" | "aplicada" | "descartada" | "falhou" | "expirada";
}
export interface CentralReport {
  relatorio_id: string;
  signed_url: string;
  nome_arquivo: string;
  formato: "pdf" | "xlsx";
  tipo: string;
}
export interface CentralMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  sources?: CentralSource[] | null;
  proposals?: CentralProposal[];
  reports?: CentralReport[];
  model?: string | null;
  created_at: string;
}

export function useCentralCopilot() {
  
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CentralMessage[]>([]);
  const [sending, setSending] = useState(false);

  const loadThread = useCallback(async (id: string) => {
    setThreadId(id);
    const { data, error } = await (supabase as any)
      .from("central_copilot_mensagens")
      .select("id, role, content, sources, model, created_at")
      .eq("thread_id", id)
      .order("created_at", { ascending: true });
    if (error) { toast.error("Não foi possível carregar a conversa."); return; }
    setMessages((data ?? []) as CentralMessage[]);
  }, []);

  const newThread = useCallback(() => { setThreadId(null); setMessages([]); }, []);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    const optimistic: CentralMessage = {
      id: `tmp-${Date.now()}`, role: "user", content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    try {
      const { data, error } = await supabase.functions.invoke(
        v2 ? "central-copilot-v2" : "central-copilot",
        { body: { thread_id: threadId ?? undefined, user_message: trimmed } },
      );
      if (error) throw error;
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Falha no copiloto.");
      setThreadId(data.thread_id as string);
      const assistant: CentralMessage = {
        id: `asst-${Date.now()}`, role: "assistant",
        content: data.reply ?? "",
        sources: data.sources ?? [],
        proposals: (data.proposals ?? []) as CentralProposal[],
        reports: (data.reports ?? []) as CentralReport[],
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
  }, [threadId, v2]);

  const applyProposal = useCallback(async (acaoId: string, password: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("central-copilot-aplicar", {
        body: { acao_id: acaoId, password },
      });
      if (error) throw error;
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Falha ao aplicar.");
      setMessages((ms) => ms.map((m) => ({
        ...m,
        proposals: m.proposals?.map((p) => (p.id === acaoId ? { ...p, status: "aplicada" } : p)),
      })));
      toast.success("Ação aplicada com sucesso.");
      return true;
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível aplicar.");
      return false;
    }
  }, []);

  const discardProposal = useCallback((acaoId: string) => {
    setMessages((ms) => ms.map((m) => ({
      ...m,
      proposals: m.proposals?.map((p) => (p.id === acaoId ? { ...p, status: "descartada" } : p)),
    })));
  }, []);

  const listThreads = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("central_copilot_threads")
      .select("id, titulo, salvo, created_at, updated_at, expires_at")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) { toast.error("Não foi possível carregar conversas."); return []; }
    return data ?? [];
  }, []);

  const setThreadSalvo = useCallback(async (id: string, salvo: boolean) => {
    const { error } = await (supabase as any).rpc("copilot_set_central_thread_salvo", {
      _thread_id: id, _salvo: salvo,
    });
    if (error) { toast.error("Falha ao atualizar conversa."); return false; }
    toast.success(salvo ? "Conversa salva (não expira)." : "Conversa volta a expirar em 30 dias.");
    return true;
  }, []);

  const salvarRelatorio = useCallback(async (
    relatorio_id: string,
    opts: { salvo?: boolean; nome_personalizado?: string; tarefa_id?: string; projeto_id?: string } = {},
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke("central-copilot-salvar-relatorio", {
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
    threadId, messages, sending, send, loadThread, newThread,
    applyProposal, discardProposal, listThreads, setThreadSalvo, salvarRelatorio,
  };
}
