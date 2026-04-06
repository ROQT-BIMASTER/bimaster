import React, { memo, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  Info,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { differenceInDays, subMonths, startOfMonth, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SmartValue, ValueLegend } from "@/components/ui/smart-value";
import { formatCurrencyCompact } from "@/lib/formatters";

interface FluxoCaixaKPIsAdvancedProps {
  contasReceber: any[];
  contasPagar: any[];
  contasReceberRaw: any[];
  contasPagarRaw?: any[];
  filterAnos: number[];
  crTotaisRpc?: Record<string, number> | null;
}

const KpiTooltip = ({ text }: { text: string }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">
        <p>{text}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export const FluxoCaixaKPIsAdvanced = memo(function FluxoCaixaKPIsAdvanced({
  contasReceber,
  contasPagar,
  contasReceberRaw,
  contasPagarRaw = [],
  filterAnos,
  crTotaisRpc
}: FluxoCaixaKPIsAdvancedProps) {
  const [showYoYDialog, setShowYoYDialog] = useState(false);
  const [showInadimplenciaDialog, setShowInadimplenciaDialog] = useState(false);
  const [showGapDialog, setShowGapDialog] = useState(false);
  const [showPrevisaoDialog, setShowPrevisaoDialog] = useState(false);

  // Dados detalhados para YoY - USA valor_original para comparação justa
  const yoyDetails = useMemo(() => {
    const anoAtual = filterAnos.length > 0 ? Math.max(...filterAnos) : new Date().getFullYear();
    const anoAnterior = anoAtual - 1;
    
    const dadosAnoAtual = contasReceberRaw.filter(c => 
      c.data_vencimento && new Date(c.data_vencimento).getFullYear() === anoAtual
    );
    const dadosAnoAnterior = contasReceberRaw.filter(c => 
      c.data_vencimento && new Date(c.data_vencimento).getFullYear() === anoAnterior
    );
    
    // CORRIGIDO: usar valor_original em vez de valor_aberto
    const totalAnoAtual = dadosAnoAtual.reduce((sum, c) => sum + (c.valor_original || 0), 0);
    const totalAnoAnterior = dadosAnoAnterior.reduce((sum, c) => sum + (c.valor_original || 0), 0);
    const qtdAnoAtual = dadosAnoAtual.length;
    const qtdAnoAnterior = dadosAnoAnterior.length;
    
    const variacao = totalAnoAnterior > 0 
      ? ((totalAnoAtual - totalAnoAnterior) / totalAnoAnterior) * 100 
      : null;
    
    const diferencaAbsoluta = totalAnoAtual - totalAnoAnterior;
    
    const porMesAtual: Record<number, number> = {};
    const porMesAnterior: Record<number, number> = {};
    
    dadosAnoAtual.forEach(c => {
      const mes = new Date(c.data_vencimento).getMonth();
      porMesAtual[mes] = (porMesAtual[mes] || 0) + (c.valor_original || 0);
    });
    
    dadosAnoAnterior.forEach(c => {
      const mes = new Date(c.data_vencimento).getMonth();
      porMesAnterior[mes] = (porMesAnterior[mes] || 0) + (c.valor_original || 0);
    });
    
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const comparativoMensal = meses.map((nome, i) => ({
      mes: nome,
      anoAtual: porMesAtual[i] || 0,
      anoAnterior: porMesAnterior[i] || 0,
      variacao: porMesAnterior[i] > 0 
        ? ((porMesAtual[i] || 0) - porMesAnterior[i]) / porMesAnterior[i] * 100 
        : null
    }));
    
    return {
      anoAtual,
      anoAnterior,
      totalAnoAtual,
      totalAnoAnterior,
      qtdAnoAtual,
      qtdAnoAnterior,
      variacao,
      diferencaAbsoluta,
      comparativoMensal
    };
  }, [contasReceberRaw, filterAnos]);

  // Dados detalhados para Inadimplência
  const inadimplenciaDetails = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const parseDate = (dateStr: string): Date => {
      const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
      return new Date(year, month - 1, day);
    };
    
    const vencidos: any[] = [];
    const aVencer: any[] = [];
    
    contasReceberRaw.forEach(c => {
      if (!c.data_vencimento) return;
      const valorAberto = c.valor_aberto || 0;
      if (valorAberto <= 0) return;
      
      const venc = parseDate(c.data_vencimento);
      
      if (venc < today) {
        vencidos.push({ ...c, diasAtraso: differenceInDays(today, venc) });
      } else {
        aVencer.push({ ...c, diasParaVencer: differenceInDays(venc, today) });
      }
    });
    
    const totalVencido = vencidos.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    const totalAVencer = aVencer.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    const totalGeral = totalVencido + totalAVencer;
    const percentual = totalGeral > 0 ? (totalVencido / totalGeral) * 100 : 0;
    
    const faixas = {
      ate30: { valor: 0, qtd: 0 },
      de31a60: { valor: 0, qtd: 0 },
      de61a90: { valor: 0, qtd: 0 },
      mais90: { valor: 0, qtd: 0 }
    };
    
    vencidos.forEach(c => {
      const dias = c.diasAtraso;
      const valor = c.valor_aberto || 0;
      if (dias <= 30) { faixas.ate30.valor += valor; faixas.ate30.qtd++; }
      else if (dias <= 60) { faixas.de31a60.valor += valor; faixas.de31a60.qtd++; }
      else if (dias <= 90) { faixas.de61a90.valor += valor; faixas.de61a90.qtd++; }
      else { faixas.mais90.valor += valor; faixas.mais90.qtd++; }
    });
    
    const clientesMap: Record<string, { nome: string; valor: number; qtd: number }> = {};
    vencidos.forEach(c => {
      const key = c.cliente_codigo || 'N/A';
      if (!clientesMap[key]) {
        clientesMap[key] = { nome: c.cliente_nome || 'Cliente não identificado', valor: 0, qtd: 0 };
      }
      clientesMap[key].valor += c.valor_aberto || 0;
      clientesMap[key].qtd++;
    });
    
    const topClientes = Object.entries(clientesMap)
      .map(([codigo, data]) => ({ codigo, ...data }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);
    
    return { totalVencido, totalAVencer, totalGeral, percentual, qtdVencidos: vencidos.length, qtdAVencer: aVencer.length, faixas, topClientes };
  }, [contasReceberRaw]);

  // DSO/DPO real + Previsão 12m com média móvel
  const kpis = useMemo(() => {
    if (!contasReceber || !contasPagar) {
      return { totalReceber: 0, totalPagar: 0, saldoProjetado: 0, dso: 0, dpo: 0, ciclo: 0, variacaoYoY: null, maiorGap: 0, maiorGapData: null, inadimplencia: 0, previsao12m: 0 };
    }

    const totalReceber = contasReceber.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    const totalPagar = contasPagar.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    const saldoProjetado = totalReceber - totalPagar;

    // DSO REAL: (Recebíveis abertos / Receita média mensal) × 30
    const today = new Date();
    const sixMonthsAgo = subMonths(today, 6);
    
    const recebidosUlt6m = contasReceberRaw.filter(c => {
      if (!c.data_recebimento || c.status !== 'recebido') return false;
      const dt = new Date(c.data_recebimento);
      return dt >= sixMonthsAgo && dt <= today;
    });
    const receita6m = recebidosUlt6m.reduce((sum, c) => sum + (c.valor_original || 0), 0);
    const receitaMediaMensal = receita6m / 6;
    const dso = receitaMediaMensal > 0 ? Math.round((totalReceber / receitaMediaMensal) * 30) : 0;

    // DPO REAL: (Pagáveis abertos / Custo médio mensal) × 30
    const pagosUlt6m = contasPagarRaw.filter(c => {
      if (!c.data_pagamento || c.status !== 'pago') return false;
      const dt = new Date(c.data_pagamento);
      return dt >= sixMonthsAgo && dt <= today;
    });
    const custo6m = pagosUlt6m.reduce((sum, c) => sum + (c.valor_original || 0), 0);
    const custoMedioMensal = custo6m / 6;
    const dpo = custoMedioMensal > 0 ? Math.round((totalPagar / custoMedioMensal) * 30) : 0;

    const ciclo = dso - dpo;

    // Gaps por data
    interface GapEntry { date: string; gap: number; entradas: number; saidas: number }
    const gapsPorData: Record<string, GapEntry> = {};
    
    contasReceber.forEach(c => {
      if (!c.data_vencimento) return;
      const date = c.data_vencimento.split('T')[0];
      if (!gapsPorData[date]) gapsPorData[date] = { date, gap: 0, entradas: 0, saidas: 0 };
      gapsPorData[date].gap += (c.valor_aberto || 0);
      gapsPorData[date].entradas += (c.valor_aberto || 0);
    });
    
    contasPagar.forEach(c => {
      if (!c.data_vencimento) return;
      const date = c.data_vencimento.split('T')[0];
      if (!gapsPorData[date]) gapsPorData[date] = { date, gap: 0, entradas: 0, saidas: 0 };
      gapsPorData[date].gap -= (c.valor_aberto || 0);
      gapsPorData[date].saidas += (c.valor_aberto || 0);
    });

    const gaps = Object.values(gapsPorData).filter(g => g.gap < 0).sort((a, b) => a.gap - b.gap);
    const maiorGap = gaps.length > 0 ? gaps[0].gap : 0;
    const maiorGapData = gaps.length > 0 ? gaps[0].date : null;

    // PREVISÃO 12M: média móvel dos últimos 6 meses (entradas - saídas realizadas) × 12
    const saldoLiquidoMensal = receita6m - custo6m;
    const mediaMensalLiquida = saldoLiquidoMensal / 6;
    const previsao12m = mediaMensalLiquida * 12;

    return {
      totalReceber, totalPagar, saldoProjetado, dso, dpo, ciclo,
      variacaoYoY: yoyDetails.variacao,
      maiorGap: Math.abs(maiorGap),
      maiorGapData,
      inadimplencia: inadimplenciaDetails.percentual,
      previsao12m
    };
  }, [contasReceber, contasPagar, contasReceberRaw, contasPagarRaw, yoyDetails, inadimplenciaDetails]);

  // Dados para dialog de Gap: top 10 maiores gaps negativos
  const gapDetails = useMemo(() => {
    if (!contasReceber || !contasPagar) return [];
    
    interface GapDetail { date: string; entradas: number; saidas: number; gap: number; topFornecedores: string[] }
    const gapsPorData: Record<string, { entradas: number; saidas: number; fornecedores: Record<string, number> }> = {};
    
    contasReceber.forEach(c => {
      if (!c.data_vencimento) return;
      const date = c.data_vencimento.split('T')[0];
      if (!gapsPorData[date]) gapsPorData[date] = { entradas: 0, saidas: 0, fornecedores: {} };
      gapsPorData[date].entradas += (c.valor_aberto || 0);
    });
    
    contasPagar.forEach(c => {
      if (!c.data_vencimento) return;
      const date = c.data_vencimento.split('T')[0];
      if (!gapsPorData[date]) gapsPorData[date] = { entradas: 0, saidas: 0, fornecedores: {} };
      gapsPorData[date].saidas += (c.valor_aberto || 0);
      const fn = c.fornecedor_nome || 'N/A';
      gapsPorData[date].fornecedores[fn] = (gapsPorData[date].fornecedores[fn] || 0) + (c.valor_aberto || 0);
    });

    return Object.entries(gapsPorData)
      .map(([date, d]) => ({
        date,
        entradas: d.entradas,
        saidas: d.saidas,
        gap: d.entradas - d.saidas,
        topFornecedores: Object.entries(d.fornecedores).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n)
      }))
      .filter(g => g.gap < 0)
      .sort((a, b) => a.gap - b.gap)
      .slice(0, 10);
  }, [contasReceber, contasPagar]);

  // Dados para dialog de Previsão 12m
  const previsaoMensal = useMemo(() => {
    const today = new Date();
    const sixMonthsAgo = subMonths(today, 6);
    
    // Calcular média mensal de entradas e saídas realizadas nos últimos 6 meses
    const entradasRealizadas = contasReceberRaw.filter(c => 
      c.data_recebimento && c.status === 'recebido' && new Date(c.data_recebimento) >= sixMonthsAgo && new Date(c.data_recebimento) <= today
    ).reduce((sum, c) => sum + (c.valor_original || 0), 0);
    
    const saidasRealizadas = contasPagarRaw.filter(c => 
      c.data_pagamento && c.status === 'pago' && new Date(c.data_pagamento) >= sixMonthsAgo && new Date(c.data_pagamento) <= today
    ).reduce((sum, c) => sum + (c.valor_original || 0), 0);

    const mediaEntrada = entradasRealizadas / 6;
    const mediaSaida = saidasRealizadas / 6;

    const meses: { mes: string; entrada: number; saida: number; saldo: number; acumulado: number }[] = [];
    let acumulado = 0;
    for (let i = 1; i <= 12; i++) {
      const dt = subMonths(today, -i);
      const saldo = mediaEntrada - mediaSaida;
      acumulado += saldo;
      meses.push({
        mes: format(startOfMonth(dt), "MMM/yy", { locale: ptBR }),
        entrada: mediaEntrada,
        saida: mediaSaida,
        saldo,
        acumulado
      });
    }
    return { meses, mediaEntrada, mediaSaida };
  }, [contasReceberRaw, contasPagarRaw]);

  const formatCurrencyFull = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR");
  };

  const tooltips: Record<string, string> = {
    receber: "Soma de todos os valores em aberto de contas a receber no período filtrado.",
    pagar: "Soma de todos os valores em aberto de contas a pagar no período filtrado.",
    saldo: "Diferença entre Total a Receber e Total a Pagar. Positivo indica superávit.",
    dso: "DSO = (Recebíveis abertos ÷ Receita média mensal dos últimos 6 meses) × 30 dias. Indica em quantos dias, em média, a empresa recebe.",
    dpo: "DPO = (Pagáveis abertos ÷ Custo médio mensal dos últimos 6 meses) × 30 dias. Indica em quantos dias, em média, a empresa paga.",
    ciclo: "Ciclo Financeiro = DSO − DPO. Se negativo, a empresa recebe antes de pagar (favorável).",
    yoy: "Variação Year-over-Year: compara o valor_original total do ano selecionado vs o ano anterior.",
    gap: "Maior diferença negativa (saídas > entradas) em um único dia. Clique para ver os 10 maiores.",
    inadimplencia: "Percentual de títulos vencidos sobre o total da carteira de recebíveis.",
    previsao: "Projeção baseada na média móvel dos últimos 6 meses de receitas e custos realizados."
  };

  const kpiCards = [
    { icon: <ArrowUpCircle className="h-4 w-4 text-emerald-500" />, label: "Total a Receber", rawValue: kpis.totalReceber, color: "text-emerald-600", isMonetary: true, tooltip: tooltips.receber },
    { icon: <ArrowDownCircle className="h-4 w-4 text-rose-500" />, label: "Total a Pagar", rawValue: kpis.totalPagar, color: "text-rose-600", isMonetary: true, tooltip: tooltips.pagar },
    { icon: <DollarSign className="h-4 w-4 text-primary" />, label: "Saldo Projetado", rawValue: kpis.saldoProjetado, color: kpis.saldoProjetado >= 0 ? "text-emerald-600" : "text-rose-600", isMonetary: true, tooltip: tooltips.saldo },
    { icon: <Clock className="h-4 w-4 text-blue-500" />, label: "DSO (Receber)", value: `${kpis.dso} dias`, color: "", isMonetary: false, tooltip: tooltips.dso },
    { icon: <Clock className="h-4 w-4 text-orange-500" />, label: "DPO (Pagar)", value: `${kpis.dpo} dias`, color: "", isMonetary: false, tooltip: tooltips.dpo },
    { icon: <BarChart3 className="h-4 w-4 text-purple-500" />, label: "Ciclo Financeiro", value: `${kpis.ciclo} dias`, color: kpis.ciclo <= 0 ? "text-emerald-600" : "text-amber-600", isMonetary: false, tooltip: tooltips.ciclo },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ValueLegend />
      </div>

      {/* KPIs Principais */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map((kpi, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                {kpi.icon}
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
                <KpiTooltip text={kpi.tooltip} />
              </div>
              {kpi.isMonetary ? (
                <SmartValue value={kpi.rawValue!} className={cn("text-lg font-bold", kpi.color)} />
              ) : (
                <p className={cn("text-lg font-bold", kpi.color)}>{kpi.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* KPIs Avançados com Dialogs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Variação YoY - Clicável */}
        <Dialog open={showYoYDialog} onOpenChange={setShowYoYDialog}>
          <DialogTrigger asChild>
            <Card className="bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors group">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {kpis.variacaoYoY !== null && kpis.variacaoYoY >= 0 
                      ? <TrendingUp className="h-4 w-4 text-emerald-500" />
                      : <TrendingDown className="h-4 w-4 text-rose-500" />}
                    <span className="text-xs text-muted-foreground">Variação YoY</span>
                    <KpiTooltip text={tooltips.yoy} />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className={cn("text-lg font-bold", kpis.variacaoYoY !== null && kpis.variacaoYoY >= 0 ? "text-emerald-600" : "text-rose-600")}>
                  {kpis.variacaoYoY !== null ? `${kpis.variacaoYoY >= 0 ? '+' : ''}${kpis.variacaoYoY.toFixed(1)}%` : "N/A"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">vs ano anterior</p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Análise de Variação Year-over-Year (YoY)
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">{yoyDetails.anoAnterior}</p>
                  <SmartValue value={yoyDetails.totalAnoAnterior} className="text-2xl font-bold" />
                  <p className="text-xs text-muted-foreground">{yoyDetails.qtdAnoAnterior.toLocaleString('pt-BR')} títulos</p>
                </div>
                <div className="p-4 rounded-lg bg-primary/10">
                  <p className="text-sm text-muted-foreground">{yoyDetails.anoAtual}</p>
                  <SmartValue value={yoyDetails.totalAnoAtual} className="text-2xl font-bold" />
                  <p className="text-xs text-muted-foreground">{yoyDetails.qtdAnoAtual.toLocaleString('pt-BR')} títulos</p>
                </div>
              </div>
              
              <div className="p-4 rounded-lg border-2 border-dashed">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Variação Total</p>
                    <p className={cn("text-3xl font-bold", yoyDetails.variacao !== null && yoyDetails.variacao >= 0 ? "text-emerald-600" : "text-rose-600")}>
                      {yoyDetails.variacao !== null ? `${yoyDetails.variacao >= 0 ? '+' : ''}${yoyDetails.variacao.toFixed(1)}%` : "N/A"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Diferença Absoluta</p>
                    <p className={cn("text-xl font-bold", yoyDetails.diferencaAbsoluta >= 0 ? "text-emerald-600" : "text-rose-600")}>
                      {yoyDetails.diferencaAbsoluta >= 0 ? '+' : ''}<SmartValue value={yoyDetails.diferencaAbsoluta} className="inline" showTooltip={false} />
                    </p>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold mb-3">Comparativo Mensal</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {yoyDetails.comparativoMensal.map((m, i) => (
                    <div key={i} className="grid grid-cols-4 gap-2 text-sm py-2 border-b last:border-0">
                      <span className="font-medium">{m.mes}</span>
                      <span className="text-right text-muted-foreground">{formatCurrencyCompact(m.anoAnterior)}</span>
                      <span className="text-right">{formatCurrencyCompact(m.anoAtual)}</span>
                      <span className={cn("text-right font-medium", m.variacao !== null && m.variacao >= 0 ? "text-emerald-600" : "text-rose-600")}>
                        {m.variacao !== null ? `${m.variacao >= 0 ? '+' : ''}${m.variacao.toFixed(1)}%` : "-"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-sm">
                <p className="font-medium text-blue-700 dark:text-blue-400 mb-1">Como é calculado?</p>
                <p className="text-blue-600 dark:text-blue-300">
                  Compara o <strong>valor original</strong> dos títulos a receber do ano {yoyDetails.anoAtual} com {yoyDetails.anoAnterior}. 
                  Usa valor_original (não valor_aberto) para comparação justa entre períodos.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Maior Gap - AGORA CLICÁVEL */}
        <Dialog open={showGapDialog} onOpenChange={setShowGapDialog}>
          <DialogTrigger asChild>
            <Card className="bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors group">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-xs text-muted-foreground">Maior Gap</span>
                    <KpiTooltip text={tooltips.gap} />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <SmartValue value={kpis.maiorGap} className="text-lg font-bold text-amber-600" />
                <p className="text-xs text-muted-foreground mt-1">
                  {kpis.maiorGapData ? formatDate(kpis.maiorGapData) : "Sem gaps"}
                </p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Top 10 Maiores Gaps de Caixa
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {gapDetails.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum gap negativo identificado no período.</p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-5 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
                    <span>Data</span>
                    <span className="text-right">Entradas</span>
                    <span className="text-right">Saídas</span>
                    <span className="text-right">Gap</span>
                    <span>Principais Fornecedores</span>
                  </div>
                  {gapDetails.map((g, i) => (
                    <div key={i} className="grid grid-cols-5 gap-2 text-sm py-2 border-b last:border-0">
                      <span className="font-medium">{formatDate(g.date)}</span>
                      <span className="text-right text-emerald-600">{formatCurrencyCompact(g.entradas)}</span>
                      <span className="text-right text-rose-600">{formatCurrencyCompact(g.saidas)}</span>
                      <span className="text-right font-bold text-rose-600">{formatCurrencyCompact(g.gap)}</span>
                      <span className="text-xs text-muted-foreground truncate">{g.topFornecedores.join(', ')}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-sm">
                <p className="font-medium text-amber-700 dark:text-amber-400 mb-1">O que é o Gap?</p>
                <p className="text-amber-600 dark:text-amber-300">
                  Gap é a diferença entre entradas e saídas previstas para o mesmo dia. 
                  Valores negativos indicam que as saídas superam as entradas, gerando necessidade de caixa.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Inadimplência - Clicável */}
        <Dialog open={showInadimplenciaDialog} onOpenChange={setShowInadimplenciaDialog}>
          <DialogTrigger asChild>
            <Card className="bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors group">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Percent className="h-4 w-4 text-rose-500" />
                    <span className="text-xs text-muted-foreground">Inadimplência</span>
                    <KpiTooltip text={tooltips.inadimplencia} />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className={cn("text-lg font-bold", kpis.inadimplencia > 10 ? "text-rose-600" : kpis.inadimplencia > 5 ? "text-amber-600" : "text-emerald-600")}>
                  {kpis.inadimplencia.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">do total a receber</p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5" />
                Análise de Inadimplência
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                  <p className="text-sm text-rose-600">Vencido</p>
                  <SmartValue value={inadimplenciaDetails.totalVencido} className="text-2xl font-bold text-rose-600" />
                  <p className="text-xs text-rose-600/70">{inadimplenciaDetails.qtdVencidos.toLocaleString('pt-BR')} títulos</p>
                </div>
                <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-sm text-emerald-600">A Vencer</p>
                  <SmartValue value={inadimplenciaDetails.totalAVencer} className="text-2xl font-bold text-emerald-600" />
                  <p className="text-xs text-emerald-600/70">{inadimplenciaDetails.qtdAVencer.toLocaleString('pt-BR')} títulos</p>
                </div>
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-600">Taxa</p>
                  <p className={cn("text-2xl font-bold", inadimplenciaDetails.percentual > 20 ? "text-rose-600" : inadimplenciaDetails.percentual > 10 ? "text-amber-600" : "text-emerald-600")}>
                    {inadimplenciaDetails.percentual.toFixed(1)}%
                  </p>
                  <p className="text-xs text-amber-600/70">do total</p>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-rose-600">
                  <AlertTriangle className="h-4 w-4" />
                  Detalhamento por Faixa de Atraso
                </h4>
                <div className="space-y-2">
                  {[
                    { label: "1-30 dias", ...inadimplenciaDetails.faixas.ate30, color: "bg-rose-400" },
                    { label: "31-60 dias", ...inadimplenciaDetails.faixas.de31a60, color: "bg-rose-500" },
                    { label: "61-90 dias", ...inadimplenciaDetails.faixas.de61a90, color: "bg-rose-600" },
                    { label: "+90 dias", ...inadimplenciaDetails.faixas.mais90, color: "bg-rose-700" }
                  ].map((f, i) => {
                    const percentFaixa = inadimplenciaDetails.totalVencido > 0 ? (f.valor / inadimplenciaDetails.totalVencido) * 100 : 0;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className={cn("w-3 h-3 rounded-full", f.color)} />
                        <span className="text-sm w-20">{f.label}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div className={cn("h-full", f.color)} style={{ width: `${percentFaixa}%` }} />
                        </div>
                        <span className="text-sm font-medium w-28 text-right">{formatCurrencyCompact(f.valor)}</span>
                        <span className="text-xs text-muted-foreground w-16 text-right">({f.qtd})</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {inadimplenciaDetails.topClientes.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-3">Top 5 Clientes Inadimplentes</h4>
                  <div className="space-y-2">
                    {inadimplenciaDetails.topClientes.map((c, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-rose-100 dark:bg-rose-900 text-rose-600 px-2 py-0.5 rounded">#{i + 1}</span>
                          <span className="text-sm truncate max-w-[200px]">{c.nome}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-rose-600">{formatCurrencyCompact(c.valor)}</p>
                          <p className="text-xs text-muted-foreground">{c.qtd} títulos</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-sm">
                <p className="font-medium text-blue-700 dark:text-blue-400 mb-1">Como é calculado?</p>
                <p className="text-blue-600 dark:text-blue-300">
                  Taxa = Títulos vencidos ÷ Total da carteira (vencidos + a vencer). Acima de 10% merece atenção.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Previsão 12 meses - AGORA CLICÁVEL */}
        <Dialog open={showPrevisaoDialog} onOpenChange={setShowPrevisaoDialog}>
          <DialogTrigger asChild>
            <Card className="bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors group">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-500" />
                    <span className="text-xs text-muted-foreground">Previsão 12m</span>
                    <KpiTooltip text={tooltips.previsao} />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <SmartValue 
                  value={kpis.previsao12m} 
                  className={cn("text-lg font-bold", kpis.previsao12m >= 0 ? "text-emerald-600" : "text-rose-600")} 
                />
                <p className="text-xs text-muted-foreground mt-1">saldo projetado</p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                Projeção de Saldo — Próximos 12 Meses
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-xs text-emerald-600">Entrada Média/Mês</p>
                  <p className="text-lg font-bold text-emerald-600">{formatCurrencyCompact(previsaoMensal.mediaEntrada)}</p>
                </div>
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                  <p className="text-xs text-rose-600">Saída Média/Mês</p>
                  <p className="text-lg font-bold text-rose-600">{formatCurrencyCompact(previsaoMensal.mediaSaida)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-5 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
                  <span>Mês</span>
                  <span className="text-right">Entrada Est.</span>
                  <span className="text-right">Saída Est.</span>
                  <span className="text-right">Saldo</span>
                  <span className="text-right">Acumulado</span>
                </div>
                {previsaoMensal.meses.map((m, i) => (
                  <div key={i} className="grid grid-cols-5 gap-2 text-sm py-1.5 border-b last:border-0">
                    <span className="font-medium capitalize">{m.mes}</span>
                    <span className="text-right text-emerald-600">{formatCurrencyCompact(m.entrada)}</span>
                    <span className="text-right text-rose-600">{formatCurrencyCompact(m.saida)}</span>
                    <span className={cn("text-right font-medium", m.saldo >= 0 ? "text-emerald-600" : "text-rose-600")}>{formatCurrencyCompact(m.saldo)}</span>
                    <span className={cn("text-right font-bold", m.acumulado >= 0 ? "text-emerald-600" : "text-rose-600")}>{formatCurrencyCompact(m.acumulado)}</span>
                  </div>
                ))}
              </div>
              
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-sm">
                <p className="font-medium text-blue-700 dark:text-blue-400 mb-1">Premissas da projeção</p>
                <p className="text-blue-600 dark:text-blue-300">
                  Baseado na <strong>média dos últimos 6 meses</strong> de receitas recebidas e custos pagos (dados realizados). 
                  Não considera sazonalidade nem crescimento projetado.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
});
