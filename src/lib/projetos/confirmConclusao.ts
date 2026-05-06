/**
 * Utilitário global para confirmar a conclusão de tarefas no módulo Projetos.
 *
 * Evita que cliques acidentais no checkbox/atalho marquem a tarefa como
 * concluída sem confirmação explícita do usuário.
 *
 * Uso:
 *   const ok = await confirmConclusaoTarefa({ titulo: tarefa.titulo });
 *   if (!ok) return;
 *   toggleTarefaCompleta.mutate(tarefa);
 */

export interface ConfirmConclusaoOptions {
  titulo?: string;
  descricao?: string;
  /** Quantidade de tarefas (para ações em lote) */
  quantidade?: number;
}

interface PendingRequest extends ConfirmConclusaoOptions {
  resolve: (ok: boolean) => void;
}

export const CONFIRM_CONCLUSAO_EVENT = "projetos-confirmar-conclusao";

export function confirmConclusaoTarefa(
  opts: ConfirmConclusaoOptions = {},
): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    const detail: PendingRequest = { ...opts, resolve };
    window.dispatchEvent(
      new CustomEvent<PendingRequest>(CONFIRM_CONCLUSAO_EVENT, { detail }),
    );
  });
}
