import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { 
  Receipt, AlertCircle, Clock, TrendingUp, TrendingDown, Calendar, Users, 
  BarChart3, PieChart as PieChartIcon, AlertTriangle, CheckCircle2, Hourglass,
  Info, ExternalLink
} from "lucide-react";
import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, Line
} from "recharts";
import { fetchAllRows } from "@/lib/utils/fetchAllRows";
import { parseLocalDate, getToday } from "@/utils/dateUtils";

interface DashboardContasReceberAggregatedProps {
  filterEmpresas: number[];
  filterAnos: number[];
  filterMeses: number[];
  filterConta: string;
  filterPortador: string;
  filterDiaVencimento?: string;
  filterDiaRecebimento?: string;
}

interface ContaReceberRow {
  id: number;
  valor_original: number | null;
  valor_aberto: number | null;
  valor_recebido: number | null;
  status: string | null;
  data_vencimento: string | null;
  data_emissao: string | null;
  data_recebimento: string | null;
  cliente_nome: string | null;
  empresa_id: number | null;
  conta: string | null;
  portador: string | null;
  dias_atraso: number | null;
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

function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export function DashboardContasReceberAggregated({ 
  filterEmpresas, 
  filterAnos, 
  filterMeses, 
  filterConta, 
  filterPortador,
  filterDiaVencimento,
  filterDiaRecebimento
}: DashboardContasReceberAggregatedProps) {
  const [showPmrDetails, setShowPmrDetails] = useState(false);

  // Build a stable query key from filters
  const queryKeyBase = useMemo(() => [
    filterEmpresas.join(',') || 'all',
    filterAnos.join(',') || 'all',
    filterMeses.join(',') || 'all',
    filterConta,
    filterPortador,
    filterDiaVencimento ?? '',
    filterDiaRecebimento ?? '',
  ], [filterEmpresas, filterAnos, filterMeses, filterConta, filterPortador, filterDiaVencimento, filterDiaRecebimento]);

  // Single query: fetch ALL rows from contas_receber with filters
  const { data: allRows, isLoading } = useQuery({
    queryKey: ['contas-receber-dashboard-rows', ...queryKeyBase],
    queryFn: async () => {
      const columns = 'id,valor_original,valor_aberto,valor_recebido,status,data_vencimento,data_emissao,data_recebimento,cliente_nome,empresa_id,conta,portador,dias_atraso';

      const rows = await fetchAllRows<ContaReceberRow>(
        'contas_receber',
        columns,
        (q) => {
          let query = q;

          // Filter by empresa
          if (filterEmpresas.length > 0) {
            query = query.in('empresa_id', filterEmpresas);
          }

          // Filter by specific day
          if (filterDiaVencimento) {
            query = query.eq('data_vencimento', filterDiaVencimento);
          } else {
            // Filter by year/month ranges on data_vencimento
            if (filterAnos.length > 0 && filterMeses.length > 0) {
              // Build date ranges for each year+month combo
              const dates: string[] = [];
              for (const ano of filterAnos) {
                for (const mes of filterMeses) {
                  const start = `${ano}-${String(mes).padStart(2, '0')}-01`;
                  const lastDay = new Date(ano, mes, 0).getDate();
                  const end = `${ano}-${String(mes).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                  dates.push(start, end);
                }
              }
              // Use min/max as broad range
              dates.sort();
              query = query.gte('data_vencimento', dates[0]).lte('data_vencimento', dates[dates.length - 1]);
            } else if (filterAnos.length > 0) {
              const minYear = Math.min(...filterAnos);
              const maxYear = Math.max(...filterAnos);
              query = query.gte('data_vencimento', `${minYear}-01-01`).lte('data_vencimento', `${maxYear}-12-31`);
            }
            // If no year/month filter, fetch all (like RPCs defaulting to last 3 years)
          }

          if (filterDiaRecebimento) {
            query = query.eq('data_recebimento', filterDiaRecebimento);
          }

          if (filterConta && filterConta !== 'all') {
            query = query.eq('conta', filterConta);
          }

          if (filterPortador && filterPortador !== 'all') {
            query = query.eq('portador', filterPortador);
          }

          return query;
        }
      );

      return rows;
    },
    staleTime: 5 * 60 * 1000,
  });

  const rows = allRows || [];
  const today = getToday();

  // ---- KPIs ----
  const kpisData = useMemo(() => {
    let total_titulos = rows.length;
    let total_valor_original = 0;
    let total_valor_aberto = 0;
    let total_valor_recebido = 0;
    let qtd_recebido = 0, valor_recebido_total = 0;
    let qtd_pendente = 0, valor_pendente = 0;
    let qtd_vencido = 0, valor_vencido = 0;
    let qtd_vencendo_hoje = 0, valor_vencendo_hoje = 0;
    let qtd_vencendo_7dias = 0, valor_vencendo_7dias = 0;
    let valor_vencendo_15dias = 0, valor_vencendo_30dias = 0;
    let qtd_vencidas_30dias = 0, valor_vencidas_30dias = 0;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    let total_mes_atual = 0;
    let total_mes_anterior = 0;

    // PMR accumulators
    let pmrSum = 0, pmrCount = 0;
    let recebidosNoPrazo = 0, recebidosTotal = 0;

    const in7days = new Date(today);
    in7days.setDate(in7days.getDate() + 7);
    const in15days = new Date(today);
    in15days.setDate(in15days.getDate() + 15);
    const in30days = new Date(today);
    in30days.setDate(in30days.getDate() + 30);
    const minus30days = new Date(today);
    minus30days.setDate(minus30days.getDate() - 30);

    for (const r of rows) {
      const vo = r.valor_original || 0;
      const va = r.valor_aberto || 0;
      const vr = r.valor_recebido || 0;
      total_valor_original += vo;
      total_valor_aberto += va;
      total_valor_recebido += vr;

      const statusLower = (r.status || '').toLowerCase().trim();
      const venc = parseLocalDate(r.data_vencimento);

      if (statusLower === 'recebido') {
        qtd_recebido++;
        valor_recebido_total += vr || vo;
        recebidosTotal++;
        // PMR: data_recebimento - data_emissao
        const dr = parseLocalDate(r.data_recebimento);
        const de = parseLocalDate(r.data_emissao);
        if (dr && de) {
          const days = diffDays(dr, de);
          if (days >= 0) { pmrSum += days; pmrCount++; }
          // Pontualidade: recebido antes ou no dia do vencimento
          if (venc && dr <= venc) recebidosNoPrazo++;
        }
      } else if (statusLower === 'vencido' || (statusLower !== 'recebido' && statusLower !== 'cancelado' && venc && venc < today)) {
        qtd_vencido++;
        valor_vencido += va;
        // Vencidas há mais de 30 dias
        if (venc && venc < minus30days) {
          qtd_vencidas_30dias++;
          valor_vencidas_30dias += va;
        }
      } else if (statusLower === 'pendente' || statusLower === 'parcial' || statusLower === '') {
        qtd_pendente++;
        valor_pendente += va;
      }

      // Vencendo checks (only non-recebido)
      if (statusLower !== 'recebido' && statusLower !== 'cancelado' && venc) {
        if (venc.getTime() === today.getTime()) { qtd_vencendo_hoje++; valor_vencendo_hoje += va; }
        if (venc >= today && venc <= in7days) { qtd_vencendo_7dias++; valor_vencendo_7dias += va; }
        if (venc >= today && venc <= in15days) { valor_vencendo_15dias += va; }
        if (venc >= today && venc <= in30days) { valor_vencendo_30dias += va; }
      }

      // Monthly comparison
      if (venc) {
        if (venc.getMonth() === currentMonth && venc.getFullYear() === currentYear) {
          total_mes_atual += vo;
        }
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        if (venc.getMonth() === prevMonth && venc.getFullYear() === prevYear) {
          total_mes_anterior += vo;
        }
      }
    }

    const pmr = pmrCount > 0 ? Math.round(pmrSum / pmrCount) : 0;
    const variacao_mensal = total_mes_anterior > 0
      ? Math.round(((total_mes_atual - total_mes_anterior) / total_mes_anterior) * 100)
      : 0;
    const indice_pontualidade = recebidosTotal > 0
      ? Math.round((recebidosNoPrazo / recebidosTotal) * 100)
      : 0;

    return {
      total_titulos, total_valor_original, total_valor_aberto, total_valor_recebido,
      qtd_recebido, valor_recebido_total, qtd_pendente, valor_pendente,
      qtd_vencido, valor_vencido, qtd_vencendo_hoje, valor_vencendo_hoje,
      qtd_vencendo_7dias, valor_vencendo_7dias, valor_vencendo_15dias, valor_vencendo_30dias,
      qtd_vencidas_30dias, valor_vencidas_30dias, total_mes_atual, total_mes_anterior,
      variacao_mensal, pmr, indice_pontualidade,
    };
  }, [rows, today]);

  // ---- Evolução Mensal ----
  const evolucao = useMemo(() => {
    const map = new Map<string, { recebido: number; pendente: number }>();
    for (const r of rows) {
      const venc = r.data_vencimento;
      if (!venc) continue;
      const key = venc.substring(0, 7); // YYYY-MM
      if (!map.has(key)) map.set(key, { recebido: 0, pendente: 0 });
      const entry = map.get(key)!;
      const statusLower = (r.status || '').toLowerCase().trim();
      if (statusLower === 'recebido') {
        entry.recebido += r.valor_recebido || r.valor_original || 0;
      } else if (statusLower !== 'cancelado') {
        entry.pendente += r.valor_aberto || 0;
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([mes, vals]) => ({ mes, ...vals }));
  }, [rows]);

  // ---- Top 10 Clientes Devedores ----
  const topClientes = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const statusLower = (r.status || '').toLowerCase().trim();
      if (statusLower === 'recebido' || statusLower === 'cancelado') continue;
      const nome = r.cliente_nome || 'Sem nome';
      map.set(nome, (map.get(nome) || 0) + (r.valor_aberto || 0));
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([nomeCompleto, valor]) => ({
        nome: nomeCompleto.length > 20 ? nomeCompleto.substring(0, 18) + '…' : nomeCompleto,
        nomeCompleto,
        valor,
      }));
  }, [rows]);

  // ---- Aging Report ----
  const aging = useMemo(() => {
    const buckets = [
      { nome: '0-15 dias', min: 0, max: 15, valor: 0, qtd: 0 },
      { nome: '16-30 dias', min: 16, max: 30, valor: 0, qtd: 0 },
      { nome: '31-60 dias', min: 31, max: 60, valor: 0, qtd: 0 },
      { nome: '61-90 dias', min: 61, max: 90, valor: 0, qtd: 0 },
      { nome: '90+ dias', min: 91, max: Infinity, valor: 0, qtd: 0 },
    ];
    for (const r of rows) {
      const statusLower = (r.status || '').toLowerCase().trim();
      if (statusLower === 'recebido' || statusLower === 'cancelado') continue;
      const venc = parseLocalDate(r.data_vencimento);
      if (!venc || venc >= today) continue; // only overdue
      const days = r.dias_atraso != null ? r.dias_atraso : diffDays(today, venc);
      if (days <= 0) continue;
      for (const b of buckets) {
        if (days >= b.min && days <= b.max) {
          b.valor += r.valor_aberto || 0;
          b.qtd++;
          break;
        }
      }
    }
    return buckets.map(({ nome, valor, qtd }) => ({ nome, valor, qtd }));
  }, [rows, today]);

  // ---- Status Distribution ----
  const statusDist = useMemo(() => {
    const map = new Map<string, { valor: number; qtd: number }>();
    for (const r of rows) {
      let status = (r.status || 'Pendente').trim();
      // Capitalize first letter
      status = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
      if (!map.has(status)) map.set(status, { valor: 0, qtd: 0 });
      const entry = map.get(status)!;
      entry.valor += r.valor_aberto || r.valor_original || 0;
      entry.qtd++;
    }
    return Array.from(map.entries()).map(([nome, vals]) => ({ nome, ...vals }));
  }, [rows]);

  // ---- PMR Details (computed from same data, shown in modal) ----
  const pmrDetalhes = useMemo(() => {
    if (!showPmrDetails) return null;

    const recebidos = rows.filter(r => (r.status || '').toLowerCase().trim() === 'recebido');
    const prazos: number[] = [];
    let recebidosNoPrazo = 0;
    let recebidosEmAtraso = 0;
    let valorNoPrazo = 0;
    let valorEmAtraso = 0;
    const porMesMap = new Map<string, { sum: number; count: number }>();

    for (const r of recebidos) {
      const dr = parseLocalDate(r.data_recebimento);
      const de = parseLocalDate(r.data_emissao);
      const dv = parseLocalDate(r.data_vencimento);
      if (!dr || !de) continue;
      const days = diffDays(dr, de);
      if (days < 0) continue;
      prazos.push(days);

      const vo = r.valor_original || 0;
      if (dv && dr <= dv) {
        recebidosNoPrazo++;
        valorNoPrazo += vo;
      } else {
        recebidosEmAtraso++;
        valorEmAtraso += vo;
      }

      // PMR por mês (based on data_recebimento month)
      const mesKey = r.data_recebimento!.substring(0, 7);
      if (!porMesMap.has(mesKey)) porMesMap.set(mesKey, { sum: 0, count: 0 });
      const entry = porMesMap.get(mesKey)!;
      entry.sum += days;
      entry.count++;
    }

    prazos.sort((a, b) => a - b);
    const total = prazos.length;
    const avg = total > 0 ? Math.round(prazos.reduce((a, b) => a + b, 0) / total) : 0;
    const sorted = [...prazos];
    const mediana = total > 0 ? sorted[Math.floor(total / 2)] : 0;

    // PMR vencimento->recebimento
    let pmrVencSum = 0, pmrVencCount = 0;
    for (const r of recebidos) {
      const dr = parseLocalDate(r.data_recebimento);
      const dv = parseLocalDate(r.data_vencimento);
      if (!dr || !dv) continue;
      pmrVencSum += diffDays(dr, dv);
      pmrVencCount++;
    }

    // Faixas
    const faixas = {
      ate_15_dias: prazos.filter(d => d <= 15).length,
      de_16_a_30_dias: prazos.filter(d => d >= 16 && d <= 30).length,
      de_31_a_45_dias: prazos.filter(d => d >= 31 && d <= 45).length,
      de_46_a_60_dias: prazos.filter(d => d >= 46 && d <= 60).length,
      acima_60_dias: prazos.filter(d => d > 60).length,
    };

    const por_mes = Array.from(porMesMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([mes, { sum, count }]) => ({ mes, qtd: count, pmr_mes: Math.round(sum / count) }));

    // Date range
    const allDates = recebidos
      .map(r => r.data_emissao || r.data_vencimento || '')
      .filter(Boolean)
      .sort();

    return {
      periodo: {
        data_inicio: allDates[0] || '',
        data_fim: allDates[allDates.length - 1] || '',
      },
      resumo: {
        total_titulos_analisados: total,
        pmr_emissao_recebimento: avg,
        pmr_vencimento_recebimento: pmrVencCount > 0 ? Math.round(pmrVencSum / pmrVencCount) : 0,
        menor_prazo: total > 0 ? sorted[0] : 0,
        maior_prazo: total > 0 ? sorted[total - 1] : 0,
        mediana_prazo: mediana,
        recebidos_no_prazo: recebidosNoPrazo,
        recebidos_em_atraso: recebidosEmAtraso,
        valor_no_prazo: valorNoPrazo,
        valor_em_atraso: valorEmAtraso,
      },
      faixas,
      por_mes,
      formula: 'PMR = Σ(Data Recebimento - Data Emissão) / Nº Títulos Recebidos',
      observacoes: [
        'Considera apenas títulos com status "Recebido" e datas válidas.',
        'PMR (Emissão → Recebimento): dias entre emissão e recebimento efetivo.',
        'PMR (Vencimento → Recebimento): valores negativos indicam recebimento antecipado.',
      ],
    };
  }, [rows, showPmrDetails]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Carregando dados consolidados...</span>
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
      {/* Cards Principais - Resumo de Valores no Topo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">Total Recebido</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(kpisData.valor_recebido_total)}</div>
            <p className="text-xs text-muted-foreground">{kpisData.qtd_recebido.toLocaleString()} títulos</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Total Pendente</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(kpisData.valor_pendente)}</div>
            <p className="text-xs text-muted-foreground">{kpisData.qtd_pendente.toLocaleString()} títulos</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">Total Vencido</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(kpisData.valor_vencido)}</div>
            <p className="text-xs text-muted-foreground">{kpisData.qtd_vencido.toLocaleString()} títulos</p>
          </CardContent>
        </Card>
      </div>

      {/* KPIs Estratégicos */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow group"
          onClick={() => setShowPmrDetails(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              Prazo Médio Recebimento
              <Info className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpisData.pmr} dias</div>
            <p className="text-xs text-muted-foreground">Clique para ver detalhes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Índice de Pontualidade</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpisData.indice_pontualidade}%</div>
            <p className="text-xs text-muted-foreground">Recebimentos no prazo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Variação Mensal</CardTitle>
            {kpisData.variacao_mensal >= 0 
              ? <TrendingUp className="h-4 w-4 text-green-500" />
              : <TrendingDown className="h-4 w-4 text-red-500" />
            }
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${kpisData.variacao_mensal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {kpisData.variacao_mensal > 0 ? '+' : ''}{kpisData.variacao_mensal}%
            </div>
            <p className="text-xs text-muted-foreground">Comparado ao mês anterior</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Títulos</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpisData.total_titulos.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{formatCompact(kpisData.total_valor_original)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas e Concentração */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencendo Hoje</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpisData.qtd_vencendo_hoje}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(kpisData.valor_vencendo_hoje)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximos 7 dias</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpisData.qtd_vencendo_7dias}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(kpisData.valor_vencendo_7dias)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximos 30 dias</CardTitle>
            <Hourglass className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCompact(kpisData.valor_vencendo_30dias)}</div>
            <p className="text-xs text-muted-foreground">Concentração de vencimentos</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencidas +30 dias</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{kpisData.qtd_vencidas_30dias}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(kpisData.valor_vencidas_30dias)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Evolução Mensal - Full Width */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Evolução Mensal
          </CardTitle>
          <CardDescription>Recebido vs Pendente (últimos 12 meses)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={evolucao}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" className="text-xs" />
                <YAxis tickFormatter={(v) => formatCompact(v)} className="text-xs" />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Bar dataKey="recebido" name="Recebido" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pendente" name="Pendente" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Distribuição por Status - Moved below */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Distribuição por Status
            </CardTitle>
            <CardDescription>Visão geral dos títulos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDist}
                    dataKey="valor"
                    nameKey="nome"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ nome, percent }) => `${nome} ${(percent * 100).toFixed(0)}%`}
                  >
                    {statusDist.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={STATUS_COLORS[entry.nome] || COLORS[index % COLORS.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Aging Report */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Aging Report
            </CardTitle>
            <CardDescription>Faixas de vencimento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aging} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(v) => formatCompact(v)} className="text-xs" />
                  <YAxis dataKey="nome" type="category" width={80} className="text-xs" />
                  <Tooltip 
                    formatter={(value: number, name, props) => [formatCurrency(value), `${props.payload.qtd} títulos`]}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="valor" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top 10 Clientes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top 10 Clientes Devedores
            </CardTitle>
            <CardDescription>Maiores valores em aberto</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topClientes} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(v) => formatCompact(v)} className="text-xs" />
                  <YAxis dataKey="nome" type="category" width={120} className="text-xs" />
                  <Tooltip 
                    formatter={(value: number, name, props) => [formatCurrency(value), props.payload.nomeCompleto]}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="valor" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Detalhes do PMR */}
      <Dialog open={showPmrDetails} onOpenChange={setShowPmrDetails}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Prazo Médio de Recebimento (PMR) - Detalhes
            </DialogTitle>
            <DialogDescription>
              Análise detalhada do cálculo e distribuição do prazo de recebimento
            </DialogDescription>
          </DialogHeader>

          {pmrDetalhes ? (
            <div className="space-y-6">
              {/* Fórmula */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Fórmula de Cálculo
                </h4>
                <code className="text-sm bg-background px-2 py-1 rounded block">
                  {pmrDetalhes.formula}
                </code>
                <p className="text-xs text-muted-foreground mt-2">
                  Período analisado: {pmrDetalhes.periodo.data_inicio ? new Date(pmrDetalhes.periodo.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR') : '-'} a {pmrDetalhes.periodo.data_fim ? new Date(pmrDetalhes.periodo.data_fim + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                </p>
              </div>

              {/* Resumo Principal */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-primary">
                        {pmrDetalhes.resumo?.pmr_emissao_recebimento ?? 0} dias
                      </div>
                      <p className="text-sm text-muted-foreground">PMR (Emissão → Recebimento)</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className={`text-3xl font-bold ${(pmrDetalhes.resumo?.pmr_vencimento_recebimento ?? 0) <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(pmrDetalhes.resumo?.pmr_vencimento_recebimento ?? 0) > 0 ? '+' : ''}{pmrDetalhes.resumo?.pmr_vencimento_recebimento ?? 0} dias
                      </div>
                      <p className="text-sm text-muted-foreground">PMR (Vencimento → Recebimento)</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(pmrDetalhes.resumo?.pmr_vencimento_recebimento ?? 0) <= 0 ? 'Recebido antes do vencimento' : 'Recebido após o vencimento'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold">
                        {(pmrDetalhes.resumo?.total_titulos_analisados ?? 0).toLocaleString()}
                      </div>
                      <p className="text-sm text-muted-foreground">Títulos Analisados</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Estatísticas */}
              <div className="grid gap-4 md:grid-cols-4">
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="text-lg font-semibold">{pmrDetalhes.resumo?.menor_prazo ?? 0} dias</div>
                  <p className="text-xs text-muted-foreground">Menor Prazo</p>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="text-lg font-semibold">{pmrDetalhes.resumo?.mediana_prazo ?? 0} dias</div>
                  <p className="text-xs text-muted-foreground">Mediana</p>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="text-lg font-semibold">{pmrDetalhes.resumo?.maior_prazo ?? 0} dias</div>
                  <p className="text-xs text-muted-foreground">Maior Prazo</p>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="text-lg font-semibold">
                    {pmrDetalhes.resumo && pmrDetalhes.resumo.total_titulos_analisados > 0
                      ? Math.round((pmrDetalhes.resumo.recebidos_no_prazo / pmrDetalhes.resumo.total_titulos_analisados) * 100)
                      : 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">Pontualidade</p>
                </div>
              </div>

              {/* Distribuição por Faixa */}
              <div>
                <h4 className="font-semibold text-sm mb-3">Distribuição por Faixa de Prazo</h4>
                <div className="space-y-2">
                  {[
                    { label: 'Até 15 dias', value: pmrDetalhes.faixas?.ate_15_dias ?? 0, color: 'bg-green-500' },
                    { label: '16 a 30 dias', value: pmrDetalhes.faixas?.de_16_a_30_dias ?? 0, color: 'bg-blue-500' },
                    { label: '31 a 45 dias', value: pmrDetalhes.faixas?.de_31_a_45_dias ?? 0, color: 'bg-yellow-500' },
                    { label: '46 a 60 dias', value: pmrDetalhes.faixas?.de_46_a_60_dias ?? 0, color: 'bg-orange-500' },
                    { label: 'Acima de 60 dias', value: pmrDetalhes.faixas?.acima_60_dias ?? 0, color: 'bg-red-500' },
                  ].map((faixa) => {
                    const total = (pmrDetalhes.resumo?.total_titulos_analisados ?? 0) || 1;
                    const percent = Math.round((faixa.value / total) * 100);
                    return (
                      <div key={faixa.label} className="flex items-center gap-3">
                        <span className="text-sm w-32">{faixa.label}</span>
                        <div className="flex-1">
                          <Progress value={percent} className={`h-3 [&>div]:${faixa.color}`} />
                        </div>
                        <span className="text-sm font-medium w-16 text-right">{faixa.value} ({percent}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recebidos no Prazo vs Atrasados */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-700 dark:text-green-400">Recebidos no Prazo</p>
                        <div className="text-2xl font-bold text-green-600">{(pmrDetalhes.resumo?.recebidos_no_prazo ?? 0).toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">{formatCurrency(pmrDetalhes.resumo?.valor_no_prazo ?? 0)}</p>
                      </div>
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-red-700 dark:text-red-400">Recebidos em Atraso</p>
                        <div className="text-2xl font-bold text-red-600">{(pmrDetalhes.resumo?.recebidos_em_atraso ?? 0).toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">{formatCurrency(pmrDetalhes.resumo?.valor_em_atraso ?? 0)}</p>
                      </div>
                      <AlertTriangle className="h-8 w-8 text-red-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* PMR por Mês */}
              {pmrDetalhes.por_mes && pmrDetalhes.por_mes.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-3">Evolução Mensal do PMR</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mês</TableHead>
                        <TableHead className="text-right">Qtd Títulos</TableHead>
                        <TableHead className="text-right">PMR (dias)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pmrDetalhes.por_mes.map((mes) => (
                        <TableRow key={mes.mes}>
                          <TableCell>{mes.mes}</TableCell>
                          <TableCell className="text-right">{mes.qtd}</TableCell>
                          <TableCell className="text-right font-medium">{mes.pmr_mes} dias</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Observações */}
              <div className="bg-muted/30 p-4 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Observações</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {pmrDetalhes.observacoes?.map((obs, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {obs}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Não foi possível carregar os detalhes do PMR
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
