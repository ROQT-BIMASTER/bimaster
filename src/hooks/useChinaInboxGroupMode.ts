import { useEffect, useState, useCallback } from "react";
import type { MailboxFolder } from "@/hooks/useChinaMailbox";

export type ChinaInboxGroupMode = "flat" | "grouped";

const KEY = "china-inbox-group-mode-v2";

// Pastas onde agrupar por submissão é o comportamento mais útil por padrão
// (item de checklist solto tem pouco contexto sem o pai).
const DEFAULT_GROUPED: MailboxFolder[] = [
  "awaiting_send",
  "sent_brazil",
  "in_analysis",
  "returned",
];

function defaultFor(folder: MailboxFolder): ChinaInboxGroupMode {
  return DEFAULT_GROUPED.includes(folder) ? "grouped" : "flat";
}

function readMap(): Partial<Record<MailboxFolder, ChinaInboxGroupMode>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // ignore
  }
  return {};
}

/**
 * Persiste a preferência de agrupamento POR PASTA da Caixa de Entrada China.
 * Pastas China (saída/acompanhamento) iniciam em "grouped" — caixas com
 * dezenas de itens de checklist soltos ficam ilegíveis sem agrupamento.
 */
export function useChinaInboxGroupMode(folder: MailboxFolder) {
  const [map, setMap] = useState<Partial<Record<MailboxFolder, ChinaInboxGroupMode>>>(() => readMap());

  const mode: ChinaInboxGroupMode = map[folder] ?? defaultFor(folder);

  const setMode = useCallback(
    (next: ChinaInboxGroupMode) => {
      setMap((prev) => {
        const merged = { ...prev, [folder]: next };
        try {
          window.localStorage.setItem(KEY, JSON.stringify(merged));
        } catch {
          // ignore (modo privado)
        }
        return merged;
      });
    },
    [folder],
  );

  // Sincroniza entre abas
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return;
      setMap(readMap());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return [mode, setMode] as const;
}
