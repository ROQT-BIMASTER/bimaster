import { useLocation } from "react-router-dom";

/**
 * Retorno de navegação genérico: a tela de origem repassa
 * `from` (URL atual com querystring) e um rótulo opcional. A tela de destino
 * resolve via `useResolvedBackTo()`, priorizando `location.state` (mais limpo)
 * e caindo para `?from=` (sobrevive a refresh / link compartilhado).
 */

export interface ReturnToOptions {
  /** rótulo amigável da origem (ex.: "Mesa de Vínculo") */
  fromLabel?: string;
}

export interface BuiltReturnTarget {
  url: string;
  state: { from: string; fromLabel?: string };
}

/** Anexa `?from=<encoded>` à URL alvo e devolve também o `state` para `navigate()`. */
export function buildReturnToTarget(
  target: string,
  fromPath: string,
  options?: ReturnToOptions,
): BuiltReturnTarget {
  const sep = target.includes("?") ? "&" : "?";
  const url = `${target}${sep}from=${encodeURIComponent(fromPath)}`;
  return { url, state: { from: fromPath, fromLabel: options?.fromLabel } };
}

/** Resolve para qual URL o botão "voltar" da página atual deve apontar. */
export function useResolvedBackTo(fallback: string): {
  backTo: string;
  backLabel?: string;
} {
  const loc = useLocation();
  const stateFrom = (loc.state as any)?.from as string | undefined;
  const stateLabel = (loc.state as any)?.fromLabel as string | undefined;
  const queryFrom = new URLSearchParams(loc.search).get("from");
  const backTo =
    stateFrom || (queryFrom ? safeDecode(queryFrom) : fallback);
  return { backTo, backLabel: stateLabel };
}

function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}
