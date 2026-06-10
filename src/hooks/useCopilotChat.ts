// useCopilotChat — single hook every copilot uses for messages + streaming.

import { useCallback, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CopilotActionPayload, Citation } from "@/types/copilot";
import type { CopilotMessage } from "@/components/copilot/shared/CopilotChatShell";

interface UseCopilotChatOpts {
  copilotId: string;
  edgeFunction: string;
  scope?: Record<string, unknown>;
  initialMessages?: CopilotMessage[];
}

export function useCopilotChat(opts: UseCopilotChatOpts) {
  const [messages, setMessages] = useState<CopilotMessage[]>(opts.initialMessages ?? []);
  const [isStreaming, setStreaming] = useState(false);

  const send = useCallback(
    async (text: string) => {
      const userMsg: CopilotMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
      };
      setMessages((prev) => [...prev, userMsg]);
      setStreaming(true);
      try {
        const { data, error } = await supabase.functions.invoke<{
          assistantMessage: string;
          citations?: Citation[];
          actions?: CopilotActionPayload[];
          meta?: { unverifiableCount?: number };
        }>(opts.edgeFunction, {
          body: {
            text,
            copilotId: opts.copilotId,
            scope: opts.scope ?? {},
            clientActionId: crypto.randomUUID(),
          },
        });
        if (error) throw error;
        if (!data) throw new Error("empty_response");
        const assistant: CopilotMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.assistantMessage,
          citations: data.citations,
          actions: data.actions,
          meta: { unverifiableCount: data.meta?.unverifiableCount },
        };
        setMessages((prev) => [...prev, assistant]);
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Não foi possível responder agora: ${e instanceof Error ? e.message : "erro desconhecido"}.`,
          },
        ]);
      } finally {
        setStreaming(false);
      }
    },
    [opts.copilotId, opts.edgeFunction, opts.scope],
  );

  const confirmAction = useCallback(
    async (proposalId: string) => {
      const { error } = await supabase.functions.invoke(`${opts.edgeFunction}-aplicar`, {
        body: { proposalId },
      });
      if (error) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "system", content: `Falha ao confirmar: ${error.message}` },
        ]);
      } else {
        setMessages((prev) =>
          prev.map((m) => ({
            ...m,
            actions: m.actions?.filter((a) => a.proposalId !== proposalId),
          })),
        );
      }
    },
    [opts.edgeFunction],
  );

  const cancelAction = useCallback((proposalId: string) => {
    setMessages((prev) =>
      prev.map((m) => ({
        ...m,
        actions: m.actions?.filter((a) => a.proposalId !== proposalId),
      })),
    );
  }, []);

  return useMemo(
    () => ({ messages, isStreaming, send, confirmAction, cancelAction }),
    [messages, isStreaming, send, confirmAction, cancelAction],
  );
}
