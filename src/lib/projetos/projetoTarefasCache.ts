/**
 * projetoTarefasCache — helpers reutilizáveis de cache para a view
 * consolidada "projeto-tarefas-v2" (ver `useProjetoTarefas`).
 *
 * Objetivo: centralizar todos os `setQueryData` que aplicam mudanças
 * otimistas (mover tarefa, alterar prioridade/status, reordenar seção,
 * trocar tempId → id real) para evitar inconsistências e re-mount
 * (efeito de "piscar") quando o servidor responde.
 *
 * Regras-chave:
 * - Preserva identidade de objeto para linhas não afetadas (a referência
 *   do array `tarefas` muda, mas cada item não-tocado é o mesmo objeto).
 *   Isso é o que mantém `<ProjetoTarefaRow key={t.id}>` estável e sem
 *   flicker.
 * - Invalidação após mutação usa `refetchType: "none"` por padrão — apenas
 *   marca o cache stale para o próximo gatilho/foco; o estado otimista
 *   continua na tela sem refetch imediato.
 * - Nenhum side-effect além de `queryClient.setQueryData` / `invalidateQueries`.
 *
 * NÃO altera contrato da view (`ProjetoTarefasView`).
 */
import type { QueryClient } from "@tanstack/react-query";
import type {
  ProjetoSecao,
  ProjetoTarefa,
  ProjetoTarefasView,
} from "@/hooks/useProjetoTarefas";

export const projetoTarefasQueryKey = (projetoId: string | undefined) =>
  ["projeto-tarefas-v2", projetoId] as const;

export interface ProjetoTarefasCache {
  /** Lê o snapshot atual da view (ou undefined se cache vazio). */
  get(): ProjetoTarefasView | undefined;
  /** Aplica uma transformação imutável na view; no-op se cache vazio. */
  patch(mutator: (v: ProjetoTarefasView) => ProjetoTarefasView): void;
  /** Atualiza apenas os campos informados em uma tarefa específica. */
  patchTarefa(tarefaId: string, fields: Partial<ProjetoTarefa>): void;
  /** Move uma tarefa para outra seção (sem refetch). */
  moveTarefa(tarefaId: string, secaoDestinoId: string): void;
  /** Reordena tarefas dentro de uma seção segundo `orderedIds`. */
  reorderSecao(secaoId: string, orderedIds: string[]): void;
  /** Troca um tempId por id real preservando o restante do snapshot otimista. */
  swapTempTarefaId(
    tempId: string,
    realId: string,
    extra?: Partial<ProjetoTarefa>,
  ): void;
  /** Troca um tempId de seção por id real. */
  swapTempSecaoId(
    tempId: string,
    realId: string,
    extra?: Partial<ProjetoSecao>,
  ): void;
  /** Restaura um snapshot anterior (rollback). */
  restore(previous: ProjetoTarefasView | undefined): void;
  /**
   * Marca o cache stale sem disparar refetch imediato. Use em `onSettled`
   * para evitar o "piscar" causado por re-mount após mutações otimistas.
   */
  markStale(): void;
  /**
   * Invalida agressivamente (refetch imediato). Use APENAS em `onError`
   * para reconciliar com o servidor quando a mutação falhou.
   */
  invalidateNow(): void;
}

export function createProjetoTarefasCache(
  queryClient: QueryClient,
  projetoId: string | undefined,
): ProjetoTarefasCache {
  const key = projetoTarefasQueryKey(projetoId);

  const get = () => queryClient.getQueryData<ProjetoTarefasView>(key);

  const patch: ProjetoTarefasCache["patch"] = (mutator) => {
    queryClient.setQueryData<ProjetoTarefasView>(key, (old) =>
      old ? mutator(old) : old,
    );
  };

  const patchTarefa: ProjetoTarefasCache["patchTarefa"] = (tarefaId, fields) => {
    patch((v) => ({
      ...v,
      tarefas: v.tarefas.map((t) => (t.id === tarefaId ? { ...t, ...fields } : t)),
    }));
  };

  const moveTarefa: ProjetoTarefasCache["moveTarefa"] = (tarefaId, secaoDestinoId) => {
    patchTarefa(tarefaId, { secao_id: secaoDestinoId });
  };

  const reorderSecao: ProjetoTarefasCache["reorderSecao"] = (secaoId, orderedIds) => {
    const orderMap = new Map(orderedIds.map((id, idx) => [id, idx]));
    patch((v) => ({
      ...v,
      tarefas: v.tarefas.map((t) =>
        t.secao_id === secaoId && orderMap.has(t.id)
          ? { ...t, ordem: orderMap.get(t.id)! }
          : t,
      ),
    }));
  };

  const swapTempTarefaId: ProjetoTarefasCache["swapTempTarefaId"] = (
    tempId,
    realId,
    extra,
  ) => {
    patch((v) => ({
      ...v,
      tarefas: v.tarefas.map((t) =>
        t.id === tempId ? { ...t, id: realId, ...(extra || {}) } : t,
      ),
    }));
  };

  const swapTempSecaoId: ProjetoTarefasCache["swapTempSecaoId"] = (
    tempId,
    realId,
    extra,
  ) => {
    patch((v) => ({
      ...v,
      secoes: v.secoes.map((s) =>
        s.id === tempId ? { ...s, id: realId, ...(extra || {}) } : s,
      ),
    }));
  };

  const restore: ProjetoTarefasCache["restore"] = (previous) => {
    if (previous) queryClient.setQueryData<ProjetoTarefasView>(key, previous);
  };

  const markStale: ProjetoTarefasCache["markStale"] = () => {
    queryClient.invalidateQueries({ queryKey: key, refetchType: "none" });
  };

  const invalidateNow: ProjetoTarefasCache["invalidateNow"] = () => {
    queryClient.invalidateQueries({ queryKey: key });
  };

  return {
    get,
    patch,
    patchTarefa,
    moveTarefa,
    reorderSecao,
    swapTempTarefaId,
    swapTempSecaoId,
    restore,
    markStale,
    invalidateNow,
  };
}
