import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DollarSign, TrendingUp, TrendingDown, Percent, Target, Calendar, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface Campaign {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  estimated_cost: number;
  actual_cost: number | null;
  verba_prevista: number;
  verba_orcada: number;
  sell_in_anterior: number;
  sell_in_atual: number;
  sell_out_anterior: number;
  sell_out_atual: number;
  crescimento_percentual: number | null;
  roi_percentual: number | null;
  roi_valor: number | null;
  budget?: { name: string; code: string } | null;
  responsible?: { nome: string } | null;
}

interface CampaignDashboardProps {
  campaign: Campaign;
}

export function CampaignDashboard({ campaign }: CampaignDashboardProps) {
  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const formatPercent = (value: number | null) => {
    if (value === null || value === undefined) return "0,00%";
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  // Calcular saldo disponível
  const saldoDisponivel = campaign.verba_orcada - (campaign.actual_cost || 0);
  const percentualUtilizado = campaign.verba_orcada > 0 
    ? ((campaign.actual_cost || 0) / campaign.verba_orcada) * 100 
    : 0;

  // Dados para o gráfico
  const chartData = [
    {
      name: "Sell In",
      anterior: campaign.sell_in_anterior,
      atual: campaign.sell_in_atual,
    },
    {
      name: "Sell Out",
      anterior: campaign.sell_out_anterior,
      atual: campaign.sell_out_atual,
    },
  ];

  const roiChartData = [
    {
      name: "Custo",
      valor: campaign.actual_cost || 0,
    },
    {
      name: "Incremento",
      valor: (campaign.sell_out_atual - campaign.sell_out_anterior),
    },
    {
      name: "ROI",
      valor: campaign.roi_valor || 0,
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Verba Orçada</p>
                <p className="text-2xl font-bold">{formatCurrency(campaign.verba_orcada)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Saldo: {formatCurrency(saldoDisponivel)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-primary opacity-50" />
            </div>
            <Progress value={percentualUtilizado} className="mt-3" />
            <p className="text-xs text-muted-foreground mt-1">
              {percentualUtilizado.toFixed(1)}% utilizado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Gastos Realizados</p>
                <p className="text-2xl font-bold">{formatCurrency(campaign.actual_cost)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Estimado: {formatCurrency(campaign.estimated_cost)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Crescimento Sell Out</p>
                <p className={`text-2xl font-bold ${(campaign.crescimento_percentual || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPercent(campaign.crescimento_percentual)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(campaign.sell_out_atual - campaign.sell_out_anterior)} incremento
                </p>
              </div>
              {(campaign.crescimento_percentual || 0) >= 0 ? (
                <TrendingUp className="h-8 w-8 text-green-500 opacity-50" />
              ) : (
                <TrendingDown className="h-8 w-8 text-red-500 opacity-50" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={`${(campaign.roi_percentual || 0) >= 0 ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ROI da Campanha</p>
                <p className={`text-2xl font-bold ${(campaign.roi_percentual || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPercent(campaign.roi_percentual)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(campaign.roi_valor)} valor
                </p>
              </div>
              <Percent className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Período</p>
                <p className="font-medium">
                  {format(new Date(campaign.start_date), "dd/MM/yyyy", { locale: ptBR })} - {format(new Date(campaign.end_date), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Verba Vinculada</p>
                <p className="font-medium">
                  {campaign.budget ? `${campaign.budget.code} - ${campaign.budget.name}` : "Nenhuma"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Responsável</p>
                <p className="font-medium">{campaign.responsible?.nome || "Não definido"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Comparativo Sell In/Out</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  labelStyle={{ color: 'var(--foreground)' }}
                />
                <Legend />
                <Bar dataKey="anterior" name="Período Anterior" fill="hsl(var(--muted-foreground))" />
                <Bar dataKey="atual" name="Período Atual" fill="hsl(var(--primary))" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Análise de ROI</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={roiChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  labelStyle={{ color: 'var(--foreground)' }}
                />
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
