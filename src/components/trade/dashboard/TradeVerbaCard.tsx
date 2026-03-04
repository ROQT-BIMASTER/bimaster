import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Wallet, TrendingDown, TrendingUp, MoreHorizontal, ChevronDown, ChevronRight, FileText, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface VerbaEntry {
  id: string;
  description?: string;
  supplier_name?: string;
  amount: number;
  status: string;
  entry_date: string;
  entry_type?: string;
  budget_id?: string;
  campaign_name?: string;
  store_name?: string;
}

interface TradeVerbaCardProps {
  metrics: VerbaMetrics;
  verbas: Verba[];
  entriesByBudget?: Record<string, VerbaEntry[]>;
}

export function TradeVerbaCard({ metrics, verbas, entriesByBudget = {} }: TradeVerbaCardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Pendente", variant: "outline" },
      approved: { label: "Aprovado", variant: "default" },
      pending_financial: { label: "Pend. Financeiro", variant: "secondary" },
      paid: { label: "Pago", variant: "default" },
      rejected: { label: "Rejeitado", variant: "destructive" },
    };
    const config = map[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant} className="text-[10px]">{config.label}</Badge>;
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          Verbas Disponíveis
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

        {/* Lista de Verbas com expansão */}
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {verbas.slice(0, 5).map((verba) => {
            const percentual = verba.total_amount > 0 
              ? (parseFloat(String(verba.spent_amount || 0)) / parseFloat(String(verba.total_amount))) * 100 
              : 0;
            const entries = entriesByBudget[verba.id] || [];
            const isExpanded = expandedId === verba.id;
            
            return (
              <Collapsible key={verba.id} open={isExpanded} onOpenChange={() => toggleExpand(verba.id)}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between py-2 px-2 rounded-md border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{verba.name}</p>
                        <p className="text-xs text-muted-foreground">{verba.code}</p>
                      </div>
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
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-6 mr-2 mb-2 space-y-1 border-l-2 border-primary/20 pl-3">
                    {entries.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">Nenhum lançamento vinculado</p>
                    ) : (
                      entries.slice(0, 10).map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between py-1.5 text-xs border-b border-border/30 last:border-0">
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="font-medium truncate">
                                {entry.description || entry.supplier_name || entry.campaign_name || 'Lançamento'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              {entry.store_name && (
                                <span className="flex items-center gap-0.5">
                                  <Store className="h-3 w-3" />
                                  {entry.store_name}
                                </span>
                              )}
                              <span>{entry.entry_date ? format(new Date(entry.entry_date), "dd/MM/yy", { locale: ptBR }) : '-'}</span>
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
          
          {verbas.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma verba ativa encontrada
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
