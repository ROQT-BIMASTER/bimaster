import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { History, Loader2, CheckCircle2, XCircle, Clock, Wallet } from "lucide-react";
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
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["supplier-payment-history", supplierName, supplierDocument],
    queryFn: async () => {
      // Search by document first (more precise), fallback to name
      let query = supabase
        .from("financial_payment_queue")
        .select("id, code, amount, due_date, financial_status, requested_at, source_type, source_code")
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
                className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/30 text-sm"
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
  );
}
