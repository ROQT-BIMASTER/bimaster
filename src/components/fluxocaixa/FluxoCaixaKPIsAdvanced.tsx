import React, { memo, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { differenceInDays } from "date-fns";

interface FluxoCaixaKPIsAdvancedProps {
  contasReceber: any[];
  contasPagar: any[];
  contasReceberRaw: any[];
  filterAnos: number[];
}

export const FluxoCaixaKPIsAdvanced = memo(function FluxoCaixaKPIsAdvanced({
  contasReceber,
  contasPagar,
  contasReceberRaw,
  filterAnos
}: FluxoCaixaKPIsAdvancedProps) {
  const [showYoYDialog, setShowYoYDialog] = useState(false);
  const [showInadimplenciaDialog, setShowInadimplenciaDialog] = useState(false);

  // Dados detalhados para YoY - USA DADOS RAW PARA GARANTIR COMPLETUDE
  const yoyDetails = useMemo(() => {
    const anoAtual = filterAnos.length > 0 ? Math.max(...filterAnos) : new Date().getFullYear();
    const anoAnterior = anoAtual - 1;
    
    // Usa contasReceberRaw para ter todos os dados
    const dadosAnoAtual = contasReceberRaw.filter(c => 
      c.data_vencimento && new Date(c.data_vencimento).getFullYear() === anoAtual
    );
    const dadosAnoAnterior = contasReceberRaw.filter(c => 
      c.data_vencimento && new Date(c.data_vencimento).getFullYear() === anoAnterior
    );
    
    const totalAnoAtual = dadosAnoAtual.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    const totalAnoAnterior = dadosAnoAnterior.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    const qtdAnoAtual = dadosAnoAtual.length;
    const qtdAnoAnterior = dadosAnoAnterior.length;
    
    console.log('[YoY] Dados RAW carregados:', {
      totalRaw: contasReceberRaw.length,
      anoAtual,
      qtdAnoAtual,
      totalAnoAtual,
      anoAnterior,
      qtdAnoAnterior,
      totalAnoAnterior
    });
    
    const variacao = totalAnoAnterior > 0 
      ? ((totalAnoAtual - totalAnoAnterior) / totalAnoAnterior) * 100 
      : null;
    
    const diferencaAbsoluta = totalAnoAtual - totalAnoAnterior;
    
    // Por mês
    const porMesAtual: Record<number, number> = {};
    const porMesAnterior: Record<number, number> = {};
    
    dadosAnoAtual.forEach(c => {
      const mes = new Date(c.data_vencimento).getMonth();
      porMesAtual[mes] = (porMesAtual[mes] || 0) + (c.valor_aberto || 0);
    });
    
    dadosAnoAnterior.forEach(c => {
      const mes = new Date(c.data_vencimento).getMonth();
      porMesAnterior[mes] = (porMesAnterior[mes] || 0) + (c.valor_aberto || 0);
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

  // Dados detalhados para Inadimplência - USA DADOS RAW PARA GARANTIR COMPLETUDE
  const inadimplenciaDetails = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const parseDate = (dateStr: string): Date => {
      const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
      return new Date(year, month - 1, day);
    };
    
    const vencidos: any[] = [];
    const aVencer: any[] = [];
    
    // Usa contasReceberRaw para ter todos os dados
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
    
    console.log('[Inadimplência] Dados RAW carregados:', {
      totalRaw: contasReceberRaw.length,
      vencidos: vencidos.length,
      aVencer: aVencer.length,
      totalVencido,
      totalAVencer,
      percentual: percentual.toFixed(2) + '%'
    });
    
    // Faixas de atraso
    const faixas = {
      ate30: { valor: 0, qtd: 0 },
      de31a60: { valor: 0, qtd: 0 },
      de61a90: { valor: 0, qtd: 0 },
      mais90: { valor: 0, qtd: 0 }
    };
    
    vencidos.forEach(c => {
      const dias = c.diasAtraso;
      const valor = c.valor_aberto || 0;
      
      if (dias <= 30) {
        faixas.ate30.valor += valor;
        faixas.ate30.qtd++;
      } else if (dias <= 60) {
        faixas.de31a60.valor += valor;
        faixas.de31a60.qtd++;
      } else if (dias <= 90) {
        faixas.de61a90.valor += valor;
        faixas.de61a90.qtd++;
      } else {
        faixas.mais90.valor += valor;
        faixas.mais90.qtd++;
      }
    });
    
    // Top 5 clientes inadimplentes
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
    
    return {
      totalVencido,
      totalAVencer,
      totalGeral,
      percentual,
      qtdVencidos: vencidos.length,
      qtdAVencer: aVencer.length,
      faixas,
      topClientes
    };
  }, [contasReceberRaw]);

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

    const totalReceber = contasReceber.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    const totalPagar = contasPagar.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    const saldoProjetado = totalReceber - totalPagar;

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

    const pagaveisComVencimento = contasPagar.filter(c => c.data_vencimento && c.valor_aberto > 0);
    let dpo = 0;
    if (pagaveisComVencimento.length > 0) {
      const totalDias = pagaveisComVencimento.reduce((sum, c) => {
        const venc = new Date(c.data_vencimento);
        return sum + Math.max(0, differenceInDays(venc, today));
      }, 0);
      dpo = Math.round(totalDias / pagaveisComVencimento.length);
    }

    const ciclo = dso - dpo;

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

    const previsao12m = saldoProjetado * 12;

    return {
      totalReceber,
      totalPagar,
      saldoProjetado,
      dso,
      dpo,
      ciclo,
      variacaoYoY: yoyDetails.variacao,
      maiorGap: Math.abs(maiorGap),
      maiorGapData,
      inadimplencia: inadimplenciaDetails.percentual,
      previsao12m
    };
  }, [contasReceber, contasPagar, yoyDetails, inadimplenciaDetails]);

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
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className={cn("text-lg font-bold", kpis.variacaoYoY !== null && kpis.variacaoYoY >= 0 ? "text-emerald-600" : "text-rose-600")}>
                  {kpis.variacaoYoY !== null 
                    ? `${kpis.variacaoYoY >= 0 ? '+' : ''}${kpis.variacaoYoY.toFixed(1)}%`
                    : "N/A"}
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  vs ano anterior
                  <Info className="h-3 w-3" />
                </p>
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
              {/* Resumo */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">{yoyDetails.anoAnterior}</p>
                  <p className="text-2xl font-bold">{formatCurrency(yoyDetails.totalAnoAnterior)}</p>
                  <p className="text-xs text-muted-foreground">{yoyDetails.qtdAnoAnterior.toLocaleString('pt-BR')} títulos</p>
                </div>
                <div className="p-4 rounded-lg bg-primary/10">
                  <p className="text-sm text-muted-foreground">{yoyDetails.anoAtual}</p>
                  <p className="text-2xl font-bold">{formatCurrency(yoyDetails.totalAnoAtual)}</p>
                  <p className="text-xs text-muted-foreground">{yoyDetails.qtdAnoAtual.toLocaleString('pt-BR')} títulos</p>
                </div>
              </div>
              
              {/* Variação */}
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
                      {yoyDetails.diferencaAbsoluta >= 0 ? '+' : ''}{formatCurrency(yoyDetails.diferencaAbsoluta)}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Comparativo Mensal */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Comparativo Mensal</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {yoyDetails.comparativoMensal.map((m, i) => (
                    <div key={i} className="grid grid-cols-4 gap-2 text-sm py-2 border-b last:border-0">
                      <span className="font-medium">{m.mes}</span>
                      <span className="text-right text-muted-foreground">{formatCurrency(m.anoAnterior)}</span>
                      <span className="text-right">{formatCurrency(m.anoAtual)}</span>
                      <span className={cn("text-right font-medium", m.variacao !== null && m.variacao >= 0 ? "text-emerald-600" : "text-rose-600")}>
                        {m.variacao !== null ? `${m.variacao >= 0 ? '+' : ''}${m.variacao.toFixed(1)}%` : "-"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Explicação */}
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-sm">
                <p className="font-medium text-blue-700 dark:text-blue-400 mb-1">Como é calculado?</p>
                <p className="text-blue-600 dark:text-blue-300">
                  A variação YoY compara o valor total de contas a receber do ano selecionado ({yoyDetails.anoAtual}) 
                  com o mesmo período do ano anterior ({yoyDetails.anoAnterior}). Uma variação positiva indica crescimento.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Maior Gap */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Maior Gap</span>
            </div>
            <p className="text-lg font-bold text-amber-600">{formatCurrency(kpis.maiorGap)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis.maiorGapData ? formatDate(kpis.maiorGapData) : "Sem gaps"}
            </p>
          </CardContent>
        </Card>

        {/* Inadimplência - Clicável */}
        <Dialog open={showInadimplenciaDialog} onOpenChange={setShowInadimplenciaDialog}>
          <DialogTrigger asChild>
            <Card className="bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors group">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Percent className="h-4 w-4 text-rose-500" />
                    <span className="text-xs text-muted-foreground">Inadimplência</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className={cn("text-lg font-bold", kpis.inadimplencia > 10 ? "text-rose-600" : kpis.inadimplencia > 5 ? "text-amber-600" : "text-emerald-600")}>
                  {kpis.inadimplencia.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  do total a receber
                  <Info className="h-3 w-3" />
                </p>
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
              {/* Resumo */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                  <p className="text-sm text-rose-600">Vencido</p>
                  <p className="text-2xl font-bold text-rose-600">{formatCurrency(inadimplenciaDetails.totalVencido)}</p>
                  <p className="text-xs text-rose-600/70">{inadimplenciaDetails.qtdVencidos.toLocaleString('pt-BR')} títulos</p>
                </div>
                <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-sm text-emerald-600">A Vencer</p>
                  <p className="text-2xl font-bold text-emerald-600">{formatCurrency(inadimplenciaDetails.totalAVencer)}</p>
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
              
              {/* Faixas de Atraso */}
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
                    const percentFaixa = inadimplenciaDetails.totalVencido > 0 
                      ? (f.valor / inadimplenciaDetails.totalVencido) * 100 
                      : 0;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className={cn("w-3 h-3 rounded-full", f.color)} />
                        <span className="text-sm w-20">{f.label}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div className={cn("h-full", f.color)} style={{ width: `${percentFaixa}%` }} />
                        </div>
                        <span className="text-sm font-medium w-28 text-right">{formatCurrency(f.valor)}</span>
                        <span className="text-xs text-muted-foreground w-16 text-right">({f.qtd})</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Top Clientes */}
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
                          <p className="text-sm font-semibold text-rose-600">{formatCurrency(c.valor)}</p>
                          <p className="text-xs text-muted-foreground">{c.qtd} títulos</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Explicação */}
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-sm">
                <p className="font-medium text-blue-700 dark:text-blue-400 mb-1">Como é calculado?</p>
                <p className="text-blue-600 dark:text-blue-300">
                  A taxa de inadimplência é calculada dividindo o valor total de títulos vencidos pelo valor total 
                  da carteira de recebíveis (vencidos + a vencer). Uma taxa acima de 10% merece atenção especial.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Previsão 12 meses */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Previsão 12 meses</span>
            </div>
            <p className={cn("text-lg font-bold", kpis.previsao12m >= 0 ? "text-emerald-600" : "text-rose-600")}>
              {formatCurrency(kpis.previsao12m)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">saldo projetado</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});
