import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEventExpenses } from "@/hooks/useEventExpenses";
import {
  type EventWithPendingExpenses,
  type PendingExpense,
  getCategoryLabel,
} from "@/hooks/usePendingEventExpenses";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle,
  XCircle,
  Loader2,
  DollarSign,
  Calendar,
  User,
  Paperclip,
  FileText,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface AprovarDespesasEventoDialogProps {
  eventGroup: EventWithPendingExpenses | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AprovarDespesasEventoDialog({
  eventGroup,
  open,
  onOpenChange,
}: AprovarDespesasEventoDialogProps) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const queryClient = useQueryClient();

  const { approveExpense, rejectExpense } = useEventExpenses(eventGroup?.event_id);

  const handleApprove = async (expenseId: string) => {
    await approveExpense.mutateAsync(expenseId);
    queryClient.invalidateQueries({ queryKey: ["pending-event-expenses"] });
  };

  const handleReject = async (expenseId: string) => {
    if (!rejectReason.trim()) return;
    await rejectExpense.mutateAsync({ id: expenseId, reason: rejectReason });
    queryClient.invalidateQueries({ queryKey: ["pending-event-expenses"] });
    setRejectingId(null);
    setRejectReason("");
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      setRejectingId(null);
      setRejectReason("");
    }
    onOpenChange(newOpen);
  };

  if (!eventGroup) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Despesas Pendentes — {eventGroup.event_code}
          </DialogTitle>
          <DialogDescription>
            {eventGroup.event_name} • {eventGroup.total_pending} despesa(s) aguardando aprovação
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            {eventGroup.expenses.map((expense) => (
              <ExpenseCard
                key={expense.id}
                expense={expense}
                isRejecting={rejectingId === expense.id}
                rejectReason={rejectReason}
                onRejectReasonChange={setRejectReason}
                onStartReject={() => {
                  setRejectingId(expense.id);
                  setRejectReason("");
                }}
                onCancelReject={() => {
                  setRejectingId(null);
                  setRejectReason("");
                }}
                onApprove={() => handleApprove(expense.id)}
                onConfirmReject={() => handleReject(expense.id)}
                isApproving={approveExpense.isPending}
                isRejectingMutation={rejectExpense.isPending}
              />
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

interface ExpenseCardProps {
  expense: PendingExpense;
  isRejecting: boolean;
  rejectReason: string;
  onRejectReasonChange: (value: string) => void;
  onStartReject: () => void;
  onCancelReject: () => void;
  onApprove: () => void;
  onConfirmReject: () => void;
  isApproving: boolean;
  isRejectingMutation: boolean;
}

function ExpenseCard({
  expense,
  isRejecting,
  rejectReason,
  onRejectReasonChange,
  onStartReject,
  onCancelReject,
  onApprove,
  onConfirmReject,
  isApproving,
  isRejectingMutation,
}: ExpenseCardProps) {
  const valorPrincipal = expense.valor_realizado || expense.valor_previsto || 0;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">{getCategoryLabel(expense.category)}</Badge>
            {expense.attachments.length > 0 && (
              <Badge variant="secondary" className="gap-1">
                <Paperclip className="h-3 w-3" />
                {expense.attachments.length} anexo(s)
              </Badge>
            )}
          </div>
          {expense.description && (
            <p className="text-sm text-muted-foreground">{expense.description}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-center gap-1 font-semibold">
            <DollarSign className="h-4 w-4 text-primary" />
            R$ {valorPrincipal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
          {expense.valor_previsto > 0 && expense.valor_realizado > 0 && expense.valor_previsto !== expense.valor_realizado && (
            <p className="text-xs text-muted-foreground">
              Previsto: R$ {expense.valor_previsto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {expense.expense_date && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(expense.expense_date), "dd/MM/yyyy", { locale: ptBR })}
          </span>
        )}
        {expense.creator?.nome && (
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {expense.creator.nome}
          </span>
        )}
      </div>

      <Separator />

      {!isRejecting ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={onStartReject}
          >
            <XCircle className="mr-1 h-4 w-4" />
            Rejeitar
          </Button>
          <Button size="sm" onClick={onApprove} disabled={isApproving}>
            {isApproving ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-1 h-4 w-4" />
            )}
            Aprovar
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Label className="text-sm">Motivo da Rejeição *</Label>
          <Textarea
            value={rejectReason}
            onChange={(e) => onRejectReasonChange(e.target.value)}
            placeholder="Informe o motivo da rejeição..."
            rows={2}
          />
          {!rejectReason.trim() && (
            <p className="text-xs text-destructive">O motivo é obrigatório.</p>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="outline" onClick={onCancelReject}>
              Cancelar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={onConfirmReject}
              disabled={!rejectReason.trim() || isRejectingMutation}
            >
              {isRejectingMutation ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-1 h-4 w-4" />
              )}
              Confirmar Rejeição
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
