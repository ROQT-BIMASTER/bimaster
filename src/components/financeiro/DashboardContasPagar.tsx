import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Receipt, AlertCircle, Clock, TrendingUp, TrendingDown, Calendar, Users,
  BarChart3, PieChart as PieChartIcon, AlertTriangle, CheckCircle2, Hourglass
} from "lucide-react";
import { format, parse, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLanguage } from "@/contexts/LanguageContext";
import type { CpDashboardPayload, CpKpisPayload } from "@/types/financeiro/cp-agregados";

// Fase B: o dashboard consome APENAS agregados do servidor (fn_cp_dashboard / fn_cp_kpis_avancados).
// Mesma fonte da faixa oficial e da tabela => zero pares de números divergentes na tela.
// Visual preservado 1:1 — apenas a origem dos dados mudou (nenhuma soma de dataset no client).

interface DashboardContasPagarProps {
  dashboard: CpDashboardPayload | undefined;
  kpis: CpKpisPayload | undefined;
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

const statusLabel = (s: string) => {
  const k = (s || '').toLowerCase();
  if (k === 'pago') return 'Pago';
  if (k === 'vencido') return 'Vencido';
  if (k === 'parcial') return 'Parcial';
  return 'Pendente';
};

export function DashboardContasPagar({ dashboard, kpis, isLoading }: DashboardContasPagarProps) {
  const { t } = useLanguage();
  const [chartViewType, setChartViewType] = useState<'area' | 'bar' | 'line'>('area');

  // KPIs — direto dos payloads do servidor
  const kpisAvancados = useMemo(() => {
    const evol = dashboard?.evolucao_mensal || [];
    // Semântica preservada do client antigo: "Mês Atual" = valor_original com vencimento no mês corrente
    const ymAtual = format(new Date(), 'yyyy-MM');
    const ymAnterior = format(subMonths(new Date(), 1), 'yyyy-MM');
    const totalMesAtual = evol.find(m => m.mes === ymAtual)?.original ?? kpis?.total_mes_atual ?? 0;
    const totalMesAnterior = evol.find(m => m.mes === ymAnterior)?.original ?? kpis?.total_mes_anterior ?? 0;
    const variacaoMensal = totalMesAnterior > 0
      ? Math.round(((totalMesAtual - totalMesAnterior) / totalMesAnterior) * 100)
      : 0;

    return {
      pmp: kpis?.pmp_dias_aprox ?? 0,
      indicePontualidade: Math.round(kpis?.pontualidade_pct_aprox ?? 0),
      aproximado: kpis?.aproximado ?? true,
      concentracao30dias: kpis?.concentracao_30d ?? 0,
      totalMesAtual,
      variacaoMensal,
      qtdVencendoHoje: dashboard?.vence_hoje?.qtd ?? 0,
      valorVencendoHoje: dashboard?.vence_hoje?.valor ?? 0,
      qtdVencendo7dias: dashboard?.vence_7d?.qtd ?? 0,
      valorVencendo7dias: dashboard?.vence_7d?.valor ?? 0,
      qtdVencidas30dias: dashboard?.vencido_30_mais?.qtd ?? 0,
      valorVencidas30dias: dashboard?.vencido_30_mais?.valor ?? 0,
    };
  }, [dashboard, kpis]);

  // Evolução mensal — buckets do servidor (pago = valor_pago; pendente = valor_aberto)
  const dadosEvolucaoMensal = useMemo(() => {
    const evol = dashboard?.evolucao_mensal || [];
    return evol.slice(0, 12).map(m => {
      let label = m.mes;
      try {
        label = format(parse(m.mes, 'yyyy-MM', new Date()), 'MMM/yy', { locale: ptBR });
      } catch { /* mantém YYYY-MM se o parse falhar */ }
      return { mes: label, pago: m.pago || 0, pendente: m.aberto || 0 };
    });
  }, [dashboard]);

  // Top 10 fornecedores — agregado no servidor (valor_original)
  const topFornecedores = useMemo(() => {
    return (dashboard?.top_fornecedores || []).map(f => {
      const nome = f.fornecedor_nome || 'Não informado';
      return {
        nome: nome.length > 20 ? nome.substring(0, 20) + '...' : nome,
        nomeCompleto: nome,
        valor: f.valor || 0,
      };
    });
  }, [dashboard]);

  // Distribuição por departamento — requer RPC v2 (por_departamento); até lá, estado vazio
  const distribuicaoDepartamento = useMemo(() => {
    return (dashboard?.por_departamento || [])
      .map(d => {
        const nome = d.departamento_nome || 'Não classificado';
        return {
          nome: nome.length > 15 ? nome.substring(0, 15) + '...' : nome,
          nomeCompleto: nome,
          valor: d.valor || 0,
        };
      })
      .slice(0, 8);
  }, [dashboard]);

  // Distribuição por status — agregado no servidor (valor_original quando a RPC v2 estiver aplicada)
  const distribuicaoStatus = useMemo(() => {
    const porStatus: { [key: string]: { qtd: number; valor: number } } = {};
    (dashboard?.por_status || []).forEach(s => {
      const label = statusLabel(s.status);
      if (!porStatus[label]) porStatus[label] = { qtd: 0, valor: 0 };
      porStatus[label].qtd += s.qtd || 0;
      porStatus[label].valor += (s.valor_original ?? s.valor) || 0;
    });
    return Object.entries(porStatus)
      .filter(([_, data]) => data.qtd > 0)
      .map(([nome, data]) => ({ nome, valor: data.valor, qtd: data.qtd }));
  }, [dashboard]);

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
      {/* KPIs consolidados agora vivem no header da página (ContasPagarHeaderKpis). */}

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
              {distribuicaoDepartamento.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground text-center px-6">
                  Distribuição disponível após a classificação por departamento dos títulos.
                </div>
              ) : (
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
              )}
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
