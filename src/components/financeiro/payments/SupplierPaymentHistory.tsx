import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { History, Loader2, CheckCircle2, XCircle, Clock, Wallet, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { PaymentQueueStatus } from "@/hooks/useFinancialPaymentQueue";

interface SupplierPaymentHistoryProps {
  supplierName: string;
  supplierDocument: string | null;
  currentItemId: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const statusConfig: Record<PaymentQueueStatus, { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: "Pendente", icon: Clock, className: "text-amber-600" },
  accepted: { label: "Aceito", icon: CheckCircle2, className: "text-emerald-600" },
  rejected: { label: "Rejeitado", icon: XCircle, className: "text-destructive" },
  paid: { label: "Pago", icon: Wallet, className: "text-primary" },
  cancelled: { label: "Cancelado", icon: XCircle, className: "text-muted-foreground" },
};

export function SupplierPaymentHistory({
  supplierName,
  supplierDocument,
  currentItemId,
}: SupplierPaymentHistoryProps) {
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["supplier-payment-history", supplierName, supplierDocument],
    queryFn: async () => {
      let query = supabase
        .from("financial_payment_queue")
        .select("id, code, amount, due_date, financial_status, requested_at, source_type, source_code, document_type, document_number, portador, description, notes, department_name, supplier_name, supplier_document, reviewed_at")
        .neq("id", currentItemId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (supplierDocument) {
        query = query.eq("supplier_document", supplierDocument);
      } else {
        query = query.eq("supplier_name", supplierName);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Carregando histórico...</span>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) return null;

  const totalPaid = history
    .filter((h) => h.financial_status === "paid")
    .reduce((sum, h) => sum + Number(h.amount), 0);

  return (
    <>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">
                Histórico de Pagamentos ({history.length})
              </span>
            </div>
            {totalPaid > 0 && (
              <Badge variant="outline" className="text-xs">
                Total pago: {formatCurrency(totalPaid)}
              </Badge>
            )}
          </div>

          <Separator />

          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {history.map((item) => {
              const status = statusConfig[item.financial_status as PaymentQueueStatus] || statusConfig.pending;
              const StatusIcon = status.icon;

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/30 text-sm cursor-pointer hover:bg-muted/60 transition-colors"
                  onClick={() => setSelectedItem(item)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusIcon className={cn("h-3.5 w-3.5 shrink-0", status.className)} />
                    <div className="min-w-0">
                      <span className="font-mono text-xs text-muted-foreground">
                        {item.code}
                      </span>
                      {item.source_code && (
                        <span className="text-xs text-muted-foreground ml-1">
                          • {item.source_code}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(item.due_date), "dd/MM/yy", { locale: ptBR })}
                    </span>
                    <span className="font-medium text-xs">
                      {formatCurrency(Number(item.amount))}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] px-1.5 py-0", status.className)}
                    >
                      {status.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detalhes do Pagamento
            </DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-muted-foreground">{selectedItem.code}</span>
                <Badge variant="outline" className={cn(statusConfig[selectedItem.financial_status as PaymentQueueStatus]?.className)}>
                  {statusConfig[selectedItem.financial_status as PaymentQueueStatus]?.label || selectedItem.financial_status}
                </Badge>
              </div>

              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground">Valor</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(Number(selectedItem.amount))}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <Label className="text-muted-foreground text-xs">Vencimento</Label>
                  <p className="font-medium">{format(new Date(selectedItem.due_date), "dd/MM/yyyy", { locale: ptBR })}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Tipo Documento</Label>
                  <p className="font-medium">{selectedItem.document_type || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Nº Documento</Label>
                  <p className="font-medium">{selectedItem.document_number || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Portador</Label>
                  <p className="font-medium">{selectedItem.portador || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Departamento</Label>
                  <p className="font-medium">{selectedItem.department_name || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Solicitado em</Label>
                  <p className="font-medium">{format(new Date(selectedItem.requested_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                </div>
              </div>

              {selectedItem.description && (
                <div>
                  <Label className="text-muted-foreground text-xs">Descrição</Label>
                  <p className="text-sm">{selectedItem.description}</p>
                </div>
              )}

              {selectedItem.notes && (
                <div>
                  <Label className="text-muted-foreground text-xs">Observações</Label>
                  <p className="text-sm">{selectedItem.notes}</p>
                </div>
              )}

              {selectedItem.reviewed_at && (
                <div>
                  <Label className="text-muted-foreground text-xs">Revisado em</Label>
                  <p className="text-sm">{format(new Date(selectedItem.reviewed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
