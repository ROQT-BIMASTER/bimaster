import { useState, useCallback } from "react";
import { DashboardFiltersBar } from "@/components/painel-executivo/DashboardFilters";
import type { DashboardFilters } from "@/hooks/useDashboardKPIs";
import { useProdutosDashboard } from "@/hooks/useProdutosDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Download, Search, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line, Cell } from "recharts";
import { ValueLegend } from "@/components/ui/smart-value";

const now = new Date();
const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"];
const ABC_COLORS = { A: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", B: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", C: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" };

export default function AnaliseProdutos() {
  const [filters, setFilters] = useState<DashboardFilters>({ ano: now.getFullYear(), mes: now.getMonth() + 1 });
  const [search, setSearch] = useState("");
  const handleFilterChange = useCallback((p: Partial<DashboardFilters>) => setFilters(prev => ({ ...prev, ...p })), []);

  const { data, isLoading } = useProdutosDashboard(filters);
  const { produtos = [], marcas = [], totalReceita = 0, totalProdutos = 0, produtosA = 0, produtosB = 0, produtosC = 0 } = data || {};

  const filteredProdutos = produtos.filter(d => d.produto.toLowerCase().includes(search.toLowerCase()) || d.marca.toLowerCase().includes(search.toLowerCase()));

  const exportCSV = () => {
    const csv = ["Produto,Marca,Receita,Quantidade,Pedidos,% Receita,% Acumulada,ABC", ...produtos.map(d => `"${d.produto}","${d.marca}",${d.receita.toFixed(2)},${d.quantidade},${d.pedidos},${d.pctReceita.toFixed(1)},${d.pctAcumulada.toFixed(1)},${d.classificacao}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "produtos_analise.csv"; a.click();
  };

  const paretoData = produtos.slice(0, 30).map(p => ({ ...p, nome: p.produto.substring(0, 25) }));

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-900/30">
            <Package className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Análise de Produtos</h1>
            <p className="text-sm text-muted-foreground">Mix de produtos, marcas e classificação ABC</p>
          </div>
        </div>
        <ValueLegend />
      </div>

      <DashboardFiltersBar filters={filters} onChange={handleFilterChange} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Total Produtos</p>
          {isLoading ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl font-bold">{totalProdutos}</p>}
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Receita Total</p>
          {isLoading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-2xl font-bold">{fmt(totalReceita)}</p>}
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">Classe A <Badge className={ABC_COLORS.A + " text-[10px]"}>80%</Badge></p>
          {isLoading ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl font-bold text-emerald-600">{produtosA}</p>}
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">Classe B <Badge className={ABC_COLORS.B + " text-[10px]"}>15%</Badge></p>
          {isLoading ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl font-bold text-amber-600">{produtosB}</p>}
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">Classe C <Badge className={ABC_COLORS.C + " text-[10px]"}>5%</Badge></p>
          {isLoading ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl font-bold text-red-600">{produtosC}</p>}
        </CardContent></Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pareto */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Pareto de Produtos — Top 30</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[350px]" /> : (
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={paretoData} margin={{ left: 5, right: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="nome" angle={-45} textAnchor="end" fontSize={9} interval={0} height={70} />
                    <YAxis yAxisId="left" tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} fontSize={11} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={v => `${v}%`} fontSize={11} />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload;
                      return (<div className="bg-popover border rounded-lg p-3 shadow-lg text-sm space-y-1">
                        <p className="font-semibold">{d.produto}</p>
                        <p>Marca: {d.marca}</p>
                        <p>Receita: {fmt(d.receita)}</p>
                        <p>% Receita: {fmtPct(d.pctReceita)}</p>
                        <p>% Acumulada: {fmtPct(d.pctAcumulada)}</p>
                        <p>Classe: {d.classificacao}</p>
                      </div>);
                    }} />
                    <Bar yAxisId="left" dataKey="receita" radius={[4, 4, 0, 0]} barSize={16}>
                      {paretoData.map((d, i) => <Cell key={i} fill={d.classificacao === "A" ? "#10b981" : d.classificacao === "B" ? "#f59e0b" : "#ef4444"} />)}
                    </Bar>
                    <Line yAxisId="right" type="monotone" dataKey="pctAcumulada" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue by Brand */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Receita por Marca</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[300px]" /> : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={marcas.slice(0, 15)} layout="vertical" margin={{ left: 5, right: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} fontSize={11} />
                    <YAxis type="category" dataKey="marca" width={100} fontSize={10} tick={({ x, y, payload }) => <text x={x} y={y} dy={4} textAnchor="end" fontSize={10} fill="currentColor">{String(payload.value).substring(0, 15)}</text>} />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload;
                      return (<div className="bg-popover border rounded-lg p-3 shadow-lg text-sm space-y-1">
                        <p className="font-semibold">{d.marca}</p>
                        <p>Receita: {fmt(d.receita)}</p>
                        <p>Qtde: {d.quantidade.toLocaleString("pt-BR")}</p>
                        <p>% Receita: {fmtPct(d.pctReceita)}</p>
                      </div>);
                    }} />
                    <Bar dataKey="receita" radius={[0, 4, 4, 0]} barSize={16}>
                      {marcas.slice(0, 15).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Brand Summary Table */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Resumo por Marca</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[300px]" /> : (
              <div className="overflow-auto max-h-[300px]">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Marca</TableHead><TableHead className="text-right">Receita</TableHead><TableHead className="text-right">Qtde</TableHead><TableHead className="text-right">%</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {marcas.map(d => (
                      <TableRow key={d.marca}>
                        <TableCell className="font-medium">{d.marca}</TableCell>
                        <TableCell className="text-right">{fmt(d.receita)}</TableCell>
                        <TableCell className="text-right">{d.quantidade.toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-right">{fmtPct(d.pctReceita)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Full Product Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">Tabela Detalhada de Produtos</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar produto ou marca..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 w-[220px]" /></div>
              <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />CSV</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-[400px]" /> : (
            <div className="overflow-auto max-h-[500px]">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Produto</TableHead><TableHead>Marca</TableHead><TableHead className="text-right">Receita</TableHead><TableHead className="text-right">Qtde</TableHead><TableHead className="text-right">Pedidos</TableHead><TableHead className="text-right">% Receita</TableHead><TableHead className="text-right">% Acum.</TableHead><TableHead className="text-center">ABC</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredProdutos.slice(0, 100).map((d, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium max-w-[200px] truncate">{d.produto}</TableCell>
                      <TableCell>{d.marca}</TableCell>
                      <TableCell className="text-right">{fmt(d.receita)}</TableCell>
                      <TableCell className="text-right">{d.quantidade.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right">{d.pedidos.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right">{fmtPct(d.pctReceita)}</TableCell>
                      <TableCell className="text-right">{fmtPct(d.pctAcumulada)}</TableCell>
                      <TableCell className="text-center"><Badge className={ABC_COLORS[d.classificacao] + " text-xs"}>{d.classificacao}</Badge></TableCell>
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
