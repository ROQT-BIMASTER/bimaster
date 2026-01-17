import React, { memo, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  BarChart3,
  AlertTriangle,
  Calendar,
  Percent
} from "lucide-react";
import { cn } from "@/lib/utils";
import { differenceInDays } from "date-fns";

interface FluxoCaixaKPIsAdvancedProps {
  contasReceber: any[];
  contasPagar: any[];
  filterAnos: number[];
}

export const FluxoCaixaKPIsAdvanced = memo(function FluxoCaixaKPIsAdvanced({
  contasReceber,
  contasPagar,
  filterAnos
}: FluxoCaixaKPIsAdvancedProps) {
  const kpis = useMemo(() => {
    if (!contasReceber || !contasPagar) {
      return {
        totalReceber: 0,
        totalPagar: 0,
        saldoProjetado: 0,
        dso: 0,
        dpo: 0,
        ciclo: 0,
        variacaoYoY: null,
        maiorGap: 0,
        maiorGapData: null,
        inadimplencia: 0,
        previsao12m: 0
      };
    }

    // Total a Receber (valor_aberto)
    const totalReceber = contasReceber.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    
    // Total a Pagar (valor_aberto)
    const totalPagar = contasPagar.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    
    // Saldo Projetado
    const saldoProjetado = totalReceber - totalPagar;

    // DSO - Days Sales Outstanding (Prazo médio de recebimento)
    const today = new Date();
    const recebiveisComVencimento = contasReceber.filter(c => c.data_vencimento && c.valor_aberto > 0);
    let dso = 0;
    if (recebiveisComVencimento.length > 0) {
      const totalDias = recebiveisComVencimento.reduce((sum, c) => {
        const venc = new Date(c.data_vencimento);
        return sum + Math.max(0, differenceInDays(venc, today));
      }, 0);
      dso = Math.round(totalDias / recebiveisComVencimento.length);
    }

    // DPO - Days Payable Outstanding (Prazo médio de pagamento)
    const pagaveisComVencimento = contasPagar.filter(c => c.data_vencimento && c.valor_aberto > 0);
    let dpo = 0;
    if (pagaveisComVencimento.length > 0) {
      const totalDias = pagaveisComVencimento.reduce((sum, c) => {
        const venc = new Date(c.data_vencimento);
        return sum + Math.max(0, differenceInDays(venc, today));
      }, 0);
      dpo = Math.round(totalDias / pagaveisComVencimento.length);
    }

    // Ciclo Financeiro
    const ciclo = dso - dpo;

    // Variação YoY (simplificada)
    const anoAtual = filterAnos.length > 0 ? Math.max(...filterAnos) : new Date().getFullYear();
    const anoAnterior = anoAtual - 1;
    
    const receberAnoAtual = contasReceber
      .filter(c => c.data_vencimento && new Date(c.data_vencimento).getFullYear() === anoAtual)
      .reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    
    const receberAnoAnterior = contasReceber
      .filter(c => c.data_vencimento && new Date(c.data_vencimento).getFullYear() === anoAnterior)
      .reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    
    let variacaoYoY: number | null = null;
    if (receberAnoAnterior > 0) {
      variacaoYoY = ((receberAnoAtual - receberAnoAnterior) / receberAnoAnterior) * 100;
    }

    // Maior Gap de Caixa
    interface GapEntry { date: string; gap: number }
    const gapsPorData: Record<string, GapEntry> = {};
    
    contasReceber.forEach(c => {
      if (!c.data_vencimento) return;
      const date = c.data_vencimento.split('T')[0];
      if (!gapsPorData[date]) gapsPorData[date] = { date, gap: 0 };
      gapsPorData[date].gap += (c.valor_aberto || 0);
    });
    
    contasPagar.forEach(c => {
      if (!c.data_vencimento) return;
      const date = c.data_vencimento.split('T')[0];
      if (!gapsPorData[date]) gapsPorData[date] = { date, gap: 0 };
      gapsPorData[date].gap -= (c.valor_aberto || 0);
    });

    const gaps = Object.values(gapsPorData).filter(g => g.gap < 0).sort((a, b) => a.gap - b.gap);
    const maiorGap = gaps.length > 0 ? gaps[0].gap : 0;
    const maiorGapData = gaps.length > 0 ? gaps[0].date : null;

    // Inadimplência
    const vencidos = contasReceber.filter(c => {
      if (!c.data_vencimento || (c.valor_aberto || 0) <= 0) return false;
      return new Date(c.data_vencimento) < today;
    });
    const totalVencido = vencidos.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    const inadimplencia = totalReceber > 0 ? (totalVencido / totalReceber) * 100 : 0;

    // Previsão 12 meses (simplificada)
    const previsao12m = saldoProjetado * 12;

    return {
      totalReceber,
      totalPagar,
      saldoProjetado,
      dso,
      dpo,
      ciclo,
      variacaoYoY,
      maiorGap: Math.abs(maiorGap),
      maiorGapData,
      inadimplencia,
      previsao12m
    };
  }, [contasReceber, contasPagar, filterAnos]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR");
  };

  const kpiCards = [
    {
      icon: <ArrowUpCircle className="h-4 w-4 text-emerald-500" />,
      label: "Total a Receber",
      value: formatCurrency(kpis.totalReceber),
      color: "text-emerald-600"
    },
    {
      icon: <ArrowDownCircle className="h-4 w-4 text-rose-500" />,
      label: "Total a Pagar",
      value: formatCurrency(kpis.totalPagar),
      color: "text-rose-600"
    },
    {
      icon: <DollarSign className="h-4 w-4 text-primary" />,
      label: "Saldo Projetado",
      value: formatCurrency(kpis.saldoProjetado),
      color: kpis.saldoProjetado >= 0 ? "text-emerald-600" : "text-rose-600"
    },
    {
      icon: <Clock className="h-4 w-4 text-blue-500" />,
      label: "DSO (Receber)",
      value: `${kpis.dso} dias`,
      color: ""
    },
    {
      icon: <Clock className="h-4 w-4 text-orange-500" />,
      label: "DPO (Pagar)",
      value: `${kpis.dpo} dias`,
      color: ""
    },
    {
      icon: <BarChart3 className="h-4 w-4 text-purple-500" />,
      label: "Ciclo Financeiro",
      value: `${kpis.ciclo} dias`,
      color: kpis.ciclo <= 0 ? "text-emerald-600" : "text-amber-600"
    }
  ];

  const advancedKpis = [
    {
      icon: kpis.variacaoYoY !== null && kpis.variacaoYoY >= 0 
        ? <TrendingUp className="h-4 w-4 text-emerald-500" />
        : <TrendingDown className="h-4 w-4 text-rose-500" />,
      label: "Variação YoY",
      value: kpis.variacaoYoY !== null 
        ? `${kpis.variacaoYoY >= 0 ? '+' : ''}${kpis.variacaoYoY.toFixed(1)}%`
        : "N/A",
      color: kpis.variacaoYoY !== null && kpis.variacaoYoY >= 0 ? "text-emerald-600" : "text-rose-600",
      subtitle: "vs ano anterior"
    },
    {
      icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
      label: "Maior Gap",
      value: formatCurrency(kpis.maiorGap),
      color: "text-amber-600",
      subtitle: kpis.maiorGapData ? formatDate(kpis.maiorGapData) : "Sem gaps"
    },
    {
      icon: <Percent className="h-4 w-4 text-rose-500" />,
      label: "Inadimplência",
      value: `${kpis.inadimplencia.toFixed(1)}%`,
      color: kpis.inadimplencia > 10 ? "text-rose-600" : kpis.inadimplencia > 5 ? "text-amber-600" : "text-emerald-600",
      subtitle: "do total a receber"
    },
    {
      icon: <Calendar className="h-4 w-4 text-blue-500" />,
      label: "Previsão 12 meses",
      value: formatCurrency(kpis.previsao12m),
      color: kpis.previsao12m >= 0 ? "text-emerald-600" : "text-rose-600",
      subtitle: "saldo projetado"
    }
  ];

  return (
    <div className="space-y-4">
      {/* KPIs Principais */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map((kpi, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                {kpi.icon}
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
              </div>
              <p className={cn("text-lg font-bold", kpi.color)}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* KPIs Avançados */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {advancedKpis.map((kpi, i) => (
          <Card key={i} className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                {kpi.icon}
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
              </div>
              <p className={cn("text-lg font-bold", kpi.color)}>{kpi.value}</p>
              {kpi.subtitle && (
                <p className="text-xs text-muted-foreground mt-1">{kpi.subtitle}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
});
