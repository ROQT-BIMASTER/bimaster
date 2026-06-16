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

  // Defesa em profundidade contra o bug conhecido do Radix Dialog que deixa
  // `pointer-events: none` no <body> após o close — especialmente quando o
  // consumidor inicia trabalho assíncrono pesado (loop de mutations + toasts)
  // logo após resolver a Promise. Sintoma: tela "travada" até F5.
  useEffect(() => {
    if (pending !== null) return;
    if (typeof document === "undefined") return;
    const cleanup = () => {
      if (document.body.style.pointerEvents === "none") {
        document.body.style.pointerEvents = "";
      }
      document.body.removeAttribute("data-scroll-locked");
    };
    const t1 = window.setTimeout(cleanup, 0);
    const t2 = window.setTimeout(cleanup, 250);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [pending]);

  const finish = (ok: boolean) => {
    const req = pending;
    setPending(null);
    // Resolve no próximo frame para deixar o Radix concluir o teardown do
    // overlay antes do chamador iniciar trabalho síncrono pesado.
    if (req) {
      if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(() => req.resolve(ok));
      } else {
        req.resolve(ok);
      }
    }
  };

  const isExclusao = pending?.kind === "exclusao";
  const isBulk = (pending?.quantidade ?? 0) > 1;
  const titulo = pending?.titulo?.trim();
  const isSub = !!pending?.isSubtarefa;
  const noun = isSub ? "subtarefa" : "tarefa";
  const nounPlural = isSub ? "subtarefas" : "tarefas";

  const title = pending?.tituloDialog
    ? pending.tituloDialog
    : isExclusao
      ? `Excluir ${isBulk ? nounPlural : noun}?`
      : `Concluir ${isBulk ? nounPlural : noun}?`;

  const qty = pending?.quantidade ?? 0;
  const defaultDescription = isExclusao
    ? isBulk
      ? `Você está prestes a excluir ${qty} ${nounPlural} selecionadas. ` +
        `Elas serão movidas para a lixeira do projeto e poderão ser ` +
        `restauradas por administradores em até 30 dias. ` +
        `Subtarefas vinculadas também serão removidas. Esta ação não pode ` +
        `ser desfeita pelo seu próprio usuário.`
      : titulo
        ? `Deseja realmente excluir a ${noun} "${titulo}"? ` +
          `Ela será movida para a lixeira do projeto e ${isSub ? "" : "todas as subtarefas vinculadas também serão removidas. "}` +
          `Apenas administradores conseguem restaurá-la.`
        : `Deseja realmente excluir esta ${noun}? Ela será movida para a lixeira do projeto.`
    : isBulk
      ? `Você está prestes a marcar ${qty} ${nounPlural} selecionadas como concluídas. ` +
        `O status, a data de conclusão e o registro de auditoria serão ` +
        `atualizados para todas elas de uma só vez. Deseja continuar?`
      : titulo
        ? `Deseja realmente marcar a ${noun} "${titulo}" como concluída? ` +
          `A data de conclusão será preenchida com a data de hoje e a ação ` +
          `ficará registrada no histórico de auditoria.`
        : `Deseja realmente marcar esta ${noun} como concluída?`;

  const actionLabel = pending?.acaoLabel
    ? pending.acaoLabel
    : isExclusao ? "Sim, excluir" : "Sim, concluir";

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
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
