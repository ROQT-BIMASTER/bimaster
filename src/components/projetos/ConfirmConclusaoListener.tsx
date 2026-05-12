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
import { CheckCircle2, Trash2 } from "lucide-react";
import {
  CONFIRM_TAREFA_EVENT,
  type ConfirmTarefaPendingRequest,
} from "@/lib/projetos/confirmConclusao";
import { cn } from "@/lib/utils";

/**
 * Listener global montado no App. Captura o evento disparado por
 * `confirmConclusaoTarefa(...)` e `confirmExclusaoTarefa(...)` e
 * exibe um AlertDialog de confirmação antes de permitir que a ação
 * destrutiva prossiga.
 */
export function ConfirmConclusaoListener() {
  const [pending, setPending] = useState<ConfirmTarefaPendingRequest | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<ConfirmTarefaPendingRequest>;
      if (ce.detail) setPending(ce.detail);
    };
    window.addEventListener(CONFIRM_TAREFA_EVENT, handler);
    return () => window.removeEventListener(CONFIRM_TAREFA_EVENT, handler);
  }, []);

  const finish = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  const isExclusao = pending?.kind === "exclusao";
  const isBulk = (pending?.quantidade ?? 0) > 1;
  const titulo = pending?.titulo?.trim();
  const isSub = !!pending?.isSubtarefa;
  const noun = isSub ? "subtarefa" : "tarefa";
  const nounPlural = isSub ? "subtarefas" : "tarefas";

  const title = isExclusao
    ? `Excluir ${isBulk ? nounPlural : noun}?`
    : `Concluir ${isBulk ? nounPlural : noun}?`;

  const defaultDescription = isExclusao
    ? isBulk
      ? `Você está prestes a excluir ${pending?.quantidade} ${nounPlural}. Esta ação não pode ser desfeita pelo próprio usuário.`
      : titulo
        ? `Deseja realmente excluir a ${noun} "${titulo}"? Ela será movida para a lixeira do projeto.`
        : `Deseja realmente excluir esta ${noun}? Ela será movida para a lixeira do projeto.`
    : isBulk
      ? `Você está prestes a marcar ${pending?.quantidade} ${nounPlural} como concluídas. Deseja continuar?`
      : titulo
        ? `Deseja realmente marcar a ${noun} "${titulo}" como concluída?`
        : `Deseja realmente marcar esta ${noun} como concluída?`;

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
            {isExclusao ? (
              <Trash2 className="h-5 w-5 text-destructive" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            )}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pending?.descricao ?? defaultDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => finish(false)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => finish(true)}
            className={cn(
              isExclusao && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            )}
          >
            {isExclusao ? "Sim, excluir" : "Sim, concluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
