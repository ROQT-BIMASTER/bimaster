/**
 * Telemetria leve para falhas de carregamento de avatar.
 *
 * Objetivo: quando um `<AvatarImage>` dispara `onError` no `SmartAvatar`,
 * registramos um evento estruturado (deduplicado por `src`) para que seja
 * possível rastrear quais membros/URLs estão com dados quebrados sem
 * poluir o console com o mesmo erro N vezes por render.
 *
 * O consumo é opt-in:
 *  - Sempre loga um `console.warn` (uma vez por `src`).
 *  - Mantém um buffer em memória (`getAvatarFailures()`) para inspeção
 *    manual via DevTools: `window.__avatarFailures`.
 *  - Permite plugar listeners externos (ex.: enviar para Edge Function
 *    de auditoria) via `onAvatarFailure(handler)`.
 */

export interface AvatarFailureEvent {
  src: string | null | undefined;
  nome: string | null | undefined;
  identifier: string | null | undefined;
  /** Momento do primeiro erro registrado para este `src`. */
  firstSeenAt: string;
  /** Quantidade de vezes que o erro foi observado nesta sessão. */
  count: number;
  /** URL da página onde ocorreu (para triagem). */
  pageUrl?: string;
}

type Listener = (event: AvatarFailureEvent) => void;

const failures = new Map<string, AvatarFailureEvent>();
const listeners = new Set<Listener>();

function keyOf(src: string | null | undefined, nome: string | null | undefined): string {
  return `${src ?? "∅"}::${nome ?? "∅"}`;
}

export function reportAvatarFailure(input: {
  src: string | null | undefined;
  nome: string | null | undefined;
  identifier?: string | null;
}): AvatarFailureEvent {
  const k = keyOf(input.src, input.nome);
  const existing = failures.get(k);
  const now = new Date().toISOString();
  const pageUrl = typeof window !== "undefined" ? window.location.href : undefined;

  const event: AvatarFailureEvent = existing
    ? { ...existing, count: existing.count + 1 }
    : {
        src: input.src ?? null,
        nome: input.nome ?? null,
        identifier: input.identifier ?? null,
        firstSeenAt: now,
        count: 1,
        pageUrl,
      };

  failures.set(k, event);

  // Log apenas na primeira ocorrência para evitar flood no console.
  if (!existing && typeof console !== "undefined") {
    console.warn("[avatar] falha ao carregar imagem", {
      src: event.src,
      nome: event.nome,
      identifier: event.identifier,
      pageUrl: event.pageUrl,
    });
  }

  // Expõe buffer no window para inspeção manual em DevTools.
  if (typeof window !== "undefined") {
    (window as unknown as { __avatarFailures?: AvatarFailureEvent[] }).__avatarFailures =
      getAvatarFailures();
  }

  listeners.forEach((l) => {
    try {
      l(event);
    } catch {
      /* listener isolado — nunca deve quebrar o render do avatar */
    }
  });

  return event;
}

export function getAvatarFailures(): AvatarFailureEvent[] {
  return Array.from(failures.values()).sort((a, b) => b.count - a.count);
}

export function clearAvatarFailures(): void {
  failures.clear();
  if (typeof window !== "undefined") {
    (window as unknown as { __avatarFailures?: AvatarFailureEvent[] }).__avatarFailures = [];
  }
}

export function onAvatarFailure(handler: Listener): () => void {
  listeners.add(handler);
  return () => listeners.delete(handler);
}
