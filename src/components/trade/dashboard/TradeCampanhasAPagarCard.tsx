import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Receipt, MoreHorizontal, CheckCircle, Clock, ChevronDown, ChevronRight, FileText, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CampanhaMetrics {
  qtdCampanhas: number;
  valorPendente: number;
  valorPago: number;
  percentualPago: number;
}

interface CampanhaEntry {
  id: string;
  description?: string;
  supplier_name?: string;
  amount: number;
  status: string;
  date: string;
  store_name?: string;
  source: 'expense' | 'financial_entry';
}

interface TradeCampanhasAPagarCardProps {
  metrics: CampanhaMetrics;
  despesasPorCampanha: Record<string, { pendente: number; pago: number; entries?: CampanhaEntry[] }>;
}

export function TradeCampanhasAPagarCard({ metrics, despesasPorCampanha }: TradeCampanhasAPagarCardProps) {
  const [expandedCampanha, setExpandedCampanha] = useState<string | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Pendente", variant: "outline" },
      approved: { label: "Aprovado", variant: "default" },
      pending_financial: { label: "Pend. Financeiro", variant: "secondary" },
      paid: { label: "Pago", variant: "default" },
      pago: { label: "Pago", variant: "default" },
      rejected: { label: "Rejeitado", variant: "destructive" },
    };
    const config = map[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant} className="text-[10px]">{config.label}</Badge>;
  };

  const campanhasList = Object.entries(despesasPorCampanha)
    .map(([nome, valores]) => ({
      nome,
      ...valores,
      total: valores.pendente + valores.pago,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const toggleExpand = (nome: string) => {
    setExpandedCampanha(prev => prev === nome ? null : nome);
  };

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

        {/* Lista de Campanhas com expansão */}
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {campanhasList.map((campanha) => {
            const isExpanded = expandedCampanha === campanha.nome;
            const entries = campanha.entries || [];

            return (
              <Collapsible key={campanha.nome} open={isExpanded} onOpenChange={() => toggleExpand(campanha.nome)}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between py-2 px-2 rounded-md border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <p className="text-sm font-medium truncate">{campanha.nome}</p>
                    </div>
                    <div className="flex gap-2 shrink-0 ml-2">
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
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-6 mr-2 mb-2 space-y-1 border-l-2 border-primary/20 pl-3">
                    {entries.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">Nenhum detalhe disponível</p>
                    ) : (
                      entries.slice(0, 10).map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between py-1.5 text-xs border-b border-border/30 last:border-0">
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="font-medium truncate">
                                {entry.description || entry.supplier_name || 'Despesa'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              {entry.store_name && (
                                <span className="flex items-center gap-0.5">
                                  <Store className="h-3 w-3" />
                                  {entry.store_name}
                                </span>
                              )}
                              <span>{entry.date ? format(new Date(entry.date), "dd/MM/yy", { locale: ptBR }) : '-'}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            {getStatusBadge(entry.status)}
                            <span className="font-medium text-xs">{formatCurrency(entry.amount)}</span>
                          </div>
                        </div>
                      ))
                    )}
                    {entries.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center py-1">
                        +{entries.length - 10} lançamentos
                      </p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
          
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
