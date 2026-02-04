import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, Wallet, Target, Calendar, Building2, FileText, ExternalLink, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { PaymentQueueItem, SourceType, PaymentQueueStatus } from "@/hooks/useFinancialPaymentQueue";

interface PaymentReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PaymentQueueItem | null;
  onAccept: (id: string, notes?: string) => void;
  onReject: (id: string, notes: string) => void;
  onMarkPaid: (id: string, notes?: string) => void;
  isProcessing: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const sourceTypeLabels: Record<SourceType, string> = {
  trade_entry: "Trade Marketing - Lançamento Financeiro",
  trade_investment: "Trade Marketing - Investimento",
  trade_campaign: "Trade Marketing - Campanha",
  event_expense: "Eventos Corporativos - Despesa",
};

const statusConfig: Record<PaymentQueueStatus, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-amber-500" },
  accepted: { label: "Aceito", color: "bg-emerald-500" },
  rejected: { label: "Rejeitado", color: "bg-red-500" },
  paid: { label: "Pago", color: "bg-blue-500" },
  cancelled: { label: "Cancelado", color: "bg-gray-500" },
};

export function PaymentReviewDialog({
  open,
  onOpenChange,
  item,
  onAccept,
  onReject,
  onMarkPaid,
  isProcessing,
}: PaymentReviewDialogProps) {
  const [notes, setNotes] = useState("");
  const [action, setAction] = useState<'accept' | 'reject' | 'paid' | null>(null);

  const handleAction = (actionType: 'accept' | 'reject' | 'paid') => {
    if (!item) return;
    
    setAction(actionType);
    
    if (actionType === 'accept') {
      onAccept(item.id, notes);
    } else if (actionType === 'reject') {
      if (!notes.trim()) {
        return; // Require notes for rejection
      }
      onReject(item.id, notes);
    } else if (actionType === 'paid') {
      onMarkPaid(item.id, notes);
    }
  };

  const handleClose = () => {
    setNotes("");
    setAction(null);
    onOpenChange(false);
  };

  if (!item) return null;

  const isOverdue = new Date(item.due_date) < new Date();
  const isPending = item.financial_status === 'pending';
  const isAccepted = item.financial_status === 'accepted';
  const status = statusConfig[item.financial_status];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Revisão de Pagamento
            </DialogTitle>
            <Badge className={cn("text-white", status.color)}>{status.label}</Badge>
          </div>
          <DialogDescription>
            {item.code} • {sourceTypeLabels[item.source_type]}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Main Info Card */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Fornecedor</Label>
                  <p className="font-medium">{item.supplier_name}</p>
                  {item.supplier_document && (
                    <p className="text-sm text-muted-foreground">{item.supplier_document}</p>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Valor</Label>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(item.amount)}</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Vencimento</Label>
                  <p className={cn("font-medium", isOverdue && isPending && "text-red-600")}>
                    {format(new Date(item.due_date), "dd/MM/yyyy", { locale: ptBR })}
                    {isOverdue && isPending && <span className="text-xs block">Vencido</span>}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Tipo Documento</Label>
                  <p className="font-medium">{item.document_type || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Nº Documento</Label>
                  <p className="font-medium">{item.document_number || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Portador</Label>
                  <p className="font-medium">{item.portador || "-"}</p>
                </div>
              </div>

              {item.description && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-muted-foreground text-xs">Descrição</Label>
                    <p className="text-sm">{item.description}</p>
                  </div>
                </>
              )}

              {item.notes && (
                <div>
                  <Label className="text-muted-foreground text-xs">Observações</Label>
                  <p className="text-sm">{item.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Origin Info */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                {item.source_type.startsWith('trade') ? (
                  <Target className="h-4 w-4 text-blue-500" />
                ) : (
                  <Calendar className="h-4 w-4 text-pink-500" />
                )}
                <span className="font-medium">Origem da Solicitação</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Código Origem</Label>
                  <p className="font-medium">{item.source_code || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Departamento</Label>
                  <p className="font-medium">{item.department_name || "Trade Marketing"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Solicitado em</Label>
                  <p className="font-medium">
                    {format(new Date(item.requested_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Attachment */}
          {item.attachment_url && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Documento anexado</span>
                  <Button variant="outline" size="sm" asChild>
                    <a href={item.attachment_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Visualizar
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Financial Review Notes */}
          {item.financial_notes && !isPending && (
            <Card className="border-primary/30">
              <CardContent className="p-4">
                <Label className="text-muted-foreground text-xs">Observações do Financeiro</Label>
                <p className="text-sm mt-1">{item.financial_notes}</p>
                {item.reviewed_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Revisado em {format(new Date(item.reviewed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Action Notes - Only for pending items */}
          {(isPending || isAccepted) && (
            <div className="space-y-2">
              <Label htmlFor="notes">
                Observações do Financeiro
                {action === 'reject' && <span className="text-destructive ml-1">*</span>}
              </Label>
              <Textarea
                id="notes"
                placeholder="Adicione observações sobre esta revisão..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            Fechar
          </Button>
          
          {isPending && (
            <>
              <Button
                variant="destructive"
                onClick={() => handleAction('reject')}
                disabled={isProcessing || !notes.trim()}
              >
                {isProcessing && action === 'reject' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Rejeitar
              </Button>
              <Button
                variant="default"
                onClick={() => handleAction('accept')}
                disabled={isProcessing}
              >
                {isProcessing && action === 'accept' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Aceitar e Criar Conta
              </Button>
            </>
          )}

          {isAccepted && (
            <Button
              variant="default"
              onClick={() => handleAction('paid')}
              disabled={isProcessing}
            >
              {isProcessing && action === 'paid' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Wallet className="h-4 w-4 mr-2" />
              )}
              Marcar como Pago
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
