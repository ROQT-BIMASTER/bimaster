/**
 * Telemetria da seta de abrir subtarefa (SubtarefasSection).
 *
 * Rastreia cliques e possíveis falhas (handler ausente, id inválido) para
 * garantir paridade entre Projetos (v1) e Central de Trabalho (v2). Todos os
 * eventos ficam em memória e expostos em `window.__subtarefaArrowEvents` para
 * triagem via DevTools. Listeners externos podem ser plugados para envio a
 * um backend de auditoria.
 */

export type SubtarefaArrowEventType = "click" | "missing_handler" | "invalid_id" | "render_error";

export interface SubtarefaArrowEvent {
  type: SubtarefaArrowEventType;
  subtarefaId: string | null | undefined;
  /** "v1" (Projetos) | "v2" (Central) | "unknown". */
  surface: "v1" | "v2" | "unknown";
  at: string;
  pageUrl?: string;
  extra?: Record<string, unknown>;
}

type Listener = (event: SubtarefaArrowEvent) => void;

const buffer: SubtarefaArrowEvent[] = [];
const listeners = new Set<Listener>();
const MAX_BUFFER = 200;

function detectSurface(): SubtarefaArrowEvent["surface"] {
  if (typeof window === "undefined") return "unknown";
  const p = window.location.pathname;
  if (p.includes("/central")) return "v2";
  if (p.includes("/projetos")) return "v1";
  return "unknown";
}

export function reportSubtarefaArrowEvent(input: {
  type: SubtarefaArrowEventType;
  subtarefaId: string | null | undefined;
  extra?: Record<string, unknown>;
}): SubtarefaArrowEvent {
  const event: SubtarefaArrowEvent = {
    type: input.type,
    subtarefaId: input.subtarefaId,
    surface: detectSurface(),
    at: new Date().toISOString(),
    pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
    extra: input.extra,
  };

  buffer.push(event);
  if (buffer.length > MAX_BUFFER) buffer.shift();

  if (typeof window !== "undefined") {
    (window as any).__subtarefaArrowEvents = buffer;
  }

  if (input.type !== "click") {
    // eslint-disable-next-line no-console
    console.warn("[subtarefa-arrow]", event);
  }

  listeners.forEach((l) => {
    try {
      l(event);
    } catch {
      /* noop */
    }
  });

  return event;
}

export function onSubtarefaArrowEvent(handler: Listener): () => void {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

export function getSubtarefaArrowEvents(): SubtarefaArrowEvent[] {
  return [...buffer];
}

export function __resetSubtarefaArrowTelemetry(): void {
  buffer.length = 0;
  listeners.clear();
  if (typeof window !== "undefined") {
    (window as any).__subtarefaArrowEvents = buffer;
  }
}
