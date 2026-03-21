import { useState, useCallback } from "react";
import { DashboardFiltersBar } from "@/components/painel-executivo/DashboardFilters";
import type { DashboardFilters } from "@/hooks/useDashboardKPIs";
import { useConsolidadoDashboard } from "@/hooks/useConsolidadoDashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layers, Download, TrendingUp, TrendingDown } from "lucide-react";
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ValueLegend } from "@/components/ui/smart-value";
import { ChartTabs } from "@/components/ui/chart-tabs";
import { ChartContainer } from "@/components/ui/chart-container";

const now = new Date();
const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

export default function Consolidado() {
  const [filters, setFilters] = useState<DashboardFilters>({ ano: now.getFullYear(), mes: now.getMonth() + 1 });
  const handleFilterChange = useCallback((p: Partial<DashboardFilters>) => setFilters(prev => ({ ...prev, ...p })), []);

  const { data, isLoading } = useConsolidadoDashboard(filters);
  const { empresas = [], totalReceita = 0, tendencia = [], empNames = [] } = data || {};

  const shareData = empresas.map(e => ({ name: e.nome_empresa, value: e.receitaMes }));

  const exportCSV = () => {
    const csv = ["Empresa,Receita Mês,Receita Anterior,Variação %,Pedidos,Clientes,Ticket Médio,% Total",
      ...empresas.map(e => `"${e.nome_empresa}",${e.receitaMes.toFixed(2)},${e.receitaMesAnterior.toFixed(2)},${e.variacao.toFixed(1)},${e.pedidos},${e.clientes},${e.ticketMedio.toFixed(2)},${e.pctTotal.toFixed(1)}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "consolidado_empresas.csv"; a.click();
  };

  const shareChart = (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={shareData} cx="50%" cy="50%" innerRadius={60} outerRadius={120} dataKey="value" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} labelLine={false}>
          {shareData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(v: number) => fmt(v)} />
      </PieChart>
    </ResponsiveContainer>
  );

  const tendenciaChart = (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={tendencia} margin={{ left: 5, right: 10 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" fontSize={10} />
        <YAxis tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}k` : `${v}`} fontSize={11} />
        <Tooltip formatter={(v: number) => fmt(v)} />
        <Legend />
        {empNames.map((name, i) => <Line key={name} type="monotone" dataKey={name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />)}
      </LineChart>
    </ResponsiveContainer>
  );

  const tabs = [
    {
      key: "share", label: "Share por Empresa", icon: <Layers className="h-3.5 w-3.5" />,
      content: (
        <ChartContainer title="Share por Empresa"
          chart={shareChart}
          table={<div className="overflow-auto max-h-[500px]"><Table><TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead className="text-right">Receita</TableHead><TableHead className="text-right">% Total</TableHead></TableRow></TableHeader><TableBody>{empresas.map(e => <TableRow key={e.id_empresa}><TableCell>{e.nome_empresa}</TableCell><TableCell className="text-right">{fmt(e.receitaMes)}</TableCell><TableCell className="text-right">{fmtPct(e.pctTotal)}</TableCell></TableRow>)}</TableBody></Table></div>}
        />
      ),
    },
    {
      key: "tendencia", label: "Tendência Mensal", icon: <TrendingUp className="h-3.5 w-3.5" />,
      content: (
        <ChartContainer title="Tendência Mensal (12 meses)"
          chart={tendenciaChart}
          table={<div className="overflow-auto max-h-[500px]"><Table><TableHeader><TableRow><TableHead>Mês</TableHead>{empNames.map(n => <TableHead key={n} className="text-right">{n}</TableHead>)}</TableRow></TableHeader><TableBody>{tendencia.map((t: any, i: number) => <TableRow key={i}><TableCell>{t.label}</TableCell>{empNames.map(n => <TableCell key={n} className="text-right">{fmt(t[n] || 0)}</TableCell>)}</TableRow>)}</TableBody></Table></div>}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
            <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Consolidado / Sell In</h1>
            <p className="text-sm text-muted-foreground">Comparativo de desempenho entre empresas</p>
          </div>
        </div>
        <ValueLegend />
      </div>

      <DashboardFiltersBar filters={filters} onChange={handleFilterChange} />

      {/* KPI Cards per empresa */}
      {isLoading ? <Skeleton className="h-[120px]" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {empresas.map((e, i) => (
            <Card key={e.id_empresa}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm truncate">{e.nome_empresa}</p>
                  <Badge variant={e.variacao >= 0 ? "default" : "destructive"} className="text-[10px]">{e.variacao >= 0 ? "+" : ""}{fmtPct(e.variacao)}</Badge>
                </div>
                <p className="text-2xl font-bold">{fmt(e.receitaMes)}</p>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div><span className="block text-foreground font-medium">{e.pedidos}</span>Pedidos</div>
                  <div><span className="block text-foreground font-medium">{e.clientes}</span>Clientes</div>
                  <div><span className="block text-foreground font-medium">{fmt(e.ticketMedio)}</span>Ticket</div>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${e.pctTotal}%`, backgroundColor: COLORS[i % COLORS.length] }} /></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ChartTabs tabs={tabs} />

      {/* Detail Table */}
      <Card className="w-full">
        <div className="flex items-center justify-between p-4 pb-2">
          <h3 className="text-base font-semibold">Tabela Comparativa</h3>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />CSV</Button>
        </div>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead className="text-right">Receita Mês</TableHead><TableHead className="text-right">Anterior</TableHead><TableHead className="text-right">Var.</TableHead><TableHead className="text-right">Pedidos</TableHead><TableHead className="text-right">Clientes</TableHead><TableHead className="text-right">Ticket</TableHead><TableHead className="text-right">%</TableHead></TableRow></TableHeader>
            <TableBody>
              {empresas.map(e => (
                <TableRow key={e.id_empresa}>
                  <TableCell className="font-medium">{e.nome_empresa}</TableCell>
                  <TableCell className="text-right">{fmt(e.receitaMes)}</TableCell>
                  <TableCell className="text-right">{fmt(e.receitaMesAnterior)}</TableCell>
                  <TableCell className="text-right"><span className={`flex items-center justify-end gap-1 ${e.variacao >= 0 ? "text-emerald-600" : "text-red-600"}`}>{e.variacao >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{fmtPct(Math.abs(e.variacao))}</span></TableCell>
                  <TableCell className="text-right">{e.pedidos.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{e.clientes.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{fmt(e.ticketMedio)}</TableCell>
                  <TableCell className="text-right">{fmtPct(e.pctTotal)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold border-t-2">
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-right">{fmt(empresas.reduce((s, e) => s + e.receitaMes, 0))}</TableCell>
                <TableCell className="text-right">{fmt(empresas.reduce((s, e) => s + e.receitaMesAnterior, 0))}</TableCell>
                <TableCell className="text-right">—</TableCell>
                <TableCell className="text-right">{empresas.reduce((s, e) => s + e.pedidos, 0).toLocaleString("pt-BR")}</TableCell>
                <TableCell className="text-right">{empresas.reduce((s, e) => s + e.clientes, 0).toLocaleString("pt-BR")}</TableCell>
                <TableCell className="text-right">—</TableCell>
                <TableCell className="text-right">100%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
