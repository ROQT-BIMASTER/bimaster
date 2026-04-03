import { useMemo } from "react";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Receipt, AlertCircle, Clock, TrendingUp, TrendingDown, Calendar, Users,
  BarChart3, PieChart as PieChartIcon, AlertTriangle, CheckCircle2, Hourglass
} from "lucide-react";
import { format, differenceInDays, subMonths, startOfMonth, endOfMonth, isWithinInterval, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate, getDateKey, getToday } from "@/utils/dateUtils";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, Line
} from "recharts";
import { EvolutionChart, HorizontalBarChart, DonutChart, StatusBarChart } from "./FinanceiroChartsGrid";
import { useLanguage } from "@/contexts/LanguageContext";

// Interfaces
interface ContaReceber {
  id: string;
  cliente_nome: string;
  valor_original: number;
  valor_aberto: number;
  valor_recebido: number;
  data_emissao: string;
  data_vencimento: string;
  data_recebimento: string | null;
  status: string;
  vendedor_nome: string | null;
}

interface DashboardContasReceberProps {
  contas: ContaReceber[] | undefined;
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
  'Recebido': 'hsl(var(--chart-2))',
  'Pendente': 'hsl(var(--chart-3))',
  'Vencido': 'hsl(var(--chart-5))',
  'Parcial': 'hsl(var(--chart-1))',
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatCompact = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(value);

export function DashboardContasReceber({ contas, isLoading }: DashboardContasReceberProps) {
  const { t } = useLanguage();
  
  // KPIs Avançados
  const kpisAvancados = useMemo(() => {
    if (!contas || contas.length === 0) {
      return {
        pmr: 0, indicePontualidade: 0, concentracao7dias: 0, concentracao15dias: 0,
        concentracao30dias: 0, totalMesAtual: 0, totalMesAnterior: 0, variacaoMensal: 0,
        qtdVencendoHoje: 0, qtdVencendo7dias: 0, qtdVencidas30dias: 0,
        valorVencendoHoje: 0, valorVencendo7dias: 0, valorVencidas30dias: 0,
      };
    }

    const hoje = getToday();
    const hojeStr = getDateKey(hoje);
    const inicioMes = startOfMonth(hoje);
    const fimMes = endOfMonth(hoje);
    const inicioMesAnterior = startOfMonth(subMonths(hoje, 1));
    const fimMesAnterior = endOfMonth(subMonths(hoje, 1));

    const isRecebido = (status: string) => status?.toLowerCase() === 'recebido';
    
    const contasRecebidas = contas.filter(c => c.data_recebimento && c.data_emissao && isRecebido(c.status));
    let totalDiasRecebimento = 0;
    contasRecebidas.forEach(c => {
      const emissao = parseLocalDate(c.data_emissao);
      const recebimento = parseLocalDate(c.data_recebimento!);
      if (emissao && recebimento) totalDiasRecebimento += differenceInDays(recebimento, emissao);
    });
    const pmr = contasRecebidas.length > 0 ? Math.round(totalDiasRecebimento / contasRecebidas.length) : 0;

    const recebidasNoPrazo = contasRecebidas.filter(c => {
      const vencimento = parseLocalDate(c.data_vencimento);
      const recebimento = parseLocalDate(c.data_recebimento!);
      if (!vencimento || !recebimento) return false;
      return differenceInDays(recebimento, vencimento) <= 0;
    });
    const indicePontualidade = contasRecebidas.length > 0 
      ? Math.round((recebidasNoPrazo.length / contasRecebidas.length) * 100) : 0;

    const contasPendentes = contas.filter(c => !isRecebido(c.status));
    
    const vencendo7dias = contasPendentes.filter(c => {
      if (!c.data_vencimento) return false;
      const venc = parseLocalDate(c.data_vencimento);
      if (!venc) return false;
      const dias = differenceInDays(venc, hoje);
      return dias >= 0 && dias <= 7;
    });
    const vencendo30dias = contasPendentes.filter(c => {
      if (!c.data_vencimento) return false;
      const venc = parseLocalDate(c.data_vencimento);
      if (!venc) return false;
      const dias = differenceInDays(venc, hoje);
      return dias >= 0 && dias <= 30;
    });

    const concentracao7dias = vencendo7dias.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    const concentracao30dias = vencendo30dias.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);

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
      ? Math.round(((totalMesAtual - totalMesAnterior) / totalMesAnterior) * 100) : 0;

    const vencendoHoje = contasPendentes.filter(c => getDateKey(c.data_vencimento) === hojeStr);
    const vencidas30dias = contasPendentes.filter(c => {
      if (!c.data_vencimento) return false;
      const venc = parseLocalDate(c.data_vencimento);
      if (!venc) return false;
      return differenceInDays(hoje, venc) > 30;
    });

    return {
      pmr, indicePontualidade, concentracao7dias, concentracao15dias: 0,
      concentracao30dias, totalMesAtual, totalMesAnterior, variacaoMensal,
      qtdVencendoHoje: vencendoHoje.length, qtdVencendo7dias: vencendo7dias.length,
      qtdVencidas30dias: vencidas30dias.length,
      valorVencendoHoje: vencendoHoje.reduce((sum, c) => sum + (c.valor_aberto || 0), 0),
      valorVencendo7dias: concentracao7dias,
      valorVencidas30dias: vencidas30dias.reduce((sum, c) => sum + (c.valor_aberto || 0), 0),
    };
  }, [contas]);

  // Dados para evolução mensal
  const dadosEvolucaoMensal = useMemo(() => {
    if (!contas || contas.length === 0) return [];
    const hoje = getToday();
    const isRecebido = (status: string) => status?.toLowerCase() === 'recebido';
    const meses: { mes: string; recebido: number; pendente: number; inicio: Date; fim: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const data = subMonths(hoje, i);
      meses.push({ mes: format(data, 'MMM/yy', { locale: ptBR }), recebido: 0, pendente: 0, inicio: startOfMonth(data), fim: endOfMonth(data) });
    }
    contas.forEach(c => {
      if (!c.data_vencimento) return;
      const venc = parseLocalDate(c.data_vencimento);
      if (!venc) return;
      const mesIndex = meses.findIndex(m => isWithinInterval(venc, { start: m.inicio, end: m.fim }));
      if (mesIndex !== -1) {
        if (isRecebido(c.status)) meses[mesIndex].recebido += c.valor_recebido || 0;
        else meses[mesIndex].pendente += c.valor_aberto || 0;
      }
    });
    return meses.map(m => ({ mes: m.mes, recebido: m.recebido, pendente: m.pendente }));
  }, [contas]);

  // Top 10 clientes com contas em aberto
  const topClientes = useMemo(() => {
    if (!contas || contas.length === 0) return [];
    const porCliente: { [key: string]: number } = {};
    const isRecebido = (status: string) => status?.toLowerCase() === 'recebido';
    contas.filter(c => !isRecebido(c.status)).forEach(c => {
      const nome = c.cliente_nome || 'Não informado';
      porCliente[nome] = (porCliente[nome] || 0) + (c.valor_aberto || 0);
    });
    return Object.entries(porCliente).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([nome, valor]) => ({ nome: nome.length > 20 ? nome.substring(0, 20) + '...' : nome, nomeCompleto: nome, valor }));
  }, [contas]);

  // Aging report (faixas de vencimento)
  const agingReport = useMemo(() => {
    if (!contas || contas.length === 0) return [];
    const hoje = getToday();
    const isRecebido = (status: string) => status?.toLowerCase() === 'recebido';
    const faixasFuturo = [
      { nome: 'Vencido', tipo: 'vencido', min: 1, max: 9999, valor: 0, qtd: 0 },
      { nome: 'Hoje', tipo: 'hoje', min: 0, max: 0, valor: 0, qtd: 0 },
      { nome: '1-30 dias', tipo: 'futuro', min: 1, max: 30, valor: 0, qtd: 0 },
      { nome: '31-60 dias', tipo: 'futuro', min: 31, max: 60, valor: 0, qtd: 0 },
      { nome: '61-90 dias', tipo: 'futuro', min: 61, max: 90, valor: 0, qtd: 0 },
      { nome: '+90 dias', tipo: 'futuro', min: 91, max: 9999, valor: 0, qtd: 0 },
    ];
    contas.filter(c => !isRecebido(c.status) && c.data_vencimento).forEach(c => {
      const venc = parseLocalDate(c.data_vencimento);
      if (!venc) return;
      const diasAteFuturo = differenceInDays(venc, hoje);
      if (diasAteFuturo < 0) { faixasFuturo[0].valor += c.valor_aberto || 0; faixasFuturo[0].qtd += 1; }
      else if (diasAteFuturo === 0) { faixasFuturo[1].valor += c.valor_aberto || 0; faixasFuturo[1].qtd += 1; }
      else {
        const faixa = faixasFuturo.find(f => f.tipo === 'futuro' && diasAteFuturo >= f.min && diasAteFuturo <= f.max);
        if (faixa) { faixa.valor += c.valor_aberto || 0; faixa.qtd += 1; }
      }
    });
    return faixasFuturo;
  }, [contas]);

  // Distribuição por status
  const distribuicaoStatus = useMemo(() => {
    if (!contas || contas.length === 0) return [];
    const hoje = getToday();
    const porStatus: { [key: string]: { qtd: number; valor: number } } = {
      'Recebido': { qtd: 0, valor: 0 }, 'Pendente': { qtd: 0, valor: 0 },
      'Vencido': { qtd: 0, valor: 0 }, 'Parcial': { qtd: 0, valor: 0 },
    };
    contas.forEach(c => {
      const statusLower = c.status?.toLowerCase() || 'pendente';
      let status: string;
      if (statusLower === 'recebido') status = 'Recebido';
      else if (statusLower === 'parcial') status = 'Parcial';
      else {
        const venc = parseLocalDate(c.data_vencimento);
        status = (venc && differenceInDays(hoje, venc) > 0) ? 'Vencido' : 'Pendente';
      }
      porStatus[status].qtd += 1;
      porStatus[status].valor += c.valor_original || 0;
    });
    return Object.entries(porStatus).filter(([_, data]) => data.qtd > 0)
      .map(([nome, data]) => ({ nome, valor: data.valor, qtd: data.qtd }));
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
            <Card key={i}><CardContent className="pt-6"><div className="animate-pulse space-y-2"><div className="h-4 bg-muted rounded w-1/2"></div><div className="h-8 bg-muted rounded w-3/4"></div></div></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("fin.avg_receipt_term")}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpisAvancados.pmr} {t("fin.days")}</div>
            <p className="text-xs text-muted-foreground">{t("fin.avg_receipt_desc")}</p>
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
            <p className="text-xs text-muted-foreground">{t("fin.received_on_time")}</p>
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
                <><TrendingUp className="h-3 w-3 text-green-600" /><span className="text-green-600">+{kpisAvancados.variacaoMensal}% {t("fin.vs_prev_month")}</span></>
              ) : kpisAvancados.variacaoMensal < 0 ? (
                <><TrendingDown className="h-3 w-3 text-destructive" /><span className="text-destructive">{kpisAvancados.variacaoMensal}% {t("fin.vs_prev_month")}</span></>
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
            <p className="text-xs text-muted-foreground">{t("fin.to_receive_period")}</p>
          </CardContent>
        </Card>
      </div>

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
              <span className={`text-2xl font-bold ${kpisAvancados.qtdVencendoHoje > 0 ? 'text-yellow-600' : ''}`}>{kpisAvancados.qtdVencendoHoje}</span>
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
              <span className={`text-2xl font-bold ${kpisAvancados.qtdVencendo7dias > 5 ? 'text-orange-600' : ''}`}>{kpisAvancados.qtdVencendo7dias}</span>
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
              <span className={`text-2xl font-bold ${kpisAvancados.qtdVencidas30dias > 0 ? 'text-destructive' : ''}`}>{kpisAvancados.qtdVencidas30dias}</span>
              <span className="text-sm text-muted-foreground">{t("fin.titles")}</span>
            </div>
            <p className="text-lg font-semibold">{formatCurrency(kpisAvancados.valorVencidas30dias)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />{t("fin.monthly_evolution")}</CardTitle>
            <CardDescription>{t("fin.receipts_vs_pending")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dadosEvolucaoMensal}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" className="text-xs" />
                  <YAxis tickFormatter={(v) => formatCompact(v)} className="text-xs" />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} labelStyle={{ color: 'hsl(var(--foreground))' }} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Legend />
                  <Area type="monotone" dataKey="recebido" name={t("fin.received")} stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="pendente" name={t("fin.pending")} stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3))" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />{t("fin.top10_clients_open")}</CardTitle>
            <CardDescription>{t("fin.highest_receivable")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topClientes} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(v) => formatCompact(v)} className="text-xs" />
                  <YAxis type="category" dataKey="nome" className="text-xs" width={100} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} labelFormatter={(label) => topClientes.find(c => c.nome === label)?.nomeCompleto || label} labelStyle={{ color: 'hsl(var(--foreground))' }} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Bar dataKey="valor" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />{t("fin.receivable_by_term")}</CardTitle>
            <CardDescription>{t("fin.distribution_by_term")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingReport}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="nome" className="text-xs" />
                  <YAxis tickFormatter={(v) => formatCompact(v)} className="text-xs" />
                  <Tooltip formatter={(value: number, name: string) => [formatCurrency(value), name === 'valor' ? t("approval.total_value") : name]} labelStyle={{ color: 'hsl(var(--foreground))' }} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Bar dataKey="valor" name={t("approval.total_value")} radius={[4, 4, 0, 0]}>
                    {agingReport.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? 'hsl(var(--chart-5))' : 'hsl(var(--chart-2))'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PieChartIcon className="h-5 w-5" />{t("fin.status_distribution")}</CardTitle>
            <CardDescription>{t("fin.value_by_status")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distribuicaoStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="valor" nameKey="nome" label={({ nome, percent }) => `${nome}: ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {distribuicaoStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.nome] || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} labelStyle={{ color: 'hsl(var(--foreground))' }} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
