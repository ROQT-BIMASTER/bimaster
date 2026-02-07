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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useDepartmentBudgets, DepartmentBudget } from "@/hooks/useDepartmentBudgets";
import {
  Loader2,
  CheckCircle,
  XCircle,
  DollarSign,
  Calendar,
  User,
  Building2,
  Wallet,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AprovarVerbaDepartamentoDialogProps {
  budget: DepartmentBudget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AprovarVerbaDepartamentoDialog({
  budget,
  open,
  onOpenChange,
}: AprovarVerbaDepartamentoDialogProps) {
  const { approveBudget, rejectBudget } = useDepartmentBudgets(budget.department_id);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  const isProcessing = approveBudget.isPending || rejectBudget.isPending;

  const handleApprove = async () => {
    await approveBudget.mutateAsync(budget.id);
    onOpenChange(false);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    await rejectBudget.mutateAsync({ id: budget.id, reason: rejectReason });
    setRejectReason("");
    setShowRejectForm(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Aprovar Solicitação de Verba
          </DialogTitle>
          <DialogDescription>
            Revise os detalhes da solicitação de verba antes de aprovar ou rejeitar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Código:</span>
                <Badge variant="outline" className="font-mono">{budget.code}</Badge>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Nome da Verba:</span>
                <span className="font-semibold">{budget.name}</span>
              </div>

              {budget.department?.nome && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Departamento:</span>
                  <span className="font-medium flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {budget.department.nome}
                  </span>
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <span className="text-muted-foreground text-sm">Valor Solicitado:</span>
                </div>
                <span className="text-xl font-bold text-primary">
                  R$ {budget.total_amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">Início</div>
                    <div className="text-sm font-medium">
                      {format(new Date(budget.period_start), "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">Término</div>
                    <div className="text-sm font-medium">
                      {format(new Date(budget.period_end), "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                  </div>
                </div>
              </div>

              {budget.creator && (
                <>
                  <Separator />
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Solicitado por <span className="font-medium">{budget.creator.nome}</span>
                    </span>
                  </div>
                </>
              )}

              {budget.notes && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                      <FileText className="h-3 w-3" />
                      Observações:
                    </div>
                    <p className="text-sm bg-muted/50 p-2 rounded">{budget.notes}</p>
                  </div>
                </>
              )}

              <Separator />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Criado em {format(new Date(budget.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </div>
            </CardContent>
          </Card>

          {/* Reject Form */}
          {showRejectForm ? (
            <div className="space-y-3 pt-2">
              <Label htmlFor="rejectBudgetReason">Motivo da Rejeição *</Label>
              <Textarea
                id="rejectBudgetReason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explique o motivo da rejeição..."
                rows={3}
              />
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
                  {rejectBudget.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <XCircle className="mr-2 h-4 w-4" />
                  Confirmar Rejeição
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
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
              <Button onClick={handleApprove} disabled={isProcessing}>
                {approveBudget.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <CheckCircle className="mr-2 h-4 w-4" />
                Aprovar Verba
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
