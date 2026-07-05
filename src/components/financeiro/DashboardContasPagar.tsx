import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, BarChart3, LayoutList } from "lucide-react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLanguage } from "@/contexts/LanguageContext";
import type { CpDashboardPayload, CpKpisPayload } from "@/types/financeiro/cp-agregados";

// Fase B: o dashboard consome APENAS agregados do servidor (fn_cp_dashboard / fn_cp_kpis_avancados).

interface DashboardContasPagarProps {
  dashboard: CpDashboardPayload | undefined;
  kpis: CpKpisPayload | undefined;
  isLoading: boolean;
}

// Paleta executiva — tons desaturados (azul-ardósia, grafite, sálvia, âmbar tostado, aço, carvão)
const EXEC_PALETTE = [
  '#334E68', // azul-ardósia
  '#5B6B7B', // cinza-grafite
  '#6B8E7B', // verde-sálvia
  '#B08968', // âmbar tostado
  '#8FA3B0', // aço claro
  '#2C3E50', // carvão
  '#A8A29E', // pedra
  '#7A8B99', // aço médio
];

const EXEC = {
  primary: '#334E68',
  primaryDark: '#22384A',
  neutral: '#5B6B7B',
  neutralLight: '#8FA3B0',
  sage: '#6B8E7B',
  amber: '#B08968',
  danger: '#8C4A4A',
};

const STATUS_COLORS: { [key: string]: string } = {
  'Pago': EXEC.sage,
  'Pendente': EXEC.amber,
  'Vencido': EXEC.danger,
  'Parcial': EXEC.neutral,
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

  const dadosEvolucaoMensal = useMemo(() => {
    const evol = dashboard?.evolucao_mensal || [];
    return evol.slice(0, 12).map(m => {
      let label = m.mes;
      try {
        label = format(parse(m.mes, 'yyyy-MM', new Date()), 'MMM/yy', { locale: ptBR });
      } catch { /* mantém YYYY-MM */ }
      return { mes: label, pago: m.pago || 0, pendente: m.aberto || 0 };
    });
  }, [dashboard]);

  const topFornecedores = useMemo(() => {
    const raw = (dashboard?.top_fornecedores || []).map(f => ({
      nome: f.fornecedor_nome || 'Não informado',
      valor: f.valor || 0,
    }));
    const total = raw.reduce((s, x) => s + x.valor, 0) || 1;
    return raw
      .slice()
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10)
      .map((f, i) => ({
        ...f,
        pct: (f.valor / total) * 100,
        rank: i + 1,
      }));
  }, [dashboard]);

  const distribuicaoDepartamento = useMemo(() => {
    const raw = (dashboard?.por_departamento || []).map(d => ({
      nome: d.departamento_nome || 'Não classificado',
      valor: d.valor || 0,
    }));
    const total = raw.reduce((s, x) => s + x.valor, 0) || 1;
    return raw
      .slice()
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8)
      .map(d => ({
        ...d,
        nomeCurto: d.nome.length > 22 ? d.nome.substring(0, 22) + '…' : d.nome,
        pct: (d.valor / total) * 100,
      }));
  }, [dashboard]);

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

  const maxFornecedor = topFornecedores[0]?.valor || 1;

  return (
    <div className="space-y-6">
      {/* Evolução Mensal */}
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
              <ToggleGroupItem value="area" aria-label={t("fin.area")} className="text-xs px-3">{t("fin.area")}</ToggleGroupItem>
              <ToggleGroupItem value="bar" aria-label={t("fin.bars")} className="text-xs px-3">{t("fin.bars")}</ToggleGroupItem>
              <ToggleGroupItem value="line" aria-label={t("fin.lines")} className="text-xs px-3">{t("fin.lines")}</ToggleGroupItem>
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
                      <stop offset="5%" stopColor={EXEC.sage} stopOpacity={0.5}/>
                      <stop offset="95%" stopColor={EXEC.sage} stopOpacity={0.05}/>
                    </linearGradient>
                    <linearGradient id="gradPendente" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={EXEC.primary} stopOpacity={0.5}/>
                      <stop offset="95%" stopColor={EXEC.primary} stopOpacity={0.05}/>
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
                  <Area type="monotone" dataKey="pago" name={t("fin.paid")} stackId="1" stroke={EXEC.sage} fill="url(#gradPago)" />
                  <Area type="monotone" dataKey="pendente" name={t("fin.pending")} stackId="1" stroke={EXEC.primary} fill="url(#gradPendente)" />
                </AreaChart>
              ) : chartViewType === 'bar' ? (
                <BarChart data={dadosEvolucaoMensal}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" className="text-xs" />
                  <YAxis tickFormatter={(v) => formatCompact(v)} className="text-xs" />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} labelStyle={{ color: 'hsl(var(--foreground))' }} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Legend />
                  <Bar dataKey="pago" name={t("fin.paid")} fill={EXEC.sage} radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="pendente" name={t("fin.pending")} fill={EXEC.primary} radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
              ) : (
                <LineChart data={dadosEvolucaoMensal}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" className="text-xs" />
                  <YAxis tickFormatter={(v) => formatCompact(v)} className="text-xs" />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} labelStyle={{ color: 'hsl(var(--foreground))' }} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Legend />
                  <Line type="monotone" dataKey="pago" name={t("fin.paid")} stroke={EXEC.sage} strokeWidth={2.5} dot={{ fill: EXEC.sage, strokeWidth: 2, r: 3 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="pendente" name={t("fin.pending")} stroke={EXEC.primary} strokeWidth={2.5} dot={{ fill: EXEC.primary, strokeWidth: 2, r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Grid de Gráficos Menores */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Por Departamento — barras horizontais executivas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutList className="h-5 w-5" />
              {t("fin.by_department")}
            </CardTitle>
            <CardDescription>{t("fin.expense_distribution")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] overflow-y-auto pr-1">
              {distribuicaoDepartamento.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground text-center px-6">
                  Distribuição disponível após a classificação por departamento dos títulos.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {distribuicaoDepartamento.map((d, i) => (
                    <div key={d.nome} className="space-y-1" title={d.nome}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-foreground/90 font-medium truncate">{d.nomeCurto}</span>
                        <span className="text-muted-foreground tabular-nums shrink-0 ml-2">
                          {formatCompact(d.valor)} <span className="opacity-60">· {d.pct.toFixed(1)}%</span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${d.pct}%`, backgroundColor: EXEC_PALETTE[i % EXEC_PALETTE.length] }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Por Status */}
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
                  <Tooltip
                    formatter={(value: number, name: string) => [name === 'valor' ? formatCurrency(value) : value, name === 'valor' ? t("approval.total_value") : name]}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  />
                  <Legend />
                  <Bar dataKey="valor" name={t("approval.total_value")} radius={[4, 4, 0, 0]}>
                    {distribuicaoStatus.map((entry) => (
                      <Cell key={`cell-${entry.nome}`} fill={STATUS_COLORS[entry.nome] || EXEC.neutral} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top 10 Fornecedores — lista refinada */}
        <Card className="lg:col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t("fin.top10_suppliers")}
            </CardTitle>
            <CardDescription>{t("fin.by_total_value")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] overflow-y-auto pr-1">
              {topFornecedores.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Sem dados no período.
                </div>
              ) : (
                <div className="space-y-2">
                  {topFornecedores.map((f) => {
                    const widthPct = (f.valor / maxFornecedor) * 100;
                    const isTop = f.rank === 1;
                    return (
                      <div key={f.nome + f.rank} className="space-y-1" title={f.nome}>
                        <div className="flex items-center justify-between text-xs gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-muted-foreground tabular-nums w-4 shrink-0 text-right">{f.rank}</span>
                            <span className={`truncate ${isTop ? 'font-semibold text-foreground' : 'text-foreground/90'}`}>{f.nome}</span>
                          </div>
                          <div className="shrink-0 tabular-nums text-right">
                            <span className="text-foreground/90">{formatCompact(f.valor)}</span>
                            <span className="text-muted-foreground ml-1.5">{f.pct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="h-[6px] w-full bg-muted/60 rounded-full overflow-hidden ml-6">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${widthPct}%`,
                              backgroundColor: isTop ? EXEC.primaryDark : EXEC.primary,
                              opacity: isTop ? 1 : 0.85,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
