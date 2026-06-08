/**
 * Open-gate global para o cache de tarefas (`projeto-tarefas-v2`).
 *
 * Enquanto houver pelo menos um painel de detalhe da tarefa OU Modo Foco
 * ATIVO para um projeto, o hook `useProjetoTarefas` deve evitar refetchs
 * ativos da query principal — o patch otimista já reflete a edição na UI,
 * e um refetch imediato troca a referência da lista e provoca:
 *   - "piscar" da linha/painel (sensação de F5)
 *   - Modo Foco fechando colateralmente em alguns caminhos de re-render.
 *
 * A sincronização final com o backend acontece quando o painel/foco fecha
 * (release final) ou em um evento natural (foco da aba, navegação).
 */

const openCounts = new Map<string, number>();
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) {
    try { l(); } catch { /* noop */ }
  }
}

export function acquireDetailGate(projetoId: string | undefined | null): void {
  if (!projetoId) return;
  openCounts.set(projetoId, (openCounts.get(projetoId) ?? 0) + 1);
}

export function releaseDetailGate(projetoId: string | undefined | null): void {
  if (!projetoId) return;
  const cur = openCounts.get(projetoId) ?? 0;
  if (cur <= 1) {
    openCounts.delete(projetoId);
  } else {
    openCounts.set(projetoId, cur - 1);
  }
  notify();
}

export function isDetailGateActive(projetoId: string | undefined | null): boolean {
  if (!projetoId) return false;
  return (openCounts.get(projetoId) ?? 0) > 0;
}

/** Registra um listener disparado quando algum gate é liberado (para sync diferido). */
export function subscribeDetailGate(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
