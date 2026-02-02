import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Receipt, MoreHorizontal, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";

interface CampanhaMetrics {
  qtdCampanhas: number;
  valorPendente: number;
  valorPago: number;
  percentualPago: number;
}

interface TradeCampanhasAPagarCardProps {
  metrics: CampanhaMetrics;
  despesasPorCampanha: Record<string, { pendente: number; pago: number }>;
}

export function TradeCampanhasAPagarCard({ metrics, despesasPorCampanha }: TradeCampanhasAPagarCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const campanhasList = Object.entries(despesasPorCampanha)
    .map(([nome, valores]) => ({
      nome,
      ...valores,
      total: valores.pendente + valores.pago,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          Campanhas a Pagar
        </CardTitle>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to="/dashboard/trade/financeiro/aprovacoes">Ver aprovações pendentes</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/dashboard/trade/financeiro/campanhas">Ver todas as campanhas</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Campanhas</p>
            <p className="text-lg font-bold text-primary">{metrics.qtdCampanhas}</p>
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
            <span className="text-emerald-500">
              {metrics.percentualPago.toFixed(1)}%
            </span>
          </div>
          <Progress 
            value={metrics.percentualPago} 
            className="h-2"
          />
        </div>

        {/* Lista de Campanhas */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {campanhasList.map((campanha) => (
            <div key={campanha.nome} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{campanha.nome}</p>
                <div className="flex gap-2 mt-1">
                  {campanha.pendente > 0 && (
                    <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-500 border-orange-500/30">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatCurrency(campanha.pendente)}
                    </Badge>
                  )}
                  {campanha.pago > 0 && (
                    <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {formatCurrency(campanha.pago)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {campanhasList.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma despesa registrada
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
