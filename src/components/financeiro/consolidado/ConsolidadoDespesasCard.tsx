import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Receipt, CheckCircle, Clock, Store, Calendar, Building2 } from "lucide-react";
import type { DespesaMetrics, DespesaPorOrigem } from "@/hooks/useFinanceiroConsolidadoDashboard";

interface ConsolidadoDespesasCardProps {
  metrics: DespesaMetrics;
  despesasPorOrigem: DespesaPorOrigem[];
}

const origemBadgeConfig = {
  trade: { label: "Trade", className: "bg-purple-500/10 text-purple-500 border-purple-500/30" },
  eventos: { label: "Eventos", className: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  departamentos: { label: "Dept", className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" },
};

const origemIconConfig = {
  trade: Store,
  eventos: Calendar,
  departamentos: Building2,
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export function ConsolidadoDespesasCard({ metrics, despesasPorOrigem }: ConsolidadoDespesasCardProps) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          Despesas Consolidadas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Origens</p>
            <p className="text-lg font-bold text-primary">{metrics.totalOrigens}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Itens</p>
            <p className="text-lg font-bold text-blue-500">{metrics.itensAtivos}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Pendente</p>
            <p className="text-lg font-bold text-orange-500">{formatCurrency(metrics.valorPendente)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Pago</p>
            <p className="text-lg font-bold text-emerald-500">{formatCurrency(metrics.valorPago)}</p>
          </div>
        </div>

        {/* Barra de Progresso */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Pagamentos Realizados</span>
            <span className="text-emerald-500">{metrics.percentualPago.toFixed(1)}%</span>
          </div>
          <Progress value={metrics.percentualPago} className="h-2" />
        </div>

        {/* Lista por Origem */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {despesasPorOrigem.slice(0, 8).map((item) => {
            const cfg = origemBadgeConfig[item.origem];
            const Icon = origemIconConfig[item.origem];

            return (
              <div key={item.nome} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate flex items-center gap-1">
                    <Icon className="h-3 w-3 text-muted-foreground" />
                    {item.nome}
                  </p>
                  <div className="flex gap-2 mt-1">
                    {item.pendente > 0 && (
                      <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-500 border-orange-500/30">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatCurrency(item.pendente)}
                      </Badge>
                    )}
                    {item.pago > 0 && (
                      <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {formatCurrency(item.pago)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {despesasPorOrigem.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma despesa registrada</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
