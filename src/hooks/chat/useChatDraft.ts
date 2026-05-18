/**
 * useChatDraft — rascunho persistente por conversa em localStorage.
 *
 * Por que: o usuário às vezes alterna entre conversas no meio de uma
 * mensagem longa. Hoje o texto se perde ao trocar de conversa. Persistir
 * em localStorage é suficiente (rascunho é por dispositivo, não por usuário
 * global) e não exige rede.
 *
 * API:
 *   const { draft, setDraft, clearDraft } = useChatDraft(conversaId);
 *
 * Estratégia:
 *  - Chave: `chat:draft:<conversaId>`
 *  - Limite: 8KB por rascunho (qualquer coisa maior provavelmente é colagem
 *    acidental e não vale persistir).
 *  - Limpa automaticamente após enviar a mensagem (via clearDraft).
 *  - Limpa quando o conteúdo fica vazio (não polui o storage).
 */
import { useCallback, useEffect, useState } from "react";

const KEY_PREFIX = "chat:draft:";
const MAX_BYTES = 8 * 1024;

function readDraft(conversaId: string | null): string {
  if (!conversaId || typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(KEY_PREFIX + conversaId) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(conversaId: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    if (!value) {
      window.localStorage.removeItem(KEY_PREFIX + conversaId);
      return;
    }
    if (new Blob([value]).size > MAX_BYTES) return;
    window.localStorage.setItem(KEY_PREFIX + conversaId, value);
  } catch {
    // localStorage cheio ou indisponível: ignora silenciosamente.
  }
}

export function useChatDraft(conversaId: string | null) {
  const [draft, setDraftState] = useState<string>(() => readDraft(conversaId));

  // Ao trocar de conversa, recarrega o rascunho daquela conversa.
  useEffect(() => {
    setDraftState(readDraft(conversaId));
  }, [conversaId]);

  const setDraft = useCallback(
    (value: string) => {
      setDraftState(value);
      if (conversaId) writeDraft(conversaId, value);
    },
    [conversaId],
  );

  const clearDraft = useCallback(() => {
    setDraftState("");
    if (conversaId) writeDraft(conversaId, "");
  }, [conversaId]);

  return { draft, setDraft, clearDraft };
}
