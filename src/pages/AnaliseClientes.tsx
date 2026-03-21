import { useState, useCallback, useMemo } from "react";
import { DashboardFiltersBar } from "@/components/painel-executivo/DashboardFilters";
import type { DashboardFilters } from "@/hooks/useDashboardKPIs";
import { useClientesDashboard } from "@/hooks/useClientesDashboard";
import { ClientesKPICards } from "@/components/clientes-dashboard/ClientesKPICards";
import { ClienteDrilldownModal } from "@/components/clientes-dashboard/ClienteDrilldownModal";
import { ValueLegend } from "@/components/ui/smart-value";
import { ChartTabs } from "@/components/ui/chart-tabs";
import { ChartContainer } from "@/components/ui/chart-container";
import { AdvancedDataTable, type Column } from "@/components/shared/AdvancedDataTable";
import { Card, CardContent } from "@/components/ui/card";
import { Users, BarChart3, Map, Layers, AlertTriangle, Crosshair } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Line, ComposedChart, ResponsiveContainer, CartesianGrid, Cell, ScatterChart, Scatter, ZAxis } from "recharts";

const now = new Date();
const fmtMoeda = (v: number) => { if (v >= 1e6) return `R$${(v/1e6).toFixed(1)}M`; if (v >= 1e3) return `R$${(v/1e3).toFixed(0)}k`; return `R$${v.toFixed(0)}`; };
const fmtFull = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const COLORS = ["hsl(var(--primary))", "hsl(210, 70%, 55%)", "hsl(200, 65%, 50%)", "hsl(190, 60%, 45%)", "hsl(180, 55%, 40%)", "hsl(170, 50%, 45%)", "hsl(160, 45%, 50%)", "hsl(150, 40%, 55%)"];

export default function AnaliseClientes() {
  const [filters, setFilters] = useState<DashboardFilters>({ ano: now.getFullYear(), mes: now.getMonth() + 1 });
  const [selectedCliente, setSelectedCliente] = useState<number | null>(null);
  const handleFilterChange = useCallback((partial: Partial<DashboardFilters>) => setFilters((prev) => ({ ...prev, ...partial })), []);

  const { kpis, clientesDetail, paretoData, ufData, faixaData, isLoading } = useClientesDashboard(filters);

  // Segmentation
  const { novos, recorrentes, inativos, emRisco } = useMemo(() => {
    const novos = clientesDetail.filter(c => c.receita > 0 && c.qtde_pedidos <= 1);
    const recorrentes = clientesDetail.filter(c => c.qtde_pedidos > 1);
    const inativos = clientesDetail.filter(c => c.dias_sem_compra > 60);
    const emRisco = clientesDetail.filter(c => c.dias_sem_compra >= 30 && c.dias_sem_compra <= 60 && c.receita > 0);
    return { novos, recorrentes, inativos, emRisco };
  }, [clientesDetail]);

  // Scatter data: Frequência x Ticket
  const scatterData = useMemo(() => 
    clientesDetail.filter(c => c.receita > 0).slice(0, 200).map(c => ({
      nome: c.nome,
      pedidos: c.qtde_pedidos,
      ticket: c.ticket_medio,
      receita: c.receita,
    })),
  [clientesDetail]);

  const paretoChart = (data: typeof paretoData) => (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data.map(d => ({ ...d, nome: d.nome.length > 15 ? d.nome.substring(0, 15) + "…" : d.nome }))} margin={{ top: 5, right: 30, left: 0, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="nome" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={70} />
        <YAxis yAxisId="left" tickFormatter={fmtMoeda} tick={{ fontSize: 11 }} />
        <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} domain={[0, 100]} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value: any, name: string) => [name === "receita" ? fmtMoeda(value) : `${Number(value).toFixed(1)}%`, name === "receita" ? "Receita" : "% Acumulado"]} />
        <Bar yAxisId="left" dataKey="receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="pctAcumulado" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );

  const scatterChart = (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis type="number" dataKey="pedidos" name="Pedidos" tick={{ fontSize: 11 }} label={{ value: "Frequência (pedidos)", position: "insideBottom", offset: -5, fontSize: 11 }} />
        <YAxis type="number" dataKey="ticket" name="Ticket" tickFormatter={fmtMoeda} tick={{ fontSize: 11 }} label={{ value: "Ticket Médio", angle: -90, position: "insideLeft", fontSize: 11 }} />
        <ZAxis type="number" dataKey="receita" range={[50, 400]} />
        <Tooltip content={({ active, payload }) => {
          if (!active || !payload?.[0]) return null;
          const d = payload[0].payload;
          return <div className="bg-popover border rounded-lg p-3 shadow-lg text-sm"><p className="font-semibold">{d.nome}</p><p>Pedidos: {d.pedidos} · Ticket: {fmtFull(d.ticket)}</p><p>Receita: {fmtFull(d.receita)}</p></div>;
        }} />
        <Scatter data={scatterData} fill="hsl(var(--primary))" fillOpacity={0.6} />
      </ScatterChart>
    </ResponsiveContainer>
  );

  const detailCols: Column<any>[] = [
    { key: "cod_cliente", label: "Cod" },
    { key: "cnpj", label: "CNPJ", format: (v) => v || "—" },
    { key: "nome", label: "Razão Social", className: "max-w-[180px] truncate" },
    { key: "uf", label: "UF" },
    { key: "cidade", label: "Cidade" },
    { key: "vendedor", label: "Vendedor" },
    { key: "supervisor", label: "Supervisor" },
    { key: "receita", label: "Receita", align: "right", format: (v) => fmtFull(Number(v)) },
    { key: "qtde_pedidos", label: "Pedidos", align: "right" },
    { key: "ticket_medio", label: "Ticket", align: "right", format: (v) => fmtFull(Number(v)) },
    { key: "dias_sem_compra", label: "Dias s/ Compra", align: "right", format: (v) => Number(v) >= 999 ? "—" : String(v) },
    { key: "ultima_compra", label: "Última Compra", format: (v) => v ? new Date(v).toLocaleDateString("pt-BR") : "—" },
  ];

  const tabs = [
    {
      key: "pareto", label: "Pareto Clientes", icon: <BarChart3 className="h-3.5 w-3.5" />,
      content: <ChartContainer title="Pareto de Clientes (Top 20)" chart={paretoChart(paretoData.slice(0, 20))} focusChart={paretoChart(paretoData)} table={null} />,
    },
    {
      key: "scatter", label: "Frequência x Ticket", icon: <Crosshair className="h-3.5 w-3.5" />,
      content: <ChartContainer title="Dispersão: Frequência x Ticket Médio" chart={scatterChart} />,
    },
    {
      key: "faixa", label: "Faixa de Receita", icon: <Layers className="h-3.5 w-3.5" />,
      content: (
        <ChartContainer title="Clientes por Faixa de Receita" chart={
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={faixaData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="faixa" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="quantidade" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Clientes" />
            </BarChart>
          </ResponsiveContainer>
        } />
      ),
    },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Análise de Clientes</h1>
            <p className="text-sm text-muted-foreground">Visão completa da carteira de clientes</p>
          </div>
        </div>
        <ValueLegend />
      </div>

      <DashboardFiltersBar filters={filters} onChange={handleFilterChange} />
      <ClientesKPICards data={kpis} isLoading={isLoading} />

      {/* Segmentation Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Novos (1 pedido)</p><p className="text-2xl font-bold text-primary">{novos.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Recorrentes</p><p className="text-2xl font-bold text-emerald-600">{recorrentes.length}</p></CardContent></Card>
        <Card className="border-amber-200 dark:border-amber-800"><CardContent className="pt-4"><p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-500" />Em Risco (30-60d)</p><p className="text-2xl font-bold text-amber-600">{emRisco.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Inativos (&gt;60d)</p><p className="text-2xl font-bold text-red-600">{inativos.length}</p></CardContent></Card>
      </div>

      <ChartTabs tabs={tabs} />

      <AdvancedDataTable
        title="Tabela Detalhada de Clientes"
        columns={detailCols}
        data={clientesDetail}
        pageSize={20}
        searchPlaceholder="Buscar por nome, CNPJ, vendedor..."
        searchKeys={["nome", "cnpj", "vendedor", "supervisor", "cidade"]}
      />

      {selectedCliente && (
        <ClienteDrilldownModal codCliente={selectedCliente} filters={filters} onClose={() => setSelectedCliente(null)} />
      )}
    </div>
  );
}
