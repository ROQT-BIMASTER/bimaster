import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseQuery } from "@/hooks/useSupabaseQuery";
import { KpiCard } from "@/components/ui/kpi-card";
import { ChartContainer } from "@/components/ui/chart-container";
import { chartColors, chartPalette } from "@/lib/chart-colors";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Activity, Zap, Database, CheckCircle2, AlertTriangle, Clock,
  TrendingUp, BarChart3,
} from "lucide-react";
import { format, subDays, subHours } from "date-fns";
import { ptBR } from "date-fns/locale";

type SyncMetric = {
  id: string;
  entity: string;
  empresa_id: number;
  pages: number;
  rows: number;
  rows_inserted: number;
  duration_ms: number;
  errors: number;
  deadlock_retries: number;
  rows_per_second: number;
  status: string;
  created_at: string;
};

type Period = "24h" | "7d" | "30d" | "all";

const STATUS_COLORS: Record<string, string> = {
  success: chartColors.success,
  error: chartColors.destructive,
  partial: chartColors.warning,
};

export function SyncMetricsDashboard() {
  const [period, setPeriod] = useState<Period>("7d");
  const [empresaFilter, setEmpresaFilter] = useState<string>("all");

  const { data: rawData, isLoading } = useSupabaseQuery<SyncMetric[]>(
    ["sync-metrics-dashboard"],
    async () => {
      const { data, error } = await supabase
        .from("sync_metrics")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as SyncMetric[];
    },
    { refetchInterval: 60_000 }
  );

  const filteredData = useMemo(() => {
    if (!rawData) return [];
    let d = rawData;

    // Period filter
    const now = new Date();
    if (period === "24h") d = d.filter(m => new Date(m.created_at) >= subHours(now, 24));
    else if (period === "7d") d = d.filter(m => new Date(m.created_at) >= subDays(now, 7));
    else if (period === "30d") d = d.filter(m => new Date(m.created_at) >= subDays(now, 30));

    // Empresa filter
    if (empresaFilter !== "all") d = d.filter(m => String(m.empresa_id) === empresaFilter);

    return d;
  }, [rawData, period, empresaFilter]);

  const empresas = useMemo(() => {
    if (!rawData) return [];
    return [...new Set(rawData.map(m => m.empresa_id))].sort((a, b) => a - b);
  }, [rawData]);

  // === KPIs ===
  const kpis = useMemo(() => {
    if (!filteredData.length) return null;
    const total = filteredData.length;
    const successCount = filteredData.filter(m => m.status === "success").length;
    const errorCount = filteredData.filter(m => m.status === "error").length;
    const deadlocks = filteredData.reduce((a, m) => a + (m.deadlock_retries || 0), 0);
    const totalRows = filteredData.reduce((a, m) => a + (m.rows || 0), 0);
    const avgRps = Math.round(filteredData.reduce((a, m) => a + (m.rows_per_second || 0), 0) / total);
    const avgDuration = Math.round(filteredData.reduce((a, m) => a + (m.duration_ms || 0), 0) / total / 1000);
    return { total, successCount, errorCount, deadlocks, totalRows, avgRps, avgDuration, successRate: ((successCount / total) * 100).toFixed(1) };
  }, [filteredData]);

  // === Chart: Throughput trend ===
  const throughputData = useMemo(() =>
    [...filteredData].reverse().map(m => ({
      time: format(new Date(m.created_at), "dd/MM HH:mm"),
      rps: m.rows_per_second,
      empresa: m.empresa_id,
      status: m.status,
    })),
    [filteredData]
  );

  // === Chart: Duration trend ===
  const durationData = useMemo(() =>
    [...filteredData].reverse().map(m => ({
      time: format(new Date(m.created_at), "dd/MM HH:mm"),
      duration: Math.round(m.duration_ms / 1000),
      status: m.status,
      empresa: m.empresa_id,
    })),
    [filteredData]
  );

  // === Chart: Volume by empresa ===
  const volumeData = useMemo(() => {
    const map = new Map<number, number>();
    filteredData.forEach(m => map.set(m.empresa_id, (map.get(m.empresa_id) || 0) + m.rows));
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([id, rows]) => ({ empresa: `Emp ${id}`, rows }));
  }, [filteredData]);

  // === Chart: Status distribution ===
  const statusData = useMemo(() => {
    const map = new Map<string, number>();
    filteredData.forEach(m => map.set(m.status, (map.get(m.status) || 0) + 1));
    return [...map.entries()].map(([status, count]) => ({ name: status, value: count, fill: STATUS_COLORS[status] || chartColors.accent }));
  }, [filteredData]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <KpiCard key={i} title="" value="" loading />)}
        </div>
        <Skeleton className="h-[400px] w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center bg-muted/50 rounded-md border border-border p-0.5">
          {(["24h", "7d", "30d", "all"] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${period === p ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {p === "24h" ? "24h" : p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "Tudo"}
            </button>
          ))}
        </div>
        <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
          <SelectTrigger className="w-[160px] h-9 text-xs">
            <SelectValue placeholder="Todas empresas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas empresas</SelectItem>
            {empresas.map(e => (
              <SelectItem key={e} value={String(e)}>Empresa {e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filteredData.length} execuções • Auto-refresh 60s</span>
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard title="Taxa de Sucesso" value={`${kpis.successRate}%`} icon={CheckCircle2} variant={Number(kpis.successRate) >= 95 ? "success" : Number(kpis.successRate) >= 80 ? "warning" : "destructive"} />
          <KpiCard title="Média rows/s" value={`${kpis.avgRps}`} icon={Zap} variant="info" />
          <KpiCard title="Total Registros" value={kpis.totalRows.toLocaleString("pt-BR")} icon={Database} variant="default" />
          <KpiCard title="Execuções" value={kpis.total} icon={Activity} variant="default" />
          <KpiCard title="Duração Média" value={`${kpis.avgDuration}s`} icon={Clock} variant="default" />
          <KpiCard title="Erros / Deadlocks" value={`${kpis.errorCount} / ${kpis.deadlocks}`} icon={AlertTriangle} variant={kpis.errorCount > 0 ? "destructive" : "success"} />
        </div>
      )}

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer
          title="Tendência de Throughput"
          icon={<TrendingUp className="h-4 w-4 text-primary" />}
          chartHeight="h-[320px]"
          chart={
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={throughputData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(v: number) => [`${v} rows/s`, "Throughput"]}
                />
                <Line type="monotone" dataKey="rps" stroke={chartColors.primary} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          }
          table={
            <Table>
              <TableHeader><TableRow><TableHead>Horário</TableHead><TableHead>Empresa</TableHead><TableHead>rows/s</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {throughputData.map((d, i) => (
                  <TableRow key={i}><TableCell className="text-xs">{d.time}</TableCell><TableCell>{d.empresa}</TableCell><TableCell>{d.rps}</TableCell><TableCell><StatusBadge status={d.status} /></TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          }
        />

        <ChartContainer
          title="Tendência de Duração"
          icon={<Clock className="h-4 w-4 text-warning" />}
          chartHeight="h-[320px]"
          chart={
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={durationData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} unit="s" className="fill-muted-foreground" />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(v: number) => [`${v}s`, "Duração"]}
                />
                <Area type="monotone" dataKey="duration" stroke={chartColors.warning} fill={chartColors.warning} fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          }
          table={
            <Table>
              <TableHeader><TableRow><TableHead>Horário</TableHead><TableHead>Empresa</TableHead><TableHead>Duração</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {durationData.map((d, i) => (
                  <TableRow key={i}><TableCell className="text-xs">{d.time}</TableCell><TableCell>{d.empresa}</TableCell><TableCell>{d.duration}s</TableCell><TableCell><StatusBadge status={d.status} /></TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          }
        />
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartContainer
          title="Volume por Empresa"
          icon={<BarChart3 className="h-4 w-4 text-accent" />}
          chartHeight="h-[300px]"
          className="lg:col-span-2"
          chart={
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="empresa" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(v: number) => [v.toLocaleString("pt-BR"), "Rows"]}
                />
                <Bar dataKey="rows" radius={[4, 4, 0, 0]}>
                  {volumeData.map((_, i) => (
                    <Cell key={i} fill={chartPalette[i % chartPalette.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          }
        />

        <ChartContainer
          title="Distribuição de Status"
          icon={<CheckCircle2 className="h-4 w-4 text-success" />}
          chartHeight="h-[300px]"
          chart={
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} strokeWidth={0}>
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          }
        />
      </div>

      {/* Detailed Table */}
      <ChartContainer
        title="Execuções Detalhadas"
        icon={<Database className="h-4 w-4 text-muted-foreground" />}
        chartHeight=""
        chart={
          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Páginas</TableHead>
                  <TableHead>Rows</TableHead>
                  <TableHead>Inseridos</TableHead>
                  <TableHead>rows/s</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Erros</TableHead>
                  <TableHead>Deadlocks</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs whitespace-nowrap">{format(new Date(m.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</TableCell>
                    <TableCell>{m.empresa_id}</TableCell>
                    <TableCell className="text-xs">{m.entity}</TableCell>
                    <TableCell>{m.pages}</TableCell>
                    <TableCell>{m.rows.toLocaleString("pt-BR")}</TableCell>
                    <TableCell>{m.rows_inserted.toLocaleString("pt-BR")}</TableCell>
                    <TableCell>{m.rows_per_second}</TableCell>
                    <TableCell>{(m.duration_ms / 1000).toFixed(1)}s</TableCell>
                    <TableCell>{m.errors}</TableCell>
                    <TableCell>{m.deadlock_retries}</TableCell>
                    <TableCell><StatusBadge status={m.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        }
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === "success" ? "default" : status === "error" ? "destructive" : "secondary";
  return (
    <Badge variant={variant} className={`text-[10px] ${status === "success" ? "bg-success/15 text-success border-success/30" : status === "partial" ? "bg-warning/15 text-warning border-warning/30" : ""}`}>
      {status}
    </Badge>
  );
}
