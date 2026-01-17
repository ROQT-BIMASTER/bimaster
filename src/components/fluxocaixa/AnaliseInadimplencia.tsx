import React, { memo, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart3,
  AlertTriangle,
  Calendar,
  Percent,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { differenceInDays } from "date-fns";
import { SmartValue, ValueLegend } from "@/components/ui/smart-value";
import { formatCurrencyCompact } from "@/lib/formatters";

interface AnaliseInadimplenciaProps {
  contasReceberRaw: any[];
}

export const AnaliseInadimplencia = memo(function AnaliseInadimplencia({
  contasReceberRaw
}: AnaliseInadimplenciaProps) {

  // Análise detalhada de inadimplência vs a vencer - usa TODOS os dados RAW
  const analiseInadimplencia = useMemo(() => {
    const dadosAnalise = contasReceberRaw;
    
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
      const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
      return new Date(year, month - 1, day);
    };

    // Separar vencidos de a vencer - considera apenas títulos com valor_aberto > 0
    const vencidos: any[] = [];
    const aVencer: any[] = [];

    dadosAnalise.forEach(c => {
      if (!c.data_vencimento) return;
      
      const valorAberto = c.valor_aberto || 0;
      if (valorAberto <= 0) return;
      
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
    console.log('[Análise Inadimplência] Dados:', {
      totalRegistrosAnalisados: dadosAnalise.length,
      titulosComValorAberto: vencidos.length + aVencer.length,
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
  }, [contasReceberRaw]);

  if (!contasReceberRaw || contasReceberRaw.length === 0) {
    return null;
  }

  return (
    <Card className="border-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5 text-primary" />
            Análise de Inadimplência vs A Vencer
          </CardTitle>
          <ValueLegend />
        </div>
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
            <SmartValue value={analiseInadimplencia.totalVencido} className="text-2xl font-bold text-rose-600" />
            <p className="text-xs text-rose-600/70 mt-1">{analiseInadimplencia.qtdVencidos.toLocaleString('pt-BR')} títulos</p>
          </div>
          
          {/* Total A Vencer */}
          <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">A Vencer (Futuro)</span>
            </div>
            <SmartValue value={analiseInadimplencia.totalAVencer} className="text-2xl font-bold text-emerald-600" />
            <p className="text-xs text-emerald-600/70 mt-1">{analiseInadimplencia.qtdAVencer.toLocaleString('pt-BR')} títulos</p>
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
                    <span className="text-xs text-muted-foreground">({faixa.qtd.toLocaleString('pt-BR')})</span>
                  </div>
                  <span className="font-semibold text-rose-600">{formatCurrencyCompact(faixa.value)}</span>
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
                    <span className="text-xs text-muted-foreground">({faixa.qtd.toLocaleString('pt-BR')})</span>
                  </div>
                  <span className="font-semibold text-emerald-600">{formatCurrencyCompact(faixa.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
