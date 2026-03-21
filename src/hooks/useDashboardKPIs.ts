import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaContext } from "@/contexts/EmpresaContext";
import { useOperacaoFilter } from "./useConfigOperacoes";

export interface DashboardFilters {
  ano: number;
  mes: number | null;
  supervisor?: string | null;
  codVend?: number | null;
  uf?: string | null;
  marca?: string | null;
  tabela?: string | null;
}

interface KPIResult {
  receita_total: number;
  qtde_pedidos: number;
  ticket_medio: number;
  clientes_ativos: number;
  qtde_itens: number;
  mix_medio: number;
  receita_trend: number;
  pedidos_trend: number;
  ticket_trend: number;
  clientes_trend: number;
  mix_trend: number;
  positivacao: number;
}

function calcTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function applyOperacaoFilter(
  rows: any[],
  visiveis: Set<string>,
  multipliers: Map<string, number>
) {
  return rows.filter((r) => visiveis.has(r.operacao));
}

function aggRows(
  rows: any[],
  multipliers: Map<string, number>
) {
  let receita = 0;
  let pedidos = 0;
  let itens = 0;
  const clientSet = new Set<number>();

  for (const r of rows) {
    const mult = multipliers.get(r.operacao) ?? 1;
    receita += (Number(r.receita_total) || 0) * mult;
    pedidos += Number(r.qtde_pedidos) || 0;
    itens += Number(r.qtde_itens) || 0;
  }

  return {
    receita,
    pedidos,
    clientes: rows.reduce((s, r) => s + (Number(r.clientes_ativos) || 0), 0),
    itens,
  };
}

async function fetchKPIData(
  filters: DashboardFilters,
  empresaIds: number[]
) {
  let query = supabase
    .from("vw_dashboard_kpis" as any)
    .select("*")
    .eq("ano", filters.ano);

  if (filters.mes) query = query.eq("mes", filters.mes);
  if (empresaIds.length > 0) query = query.in("id_empresa", empresaIds);
  if (filters.supervisor) query = query.eq("supervisor", filters.supervisor);
  if (filters.codVend) query = query.eq("cod_vend", filters.codVend);
  if (filters.uf) query = query.eq("uf", filters.uf);
  if (filters.marca) query = query.eq("marca", filters.marca);

  const { data, error } = await query;
  if (error) throw error;
  return (data as any[]) || [];
}

async function fetchTotalClientes(empresaIds: number[]) {
  let query = supabase
    .from("clientes")
    .select("*", { count: "exact", head: true });
  if (empresaIds.length > 0) query = query.in("id_empresa", empresaIds);
  const { count } = await query;
  return count || 0;
}

export function useDashboardKPIs(filters: DashboardFilters) {
  const { empresaIds } = useEmpresaContext();
  const { visiveis, multipliers, loaded } = useOperacaoFilter();

  return useQuery<KPIResult>({
    queryKey: ["dashboard-kpis", filters, empresaIds, [...visiveis]],
    queryFn: async () => {
      const currentRaw = await fetchKPIData(filters, empresaIds);
      const currentData = applyOperacaoFilter(currentRaw, visiveis, multipliers);

      const prevFilters = { ...filters };
      if (filters.mes) {
        if (filters.mes === 1) { prevFilters.ano = filters.ano - 1; prevFilters.mes = 12; }
        else { prevFilters.mes = filters.mes - 1; }
      } else {
        prevFilters.ano = filters.ano - 1;
      }
      const prevRaw = await fetchKPIData(prevFilters, empresaIds);
      const prevData = applyOperacaoFilter(prevRaw, visiveis, multipliers);

      const totalClientes = await fetchTotalClientes(empresaIds);

      const cur = aggRows(currentData, multipliers);
      const prev = aggRows(prevData, multipliers);

      const ticketMedio = cur.pedidos > 0 ? cur.receita / cur.pedidos : 0;
      const prevTicket = prev.pedidos > 0 ? prev.receita / prev.pedidos : 0;
      const mixMedio = cur.pedidos > 0 ? cur.itens / cur.pedidos : 0;
      const prevMix = prev.pedidos > 0 ? prev.itens / prev.pedidos : 0;
      const positivacao = totalClientes > 0 ? (cur.clientes / totalClientes) * 100 : 0;

      return {
        receita_total: cur.receita,
        qtde_pedidos: cur.pedidos,
        ticket_medio: ticketMedio,
        clientes_ativos: cur.clientes,
        qtde_itens: cur.itens,
        mix_medio: mixMedio,
        receita_trend: calcTrend(cur.receita, prev.receita),
        pedidos_trend: calcTrend(cur.pedidos, prev.pedidos),
        ticket_trend: calcTrend(ticketMedio, prevTicket),
        clientes_trend: calcTrend(cur.clientes, prev.clientes),
        mix_trend: calcTrend(mixMedio, prevMix),
        positivacao,
      };
    },
    enabled: loaded,
    staleTime: 5 * 60 * 1000,
  });
}
