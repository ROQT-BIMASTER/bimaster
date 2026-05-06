import { useEffect, useState } from "react";
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
import { CheckCircle2 } from "lucide-react";
import { CONFIRM_CONCLUSAO_EVENT, type ConfirmConclusaoOptions } from "@/lib/projetos/confirmConclusao";

interface PendingRequest extends ConfirmConclusaoOptions {
  resolve: (ok: boolean) => void;
}

/**
 * Listener global montado no App. Captura o evento disparado por
 * `confirmConclusaoTarefa(...)` e exibe um AlertDialog de confirmação
 * antes de permitir que a tarefa seja marcada como concluída.
 */
export function ConfirmConclusaoListener() {
  const [pending, setPending] = useState<PendingRequest | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<PendingRequest>;
      if (ce.detail) setPending(ce.detail);
    };
    window.addEventListener(CONFIRM_CONCLUSAO_EVENT, handler);
    return () => window.removeEventListener(CONFIRM_CONCLUSAO_EVENT, handler);
  }, []);

  const finish = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  const isBulk = (pending?.quantidade ?? 0) > 1;
  const titulo = pending?.titulo?.trim();

  return (
    <AlertDialog
      open={!!pending}
      onOpenChange={(open) => {
        if (!open && pending) finish(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Concluir tarefa{isBulk ? "s" : ""}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pending?.descricao ??
              (isBulk
                ? `Você está prestes a marcar ${pending?.quantidade} tarefas como concluídas. Deseja continuar?`
                : titulo
                  ? `Deseja realmente marcar a tarefa "${titulo}" como concluída?`
                  : "Deseja realmente marcar esta tarefa como concluída?")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => finish(false)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => finish(true)}>
            Sim, concluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
