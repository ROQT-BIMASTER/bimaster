import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Receipt, AlertCircle, Clock, TrendingUp, TrendingDown, Calendar, Users, 
  BarChart3, PieChart as PieChartIcon, AlertTriangle, CheckCircle2, Hourglass
} from "lucide-react";
import { format, differenceInDays, subDays, subMonths, startOfMonth, endOfMonth, isWithinInterval, addDays, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from "recharts";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { parseLocalDate, getDateKey, getToday } from "@/utils/dateUtils";
import { calculateFinancialStatus } from "@/hooks/useFinancialStatus";
import { useLanguage } from "@/contexts/LanguageContext";

interface ContaPagar {
  id: string;
  fornecedor_nome: string;
  valor_original: number;
  valor_aberto: number;
  valor_pago: number;
  data_emissao: string;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string;
  departamento_nome: string | null;
}

interface DashboardContasPagarProps {
  contas: ContaPagar[] | undefined;
  isLoading: boolean;
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-6))',
  'hsl(var(--chart-7))',
  'hsl(var(--chart-8))',
];

const STATUS_COLORS: { [key: string]: string } = {
  'Pago': 'hsl(var(--chart-2))',
  'Pendente': 'hsl(var(--chart-3))',
  'Vencido': 'hsl(var(--chart-5))',
  'Parcial': 'hsl(var(--chart-1))',
};

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatCompact = (value: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(value);

export function DashboardContasPagar({ contas, isLoading }: DashboardContasPagarProps) {
  const { t } = useLanguage();
  const [chartViewType, setChartViewType] = useState<'area' | 'bar' | 'line'>('area');

  // KPIs Avançados
  const kpisAvancados = useMemo(() => {
    if (!contas || contas.length === 0) {
      return {
        pmp: 0,
        indicePontualidade: 0,
        concentracao7dias: 0,
        concentracao15dias: 0,
        concentracao30dias: 0,
        totalMesAtual: 0,
        totalMesAnterior: 0,
        variacaoMensal: 0,
        qtdVencendoHoje: 0,
        qtdVencendo7dias: 0,
        qtdVencidas30dias: 0,
        valorVencendoHoje: 0,
        valorVencendo7dias: 0,
        valorVencidas30dias: 0,
      };
    }

    const hoje = getToday();
    const inicioMes = startOfMonth(hoje);
    const fimMes = endOfMonth(hoje);
    const inicioMesAnterior = startOfMonth(subDays(inicioMes, 1));
    const fimMesAnterior = endOfMonth(subDays(inicioMes, 1));

    // PMP - Prazo Médio de Pagamento (dias entre emissão e pagamento)
    const contasPagas = contas.filter(c => {
      const statusLower = (c.status || '').toLowerCase();
      return statusLower === 'pago' && !!c.data_pagamento && !!c.data_emissao;
    });
    let totalDiasPagamento = 0;
    contasPagas.forEach(c => {
      const emissao = parseLocalDate(c.data_emissao);
      const pagamento = parseLocalDate(c.data_pagamento!);
      if (emissao && pagamento) {
        totalDiasPagamento += differenceInDays(pagamento, emissao);
      }
    });
    const pmp = contasPagas.length > 0 ? Math.round(totalDiasPagamento / contasPagas.length) : 0;

    // Índice de Pontualidade (% pagas no vencimento ou antes)
    const contasPagasNoPrazo = contasPagas.filter(c => {
      const vencimento = parseLocalDate(c.data_vencimento);
      const pagamento = parseLocalDate(c.data_pagamento!);
      if (!vencimento || !pagamento) return false;
      return differenceInDays(pagamento, vencimento) <= 0;
    });
    const indicePontualidade = contasPagas.length > 0 
      ? Math.round((contasPagasNoPrazo.length / contasPagas.length) * 100) 
      : 0;

    // Concentração de vencimentos
    const vencendo7dias = contas.filter(c => {
      if (!c.data_vencimento || c.status === 'pago') return false;
      const venc = parseLocalDate(c.data_vencimento);
      if (!venc) return false;
      return isWithinInterval(venc, { start: hoje, end: addDays(hoje, 7) });
    });
    const vencendo15dias = contas.filter(c => {
      if (!c.data_vencimento || c.status === 'pago') return false;
      const venc = parseLocalDate(c.data_vencimento);
      if (!venc) return false;
      return isWithinInterval(venc, { start: hoje, end: addDays(hoje, 15) });
    });
    const vencendo30dias = contas.filter(c => {
      if (!c.data_vencimento || c.status === 'pago') return false;
      const venc = parseLocalDate(c.data_vencimento);
      if (!venc) return false;
      return isWithinInterval(venc, { start: hoje, end: addDays(hoje, 30) });
    });

    const concentracao7dias = vencendo7dias.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    const concentracao15dias = vencendo15dias.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    const concentracao30dias = vencendo30dias.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);

    // Comparativo mensal
    const totalMesAtual = contas.filter(c => {
      if (!c.data_vencimento) return false;
      const venc = parseLocalDate(c.data_vencimento);
      if (!venc) return false;
      return isWithinInterval(venc, { start: inicioMes, end: fimMes });
    }).reduce((sum, c) => sum + (c.valor_original || 0), 0);

    const totalMesAnterior = contas.filter(c => {
      if (!c.data_vencimento) return false;
      const venc = parseLocalDate(c.data_vencimento);
      if (!venc) return false;
      return isWithinInterval(venc, { start: inicioMesAnterior, end: fimMesAnterior });
    }).reduce((sum, c) => sum + (c.valor_original || 0), 0);

    const variacaoMensal = totalMesAnterior > 0 
      ? Math.round(((totalMesAtual - totalMesAnterior) / totalMesAnterior) * 100) 
      : 0;

    // Alertas - usando getDateKey para comparação consistente
    const hojeStr = getDateKey(hoje);
    const vencendoHoje = contas.filter(c => {
      const vencKey = getDateKey(c.data_vencimento);
      return vencKey === hojeStr && c.status !== 'pago';
    });
    // Vencidas há mais de 30 dias - exclui apenas 'pago', inclui 'vencido', 'parcial', 'pendente' com atraso > 30
    const vencidas30dias = contas.filter(c => {
      if (!c.data_vencimento) return false;
      const statusLower = (c.status || '').toLowerCase();
      if (statusLower === 'pago') return false;
      const venc = parseLocalDate(c.data_vencimento);
      if (!venc) return false;
      const diasAtraso = differenceInDays(hoje, venc);
      return diasAtraso > 30;
    });

    return {
      pmp,
      indicePontualidade,
      concentracao7dias,
      concentracao15dias,
      concentracao30dias,
      totalMesAtual,
      totalMesAnterior,
      variacaoMensal,
      qtdVencendoHoje: vencendoHoje.length,
      qtdVencendo7dias: vencendo7dias.length,
      qtdVencidas30dias: vencidas30dias.length,
      valorVencendoHoje: vencendoHoje.reduce((sum, c) => sum + (c.valor_aberto || 0), 0),
      valorVencendo7dias: concentracao7dias,
      valorVencidas30dias: vencidas30dias.reduce((sum, c) => sum + (c.valor_aberto || 0), 0),
    };
  }, [contas]);

  // Dados para gráfico de evolução mensal - baseado nos dados filtrados
  const dadosEvolucaoMensal = useMemo(() => {
    if (!contas || contas.length === 0) return [];

    // Extrair datas válidas dos dados filtrados
    const datasValidas = contas
      .map(c => parseLocalDate(c.data_vencimento))
      .filter((d): d is Date => d !== null);
    
    if (datasValidas.length === 0) return [];

    // Encontrar min e max das datas filtradas
    const minData = datasValidas.reduce((a, b) => a < b ? a : b);
    const maxData = datasValidas.reduce((a, b) => a > b ? a : b);

    // Gerar meses entre minData e maxData (máximo 12 meses)
    const meses: { mes: string; pago: number; pendente: number; inicio: Date; fim: Date }[] = [];
    let current = startOfMonth(minData);
    const fimPeriodo = startOfMonth(maxData);
    
    while (current <= fimPeriodo && meses.length < 12) {
      meses.push({
        mes: format(current, 'MMM/yy', { locale: ptBR }),
        pago: 0,
        pendente: 0,
        inicio: startOfMonth(current),
        fim: endOfMonth(current)
      });
      current = addMonths(current, 1);
    }

    contas.forEach(c => {
      if (!c.data_vencimento) return;
      const venc = parseLocalDate(c.data_vencimento);
      if (!venc) return;
      
      // Encontrar o mês correspondente
      const mesIndex = meses.findIndex(m => 
        isWithinInterval(venc, { start: m.inicio, end: m.fim })
      );
      
      if (mesIndex !== -1) {
        if (c.status === 'pago') {
          meses[mesIndex].pago += c.valor_pago || 0;
        } else {
          meses[mesIndex].pendente += c.valor_aberto || 0;
        }
      }
    });

    return meses.map(m => ({
      mes: m.mes,
      pago: m.pago,
      pendente: m.pendente,
    }));
  }, [contas]);

  // Top 10 fornecedores
  const topFornecedores = useMemo(() => {
    if (!contas || contas.length === 0) return [];

    const porFornecedor: { [key: string]: number } = {};
    
    contas.forEach(c => {
      const nome = c.fornecedor_nome || 'Não informado';
      porFornecedor[nome] = (porFornecedor[nome] || 0) + (c.valor_original || 0);
    });

    return Object.entries(porFornecedor)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([nome, valor]) => ({
        nome: nome.length > 20 ? nome.substring(0, 20) + '...' : nome,
        nomeCompleto: nome,
        valor,
      }));
  }, [contas]);

  // Distribuição por departamento
  const distribuicaoDepartamento = useMemo(() => {
    if (!contas || contas.length === 0) return [];

    const porDepartamento: { [key: string]: number } = {};
    
    contas.forEach(c => {
      const nome = c.departamento_nome || 'Não classificado';
      porDepartamento[nome] = (porDepartamento[nome] || 0) + (c.valor_original || 0);
    });

    return Object.entries(porDepartamento)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([nome, valor]) => ({
        nome: nome.length > 15 ? nome.substring(0, 15) + '...' : nome,
        nomeCompleto: nome,
        valor,
      }));
  }, [contas]);

  // Distribuição por status - usando cálculo correto baseado em data de vencimento
  const distribuicaoStatus = useMemo(() => {
    if (!contas || contas.length === 0) return [];

    const porStatus: { [key: string]: { qtd: number; valor: number } } = {
      'Pago': { qtd: 0, valor: 0 },
      'Pendente': { qtd: 0, valor: 0 },
      'Vencido': { qtd: 0, valor: 0 },
      'Parcial': { qtd: 0, valor: 0 },
    };
    
    contas.forEach(c => {
      // Usa o cálculo correto de status baseado na data de vencimento
      const statusCalculado = calculateFinancialStatus(
        c.data_vencimento,
        c.data_pagamento,
        c.status
      );
      
      const statusLabel = statusCalculado === 'pago' ? 'Pago' 
        : statusCalculado === 'vencido' ? 'Vencido' 
        : statusCalculado === 'parcial' ? 'Parcial' 
        : 'Pendente';
      
      porStatus[statusLabel].qtd += 1;
      porStatus[statusLabel].valor += c.valor_original || 0;
    });

    return Object.entries(porStatus)
      .filter(([_, data]) => data.qtd > 0)
      .map(([nome, data]) => ({
        nome,
        valor: data.valor,
        qtd: data.qtd,
      }));
  }, [contas]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>{t("fin.loading_data")}</span>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                  <div className="h-8 bg-muted rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs Estratégicos */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("fin.avg_payment_term")}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpisAvancados.pmp} {t("fin.days")}</div>
            <p className="text-xs text-muted-foreground">{t("fin.avg_payment_desc")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("fin.punctuality_index")}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${kpisAvancados.indicePontualidade >= 80 ? 'text-green-600' : kpisAvancados.indicePontualidade >= 50 ? 'text-yellow-600' : 'text-destructive'}`}>
              {kpisAvancados.indicePontualidade}%
            </div>
            <p className="text-xs text-muted-foreground">{t("fin.paid_on_time")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("fin.current_month")}</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCompact(kpisAvancados.totalMesAtual)}</div>
            <div className="flex items-center gap-1 text-xs">
              {kpisAvancados.variacaoMensal > 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-destructive" />
                  <span className="text-destructive">+{kpisAvancados.variacaoMensal}% {t("fin.vs_prev_month")}</span>
                </>
              ) : kpisAvancados.variacaoMensal < 0 ? (
                <>
                  <TrendingDown className="h-3 w-3 text-green-600" />
                  <span className="text-green-600">{kpisAvancados.variacaoMensal}% {t("fin.vs_prev_month")}</span>
                </>
              ) : (
                <span className="text-muted-foreground">{t("fin.no_variation")}</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("fin.next_30_days")}</CardTitle>
            <Hourglass className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCompact(kpisAvancados.concentracao30dias)}</div>
            <p className="text-xs text-muted-foreground">{t("fin.due_in_period")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Cards de Alerta */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className={kpisAvancados.qtdVencendoHoje > 0 ? 'border-yellow-500 bg-yellow-50/50 dark:bg-yellow-900/10' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className={`h-4 w-4 ${kpisAvancados.qtdVencendoHoje > 0 ? 'text-yellow-600' : 'text-muted-foreground'}`} />
              {t("fin.due_today")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${kpisAvancados.qtdVencendoHoje > 0 ? 'text-yellow-600' : ''}`}>
                {kpisAvancados.qtdVencendoHoje}
              </span>
              <span className="text-sm text-muted-foreground">{t("fin.titles")}</span>
            </div>
            <p className="text-lg font-semibold">{formatCurrency(kpisAvancados.valorVencendoHoje)}</p>
          </CardContent>
        </Card>

        <Card className={kpisAvancados.qtdVencendo7dias > 5 ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-900/10' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${kpisAvancados.qtdVencendo7dias > 5 ? 'text-orange-600' : 'text-muted-foreground'}`} />
              {t("fin.next_7_days")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${kpisAvancados.qtdVencendo7dias > 5 ? 'text-orange-600' : ''}`}>
                {kpisAvancados.qtdVencendo7dias}
              </span>
              <span className="text-sm text-muted-foreground">{t("fin.titles")}</span>
            </div>
            <p className="text-lg font-semibold">{formatCurrency(kpisAvancados.valorVencendo7dias)}</p>
          </CardContent>
        </Card>

        <Card className={kpisAvancados.qtdVencidas30dias > 0 ? 'border-destructive bg-destructive/5' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className={`h-4 w-4 ${kpisAvancados.qtdVencidas30dias > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
              {t("fin.overdue_30d")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${kpisAvancados.qtdVencidas30dias > 0 ? 'text-destructive' : ''}`}>
                {kpisAvancados.qtdVencidas30dias}
              </span>
              <span className="text-sm text-muted-foreground">{t("fin.titles")}</span>
            </div>
            <p className="text-lg font-semibold">{formatCurrency(kpisAvancados.valorVencidas30dias)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Evolução Mensal */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                {t("fin.monthly_evolution")}
              </CardTitle>
              <CardDescription>{t("fin.payments_vs_pending")}</CardDescription>
            </div>
            <ToggleGroup type="single" value={chartViewType} onValueChange={(val) => val && setChartViewType(val as 'area' | 'bar' | 'line')}>
              <ToggleGroupItem value="area" aria-label={t("fin.area")} className="text-xs px-3">
                {t("fin.area")}
              </ToggleGroupItem>
              <ToggleGroupItem value="bar" aria-label={t("fin.bars")} className="text-xs px-3">
                {t("fin.bars")}
              </ToggleGroupItem>
              <ToggleGroupItem value="line" aria-label={t("fin.lines")} className="text-xs px-3">
                {t("fin.lines")}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              {chartViewType === 'area' ? (
                <AreaChart data={dadosEvolucaoMensal}>
                  <defs>
                    <linearGradient id="gradPago" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="gradPendente" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" className="text-xs" />
                  <YAxis tickFormatter={(v) => formatCompact(v)} className="text-xs" />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="pago" name={t("fin.paid")} stackId="1" stroke="hsl(var(--chart-2))" fill="url(#gradPago)" />
                  <Area type="monotone" dataKey="pendente" name={t("fin.pending")} stackId="1" stroke="hsl(var(--chart-1))" fill="url(#gradPendente)" />
                </AreaChart>
              ) : chartViewType === 'bar' ? (
                <BarChart data={dadosEvolucaoMensal}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" className="text-xs" />
                  <YAxis tickFormatter={(v) => formatCompact(v)} className="text-xs" />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} labelStyle={{ color: 'hsl(var(--foreground))' }} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Legend />
                  <Bar dataKey="pago" name={t("fin.paid")} fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="pendente" name={t("fin.pending")} fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
              ) : (
                <LineChart data={dadosEvolucaoMensal}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" className="text-xs" />
                  <YAxis tickFormatter={(v) => formatCompact(v)} className="text-xs" />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} labelStyle={{ color: 'hsl(var(--foreground))' }} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Legend />
                  <Line type="monotone" dataKey="pago" name={t("fin.paid")} stroke="hsl(var(--chart-2))" strokeWidth={3} dot={{ fill: "hsl(var(--chart-2))", strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="pendente" name={t("fin.pending")} stroke="hsl(var(--chart-1))" strokeWidth={3} dot={{ fill: "hsl(var(--chart-1))", strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Grid de Gráficos Menores */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              {t("fin.by_department")}
            </CardTitle>
            <CardDescription>{t("fin.expense_distribution")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distribuicaoDepartamento} cx="50%" cy="50%" labelLine={false} outerRadius={90} fill="#8884d8" dataKey="valor" label={({ nome, percent }) => `${nome} (${(percent * 100).toFixed(0)}%)`}>
                    {distribuicaoDepartamento.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string, props: any) => [formatCurrency(value), props.payload.nomeCompleto]} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {t("fin.by_status")}
            </CardTitle>
            <CardDescription>{t("fin.title_status")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribuicaoStatus}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="nome" className="text-xs" />
                  <YAxis tickFormatter={(v) => formatCompact(v)} className="text-xs" />
                  <Tooltip formatter={(value: number, name: string) => [name === 'valor' ? formatCurrency(value) : value, name === 'valor' ? t("approval.total_value") : name]} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Legend />
                  <Bar dataKey="valor" name={t("approval.total_value")} radius={[4, 4, 0, 0]}>
                    {distribuicaoStatus.map((entry) => (
                      <Cell key={`cell-${entry.nome}`} fill={STATUS_COLORS[entry.nome] || COLORS[0]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t("fin.top10_suppliers")}
            </CardTitle>
            <CardDescription>{t("fin.by_total_value")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topFornecedores} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(v) => formatCompact(v)} className="text-xs" />
                  <YAxis dataKey="nome" type="category" width={100} className="text-xs" tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value: number, name: string, props: any) => [formatCurrency(value), props.payload.nomeCompleto]} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                    {topFornecedores.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
