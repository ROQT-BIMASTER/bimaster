import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaContext } from "@/contexts/EmpresaContext";

export interface DashboardFilters {
  ano: number;
  mes: number | null; // null = all months
  supervisor?: string | null;
  codVend?: number | null;
  uf?: string | null;
  marca?: string | null;
}

interface KPIResult {
  receita_total: number;
  qtde_pedidos: number;
  ticket_medio: number;
  clientes_ativos: number;
  qtde_itens: number;
  mix_medio: number;
  // trends vs previous period
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

async function fetchKPIData(
  filters: DashboardFilters,
  empresaIds: number[]
) {
  // Build query for current period
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

  return useQuery<KPIResult>({
    queryKey: ["dashboard-kpis", filters, empresaIds],
    queryFn: async () => {
      // Fetch current period
      const currentData = await fetchKPIData(filters, empresaIds);

      // Fetch previous period (previous month or previous year)
      const prevFilters = { ...filters };
      if (filters.mes) {
        if (filters.mes === 1) {
          prevFilters.ano = filters.ano - 1;
          prevFilters.mes = 12;
        } else {
          prevFilters.mes = filters.mes - 1;
        }
      } else {
        prevFilters.ano = filters.ano - 1;
      }
      const prevData = await fetchKPIData(prevFilters, empresaIds);

      const totalClientes = await fetchTotalClientes(empresaIds);

      // Aggregate
      const agg = (rows: any[]) => ({
        receita: rows.reduce((s, r) => s + (Number(r.receita_total) || 0), 0),
        pedidos: rows.reduce((s, r) => s + (Number(r.qtde_pedidos) || 0), 0),
        clientes: new Set(rows.flatMap((r) => r.clientes_ativos ? [r.cod_vend + '-' + r.uf] : [])).size > 0
          ? rows.reduce((s, r) => s + (Number(r.clientes_ativos) || 0), 0)
          : 0,
        itens: rows.reduce((s, r) => s + (Number(r.qtde_itens) || 0), 0),
      });

      const cur = agg(currentData);
      const prev = agg(prevData);

      // For clientes_ativos, we need distinct count - the view already groups so we sum
      // Use a Set-based approach for unique clients across dimensions
      const clientesAtivos = cur.clientes;

      const ticketMedio = cur.pedidos > 0 ? cur.receita / cur.pedidos : 0;
      const prevTicket = prev.pedidos > 0 ? prev.receita / prev.pedidos : 0;
      const mixMedio = cur.pedidos > 0 ? cur.itens / cur.pedidos : 0;
      const prevMix = prev.pedidos > 0 ? prev.itens / prev.pedidos : 0;
      const positivacao = totalClientes > 0 ? (clientesAtivos / totalClientes) * 100 : 0;

      return {
        receita_total: cur.receita,
        qtde_pedidos: cur.pedidos,
        ticket_medio: ticketMedio,
        clientes_ativos: clientesAtivos,
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
    staleTime: 5 * 60 * 1000,
  });
}
