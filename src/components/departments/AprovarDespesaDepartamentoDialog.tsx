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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDepartmentExpenses, DepartmentExpense, DEPARTMENT_EXPENSE_CATEGORIES } from "@/hooks/useDepartmentExpenses";
import { Loader2, CheckCircle, XCircle, FileText, DollarSign, Calendar, User, AlertTriangle, ExternalLink, Paperclip, Building2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { resolveStorageUrl } from "@/lib/utils/storage-url";
import { toast } from "sonner";

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
  const [attachmentsAcknowledged, setAttachmentsAcknowledged] = useState(false);

  const getCategoryLabel = (value: string) => {
    const cat = DEPARTMENT_EXPENSE_CATEGORIES.find(c => c.value === value);
    return cat?.label || value;
  };

  const hasAttachments = expense.attachments && expense.attachments.length > 0;
  const requiresAcknowledgement = hasAttachments && !attachmentsAcknowledged;

  const handleApprove = async () => {
    // Log audit entry
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("expense_approval_audit").insert({
        expense_id: expense.id,
        expense_type: "department_expense",
        action: "approved",
        performed_by: user.id,
        old_status: expense.status,
        new_status: "approved",
        metadata: { category: expense.category, amount: expense.valor_realizado || expense.valor_previsto }
      });
    }

    await approveExpense.mutateAsync(expense.id);
    onOpenChange(false);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;

    // Log audit entry
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("expense_approval_audit").insert({
        expense_id: expense.id,
        expense_type: "department_expense",
        action: "rejected",
        performed_by: user.id,
        old_status: expense.status,
        new_status: "rejected",
        notes: rejectReason,
        metadata: { category: expense.category, amount: expense.valor_realizado || expense.valor_previsto }
      });
    }

    await rejectExpense.mutateAsync({ id: expense.id, reason: rejectReason });
    setRejectReason("");
    setShowRejectForm(false);
    onOpenChange(false);
  };

  const isProcessing = approveExpense.isPending || rejectExpense.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Aprovar Despesa
          </DialogTitle>
          <DialogDescription>
            Revise os detalhes da despesa antes de aprovar ou rejeitar
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {/* Expense Details */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Código:</span>
                  <Badge variant="outline" className="font-mono">{expense.code}</Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Categoria:</span>
                  <Badge variant="secondary">{getCategoryLabel(expense.category)}</Badge>
                </div>

                {expense.department?.nome && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Departamento:</span>
                    <span className="font-medium flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {expense.department.nome}
                    </span>
                  </div>
                )}

                {(expense.empresa_nome || expense.empresa?.nome) && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Filial:</span>
                    <span className="font-medium">{expense.empresa?.nome || expense.empresa_nome}</span>
                  </div>
                )}

                {expense.description && (
                  <div>
                    <span className="text-muted-foreground text-sm">Descrição:</span>
                    <p className="text-sm mt-1 bg-muted/50 p-2 rounded">{expense.description}</p>
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
                    <DollarSign className="h-4 w-4 text-primary" />
                    <div>
                      <div className="text-xs text-muted-foreground">Valor Realizado</div>
                      <div className="font-semibold text-primary">
                        R$ {(expense.valor_realizado || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 pt-2 border-t">
                  {expense.expense_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {format(new Date(expense.expense_date), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  )}
                  {expense.creator && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{expense.creator.nome}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Attachments Section */}
            {hasAttachments && (
              <Card className="border-primary/20">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-primary" />
                    <span className="font-medium">Anexos ({expense.attachments.length})</span>
                  </div>

                  <div className="space-y-2">
                    {expense.attachments.map((attachment, index) => (
                      <button
                        key={index}
                        onClick={async () => {
                          const { signedUrl, error } = await resolveStorageUrl(attachment.url);
                          if (error || !signedUrl) { toast.error(error || "Erro ao abrir arquivo"); return; }
                          window.open(signedUrl, "_blank");
                        }}
                        className="flex items-center justify-between p-2 rounded border hover:bg-muted/50 transition-colors group w-full text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm truncate">{attachment.name}</span>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                      </button>
                    ))}
                  </div>

                  {/* Acknowledgement Checkbox */}
                  <div className="flex items-start space-x-2 pt-2 border-t">
                    <Checkbox
                      id="attachments-ack"
                      checked={attachmentsAcknowledged}
                      onCheckedChange={(checked) => setAttachmentsAcknowledged(checked === true)}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <label
                        htmlFor="attachments-ack"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Li e estou ciente dos anexos
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Confirmo que revisei todos os documentos anexados a esta despesa.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Warning if no attachments */}
            {!hasAttachments && (
              <Card className="border-warning/50 bg-warning/5">
                <CardContent className="py-3">
                  <div className="flex items-center gap-2 text-warning">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">Nenhum anexo encontrado</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Esta despesa não possui documentos comprobatórios anexados.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>

        {/* Action Buttons */}
        {showRejectForm ? (
          <div className="space-y-4 pt-4 border-t">
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
          <div className="flex justify-end gap-2 pt-4 border-t">
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
              disabled={isProcessing || requiresAcknowledgement}
              title={requiresAcknowledgement ? "Confirme que leu os anexos antes de aprovar" : undefined}
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
