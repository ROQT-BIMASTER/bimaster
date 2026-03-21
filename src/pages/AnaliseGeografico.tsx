import { useState, useCallback } from "react";
import { DashboardFiltersBar } from "@/components/painel-executivo/DashboardFilters";
import type { DashboardFilters } from "@/hooks/useDashboardKPIs";
import { useGeograficoDashboard } from "@/hooks/useGeograficoDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, Download, Search, MapPin, AlertTriangle, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ValueLegend } from "@/components/ui/smart-value";

const now = new Date();
const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"];

export default function AnaliseGeografico() {
  const [filters, setFilters] = useState<DashboardFilters>({ ano: now.getFullYear(), mes: now.getMonth() + 1 });
  const [search, setSearch] = useState("");
  const [cidadeSearch, setCidadeSearch] = useState("");
  const handleFilterChange = useCallback((p: Partial<DashboardFilters>) => setFilters(prev => ({ ...prev, ...p })), []);

  const data = useGeograficoDashboard(filters);
  const { ufData = [], cidades = [], totalReceita = 0, top5Receita = 0, restReceita = 0, ufsSemVenda = [], ufsComVenda = 0, totalUFs = 27, isLoading } = data;

  const filteredUFs = ufData.filter(d => d.uf.toLowerCase().includes(search.toLowerCase()));
  const filteredCidades = cidades.filter(d => d.cidade.toLowerCase().includes(cidadeSearch.toLowerCase()) || d.uf.toLowerCase().includes(cidadeSearch.toLowerCase())).slice(0, 50);

  const exportUFs = () => {
    const csv = ["UF,Receita,Pedidos,Clientes,Ticket Médio,% Total", ...ufData.map(d => `${d.uf},${d.receita.toFixed(2)},${d.pedidos},${d.clientes},${d.ticketMedio.toFixed(2)},${d.pctTotal.toFixed(1)}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "geografico_ufs.csv"; a.click();
  };

  const exportCidades = () => {
    const csv = ["Cidade,UF,Receita,Pedidos,Clientes,Ticket Médio,% Total", ...cidades.map(d => `${d.cidade},${d.uf},${d.receita.toFixed(2)},${d.pedidos},${d.clientes},${d.ticketMedio.toFixed(2)},${d.pctTotal.toFixed(1)}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "geografico_cidades.csv"; a.click();
  };

  const concentrationData = [
    { name: "Top 5 UFs", value: top5Receita },
    { name: "Demais", value: restReceita },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
            <Globe className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Análise Geográfica</h1>
            <p className="text-sm text-muted-foreground">Distribuição territorial de receita e clientes</p>
          </div>
        </div>
        <ValueLegend />
      </div>

      <DashboardFiltersBar filters={filters} onChange={handleFilterChange} />

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">UFs com Venda</p>
          {isLoading ? <Skeleton className="h-8 w-20 mt-1" /> : <p className="text-2xl font-bold">{ufsComVenda} <span className="text-sm text-muted-foreground">/ {totalUFs}</span></p>}
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Cobertura</p>
          {isLoading ? <Skeleton className="h-8 w-20 mt-1" /> : <p className="text-2xl font-bold">{totalUFs > 0 ? fmtPct((ufsComVenda / totalUFs) * 100) : "0%"}</p>}
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Top 5 UFs</p>
          {isLoading ? <Skeleton className="h-8 w-20 mt-1" /> : <p className="text-2xl font-bold">{totalReceita > 0 ? fmtPct((top5Receita / totalReceita) * 100) : "0%"}</p>}
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Municípios Ativos</p>
          {isLoading ? <Skeleton className="h-8 w-20 mt-1" /> : <p className="text-2xl font-bold">{cidades.filter(c => c.receita > 0).length}</p>}
        </CardContent></Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking UF Bar Chart */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Receita por UF — Top 15</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[350px]" /> : (
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ufData.slice(0, 15)} layout="vertical" margin={{ left: 5, right: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} fontSize={11} />
                    <YAxis type="category" dataKey="uf" width={35} fontSize={12} />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload;
                      return (<div className="bg-popover border rounded-lg p-3 shadow-lg text-sm space-y-1">
                        <p className="font-semibold">{d.uf}</p>
                        <p>Receita: {fmt(d.receita)}</p>
                        <p>Pedidos: {d.pedidos}</p>
                        <p>Clientes: {d.clientes}</p>
                        <p>Ticket Médio: {fmt(d.ticketMedio)}</p>
                        <p>% Total: {fmtPct(d.pctTotal)}</p>
                      </div>);
                    }} />
                    <Bar dataKey="receita" radius={[0, 4, 4, 0]} barSize={18}>
                      {ufData.slice(0, 15).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Concentration Donut */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Concentração Geográfica</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[350px]" /> : (
              <div className="flex flex-col items-center">
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={concentrationData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}>
                        <Cell fill="#3b82f6" />
                        <Cell fill="#d1d5db" />
                      </Pie>
                      <Tooltip formatter={(v: number) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 text-center space-y-1">
                  <p className="text-sm"><span className="font-semibold text-blue-600">Top 5:</span> {ufData.slice(0, 5).map(d => d.uf).join(", ")}</p>
                </div>
                {/* UFs sem venda */}
                {ufsSemVenda.length > 0 && (
                  <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg w-full">
                    <p className="text-sm font-medium flex items-center gap-1 text-amber-700 dark:text-amber-400"><AlertTriangle className="h-3.5 w-3.5" /> UFs sem venda ({ufsSemVenda.length})</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {ufsSemVenda.map(uf => <Badge key={uf} variant="outline" className="text-xs">{uf}</Badge>)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top 20 Cities */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> Top 20 Municípios por Receita</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-[300px]" /> : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cidades.slice(0, 20)} layout="vertical" margin={{ left: 10, right: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} fontSize={11} />
                  <YAxis type="category" dataKey="cidade" width={120} fontSize={10} tick={({ x, y, payload }) => <text x={x} y={y} dy={4} textAnchor="end" fontSize={10} fill="currentColor">{String(payload.value).substring(0, 18)}</text>} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload;
                    return (<div className="bg-popover border rounded-lg p-3 shadow-lg text-sm space-y-1">
                      <p className="font-semibold">{d.cidade} — {d.uf}</p>
                      <p>Receita: {fmt(d.receita)}</p>
                      <p>Pedidos: {d.pedidos} · Clientes: {d.clientes}</p>
                    </div>);
                  }} />
                  <Bar dataKey="receita" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* UF Detail Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">Tabela Detalhada por UF</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar UF..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 w-[180px]" /></div>
              <Button variant="outline" size="sm" onClick={exportUFs}><Download className="h-4 w-4 mr-1" />CSV</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-[300px]" /> : (
            <div className="overflow-auto max-h-[400px]">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>UF</TableHead><TableHead className="text-right">Receita</TableHead><TableHead className="text-right">Pedidos</TableHead><TableHead className="text-right">Clientes</TableHead><TableHead className="text-right">Ticket Médio</TableHead><TableHead className="text-right">% Total</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredUFs.map(d => (
                    <TableRow key={d.uf}>
                      <TableCell className="font-medium">{d.uf}</TableCell>
                      <TableCell className="text-right">{fmt(d.receita)}</TableCell>
                      <TableCell className="text-right">{d.pedidos.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right">{d.clientes.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right">{fmt(d.ticketMedio)}</TableCell>
                      <TableCell className="text-right">{fmtPct(d.pctTotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* City Detail Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">Tabela Detalhada por Município</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar cidade ou UF..." value={cidadeSearch} onChange={e => setCidadeSearch(e.target.value)} className="pl-9 h-9 w-[200px]" /></div>
              <Button variant="outline" size="sm" onClick={exportCidades}><Download className="h-4 w-4 mr-1" />CSV</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-[300px]" /> : (
            <div className="overflow-auto max-h-[400px]">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Cidade</TableHead><TableHead>UF</TableHead><TableHead className="text-right">Receita</TableHead><TableHead className="text-right">Pedidos</TableHead><TableHead className="text-right">Clientes</TableHead><TableHead className="text-right">Ticket Médio</TableHead><TableHead className="text-right">% Total</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredCidades.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{d.cidade}</TableCell>
                      <TableCell>{d.uf}</TableCell>
                      <TableCell className="text-right">{fmt(d.receita)}</TableCell>
                      <TableCell className="text-right">{d.pedidos.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right">{d.clientes.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right">{fmt(d.ticketMedio)}</TableCell>
                      <TableCell className="text-right">{fmtPct(d.pctTotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
