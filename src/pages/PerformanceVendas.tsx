import { useState, useCallback } from "react";
import { DashboardFiltersBar } from "@/components/painel-executivo/DashboardFilters";
import { useDashboardKPIs, type DashboardFilters } from "@/hooks/useDashboardKPIs";
import { useRankingSupervisores } from "@/hooks/useRankingSupervisores";
import { useRankingVendedores } from "@/hooks/useRankingVendedores";
import { useReceitaMensal } from "@/hooks/useReceitaMensal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SmartValue } from "@/components/ui/smart-value";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Users, UserCheck, ChevronDown, ChevronRight, BarChart3 } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaContext } from "@/contexts/EmpresaContext";
import { useOperacaoFilter } from "@/hooks/useConfigOperacoes";

const now = new Date();

function TrendIcon({ value }: { value: number }) {
  if (Math.abs(value) < 1) return <Minus className="h-3 w-3 text-muted-foreground" />;
  return value > 0
    ? <TrendingUp className="h-3 w-3 text-emerald-600" />
    : <TrendingDown className="h-3 w-3 text-red-600" />;
}

function MiniSparkline({ data }: { data: { value: number }[] }) {
  return (
    <ResponsiveContainer width={80} height={30}>
      <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Tooltip formatter={(v: number) => formatCurrency(v)} />
        <Area type="monotone" dataKey="value" stroke="hsl(217, 91%, 60%)" strokeWidth={1.5} fill="url(#sparkGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function VendedorDrilldown({ codVend, vendedor, filters, onClose }: {
  codVend: number; vendedor: string; filters: DashboardFilters; onClose: () => void;
}) {
  const { empresaIds } = useEmpresaContext();
  const { visiveis, multipliers } = useOperacaoFilter();

  const { data: monthlyData } = useQuery({
    queryKey: ["vendedor-monthly", codVend, filters.ano, empresaIds, [...visiveis]],
    queryFn: async () => {
      const meses = [];
      for (let i = 5; i >= 0; i--) {
        let m = (filters.mes || now.getMonth() + 1) - i;
        let y = filters.ano;
        while (m <= 0) { m += 12; y--; }
        meses.push({ ano: y, mes: m });
      }
      const anos = [...new Set(meses.map(m => m.ano))];
      const { data } = await supabase
        .from("vw_ranking_vendedores" as any)
        .select("*")
        .eq("cod_vend", codVend)
        .in("ano", anos);

      const rows = ((data as any[]) || []).filter(r => visiveis.has(r.operacao));
      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      return meses.map(({ ano, mes }) => {
        const monthRows = rows.filter(r => r.ano === ano && r.mes === mes);
        const receita = monthRows.reduce((s, r) => s + (Number(r.receita_total) || 0) * (multipliers.get(r.operacao) ?? 1), 0);
        return { label: `${monthNames[mes - 1]}/${String(ano).slice(2)}`, receita };
      });
    },
  });

  const { data: topClientes } = useQuery({
    queryKey: ["vendedor-top-clientes", codVend, filters.ano, filters.mes, [...visiveis]],
    queryFn: async () => {
      let query = supabase
        .from("vendas_union")
        .select("cod_cliente, cliente, venda, preco_venda, quantidade, operacao")
        .eq("cod_vend", codVend);

      if (filters.mes) {
        const start = `${filters.ano}-${String(filters.mes).padStart(2, "0")}-01`;
        const endM = filters.mes === 12 ? 1 : filters.mes + 1;
        const endY = filters.mes === 12 ? filters.ano + 1 : filters.ano;
        const end = `${endY}-${String(endM).padStart(2, "0")}-01`;
        query = query.gte("data", start).lt("data", end);
      } else {
        query = query.gte("data", `${filters.ano}-01-01`).lt("data", `${filters.ano + 1}-01-01`);
      }

      const { data } = await query.limit(1000);
      const rows = ((data as any[]) || []).filter(r => visiveis.has(r.operacao));
      const map = new Map<number, { cliente: string; receita: number }>();
      for (const r of rows) {
        const mult = multipliers.get(r.operacao) ?? 1;
        if (!map.has(r.cod_cliente)) map.set(r.cod_cliente, { cliente: r.cliente, receita: 0 });
        map.get(r.cod_cliente)!.receita += (Number(r.vl_outros_custos) || 0) * mult;
      }
      return [...map.values()].sort((a, b) => b.receita - a.receita).slice(0, 10);
    },
  });

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            {vendedor}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Evolução Mensal (6 meses)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={monthlyData || []} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="drillGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip formatter={(v: number) => [formatCurrency(v), "Receita"]} />
                  <Area type="monotone" dataKey="receita" stroke="hsl(217, 91%, 60%)" strokeWidth={2} fill="url(#drillGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Top 10 Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-1.5 px-2 font-medium">#</th>
                    <th className="text-left py-1.5 px-2 font-medium">Cliente</th>
                    <th className="text-right py-1.5 px-2 font-medium">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {(topClientes || []).map((c, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-1.5 px-2 text-muted-foreground">{i + 1}</td>
                      <td className="py-1.5 px-2">{c.cliente}</td>
                      <td className="py-1.5 px-2 text-right"><SmartValue value={c.receita} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PerformanceVendas() {
  const [filters, setFilters] = useState<DashboardFilters>({ ano: now.getFullYear(), mes: now.getMonth() + 1 });
  const handleFilterChange = useCallback((p: Partial<DashboardFilters>) => setFilters(prev => ({ ...prev, ...p })), []);

  const supervisores = useRankingSupervisores(filters);
  const vendedores = useRankingVendedores(filters);
  const receitaMensal = useReceitaMensal(filters);

  const [expandedSup, setExpandedSup] = useState<string | null>(null);
  const [drillVendedor, setDrillVendedor] = useState<{ codVend: number; vendedor: string } | null>(null);

  // Build sparkline data from receitaMensal
  const sparkData = (receitaMensal.data || []).map(d => ({ value: d.receita_total }));

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-900/30">
          <BarChart3 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Performance de Vendas</h1>
          <p className="text-sm text-muted-foreground">Análise por supervisor e vendedor</p>
        </div>
      </div>

      <DashboardFiltersBar filters={filters} onChange={handleFilterChange} />

      {/* Supervisores */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-amber-600" />
            Visão por Supervisor
          </CardTitle>
        </CardHeader>
        <CardContent>
          {supervisores.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="space-y-1">
              {(supervisores.data || []).map((sup, idx) => {
                const isExpanded = expandedSup === sup.supervisor;
                const teamVendedores = (vendedores.data || []).filter(v => v.supervisor === sup.supervisor);

                return (
                  <div key={sup.supervisor} className="border border-border rounded-lg overflow-hidden">
                    <div
                      className="flex items-center gap-4 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedSup(isExpanded ? null : sup.supervisor)}
                    >
                      <span className="text-sm text-muted-foreground w-6">{idx + 1}</span>
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <span className="font-medium text-sm flex-1">{sup.supervisor}</span>
                      <div className="hidden md:block"><MiniSparkline data={sparkData} /></div>
                      <div className="text-right min-w-[100px]"><SmartValue value={sup.receita_total} className="text-sm font-semibold" /></div>
                      <div className="text-right min-w-[70px] text-sm">{sup.qtde_pedidos.toLocaleString("pt-BR")} ped</div>
                      <div className="text-right min-w-[60px] text-sm">{sup.clientes_ativos} cli</div>
                    </div>

                    {isExpanded && teamVendedores.length > 0 && (
                      <div className="bg-muted/20 border-t border-border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-muted-foreground text-xs">
                              <th className="text-left py-1.5 px-4 font-medium">#</th>
                              <th className="text-left py-1.5 px-2 font-medium">Vendedor</th>
                              <th className="text-right py-1.5 px-2 font-medium">Receita</th>
                              <th className="text-right py-1.5 px-2 font-medium">Pedidos</th>
                              <th className="text-right py-1.5 px-2 font-medium">Clientes</th>
                              <th className="text-right py-1.5 px-2 font-medium">Ticket</th>
                              <th className="py-1.5 px-2"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {teamVendedores.map((v, vi) => (
                              <tr
                                key={v.cod_vend}
                                className="border-t border-border/30 hover:bg-muted/40 cursor-pointer transition-colors"
                                onClick={() => setDrillVendedor({ codVend: v.cod_vend, vendedor: v.vendedor })}
                              >
                                <td className="py-1.5 px-4 text-muted-foreground">{vi + 1}</td>
                                <td className="py-1.5 px-2">{v.vendedor}</td>
                                <td className="py-1.5 px-2 text-right"><SmartValue value={v.receita_total} /></td>
                                <td className="py-1.5 px-2 text-right">{v.qtde_pedidos.toLocaleString("pt-BR")}</td>
                                <td className="py-1.5 px-2 text-right">{v.clientes_ativos}</td>
                                <td className="py-1.5 px-2 text-right">
                                  <SmartValue value={v.qtde_pedidos > 0 ? v.receita_total / v.qtde_pedidos : 0} />
                                </td>
                                <td className="py-1.5 px-2 text-xs text-blue-600">Detalhar →</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ranking geral vendedores */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-emerald-600" />
            Ranking Geral de Vendedores
          </CardTitle>
        </CardHeader>
        <CardContent>
          {vendedores.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium">#</th>
                    <th className="text-left py-2 px-2 font-medium">Vendedor</th>
                    <th className="text-left py-2 px-2 font-medium">Supervisor</th>
                    <th className="text-right py-2 px-2 font-medium">Receita</th>
                    <th className="text-right py-2 px-2 font-medium">Pedidos</th>
                    <th className="text-right py-2 px-2 font-medium">Clientes</th>
                    <th className="text-right py-2 px-2 font-medium">Ticket Médio</th>
                  </tr>
                </thead>
                <tbody>
                  {(vendedores.data || []).slice(0, 30).map((v, i) => (
                    <tr
                      key={v.cod_vend}
                      className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => setDrillVendedor({ codVend: v.cod_vend, vendedor: v.vendedor })}
                    >
                      <td className="py-2 px-2 text-muted-foreground">{i + 1}</td>
                      <td className="py-2 px-2 font-medium">{v.vendedor}</td>
                      <td className="py-2 px-2 text-muted-foreground">{v.supervisor || "-"}</td>
                      <td className="py-2 px-2 text-right"><SmartValue value={v.receita_total} /></td>
                      <td className="py-2 px-2 text-right">{v.qtde_pedidos.toLocaleString("pt-BR")}</td>
                      <td className="py-2 px-2 text-right">{v.clientes_ativos}</td>
                      <td className="py-2 px-2 text-right">
                        <SmartValue value={v.qtde_pedidos > 0 ? v.receita_total / v.qtde_pedidos : 0} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {drillVendedor && (
        <VendedorDrilldown
          codVend={drillVendedor.codVend}
          vendedor={drillVendedor.vendedor}
          filters={filters}
          onClose={() => setDrillVendedor(null)}
        />
      )}
    </div>
  );
}
