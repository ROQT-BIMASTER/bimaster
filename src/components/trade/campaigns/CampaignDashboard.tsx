import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Percent, 
  Calendar, 
  User, 
  Package,
  Gift,
  FileText,
  BarChart3,
  ArrowRight
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/formatters";

interface Campaign {
  id: string;
  code: string;
  name: string;
  campaign_type: string;
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
  valor_pedido?: number | null;
  tipo_brinde?: string | null;
  acoes_manuais?: string | null;
  unon_anterior?: number | null;
  unon_atual?: number | null;
  budget?: { name: string; code: string } | null;
  responsible?: { nome: string } | null;
}

interface CampaignDashboardProps {
  campaign: Campaign;
  onNavigateToProducts?: () => void;
}

export function CampaignDashboard({ campaign, onNavigateToProducts }: CampaignDashboardProps) {
  const formatPercent = (value: number | null) => {
    if (value === null || value === undefined) return "0,00%";
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  const getCampaignTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      sell_in: "Sell In",
      sell_out: "Sell Out",
      institucional: "Institucional",
      cooperada: "Cooperada",
      mdf: "MDF",
      midia: "Mídia",
      incentivo: "Incentivo",
      degustacao: "Degustação",
      bonificacao: "Bonificação",
      compre_ganhe: "Compre e Ganhe",
    };
    return labels[type] || type;
  };

  // Cálculos
  const incrementoValor = campaign.sell_out_atual - campaign.sell_out_anterior;
  const crescimentoPositivo = (campaign.crescimento_percentual || 0) >= 0;
  const roiPositivo = (campaign.roi_percentual || 0) >= 0;

  return (
    <div className="space-y-6">
      {/* SEÇÃO 1: Header da Campanha */}
      <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2">
              <Badge variant="secondary" className="mb-2">
                {getCampaignTypeLabel(campaign.campaign_type)}
              </Badge>
              <h2 className="text-2xl font-bold">{campaign.name}</h2>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium">Código: {campaign.code}</span>
                <span className="text-muted-foreground/50">|</span>
                <span>OP: {campaign.id.slice(0, 8).toUpperCase()}</span>
              </div>
            </div>
            <div className="flex flex-col items-start md:items-end gap-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Data Entrada</span>
              </div>
              <p className="text-lg font-semibold">
                {format(new Date(campaign.start_date), "dd/MM/yyyy", { locale: ptBR })}
              </p>
              <p className="text-xs text-muted-foreground">
                até {format(new Date(campaign.end_date), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 2: Valor do Pedido + Brinde + Ações */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-primary" />
            Valor do Pedido
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Valor do Pedido</p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(campaign.valor_pedido || 0)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Gift className="h-4 w-4" />
                Brinde
              </p>
              {campaign.tipo_brinde ? (
                <Badge variant="secondary" className="text-base font-medium">
                  {campaign.tipo_brinde}
                </Badge>
              ) : (
                <span className="text-muted-foreground italic">Não definido</span>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <FileText className="h-4 w-4" />
                Ações Manuais
              </p>
              {campaign.acoes_manuais ? (
                <p className="text-sm">{campaign.acoes_manuais}</p>
              ) : (
                <span className="text-muted-foreground italic text-sm">Nenhuma ação registrada</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 3: Retorno da Campanha (Supervisor) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
              Retorno da Campanha
            </CardTitle>
            <Badge variant="outline" className="gap-1">
              <User className="h-3 w-3" />
              Supervisor
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Comparativo Sell Out */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sell Out Anterior */}
            <div className="p-4 rounded-xl bg-muted/50 border space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Sell Out $ Anterior</p>
              <p className="text-2xl font-bold">
                {formatCurrency(campaign.sell_out_anterior)}
              </p>
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground">Unon x Cliente</p>
                <p className="text-sm font-medium">
                  {formatCurrency(campaign.unon_anterior || 0)}
                </p>
              </div>
            </div>

            {/* VS Indicator */}
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <span className="text-3xl font-bold text-primary">X</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">versus</p>
              </div>
            </div>

            {/* Sell Out Atual */}
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Sell Out $ Atual</p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(campaign.sell_out_atual)}
              </p>
              <div className="pt-2 border-t border-primary/20">
                <p className="text-xs text-muted-foreground">Unon x Cliente</p>
                <p className="text-sm font-medium text-primary">
                  {formatCurrency(campaign.unon_atual || 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Crescimento */}
          <div className="p-4 rounded-xl border-2 border-dashed flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                crescimentoPositivo ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              }`}>
                {crescimentoPositivo ? (
                  <TrendingUp className="h-6 w-6" />
                ) : (
                  <TrendingDown className="h-6 w-6" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Crescimento</p>
                <p className={`text-2xl font-bold ${
                  crescimentoPositivo ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatPercent(campaign.crescimento_percentual)}
                </p>
              </div>
            </div>
            <div className="text-left md:text-right">
              <p className="text-sm text-muted-foreground">Valor Incremento</p>
              <p className={`text-xl font-bold ${
                incrementoValor >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(incrementoValor)}
              </p>
              <Badge variant="secondary" className="mt-1">
                Manualmente
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 4: ROI da Campanha */}
      <Card className={`border-2 ${
        roiPositivo 
          ? 'border-green-200 bg-gradient-to-r from-green-50/50 to-transparent' 
          : 'border-red-200 bg-gradient-to-r from-red-50/50 to-transparent'
      }`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Percent className="h-5 w-5 text-primary" />
            Aumento ROI da Campanha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 rounded-xl bg-background/80">
              <p className={`text-5xl font-bold ${
                roiPositivo ? 'text-green-600' : 'text-red-600'
              }`}>
                {(campaign.roi_percentual || 0).toFixed(0)}%
              </p>
              <p className="text-sm text-muted-foreground mt-2">ROI Percentual</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-background/80">
              <p className={`text-3xl font-bold ${
                roiPositivo ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(campaign.roi_valor || 0)}
              </p>
              <p className="text-sm text-muted-foreground mt-2">Valor Absoluto</p>
            </div>
            <div className="flex items-center justify-center p-4 rounded-xl bg-background/80">
              <Badge variant="outline" className="gap-2 px-4 py-2 text-base">
                <BarChart3 className="h-5 w-5" />
                BI Dashboard
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 5: Preview de Produtos */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-primary" />
              Produtos da Campanha
            </CardTitle>
            {onNavigateToProducts && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onNavigateToProducts}
                className="gap-1"
              >
                Ver Todos
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
          <CardDescription>
            Resumo dos produtos vinculados a esta campanha
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Badge variant="secondary" className="text-sm py-1 px-3">
              <Package className="h-3 w-3 mr-1" />
              Produtos associados
            </Badge>
            <Badge variant="outline" className="text-sm py-1 px-3">
              <DollarSign className="h-3 w-3 mr-1" />
              Verba Orçada: {formatCurrency(campaign.verba_orcada)}
            </Badge>
            <Badge variant="outline" className="text-sm py-1 px-3">
              Gasto Atual: {formatCurrency(campaign.actual_cost || 0)}
            </Badge>
          </div>
          
          {/* Progress de utilização */}
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Utilização da Verba</span>
              <span className="font-medium">
                {campaign.verba_orcada > 0 
                  ? ((campaign.actual_cost || 0) / campaign.verba_orcada * 100).toFixed(1) 
                  : 0}%
              </span>
            </div>
            <Progress 
              value={campaign.verba_orcada > 0 
                ? ((campaign.actual_cost || 0) / campaign.verba_orcada * 100) 
                : 0
              } 
              className="h-2"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
