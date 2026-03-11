import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SmartValue } from "@/components/ui/smart-value";
import { Progress } from "@/components/ui/progress";
import { Landmark, Calendar, TrendingDown, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface MonitorEmprestimosProps {
  loans: any[];
  isLoading: boolean;
}

export function MonitorEmprestimos({ loans, isLoading }: MonitorEmprestimosProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loans.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Landmark className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Nenhum empréstimo encontrado</p>
          <p className="text-xs text-muted-foreground mt-1">
            Sincronize suas contas para detectar empréstimos ativos
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalOutstanding = loans.reduce((sum: number, l: any) => sum + (l.outstanding_balance || 0), 0);
  const totalMonthly = loans.reduce((sum: number, l: any) => sum + (l.monthly_payment || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="bg-gradient-to-br from-red-500/5 to-red-500/10 border-red-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Devedor Total</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              <SmartValue value={totalOutstanding} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Parcela Mensal Total</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <SmartValue value={totalMonthly} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Contratos Ativos</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loans.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Loans List */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {loans.map((loan: any) => {
              const paid = loan.installments_paid || 0;
              const total = loan.installments_total || 1;
              const progress = (paid / total) * 100;

              return (
                <div key={loan.id} className="p-4 rounded-lg border bg-muted/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{loan.name || "Empréstimo"}</p>
                      <p className="text-xs text-muted-foreground">
                        {loan.bank_connections?.banco || "—"}
                        {loan.contract_number && ` • Contrato ${loan.contract_number}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600">
                        <SmartValue value={loan.outstanding_balance || 0} />
                      </p>
                      {loan.interest_rate && (
                        <p className="text-xs text-muted-foreground">{loan.interest_rate}% a.a.</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Parcelas: {paid}/{total}</span>
                      <span>{progress.toFixed(0)}% quitado</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  <div className="flex gap-4 text-xs">
                    {loan.monthly_payment && (
                      <span className="text-muted-foreground">
                        Parcela: <SmartValue value={loan.monthly_payment} className="font-medium text-foreground" />
                      </span>
                    )}
                    {loan.next_payment_date && (
                      <span className="text-muted-foreground">
                        Próximo: {format(new Date(loan.next_payment_date), "dd/MM/yyyy")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
