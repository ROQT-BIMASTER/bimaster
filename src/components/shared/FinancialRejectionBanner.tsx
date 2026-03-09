import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, RotateCcw, User, Calendar, ListChecks } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { REJECTION_CATEGORY_LABELS } from "@/components/financeiro/payments/RejeicaoFinanceiraDialog";
import type { FinancialQueueInfo } from "@/hooks/useExpenseFinancialStatus";

interface FinancialRejectionBannerProps {
  info: FinancialQueueInfo;
  onResubmit?: () => void;
  isResubmitting?: boolean;
}

export function FinancialRejectionBanner({ info, onResubmit, isResubmitting }: FinancialRejectionBannerProps) {
  if (info.financial_status !== "rejected") return null;

  const categoryLabel = info.rejection_category
    ? REJECTION_CATEGORY_LABELS[info.rejection_category] || info.rejection_category
    : null;

  const rejectionFields = (info.rejection_fields as string[] | undefined) || [];

  return (
    <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2 flex-wrap">
        Rejeitado pelo Financeiro
        {categoryLabel && (
          <Badge variant="destructive" className="text-[10px]">{categoryLabel}</Badge>
        )}
        {!categoryLabel && (
          <Badge variant="destructive" className="text-[10px]">Rejeição Financeira</Badge>
        )}
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        {/* Affected fields */}
        {rejectionFields.length > 0 && (
          <div className="flex items-start gap-2">
            <ListChecks className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">Campos a corrigir:</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {rejectionFields.map((field) => (
                  <Badge
                    key={field}
                    variant="outline"
                    className="text-[10px] border-destructive/40 text-destructive"
                  >
                    {field}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {info.financial_notes && (
          <p className="text-sm font-medium text-destructive">
            Instrução: {info.financial_notes}
          </p>
        )}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {info.reviewer_name && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {info.reviewer_name}
            </span>
          )}
          {info.reviewed_at && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(info.reviewed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          )}
        </div>
        {onResubmit && (
          <Button
            size="sm"
            variant="outline"
            className="mt-2 border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={onResubmit}
            disabled={isResubmitting}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Corrigir e Reenviar ao Financeiro
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
