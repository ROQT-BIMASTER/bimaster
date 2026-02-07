import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  useActivePaymentPolicy,
  getPolicySummary,
  getNextPaymentDateFormatted,
  getNextCutoffDate,
  isWithinCutoff,
  getDayName,
  formatCutoffTime,
} from "@/hooks/useFinancialPaymentPolicies";
import {
  Calendar,
  Clock,
  Info,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Banknote,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function PaymentPolicyBanner() {
  const { data: policy, isLoading } = useActivePaymentPolicy();
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (isLoading || !policy) return null;

  const withinCutoff = isWithinCutoff(policy);
  const nextPaymentDate = getNextPaymentDateFormatted(policy);
  const nextCutoff = getNextCutoffDate(policy);
  const summary = getPolicySummary(policy);

  return (
    <>
      <Card
        className={`cursor-pointer transition-all hover:shadow-md ${
          withinCutoff
            ? "border-primary/30 bg-primary/5"
            : "border-warning/50 bg-warning/5"
        }`}
        onClick={() => setDetailsOpen(true)}
      >
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div
                className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                  withinCutoff ? "bg-primary/10" : "bg-warning/10"
                }`}
              >
                {withinCutoff ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-warning" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{summary}</span>
                  {policy.allows_exceptions && (
                    <Badge variant="outline" className="text-xs">
                      Aceita exceções
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {withinCutoff ? (
                    <span className="text-primary">
                      ✓ Dentro do prazo — Próximo pagamento: {nextPaymentDate}
                    </span>
                  ) : (
                    <span className="text-warning">
                      ⚠ Fora do prazo de corte — Lançamentos entrarão no próximo ciclo
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="gap-1">
              <Info className="h-3.5 w-3.5" />
              Detalhes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Política de Pagamento
            </DialogTitle>
            <DialogDescription>{policy.name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Status */}
            <Card
              className={
                withinCutoff
                  ? "border-primary/30 bg-primary/5"
                  : "border-warning/50 bg-warning/5"
              }
            >
              <CardContent className="py-3">
                <div className="flex items-center gap-2">
                  {withinCutoff ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <span className="font-medium text-sm text-primary">
                        Dentro do prazo de lançamento
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5 text-warning" />
                      <span className="font-medium text-sm text-warning">
                        Fora do prazo de corte
                      </span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Rules */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Prazo de Lançamento</p>
                  <p className="text-sm text-muted-foreground">
                    Até <strong>{getDayName(policy.cutoff_day_of_week)}</strong> às{" "}
                    <strong>{formatCutoffTime(policy.cutoff_time)}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Banknote className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Dia de Pagamento</p>
                  <p className="text-sm text-muted-foreground">
                    Todo(a) <strong>{getDayName(policy.payment_day_of_week)}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Próximo Corte</p>
                  <p className="text-sm text-muted-foreground">
                    {format(nextCutoff, "EEEE, dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Banknote className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Próximo Pagamento</p>
                  <p className="text-sm text-primary font-medium">{nextPaymentDate}</p>
                </div>
              </div>
            </div>

            {/* Exceptions */}
            <Card className="bg-muted/50">
              <CardContent className="py-3">
                <p className="text-sm font-medium mb-1">Exceções</p>
                {policy.allows_exceptions ? (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      ✓ O financeiro aceita lançamentos fora do prazo
                    </p>
                    {policy.exception_requires_approval && (
                      <p className="text-xs text-muted-foreground">
                        ⚠ Exceções requerem aprovação adicional do financeiro
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    ✗ Não são aceitas exceções. Lançamentos fora do prazo entram no próximo ciclo automaticamente.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Description */}
            {policy.description && (
              <div>
                <p className="text-sm font-medium mb-1">Observações</p>
                <p className="text-sm text-muted-foreground">{policy.description}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
