import { useConfirmContext, type ConfirmFn, type ConfirmOptions } from "@/components/ui/confirm-dialog";

/**
 * Dialog de confirmação tematizado (substitui window.confirm).
 *
 * Uso:
 * ```tsx
 * const confirm = useConfirm();
 * const ok = await confirm({
 *   title: "Excluir item?",
 *   description: "Esta ação não pode ser desfeita.",
 *   destructive: true,
 * });
 * if (!ok) return;
 * ```
 *
 * Requer <ConfirmDialogProvider> montado em App.tsx.
 */
export function useConfirm(): ConfirmFn {
  return useConfirmContext();
}

export type { ConfirmFn, ConfirmOptions };
