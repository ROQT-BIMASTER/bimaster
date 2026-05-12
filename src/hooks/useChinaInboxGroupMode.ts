import { useEffect, useState } from "react";

export type ChinaInboxGroupMode = "flat" | "grouped";

const KEY = "china-inbox-group-mode";

/**
 * Persiste a preferência de agrupamento da Caixa de Entrada China.
 * - "grouped": agrupa documentos pela mesma submissão/OC (padrão).
 * - "flat": comportamento clássico — um item por documento.
 */
export function useChinaInboxGroupMode() {
  const [mode, setMode] = useState<ChinaInboxGroupMode>(() => {
    if (typeof window === "undefined") return "grouped";
    const v = window.localStorage.getItem(KEY);
    return v === "flat" || v === "grouped" ? v : "grouped";
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, mode);
    } catch {
      // ignore (modo privado)
    }
  }, [mode]);

  return [mode, setMode] as const;
}
