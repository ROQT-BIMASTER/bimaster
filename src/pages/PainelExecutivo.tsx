import { useState, useCallback, useMemo } from "react";
import { DashboardFiltersBar } from "@/components/painel-executivo/DashboardFilters";
import { KPICards } from "@/components/painel-executivo/KPICards";
import { useDashboardKPIs, type DashboardFilters } from "@/hooks/useDashboardKPIs";
import { useReceitaMensal } from "@/hooks/useReceitaMensal";
import { useReceitaEmpresa } from "@/hooks/useReceitaEmpresa";
import { useRankingSupervisores } from "@/hooks/useRankingSupervisores";
import { useRankingVendedores } from "@/hooks/useRankingVendedores";
import { ValueLegend, SmartValue } from "@/components/ui/smart-value";
import { ChartTabs } from "@/components/ui/chart-tabs";
import { ChartContainer } from "@/components/ui/chart-container";
import { AdvancedDataTable, type Column } from "@/components/shared/AdvancedDataTable";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, TrendingUp, Building2, Trophy, UserCheck, Users, CalendarDays } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaContext } from "@/contexts/EmpresaContext";
import { useOperacaoFilter } from "@/hooks/useConfigOperacoes";

const now = new Date();
const COLORS = ["hsl(217, 91%, 60%)", "hsl(262, 83%, 58%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)", "hsl(0, 84%, 60%)", "hsl(199, 89%, 48%)", "hsl(326, 78%, 60%)", "hsl(45, 93%, 47%)"];
const fmtMoeda = (v: number) => formatCurrency(v);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

function InlineReceitaMensalChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
        <defs>
          <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis tickFormatter={(v) => v >= 1e6 ? `${(v/1e6).toFixed(0)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : String(v)} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={55} />
        <Tooltip formatter={(value: number) => [formatCurrency(value), "Receita"]} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
        <Area type="monotone" dataKey="receita_total" stroke="hsl(217, 91%, 60%)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorReceita)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function InlineBarChart({ data, dataKey, nameKey, fill }: { data: any[]; dataKey: string; nameKey: string; fill?: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis type="number" tickFormatter={(v) => v >= 1e6 ? `${(v/1e6).toFixed(0)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : String(v)} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis type="category" dataKey={nameKey} tick={{ fontSize: 11 }} width={130} stroke="hsl(var(--muted-foreground))" />
        <Tooltip formatter={(value: number) => [formatCurrency(value), "Receita"]} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
        {fill ? (
          <Bar dataKey={dataKey} fill={fill} radius={[0, 4, 4, 0]} barSize={20} />
        ) : (
          <Bar dataKey={dataKey} radius={[0, 4, 4, 0]} barSize={24}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

function SimpleTable({ columns, rows }: { columns: { key: string; label: string; align?: string; format?: (v: any) => string }[]; rows: any[] }) {
  return (
    <div className="overflow-auto max-h-[500px]">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map(c => <TableHead key={c.key} className={c.align === "right" ? "text-right" : ""}>{c.label}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {columns.map(c => (
                <TableCell key={c.key} className={c.align === "right" ? "text-right" : ""}>
                  {c.format ? c.format(r[c.key]) : r[c.key]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function PainelExecutivo() {
  const [filters, setFilters] = useState<DashboardFilters>({ ano: now.getFullYear(), mes: now.getMonth() + 1 });
  const handleFilterChange = useCallback((partial: Partial<DashboardFilters>) => setFilters((prev) => ({ ...prev, ...partial })), []);

  const kpis = useDashboardKPIs(filters);
  const receitaMensal = useReceitaMensal(filters);
  const receitaEmpresa = useReceitaEmpresa(filters);
  const rankingSupervisores = useRankingSupervisores(filters);
  const rankingVendedores = useRankingVendedores(filters);
  const { empresaIds } = useEmpresaContext();
  const { visiveis, multipliers } = useOperacaoFilter();

  // Melhor mês
  const melhorMes = useMemo(() => {
    const data = receitaMensal.data || [];
    if (data.length === 0) return null;
    return data.reduce((best, cur) => cur.receita_total > best.receita_total ? cur : best, data[0]);
  }, [receitaMensal.data]);

  // Top 10 Clientes
  const topClientes = useQuery({
    queryKey: ["top-clientes-executivo", filters, empresaIds, [...visiveis]],
    queryFn: async () => {
      const startDate = filters.mes ? `${filters.ano}-${String(filters.mes).padStart(2, "0")}-01` : `${filters.ano}-01-01`;
      const endDate = filters.mes ? new Date(filters.ano, filters.mes, 0).toISOString().split("T")[0] : `${filters.ano}-12-31`;
      
      const allData: any[] = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        let q = supabase.from("vendas_union").select("cod_cliente,cliente,venda,preco_venda,quantidade,operacao")
          .gte("data", startDate).lte("data", endDate).range(offset, offset + 999);
        if (empresaIds.length > 0) q = q.in("id_empresa", empresaIds);
        if (filters.supervisor) q = q.eq("supervisor", filters.supervisor);
        if (filters.tabela) q = q.eq("tabela", filters.tabela);
        const { data: batch } = await q;
        if (batch && batch.length > 0) { allData.push(...batch); offset += 1000; hasMore = batch.length === 1000; }
        else hasMore = false;
      }
      
      const map = new Map<number, { cliente: string; receita: number; pedidos: number }>();
      for (const r of allData.filter(r => visiveis.has(r.operacao))) {
        const mult = multipliers.get(r.operacao) ?? 1;
        const receita = (Number(r.venda) || (Number(r.preco_venda) || 0) * (Number(r.quantidade) || 0)) * mult;
        if (!map.has(r.cod_cliente)) map.set(r.cod_cliente, { cliente: r.cliente, receita: 0, pedidos: 0 });
        map.get(r.cod_cliente)!.receita += receita;
        map.get(r.cod_cliente)!.pedidos++;
      }
      return [...map.values()].sort((a, b) => b.receita - a.receita).slice(0, 10);
    },
    staleTime: 5 * 60 * 1000,
  });

  const supData = (rankingSupervisores.data || []).map(d => ({ ...d, name: d.supervisor?.length > 18 ? d.supervisor.slice(0, 16) + "…" : d.supervisor }));
  const vendData = (rankingVendedores.data || []).map(d => ({ ...d, name: d.vendedor?.length > 18 ? d.vendedor.slice(0, 16) + "…" : d.vendedor }));
  const empData = (receitaEmpresa.data || []).map(d => ({ ...d, nome_short: d.nome_empresa?.length > 20 ? d.nome_empresa.slice(0, 18) + "…" : d.nome_empresa }));

  // Detailed ranking table for empresas
  const empresaTableData = useMemo(() => {
    const kpiData = kpis.data;
    return (receitaEmpresa.data || []).map((e, i) => ({
      ranking: i + 1,
      empresa: e.nome_empresa,
      receita: e.receita_total,
      pedidos: e.qtde_pedidos,
      ticket_medio: e.qtde_pedidos > 0 ? e.receita_total / e.qtde_pedidos : 0,
    }));
  }, [receitaEmpresa.data, kpis.data]);

  const empDetailCols: Column<any>[] = [
    { key: "ranking", label: "#", align: "center" },
    { key: "empresa", label: "Empresa" },
    { key: "receita", label: "Receita", align: "right", format: (v) => fmtMoeda(Number(v)) },
    { key: "pedidos", label: "Pedidos", align: "right", format: (v) => Number(v).toLocaleString("pt-BR") },
    { key: "ticket_medio", label: "Ticket Médio", align: "right", format: (v) => fmtMoeda(Number(v)) },
  ];

  const tabs = [
    {
      key: "evolucao",
      label: "Evolução Mensal",
      icon: <TrendingUp className="h-3.5 w-3.5" />,
      content: (
        <ChartContainer
          title="Evolução Mensal da Receita"
          icon={<TrendingUp className="h-4 w-4 text-primary" />}
          chart={<InlineReceitaMensalChart data={receitaMensal.data || []} />}
          table={<SimpleTable columns={[
            { key: "label", label: "Mês" },
            { key: "receita_total", label: "Receita", align: "right", format: (v: number) => formatCurrency(v) },
          ]} rows={receitaMensal.data || []} />}
        />
      ),
    },
    {
      key: "empresa",
      label: "Receita por Empresa",
      icon: <Building2 className="h-3.5 w-3.5" />,
      content: (
        <ChartContainer
          title="Receita por Empresa"
          icon={<Building2 className="h-4 w-4 text-primary" />}
          chart={<InlineBarChart data={empData} dataKey="receita_total" nameKey="nome_short" />}
          table={<SimpleTable columns={[
            { key: "nome_empresa", label: "Empresa" },
            { key: "receita_total", label: "Receita", align: "right", format: (v: number) => formatCurrency(v) },
          ]} rows={receitaEmpresa.data || []} />}
        />
      ),
    },
    {
      key: "supervisores",
      label: "Top Supervisores",
      icon: <Trophy className="h-3.5 w-3.5" />,
      content: (
        <ChartContainer
          title="Top 10 Supervisores"
          icon={<Trophy className="h-4 w-4 text-amber-600" />}
          chart={<InlineBarChart data={supData.slice(0, 10)} dataKey="receita_total" nameKey="name" fill="hsl(38, 92%, 50%)" />}
          focusChart={<InlineBarChart data={supData} dataKey="receita_total" nameKey="name" fill="hsl(38, 92%, 50%)" />}
          table={<SimpleTable columns={[
            { key: "supervisor", label: "Supervisor" },
            { key: "receita_total", label: "Receita", align: "right", format: (v: any) => formatCurrency(Number(v)) },
            { key: "qtde_pedidos", label: "Pedidos", align: "right", format: (v: any) => Number(v)?.toLocaleString("pt-BR") },
            { key: "clientes_ativos", label: "Clientes", align: "right", format: (v: any) => Number(v)?.toLocaleString("pt-BR") },
          ]} rows={rankingSupervisores.data || []} />}
        />
      ),
    },
    {
      key: "vendedores",
      label: "Top Vendedores",
      icon: <UserCheck className="h-3.5 w-3.5" />,
      content: (
        <ChartContainer
          title="Top 10 Vendedores"
          icon={<UserCheck className="h-4 w-4 text-emerald-600" />}
          chart={<InlineBarChart data={vendData.slice(0, 10)} dataKey="receita_total" nameKey="name" fill="hsl(142, 71%, 45%)" />}
          focusChart={<InlineBarChart data={vendData} dataKey="receita_total" nameKey="name" fill="hsl(142, 71%, 45%)" />}
          table={<SimpleTable columns={[
            { key: "vendedor", label: "Vendedor" },
            { key: "supervisor", label: "Supervisor" },
            { key: "receita_total", label: "Receita", align: "right", format: (v: any) => formatCurrency(Number(v)) },
            { key: "qtde_pedidos", label: "Pedidos", align: "right", format: (v: any) => Number(v)?.toLocaleString("pt-BR") },
            { key: "clientes_ativos", label: "Clientes", align: "right", format: (v: any) => Number(v)?.toLocaleString("pt-BR") },
          ]} rows={rankingVendedores.data || []} />}
        />
      ),
    },
    {
      key: "topclientes",
      label: "Top 10 Clientes",
      icon: <Users className="h-3.5 w-3.5" />,
      content: (
        <ChartContainer
          title="Top 10 Clientes por Receita"
          icon={<Users className="h-4 w-4 text-cyan-600" />}
          chart={
            <InlineBarChart
              data={(topClientes.data || []).map(c => ({ ...c, name: c.cliente?.length > 20 ? c.cliente.slice(0, 18) + "…" : c.cliente }))}
              dataKey="receita" nameKey="name" fill="hsl(199, 89%, 48%)"
            />
          }
          table={<SimpleTable columns={[
            { key: "cliente", label: "Cliente" },
            { key: "receita", label: "Receita", align: "right", format: (v: number) => formatCurrency(v) },
          ]} rows={topClientes.data || []} />}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Painel Executivo</h1>
            <p className="text-sm text-muted-foreground">Visão consolidada de vendas e desempenho</p>
          </div>
        </div>
        <ValueLegend />
      </div>

      <DashboardFiltersBar filters={filters} onChange={handleFilterChange} />
      
      {/* Melhor Mês Card */}
      {melhorMes && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">🏆 Melhor Mês dos Últimos 12</p>
              <p className="text-lg font-bold">{melhorMes.label} — <SmartValue value={melhorMes.receita_total} /></p>
            </div>
          </CardContent>
        </Card>
      )}

      <KPICards data={kpis.data} isLoading={kpis.isLoading} />

      <ChartTabs tabs={tabs} />

      {/* Detailed Empresa Table */}
      <AdvancedDataTable
        title="Ranking Detalhado por Empresa"
        columns={empDetailCols}
        data={empresaTableData}
        pageSize={20}
        searchKeys={["empresa"]}
      />
    </div>
  );
}
