import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConfirmOptions = {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmDialogContext = React.createContext<ConfirmFn | null>(null);

type PendingState = {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
};

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<PendingState | null>(null);
  // Mantemos a referência da última solicitação para resolver corretamente quando o dialog fecha.
  const pendingRef = React.useRef<PendingState | null>(null);
  pendingRef.current = pending;

  const confirm = React.useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      // Se já houver um dialog aberto, resolvemos a chamada anterior como falsa antes de substituir.
      if (pendingRef.current) {
        pendingRef.current.resolve(false);
      }
      setPending({ options, resolve });
    });
  }, []);

  const handleOpenChange = (open: boolean) => {
    if (!open && pending) {
      pending.resolve(false);
      setPending(null);
    }
  };

  const handleConfirm = () => {
    if (!pending) return;
    pending.resolve(true);
    setPending(null);
  };

  const handleCancel = () => {
    if (!pending) return;
    pending.resolve(false);
    setPending(null);
  };

  const opts = pending?.options;

  return (
    <ConfirmDialogContext.Provider value={confirm}>
      {children}
      <AlertDialog open={!!pending} onOpenChange={handleOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{opts?.title ?? ""}</AlertDialogTitle>
            {opts?.description ? (
              <AlertDialogDescription asChild>
                <div className="whitespace-pre-line">{opts.description}</div>
              </AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>
              {opts?.cancelLabel ?? "Cancelar"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={cn(
                opts?.destructive &&
                  buttonVariants({ variant: "destructive" }),
              )}
            >
              {opts?.confirmLabel ?? "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmContext(): ConfirmFn {
  const ctx = React.useContext(ConfirmDialogContext);
  if (!ctx) {
    throw new Error(
      "useConfirm() requer <ConfirmDialogProvider> montado na árvore (ver src/App.tsx).",
    );
  }
  return ctx;
}
