import React, { memo, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
  Percent,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { differenceInDays } from "date-fns";

interface FluxoCaixaKPIsAdvancedProps {
  contasReceber: any[];
  contasPagar: any[];
  contasReceberRaw?: any[]; // Dados brutos sem filtro de ano para análise de inadimplência
  filterAnos: number[];
}

export const FluxoCaixaKPIsAdvanced = memo(function FluxoCaixaKPIsAdvanced({
  contasReceber,
  contasPagar,
  contasReceberRaw,
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const anoAtual = today.getFullYear();
    const anoAnterior = anoAtual - 1;

    // Totals
    const totalReceber = contasReceber.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    const totalPagar = contasPagar.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    const saldoProjetado = totalReceber - totalPagar;

    // DSO - Days Sales Outstanding
    const receberVencidos = contasReceber.filter(c => {
      if (!c.data_vencimento) return false;
      const venc = new Date(c.data_vencimento);
      venc.setHours(0, 0, 0, 0);
      return venc < today;
    });
    const totalVencidoReceber = receberVencidos.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    const diasVencidosReceber = receberVencidos.reduce((sum, c) => {
      return sum + differenceInDays(today, new Date(c.data_vencimento!)) * (c.valor_aberto || 0);
    }, 0);
    const dso = totalVencidoReceber > 0 ? Math.round(diasVencidosReceber / totalVencidoReceber) : 0;

    // DPO - Days Payable Outstanding
    const pagarVencidos = contasPagar.filter(c => {
      if (!c.data_vencimento) return false;
      const venc = new Date(c.data_vencimento);
      venc.setHours(0, 0, 0, 0);
      return venc < today;
    });
    const totalVencidoPagar = pagarVencidos.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    const diasVencidosPagar = pagarVencidos.reduce((sum, c) => {
      return sum + differenceInDays(today, new Date(c.data_vencimento!)) * (c.valor_aberto || 0);
    }, 0);
    const dpo = totalVencidoPagar > 0 ? Math.round(diasVencidosPagar / totalVencidoPagar) : 0;

    // Ciclo Financeiro
    const ciclo = dso - dpo;

    // Variação YoY (Year over Year)
    let variacaoYoY: number | null = null;
    if (filterAnos.length === 0 || filterAnos.includes(anoAtual)) {
      const receberAnoAtual = contasReceber
        .filter(c => new Date(c.data_vencimento!).getFullYear() === anoAtual)
        .reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
      
      const pagarAnoAtual = contasPagar
        .filter(c => new Date(c.data_vencimento!).getFullYear() === anoAtual)
        .reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
      
      const saldoAnoAtual = receberAnoAtual - pagarAnoAtual;
      
      const receberAnoAnterior = contasReceber
        .filter(c => new Date(c.data_vencimento!).getFullYear() === anoAnterior)
        .reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
      
      const pagarAnoAnterior = contasPagar
        .filter(c => new Date(c.data_vencimento!).getFullYear() === anoAnterior)
        .reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
      
      const saldoAnoAnterior = receberAnoAnterior - pagarAnoAnterior;
      
      if (saldoAnoAnterior !== 0) {
        variacaoYoY = ((saldoAnoAtual - saldoAnoAnterior) / Math.abs(saldoAnoAnterior)) * 100;
      }
    }

    // Maior Gap (dia com maior déficit de caixa)
    const dailyGaps = new Map<string, number>();
    
    contasReceber.forEach(c => {
      if (c.data_vencimento) {
        const key = c.data_vencimento.substring(0, 10);
        const current = dailyGaps.get(key) || 0;
        dailyGaps.set(key, current + (c.valor_aberto || 0));
      }
    });
    
    contasPagar.forEach(c => {
      if (c.data_vencimento) {
        const key = c.data_vencimento.substring(0, 10);
        const current = dailyGaps.get(key) || 0;
        dailyGaps.set(key, current - (c.valor_aberto || 0));
      }
    });
    
    let maiorGap = 0;
    let maiorGapData: string | null = null;
    
    dailyGaps.forEach((saldo, data) => {
      if (saldo < maiorGap) {
        maiorGap = saldo;
        maiorGapData = data;
      }
    });

    // Índice de Inadimplência
    const totalVencido = receberVencidos.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    const totalGeralReceber = contasReceber.reduce((sum, c) => sum + (c.valor_original || c.valor_aberto || 0), 0);
    const inadimplencia = totalGeralReceber > 0 ? (totalVencido / totalGeralReceber) * 100 : 0;

    // Previsão próximos 12 meses
    const in12Months = new Date();
    in12Months.setMonth(in12Months.getMonth() + 12);
    
    const receberProximo12m = contasReceber
      .filter(c => {
        const venc = new Date(c.data_vencimento!);
        return venc >= today && venc <= in12Months;
      })
      .reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    
    const pagarProximo12m = contasPagar
      .filter(c => {
        const venc = new Date(c.data_vencimento!);
        return venc >= today && venc <= in12Months;
      })
      .reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    
    const previsao12m = receberProximo12m - pagarProximo12m;

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

  // Análise detalhada de inadimplência vs a vencer - usa dados RAW sem filtro de ano
  const analiseInadimplencia = useMemo(() => {
    // Usa dados raw se disponíveis, senão usa dados filtrados
    const dadosAnalise = contasReceberRaw && contasReceberRaw.length > 0 ? contasReceberRaw : contasReceber;
    
    if (!dadosAnalise || dadosAnalise.length === 0) {
      return {
        totalVencido: 0,
        totalAVencer: 0,
        qtdVencidos: 0,
        qtdAVencer: 0,
        percentualInadimplencia: 0,
        faixasVencido: { ate30: 0, de31a60: 0, de61a90: 0, mais90: 0 },
        faixasAVencer: { ate30: 0, de31a60: 0, de61a90: 0, mais90: 0 },
        faixasVencidoQtd: { ate30: 0, de31a60: 0, de61a90: 0, mais90: 0 },
        faixasAVencerQtd: { ate30: 0, de31a60: 0, de61a90: 0, mais90: 0 },
        totalTitulos: 0,
        totalGeralCarteira: 0
      };
    }

    // Data de hoje sem hora (usando timezone local consistente)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Função para parsear data de forma consistente
    const parseDate = (dateStr: string): Date => {
      // Formato: YYYY-MM-DD - parsear como data local
      const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
      return new Date(year, month - 1, day);
    };

    // Separar vencidos de a vencer - considera apenas títulos com valor_aberto > 0
    const vencidos: any[] = [];
    const aVencer: any[] = [];
    let titulosIgnorados = 0;
    let titulosSemData = 0;

    dadosAnalise.forEach(c => {
      if (!c.data_vencimento) {
        titulosSemData++;
        return;
      }
      
      const valorAberto = c.valor_aberto || 0;
      if (valorAberto <= 0) {
        titulosIgnorados++;
        return;
      }
      
      const venc = parseDate(c.data_vencimento);
      
      if (venc < today) {
        vencidos.push({ ...c, _diasAtraso: differenceInDays(today, venc) });
      } else {
        aVencer.push({ ...c, _diasParaVencer: differenceInDays(venc, today) });
      }
    });

    const totalVencido = vencidos.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    const totalAVencer = aVencer.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    const totalGeral = totalVencido + totalAVencer;
    const percentualInadimplencia = totalGeral > 0 ? (totalVencido / totalGeral) * 100 : 0;

    // Faixas de atraso (vencido)
    const faixasVencido = { ate30: 0, de31a60: 0, de61a90: 0, mais90: 0 };
    const faixasVencidoQtd = { ate30: 0, de31a60: 0, de61a90: 0, mais90: 0 };
    
    vencidos.forEach(c => {
      const diasAtraso = c._diasAtraso;
      const valor = c.valor_aberto || 0;
      
      if (diasAtraso <= 30) {
        faixasVencido.ate30 += valor;
        faixasVencidoQtd.ate30++;
      } else if (diasAtraso <= 60) {
        faixasVencido.de31a60 += valor;
        faixasVencidoQtd.de31a60++;
      } else if (diasAtraso <= 90) {
        faixasVencido.de61a90 += valor;
        faixasVencidoQtd.de61a90++;
      } else {
        faixasVencido.mais90 += valor;
        faixasVencidoQtd.mais90++;
      }
    });

    // Faixas de vencimento futuro (a vencer)
    const faixasAVencer = { ate30: 0, de31a60: 0, de61a90: 0, mais90: 0 };
    const faixasAVencerQtd = { ate30: 0, de31a60: 0, de61a90: 0, mais90: 0 };
    
    aVencer.forEach(c => {
      const diasParaVencer = c._diasParaVencer;
      const valor = c.valor_aberto || 0;
      
      if (diasParaVencer <= 30) {
        faixasAVencer.ate30 += valor;
        faixasAVencerQtd.ate30++;
      } else if (diasParaVencer <= 60) {
        faixasAVencer.de31a60 += valor;
        faixasAVencerQtd.de31a60++;
      } else if (diasParaVencer <= 90) {
        faixasAVencer.de61a90 += valor;
        faixasAVencerQtd.de61a90++;
      } else {
        faixasAVencer.mais90 += valor;
        faixasAVencerQtd.mais90++;
      }
    });

    // Log para validação
    console.log('[FluxoCaixa KPIs] Análise de Inadimplência:', {
      totalRegistrosAnalisados: dadosAnalise.length,
      titulosComValorAberto: vencidos.length + aVencer.length,
      titulosIgnorados,
      titulosSemData,
      vencidos: { qtd: vencidos.length, valor: totalVencido },
      aVencer: { qtd: aVencer.length, valor: totalAVencer },
      totalCarteira: totalGeral
    });

    return {
      totalVencido,
      totalAVencer,
      qtdVencidos: vencidos.length,
      qtdAVencer: aVencer.length,
      percentualInadimplencia,
      faixasVencido,
      faixasAVencer,
      faixasVencidoQtd,
      faixasAVencerQtd,
      totalTitulos: vencidos.length + aVencer.length,
      totalGeralCarteira: totalGeral
    };
  }, [contasReceberRaw, contasReceber]);

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

      {/* Card de Análise de Inadimplência */}
      <Card className="border-2">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5 text-primary" />
            Análise de Inadimplência vs A Vencer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Visão Geral */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Vencido */}
            <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-5 w-5 text-rose-600" />
                <span className="text-sm font-medium text-rose-700 dark:text-rose-400">Em Atraso (Vencido)</span>
              </div>
              <p className="text-2xl font-bold text-rose-600">{formatCurrency(analiseInadimplencia.totalVencido)}</p>
              <p className="text-xs text-rose-600/70 mt-1">{analiseInadimplencia.qtdVencidos} títulos</p>
            </div>
            
            {/* Total A Vencer */}
            <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">A Vencer (Futuro)</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600">{formatCurrency(analiseInadimplencia.totalAVencer)}</p>
              <p className="text-xs text-emerald-600/70 mt-1">{analiseInadimplencia.qtdAVencer} títulos</p>
            </div>
            
            {/* Percentual de Inadimplência */}
            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 mb-2">
                <Percent className="h-5 w-5 text-amber-600" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Taxa de Inadimplência</span>
              </div>
              <p className={cn(
                "text-2xl font-bold",
                analiseInadimplencia.percentualInadimplencia > 20 ? "text-rose-600" :
                analiseInadimplencia.percentualInadimplencia > 10 ? "text-amber-600" : "text-emerald-600"
              )}>
                {analiseInadimplencia.percentualInadimplencia.toFixed(1)}%
              </p>
              <p className="text-xs text-amber-600/70 mt-1">do total de recebíveis</p>
            </div>
          </div>

          {/* Barra de Proporção */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Proporção Vencido vs A Vencer</span>
              <span>
                {analiseInadimplencia.percentualInadimplencia.toFixed(1)}% vencido | {(100 - analiseInadimplencia.percentualInadimplencia).toFixed(1)}% a vencer
              </span>
            </div>
            <div className="h-4 rounded-full bg-emerald-200 dark:bg-emerald-900 overflow-hidden">
              <div 
                className="h-full bg-rose-500 transition-all duration-500"
                style={{ width: `${Math.min(analiseInadimplencia.percentualInadimplencia, 100)}%` }}
              />
            </div>
          </div>

          {/* Detalhamento por Faixas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Faixas de Atraso */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-rose-600">
                <AlertTriangle className="h-4 w-4" />
                Títulos em Atraso (por dias)
              </h4>
              <div className="space-y-2">
                {[
                  { label: "1-30 dias", value: analiseInadimplencia.faixasVencido.ate30, qtd: analiseInadimplencia.faixasVencidoQtd.ate30, color: "bg-rose-400" },
                  { label: "31-60 dias", value: analiseInadimplencia.faixasVencido.de31a60, qtd: analiseInadimplencia.faixasVencidoQtd.de31a60, color: "bg-rose-500" },
                  { label: "61-90 dias", value: analiseInadimplencia.faixasVencido.de61a90, qtd: analiseInadimplencia.faixasVencidoQtd.de61a90, color: "bg-rose-600" },
                  { label: "+90 dias", value: analiseInadimplencia.faixasVencido.mais90, qtd: analiseInadimplencia.faixasVencidoQtd.mais90, color: "bg-rose-700" }
                ].map((faixa, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-rose-50 dark:bg-rose-950/20">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-3 h-3 rounded-full", faixa.color)} />
                      <span className="text-sm">{faixa.label}</span>
                      <span className="text-xs text-muted-foreground">({faixa.qtd})</span>
                    </div>
                    <span className="font-semibold text-rose-600">{formatCurrency(faixa.value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Faixas A Vencer */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-emerald-600">
                <Calendar className="h-4 w-4" />
                Títulos a Vencer (por dias)
              </h4>
              <div className="space-y-2">
                {[
                  { label: "0-30 dias", value: analiseInadimplencia.faixasAVencer.ate30, qtd: analiseInadimplencia.faixasAVencerQtd.ate30, color: "bg-emerald-600" },
                  { label: "31-60 dias", value: analiseInadimplencia.faixasAVencer.de31a60, qtd: analiseInadimplencia.faixasAVencerQtd.de31a60, color: "bg-emerald-500" },
                  { label: "61-90 dias", value: analiseInadimplencia.faixasAVencer.de61a90, qtd: analiseInadimplencia.faixasAVencerQtd.de61a90, color: "bg-emerald-400" },
                  { label: "+90 dias", value: analiseInadimplencia.faixasAVencer.mais90, qtd: analiseInadimplencia.faixasAVencerQtd.mais90, color: "bg-emerald-300" }
                ].map((faixa, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-emerald-50 dark:bg-emerald-950/20">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-3 h-3 rounded-full", faixa.color)} />
                      <span className="text-sm">{faixa.label}</span>
                      <span className="text-xs text-muted-foreground">({faixa.qtd})</span>
                    </div>
                    <span className="font-semibold text-emerald-600">{formatCurrency(faixa.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
