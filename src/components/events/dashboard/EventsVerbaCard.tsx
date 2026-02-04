import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Wallet, TrendingDown, TrendingUp, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";

interface VerbaMetrics {
  totalOrcado: number;
  totalUtilizado: number;
  saldoDisponivel: number;
  percentualUtilizado: number;
}

interface Verba {
  id: string;
  name: string;
  code: string;
  total_amount: number;
  spent_amount: number;
  available_amount: number;
  status: string;
}

interface EventsVerbaCardProps {
  metrics: VerbaMetrics;
  verbas: Verba[];
}

export function EventsVerbaCard({ metrics, verbas }: EventsVerbaCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (percentual: number) => {
    if (percentual >= 90) return "text-destructive";
    if (percentual >= 70) return "text-orange-500";
    return "text-emerald-500";
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          Verbas de Eventos
        </CardTitle>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to="/dashboard/trade/financeiro/verbas">Ver todas as verbas</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
            <p className={`text-lg font-bold ${metrics.saldoDisponivel >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
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
          <Progress 
            value={Math.min(metrics.percentualUtilizado, 100)} 
            className="h-2"
          />
        </div>

        {/* Lista de Verbas */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {verbas.slice(0, 5).map((verba) => {
            const percentual = verba.total_amount > 0 
              ? (parseFloat(String(verba.spent_amount || 0)) / parseFloat(String(verba.total_amount))) * 100 
              : 0;
            
            return (
              <div key={verba.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{verba.name}</p>
                  <p className="text-xs text-muted-foreground">{verba.code}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {formatCurrency(parseFloat(String(verba.available_amount || 0)))}
                  </span>
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
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma verba de eventos encontrada
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
