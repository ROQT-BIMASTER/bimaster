import { useState, useCallback, useMemo } from "react";
import { DashboardFiltersBar } from "@/components/painel-executivo/DashboardFilters";
import { useDashboardKPIs, type DashboardFilters } from "@/hooks/useDashboardKPIs";
import { useReceitaMensal } from "@/hooks/useReceitaMensal";
import { useReceitaEmpresa } from "@/hooks/useReceitaEmpresa";
import { useRankingSupervisores } from "@/hooks/useRankingSupervisores";
import { useRankingVendedores } from "@/hooks/useRankingVendedores";
import { useMetasVendas } from "@/hooks/useMetasVendas";
import { EnhancedKPICard } from "@/components/ui/EnhancedKPICard";
import { DataDetailTable, type DataColumn } from "@/components/ui/DataDetailTable";
import { ValueLegend } from "@/components/ui/smart-value";
import { ChartTabs } from "@/components/ui/chart-tabs";
import { ChartContainer } from "@/components/ui/chart-container";
import { BarChart3, TrendingUp, Building2, Trophy, UserCheck, DollarSign, ShoppingCart, Receipt, Users, Package, Target, Star } from "lucide-react";
import { SmartValue } from "@/components/ui/smart-value";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaContext } from "@/contexts/EmpresaContext";
import { useOperacaoFilter } from "@/hooks/useConfigOperacoes";

const now = new Date();
const COLORS = ["hsl(217, 91%, 60%)", "hsl(262, 83%, 58%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)", "hsl(0, 84%, 60%)", "hsl(199, 89%, 48%)", "hsl(326, 78%, 60%)", "hsl(45, 93%, 47%)"];

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

export default function PainelExecutivo() {
  const [filters, setFilters] = useState<DashboardFilters>({ ano: now.getFullYear(), mes: now.getMonth() + 1 });
  const handleFilterChange = useCallback((partial: Partial<DashboardFilters>) => setFilters((prev) => ({ ...prev, ...partial })), []);

  const kpis = useDashboardKPIs(filters);
  const receitaMensal = useReceitaMensal(filters);
  const receitaEmpresa = useReceitaEmpresa(filters);
  const rankingSupervisores = useRankingSupervisores(filters);
  const rankingVendedores = useRankingVendedores(filters);
  const metas = useMetasVendas(filters);
  const { empresaIds } = useEmpresaContext();
  const { visiveis, multipliers } = useOperacaoFilter();

  // Top 10 clientes
  const topClientes = useQuery({
    queryKey: ["exec-top-clientes", filters, empresaIds, [...visiveis]],
    queryFn: async () => {
      const startDate = filters.mes ? `${filters.ano}-${String(filters.mes).padStart(2, "0")}-01` : `${filters.ano}-01-01`;
      const endDate = filters.mes ? new Date(filters.ano, filters.mes, 0).toISOString().split("T")[0] : `${filters.ano}-12-31`;
      let q = supabase.from("vendas_union").select("cod_cliente,cliente,venda,preco_venda,quantidade,operacao").gte("data", startDate).lte("data", endDate);
      if (empresaIds.length > 0) q = q.in("id_empresa", empresaIds);
      if (filters.supervisor) q = q.eq("supervisor", filters.supervisor);
      if (filters.tabela) q = q.eq("tabela", filters.tabela);
      const { data } = await q.limit(50000);
      const rows = ((data as any[]) || []).filter(r => visiveis.has(r.operacao));
      const map = new Map<number, { cliente: string; receita: number }>();
      for (const r of rows) {
        const mult = multipliers.get(r.operacao) ?? 1;
        const receita = (Number(r.venda) || (Number(r.preco_venda) || 0) * (Number(r.quantidade) || 0)) * mult;
        if (!map.has(r.cod_cliente)) map.set(r.cod_cliente, { cliente: r.cliente, receita: 0 });
        map.get(r.cod_cliente)!.receita += receita;
      }
      return [...map.values()].sort((a, b) => b.receita - a.receita).slice(0, 10);
    },
    staleTime: 5 * 60 * 1000,
  });

  // Best month
  const melhorMes = useMemo(() => {
    const data = receitaMensal.data || [];
    if (data.length === 0) return null;
    return data.reduce((best, d) => d.receita_total > best.receita_total ? d : best, data[0]);
  }, [receitaMensal.data]);

  // Aggregate meta for receita total
  const metaReceita = useMemo(() => {
    const allMetas = [...(metas.data?.empresaMetas || [])];
    return allMetas.reduce((s, m) => s + m.valor_meta, 0);
  }, [metas.data]);

  const supData = (rankingSupervisores.data || []).map(d => ({ ...d, name: d.supervisor?.length > 18 ? d.supervisor.slice(0, 16) + "…" : d.supervisor }));
  const vendData = (rankingVendedores.data || []).map(d => ({ ...d, name: d.vendedor?.length > 18 ? d.vendedor.slice(0, 16) + "…" : d.vendedor }));
  const empData = (receitaEmpresa.data || []).map(d => ({ ...d, nome_short: d.nome_empresa?.length > 20 ? d.nome_empresa.slice(0, 18) + "…" : d.nome_empresa }));

  // Detail table columns
  const detailColumns: DataColumn[] = [
    { key: "rank", label: "#", width: "50px", sortable: false },
    { key: "nome_empresa", label: "Empresa" },
    { key: "receita_total", label: "Receita", align: "right", format: (v: number) => formatCurrency(v, false) },
    { key: "qtde_pedidos", label: "Pedidos", align: "right", format: (v: number) => v?.toLocaleString("pt-BR") },
    { key: "ticket_medio", label: "Ticket Médio", align: "right", format: (v: number) => formatCurrency(v, false) },
    { key: "clientes_ativos", label: "Clientes", align: "right", format: (v: number) => v?.toLocaleString("pt-BR") },
  ];

  const detailData = useMemo(() => {
    return (receitaEmpresa.data || []).map((e, i) => ({
      rank: i + 1,
      nome_empresa: e.nome_empresa,
      receita_total: e.receita_total,
      qtde_pedidos: e.qtde_pedidos,
      ticket_medio: e.qtde_pedidos > 0 ? e.receita_total / e.qtde_pedidos : 0,
      clientes_ativos: 0,
    }));
  }, [receitaEmpresa.data]);

  const tabs = [
    {
      key: "evolucao",
      label: "Evolução Mensal",
      icon: <TrendingUp className="h-3.5 w-3.5" />,
      content: (
        <ChartContainer
          title="Evolução Mensal da Receita"
          icon={<TrendingUp className="h-4 w-4 text-blue-600" />}
          chart={<InlineReceitaMensalChart data={receitaMensal.data || []} />}
          table={<DataDetailTable
            columns={[
              { key: "label", label: "Mês" },
              { key: "receita_total", label: "Receita", align: "right", format: (v: number) => formatCurrency(v) },
            ]}
            data={receitaMensal.data || []}
            showSearch={false}
            pageSize={12}
          />}
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
          icon={<Building2 className="h-4 w-4 text-violet-600" />}
          chart={<InlineBarChart data={empData} dataKey="receita_total" nameKey="nome_short" />}
          table={<DataDetailTable
            columns={[
              { key: "nome_empresa", label: "Empresa" },
              { key: "receita_total", label: "Receita", align: "right", format: (v: number) => formatCurrency(v) },
              { key: "qtde_pedidos", label: "Pedidos", align: "right", format: (v: number) => v?.toLocaleString("pt-BR") },
            ]}
            data={receitaEmpresa.data || []}
            showSearch={false}
          />}
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
          table={<DataDetailTable
            columns={[
              { key: "supervisor", label: "Supervisor" },
              { key: "receita_total", label: "Receita", align: "right", format: (v: number) => formatCurrency(v) },
              { key: "qtde_pedidos", label: "Pedidos", align: "right", format: (v: number) => v?.toLocaleString("pt-BR") },
              { key: "clientes_ativos", label: "Clientes", align: "right", format: (v: number) => v?.toLocaleString("pt-BR") },
            ]}
            data={rankingSupervisores.data || []}
          />}
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
          table={<DataDetailTable
            columns={[
              { key: "vendedor", label: "Vendedor" },
              { key: "supervisor", label: "Supervisor" },
              { key: "receita_total", label: "Receita", align: "right", format: (v: number) => formatCurrency(v) },
              { key: "qtde_pedidos", label: "Pedidos", align: "right", format: (v: number) => v?.toLocaleString("pt-BR") },
              { key: "clientes_ativos", label: "Clientes", align: "right", format: (v: number) => v?.toLocaleString("pt-BR") },
            ]}
            data={rankingVendedores.data || []}
          />}
        />
      ),
    },
    {
      key: "top-clientes",
      label: "Top 10 Clientes",
      icon: <Star className="h-3.5 w-3.5" />,
      content: (
        <ChartContainer
          title="Top 10 Clientes por Receita"
          icon={<Star className="h-4 w-4 text-rose-600" />}
          chart={
            <InlineBarChart
              data={(topClientes.data || []).map(c => ({ ...c, name: c.cliente?.length > 20 ? c.cliente.slice(0, 18) + "…" : c.cliente }))}
              dataKey="receita"
              nameKey="name"
              fill="hsl(0, 84%, 60%)"
            />
          }
          table={<DataDetailTable
            columns={[
              { key: "cliente", label: "Cliente" },
              { key: "receita", label: "Receita", align: "right", format: (v: number) => formatCurrency(v) },
            ]}
            data={topClientes.data || []}
            showSearch={false}
          />}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Painel Executivo</h1>
            <p className="text-sm text-muted-foreground">Visão consolidada de vendas e desempenho</p>
          </div>
        </div>
        <ValueLegend />
      </div>

      <DashboardFiltersBar filters={filters} onChange={handleFilterChange} />

      {/* Enhanced KPI Cards */}
      {kpis.isLoading ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
          {[...Array(7)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-4 w-24 mb-3" /><Skeleton className="h-7 w-32 mb-2" /><Skeleton className="h-5 w-16" /></CardContent></Card>
          ))}
        </div>
      ) : kpis.data && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
          <EnhancedKPICard title="Receita Total" value={kpis.data.receita_total} isCurrency icon={DollarSign} iconColor="text-blue-600 dark:text-blue-400" trend={kpis.data.receita_trend} meta={metaReceita > 0 ? metaReceita : undefined} />
          <EnhancedKPICard title="Qtde Pedidos" value={kpis.data.qtde_pedidos} icon={ShoppingCart} iconColor="text-violet-600 dark:text-violet-400" trend={kpis.data.pedidos_trend} />
          <EnhancedKPICard title="Ticket Médio" value={kpis.data.ticket_medio} isCurrency icon={Receipt} iconColor="text-amber-600 dark:text-amber-400" trend={kpis.data.ticket_trend} />
          <EnhancedKPICard title="Clientes Ativos" value={kpis.data.clientes_ativos} icon={Users} iconColor="text-emerald-600 dark:text-emerald-400" trend={kpis.data.clientes_trend} />
          <EnhancedKPICard title="Mix Médio" value={kpis.data.mix_medio} icon={Package} iconColor="text-cyan-600 dark:text-cyan-400" trend={kpis.data.mix_trend} suffix="itens/ped" formatValue={(v) => v.toFixed(1)} />
          <EnhancedKPICard title="Positivação" value={kpis.data.positivacao} icon={Target} iconColor="text-rose-600 dark:text-rose-400" suffix="%" formatValue={(v) => v.toFixed(1)} />
          {melhorMes && (
            <EnhancedKPICard title="Melhor Mês" value={melhorMes.receita_total} isCurrency icon={Star} iconColor="text-yellow-600 dark:text-yellow-400" formatValue={() => melhorMes.label} />
          )}
        </div>
      )}

      <ChartTabs tabs={tabs} />

      {/* Detail Table */}
      <DataDetailTable
        title="Resumo por Empresa"
        columns={detailColumns}
        data={detailData}
        showTotals
        totalsRow={{
          rank: "",
          nome_empresa: "TOTAL",
          receita_total: detailData.reduce((s, d) => s + d.receita_total, 0),
          qtde_pedidos: detailData.reduce((s, d) => s + d.qtde_pedidos, 0),
          ticket_medio: null,
          clientes_ativos: null,
        }}
        exportFilename="painel_executivo"
      />
    </div>
  );
}
