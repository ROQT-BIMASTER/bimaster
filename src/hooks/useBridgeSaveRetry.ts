import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Helper compartilhado pelos "bridges" da tela de detalhes/Focus Mode
 * (MinhasTarefasContent / MinhasTarefasSimples).
 *
 * - Mantém um contador de operações em curso (`isSaving`) para a UI
 *   exibir um indicador discreto de "Salvando…" no header, evitando a
 *   sensação de que a tela "fechou".
 * - Encapsula a chamada ao backend com tratamento de erro e botão
 *   "Tentar novamente" no toast — sem fechar o painel.
 *
 * O painel de detalhes NÃO é fechado em nenhum caminho de erro: o
 * caller apenas inspeciona `result.ok` e decide se invalida queries.
 */
export function useBridgeSaveRetry() {
  const [savingCount, setSavingCount] = useState(0);
  const fnRef = useRef<
    <T>(label: string, op: () => PromiseLike<T>) => Promise<{ ok: true; data: T } | { ok: false }>
  >(null as any);

  const attemptSave = useCallback(
    async <T,>(
      label: string,
      op: () => PromiseLike<T>,
    ): Promise<{ ok: true; data: T } | { ok: false }> => {
      setSavingCount((c) => c + 1);
      try {
        const res = await op();
        const err = (res as any)?.error;
        if (err) {
          toast.error(`${label} falhou`, {
            description: err.message || "Verifique sua conexão e tente novamente.",
            action: {
              label: "Tentar novamente",
              onClick: () => {
                void fnRef.current(label, op);
              },
            },
          });
          return { ok: false };
        }
        return { ok: true, data: res };
      } catch (e: any) {
        toast.error(`${label} falhou`, {
          description: e?.message || "Verifique sua conexão e tente novamente.",
          action: {
            label: "Tentar novamente",
            onClick: () => {
              void fnRef.current(label, op);
            },
          },
        });
        return { ok: false };
      } finally {
        setSavingCount((c) => Math.max(0, c - 1));
      }
    },
    [],
  );

  useEffect(() => {
    fnRef.current = attemptSave;
  }, [attemptSave]);

  return { isSaving: savingCount > 0, attemptSave };
}
