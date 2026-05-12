/**
 * Utilitário global para confirmar ações destrutivas / irreversíveis no
 * módulo Projetos (conclusão e exclusão de tarefas).
 *
 * Evita que cliques acidentais em checkboxes, atalhos ou drag-and-drop
 * disparem mudanças sem confirmação explícita do usuário.
 *
 * Uso:
 *   const ok = await confirmConclusaoTarefa({ titulo: tarefa.titulo });
 *   if (!ok) return;
 *   toggleTarefaCompleta.mutate(tarefa);
 *
 *   const ok = await confirmExclusaoTarefa({ titulo: tarefa.titulo });
 *   if (!ok) return;
 *   softDeleteTarefa.mutate(tarefa.id);
 */

export type ConfirmKind = "conclusao" | "exclusao";

export interface ConfirmTarefaOptions {
  titulo?: string;
  descricao?: string;
  /** Quantidade de tarefas (para ações em lote) */
  quantidade?: number;
  /** Indica que é uma subtarefa (afeta o texto do diálogo) */
  isSubtarefa?: boolean;
}

interface PendingRequest extends ConfirmTarefaOptions {
  kind: ConfirmKind;
  resolve: (ok: boolean) => void;
}

export const CONFIRM_TAREFA_EVENT = "projetos-confirmar-acao-tarefa";

// Evento legado mantido apenas para compatibilidade.
export const CONFIRM_CONCLUSAO_EVENT = CONFIRM_TAREFA_EVENT;

function dispatch(kind: ConfirmKind, opts: ConfirmTarefaOptions): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    const detail: PendingRequest = { ...opts, kind, resolve };
    window.dispatchEvent(
      new CustomEvent<PendingRequest>(CONFIRM_TAREFA_EVENT, { detail }),
    );
  });
}

export function confirmConclusaoTarefa(
  opts: ConfirmTarefaOptions = {},
): Promise<boolean> {
  return dispatch("conclusao", opts);
}

export function confirmExclusaoTarefa(
  opts: ConfirmTarefaOptions = {},
): Promise<boolean> {
  return dispatch("exclusao", opts);
}

// Tipo exportado para o listener
export type { PendingRequest as ConfirmTarefaPendingRequest };
