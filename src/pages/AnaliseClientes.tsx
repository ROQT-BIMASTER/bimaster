import { useState, useCallback } from "react";
import { DashboardFiltersBar } from "@/components/painel-executivo/DashboardFilters";
import type { DashboardFilters } from "@/hooks/useDashboardKPIs";
import { useClientesDashboard } from "@/hooks/useClientesDashboard";
import { ClientesKPICards } from "@/components/clientes-dashboard/ClientesKPICards";
import { ClientesDetalheTable } from "@/components/clientes-dashboard/ClientesDetalheTable";
import { ClienteDrilldownModal } from "@/components/clientes-dashboard/ClienteDrilldownModal";
import { ValueLegend } from "@/components/ui/smart-value";
import { ChartTabs } from "@/components/ui/chart-tabs";
import { ChartContainer } from "@/components/ui/chart-container";
import { Users, BarChart3, Map, Layers } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Line, ComposedChart, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

const now = new Date();
const fmtMoeda = (v: number) => { if (v >= 1e6) return `R$${(v/1e6).toFixed(1)}M`; if (v >= 1e3) return `R$${(v/1e3).toFixed(0)}k`; return `R$${v.toFixed(0)}`; };
const COLORS = ["hsl(var(--primary))", "hsl(210, 70%, 55%)", "hsl(200, 65%, 50%)", "hsl(190, 60%, 45%)", "hsl(180, 55%, 40%)", "hsl(170, 50%, 45%)", "hsl(160, 45%, 50%)", "hsl(150, 40%, 55%)"];

export default function AnaliseClientes() {
  const [filters, setFilters] = useState<DashboardFilters>({ ano: now.getFullYear(), mes: now.getMonth() + 1 });
  const [selectedCliente, setSelectedCliente] = useState<number | null>(null);
  const handleFilterChange = useCallback((partial: Partial<DashboardFilters>) => setFilters((prev) => ({ ...prev, ...partial })), []);

  const { kpis, clientesDetail, paretoData, ufData, faixaData, isLoading } = useClientesDashboard(filters);

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

  const ufChart = (data: typeof ufData) => (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data.slice(0, 12)} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis type="number" tickFormatter={fmtMoeda} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="uf" tick={{ fontSize: 12 }} width={40} />
        <Tooltip formatter={(v: any) => [fmtMoeda(v), "Receita"]} labelFormatter={(l) => `UF: ${l}`} />
        <Bar dataKey="receita" radius={[0, 4, 4, 0]}>
          {data.slice(0, 12).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );

  const faixaChart = (data: typeof faixaData) => (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="faixa" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: any, name: string) => [name === "quantidade" ? v : `R$ ${Number(v).toLocaleString("pt-BR")}`, name === "quantidade" ? "Clientes" : "Valor Total"]} />
        <Bar dataKey="quantidade" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="quantidade" />
      </BarChart>
    </ResponsiveContainer>
  );

  const tabs = [
    {
      key: "pareto", label: "Pareto Clientes", icon: <BarChart3 className="h-3.5 w-3.5" />,
      content: (
        <ChartContainer
          title="Pareto de Clientes (Top 20)"
          chart={paretoChart(paretoData.slice(0, 20))}
          focusChart={paretoChart(paretoData)}
          table={
            <div className="overflow-auto max-h-[500px]">
              <Table><TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead className="text-right">Receita</TableHead><TableHead className="text-right">% Acum.</TableHead></TableRow></TableHeader>
                <TableBody>{paretoData.map((d, i) => <TableRow key={i}><TableCell>{d.nome}</TableCell><TableCell className="text-right">{fmtMoeda(d.receita)}</TableCell><TableCell className="text-right">{d.pctAcumulado.toFixed(1)}%</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
          }
        />
      ),
    },
    {
      key: "uf", label: "Clientes por UF", icon: <Map className="h-3.5 w-3.5" />,
      content: (
        <ChartContainer
          title="Clientes por UF"
          chart={ufChart(ufData)}
          focusChart={ufChart(ufData)}
          table={
            <div className="overflow-auto max-h-[500px]">
              <Table><TableHeader><TableRow><TableHead>UF</TableHead><TableHead className="text-right">Clientes</TableHead><TableHead className="text-right">Receita</TableHead></TableRow></TableHeader>
                <TableBody>{ufData.map((d, i) => <TableRow key={i}><TableCell>{d.uf}</TableCell><TableCell className="text-right">{d.qtdClientes}</TableCell><TableCell className="text-right">{fmtMoeda(d.receita)}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
          }
        />
      ),
    },
    {
      key: "faixa", label: "Faixa de Receita", icon: <Layers className="h-3.5 w-3.5" />,
      content: (
        <ChartContainer
          title="Clientes por Faixa de Receita"
          chart={faixaChart(faixaData)}
          table={
            <div className="overflow-auto max-h-[500px]">
              <Table><TableHeader><TableRow><TableHead>Faixa</TableHead><TableHead className="text-right">Clientes</TableHead><TableHead className="text-right">Valor Total</TableHead></TableRow></TableHeader>
                <TableBody>{faixaData.map((d, i) => <TableRow key={i}><TableCell>{d.faixa}</TableCell><TableCell className="text-right">{d.quantidade}</TableCell><TableCell className="text-right">{fmtMoeda(d.valorTotal)}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
          }
        />
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

      <ChartTabs tabs={tabs} />

      <ClientesDetalheTable data={clientesDetail} isLoading={isLoading} onClienteClick={setSelectedCliente} />

      {selectedCliente && (
        <ClienteDrilldownModal codCliente={selectedCliente} filters={filters} onClose={() => setSelectedCliente(null)} />
      )}
    </div>
  );
}
