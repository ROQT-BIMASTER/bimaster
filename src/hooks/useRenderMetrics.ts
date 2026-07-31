/**
 * Hook de métricas de renderização.
 *
 * Conta renderizações por componente, detecta renderizações duplicadas
 * (mesmas dependências em menos de 50ms) e aponta quais props mudaram.
 *
 * Uso:
 *   useRenderMetrics("ProjetoTarefaDetalhe", { tarefaId, open });
 */
import { useEffect, useRef } from "react";
import { recordRender, isPerfEnabled, perfMark } from "@/lib/debug/perfMetrics";

export function useRenderMetrics(
  label: string,
  signature: Record<string, unknown> = {},
): { renders: number; changed: string[] } {
  const previousRef = useRef<Record<string, unknown> | undefined>(undefined);
  const result = recordRender(label, signature, previousRef.current);
  previousRef.current = signature;

  useEffect(() => {
    if (!isPerfEnabled()) return;
    perfMark(`${label}:mount`);
    return () => perfMark(`${label}:unmount`);
  }, [label]);

  return { renders: result.count, changed: result.changed };
}
