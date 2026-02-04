import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useDepartmentExpenses, DepartmentExpense, DEPARTMENT_EXPENSE_CATEGORIES } from "@/hooks/useDepartmentExpenses";
import { Loader2, CheckCircle, XCircle, FileText, DollarSign, Calendar, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AprovarDespesaDepartamentoDialogProps {
  expense: DepartmentExpense;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AprovarDespesaDepartamentoDialog({ 
  expense, 
  open, 
  onOpenChange 
}: AprovarDespesaDepartamentoDialogProps) {
  const { approveExpense, rejectExpense } = useDepartmentExpenses(expense.department_id);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  const getCategoryLabel = (value: string) => {
    const cat = DEPARTMENT_EXPENSE_CATEGORIES.find(c => c.value === value);
    return cat?.label || value;
  };

  const handleApprove = async () => {
    await approveExpense.mutateAsync(expense.id);
    onOpenChange(false);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    await rejectExpense.mutateAsync({ id: expense.id, reason: rejectReason });
    setRejectReason("");
    setShowRejectForm(false);
    onOpenChange(false);
  };

  const isProcessing = approveExpense.isPending || rejectExpense.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Aprovar Despesa
          </DialogTitle>
          <DialogDescription>
            Revise os detalhes da despesa antes de aprovar ou rejeitar
          </DialogDescription>
        </DialogHeader>

        {/* Expense Details */}
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Código:</span>
              <span className="font-mono font-medium">{expense.code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Categoria:</span>
              <span className="font-medium">{getCategoryLabel(expense.category)}</span>
            </div>
            {expense.description && (
              <div>
                <span className="text-muted-foreground text-sm">Descrição:</span>
                <p className="text-sm mt-1">{expense.description}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Valor Previsto</div>
                  <div className="font-medium">
                    R$ {(expense.valor_previsto || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Valor Realizado</div>
                  <div className="font-medium">
                    R$ {(expense.valor_realizado || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
            {expense.expense_date && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {format(new Date(expense.expense_date), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
            )}
            {expense.creator && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Criado por: {expense.creator.nome}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {showRejectForm ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rejectReason">Motivo da Rejeição *</Label>
              <Textarea
                id="rejectReason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explique o motivo da rejeição..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectReason("");
                }}
              >
                Cancelar
              </Button>
              <Button 
                variant="destructive"
                onClick={handleReject}
                disabled={isProcessing || !rejectReason.trim()}
              >
                {rejectExpense.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <XCircle className="mr-2 h-4 w-4" />
                Confirmar Rejeição
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={() => setShowRejectForm(true)}
              disabled={isProcessing}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Rejeitar
            </Button>
            <Button 
              onClick={handleApprove}
              disabled={isProcessing}
            >
              {approveExpense.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CheckCircle className="mr-2 h-4 w-4" />
              Aprovar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
