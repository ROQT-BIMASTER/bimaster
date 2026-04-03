import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { Progress } from "@/components/ui/progress";
import { Wallet, TrendingDown, TrendingUp, Store, Calendar, Building2 } from "lucide-react";
import type { VerbaMetrics, VerbaConsolidada } from "@/hooks/useFinanceiroConsolidadoDashboard";

interface ConsolidadoVerbaCardProps {
  metrics: VerbaMetrics;
  verbas: VerbaConsolidada[];
}

const origemConfig = {
  trade: { icon: Store, label: "Trade", className: "text-purple-500" },
  eventos: { icon: Calendar, label: "Eventos", className: "text-blue-500" },
  departamentos: { icon: Building2, label: "Dept", className: "text-emerald-500" },
};

const formatCurrencyNoDecimals = (value: number) => formatCurrency(value, false);

const getStatusColor = (p: number) => {
  if (p >= 90) return "text-destructive";
  if (p >= 70) return "text-orange-500";
  return "text-emerald-500";
};

export function ConsolidadoVerbaCard({ metrics, verbas }: ConsolidadoVerbaCardProps) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          Verbas Consolidadas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Orçado</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(metrics.totalOrcado)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Utilizado</p>
            <p className="text-lg font-bold text-orange-500">{formatCurrency(metrics.totalUtilizado)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Disponível</p>
            <p className={`text-lg font-bold ${metrics.saldoDisponivel >= 0 ? "text-emerald-500" : "text-destructive"}`}>
              {formatCurrency(metrics.saldoDisponivel)}
            </p>
          </div>
        </div>

        {/* Barra de Progresso */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Utilização</span>
            <span className={getStatusColor(metrics.percentualUtilizado)}>
              {metrics.percentualUtilizado.toFixed(1)}%
            </span>
          </div>
          <Progress value={Math.min(metrics.percentualUtilizado, 100)} className="h-2" />
        </div>

        {/* Lista de Verbas */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {verbas.slice(0, 8).map((verba) => {
            const percentual =
              verba.total_amount > 0 ? (verba.spent_amount / verba.total_amount) * 100 : 0;
            const cfg = origemConfig[verba.origem];
            const Icon = cfg.icon;

            return (
              <div key={verba.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Icon className={`h-4 w-4 shrink-0 ${cfg.className}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{verba.name}</p>
                    <p className="text-xs text-muted-foreground">{cfg.label}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{formatCurrency(verba.available_amount)}</span>
                  {percentual >= 80 ? (
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  ) : (
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  )}
                </div>
              </div>
            );
          })}

          {verbas.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma verba encontrada</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
