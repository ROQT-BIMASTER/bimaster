import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, endOfMonth, startOfYear, subDays } from "date-fns";

export interface DateRangeFilter {
  from: Date;
  to: Date;
}

export type DatePreset = "this_month" | "last_30_days" | "last_90_days" | "this_year" | "custom";

export function getDateRangeFromPreset(preset: DatePreset, customRange?: DateRangeFilter): DateRangeFilter {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  
  switch (preset) {
    case "this_month":
      return { from: startOfMonth(today), to: today };
    case "last_30_days":
      return { from: subDays(today, 30), to: today };
    case "last_90_days":
      return { from: subDays(today, 90), to: today };
    case "this_year":
      return { from: startOfYear(today), to: today };
    case "custom":
      return customRange || { from: startOfMonth(today), to: today };
    default:
      return { from: startOfMonth(today), to: today };
  }
}

interface VerbaMetrics {
  totalOrcado: number;
  totalUtilizado: number;
  saldoDisponivel: number;
  percentualUtilizado: number;
}

interface EventoMetrics {
  qtdEventos: number;
  eventosAtivos: number;
  valorPendente: number;
  valorPago: number;
  percentualPago: number;
}

interface FluxoCaixaItem {
  mes: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

interface Despesa {
  id: string;
  evento: string;
  categoria: string;
  descricao: string;
  valorPrevisto: number;
  valorRealizado: number;
  status: string;
  data: string;
  event_id?: string;
}

export function useEventsDashboard(dateRange?: DateRangeFilter) {
  const today = new Date();
  const startDate = dateRange?.from || startOfMonth(today);
  const endDate = dateRange?.to || today;
  
  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];

  // Query para verbas vinculadas a eventos (via budget_id dos eventos)
  const verbasQuery = useQuery({
    queryKey: ['events-dashboard-verbas'],
    queryFn: async () => {
      // Primeiro buscar budget_ids dos eventos
      const { data: eventBudgets } = await supabase
        .from("corporate_events")
        .select("budget_id")
        .not("budget_id", "is", null);
      
      const budgetIds = [...new Set(eventBudgets?.map(e => e.budget_id).filter(Boolean) || [])];
      
      if (budgetIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from("trade_budgets")
        .select("id, name, code, total_amount, spent_amount, available_amount, status, period_start")
        .in("id", budgetIds)
        .eq("status", "active")
        .is("inactivated_at", null)
        .order("period_start", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 3 * 60 * 1000,
  });

  // Query para eventos
  const eventosQuery = useQuery({
    queryKey: ['events-dashboard-eventos', startDateStr, endDateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corporate_events")
        .select(`
          id,
          code,
          name,
          status,
          event_date,
          end_date,
          budget_id,
          budget_amount,
          actual_cost,
          event_type,
          location
        `)
        .or(`event_date.gte.${startDateStr},event_date.lte.${endDateStr}`)
        .order("event_date", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 3 * 60 * 1000,
  });

  // Query para despesas de eventos
  const despesasQuery = useQuery({
    queryKey: ['events-dashboard-despesas', startDateStr, endDateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corporate_event_expenses")
        .select(`
          id,
          event_id,
          category,
          description,
          valor_previsto,
          valor_realizado,
          status,
          expense_date,
          created_at,
          payment_queue_id,
          event:corporate_events(name, budget_id)
        `)
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr + "T23:59:59")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 3 * 60 * 1000,
  });

  // Calcular métricas de verbas
  const activeBudgetIds = new Set(verbasQuery.data?.map(v => v.id) || []);
  
  const totalUtilizadoReal = (despesasQuery.data as any[])?.filter((d: any) => {
    const isApproved = ['approved', 'aprovado', 'completed', 'pago'].includes(d.status?.toLowerCase());
    const budgetId = d.event?.budget_id;
    return isApproved && budgetId && activeBudgetIds.has(budgetId);
  }).reduce((sum: number, d: any) => sum + (parseFloat(String(d.valor_realizado)) || 0), 0) || 0;

  const verbaMetrics: VerbaMetrics = {
    totalOrcado: verbasQuery.data?.reduce((sum, v) => sum + (parseFloat(String(v.total_amount)) || 0), 0) || 0,
    totalUtilizado: totalUtilizadoReal,
    saldoDisponivel: 0,
    percentualUtilizado: 0,
  };
  verbaMetrics.saldoDisponivel = verbaMetrics.totalOrcado - verbaMetrics.totalUtilizado;
  verbaMetrics.percentualUtilizado = verbaMetrics.totalOrcado > 0
    ? (verbaMetrics.totalUtilizado / verbaMetrics.totalOrcado) * 100 
    : 0;

  // Calcular métricas de eventos
  const eventosAtivos = eventosQuery.data?.filter(e => 
    ['approved', 'in_progress'].includes(e.status)
  ).length || 0;

  const eventoMetrics: EventoMetrics = {
    qtdEventos: eventosQuery.data?.length || 0,
    eventosAtivos,
    valorPendente: (despesasQuery.data as any[])?.filter((d: any) => 
      ['pending', 'pendente'].includes(d.status?.toLowerCase())
    ).reduce((sum: number, d: any) => sum + (parseFloat(String(d.valor_realizado)) || 0), 0) || 0,
    valorPago: (despesasQuery.data as any[])?.filter((d: any) => 
      ['approved', 'aprovado', 'completed', 'pago'].includes(d.status?.toLowerCase())
    ).reduce((sum: number, d: any) => sum + (parseFloat(String(d.valor_realizado)) || 0), 0) || 0,
    percentualPago: 0,
  };
  const totalDespesas = eventoMetrics.valorPendente + eventoMetrics.valorPago;
  eventoMetrics.percentualPago = totalDespesas > 0 
    ? (eventoMetrics.valorPago / totalDespesas) * 100 
    : 0;

  // Calcular fluxo de caixa mensal (últimos 6 meses)
  const fluxoCaixa: FluxoCaixaItem[] = [];
  const referenceDate = endDate;
  let saldoAcumulado = 0;

  for (let i = 5; i >= 0; i--) {
    const mesDate = subMonths(referenceDate, i);
    const mesInicio = startOfMonth(mesDate);
    const mesFim = endOfMonth(mesDate);
    const mesLabel = format(mesDate, "MMM/yy");

    // Entradas: verbas liberadas no mês
    const entradas = verbasQuery.data?.filter(v => {
      const vDate = new Date(v.period_start);
      return vDate >= mesInicio && vDate <= mesFim;
    }).reduce((sum, v) => sum + (parseFloat(String(v.total_amount)) || 0), 0) || 0;

    // Saídas: despesas realizadas no mês
    const saidas = despesasQuery.data?.filter((d: any) => {
      const dDate = new Date(d.created_at);
      const isApproved = ['approved', 'aprovado', 'completed', 'pago'].includes(d.status?.toLowerCase());
      return dDate >= mesInicio && dDate <= mesFim && isApproved;
    }).reduce((sum: number, d: any) => sum + (parseFloat(String(d.valor_realizado)) || 0), 0) || 0;

    saldoAcumulado += entradas - saidas;

    fluxoCaixa.push({
      mes: mesLabel,
      entradas,
      saidas,
      saldo: saldoAcumulado,
    });
  }

  // Formatar despesas para tabela
  const despesas: Despesa[] = despesasQuery.data?.map((d: any) => ({
    id: d.id,
    evento: d.event?.name || 'Evento não identificado',
    categoria: d.category || 'Geral',
    descricao: d.description || '',
    valorPrevisto: parseFloat(String(d.valor_previsto)) || 0,
    valorRealizado: parseFloat(String(d.valor_realizado)) || 0,
    status: d.status || 'pending',
    data: d.expense_date || d.created_at?.split('T')[0] || '',
    event_id: d.event_id,
  })) || [];

  // Despesas por evento
  const despesasPorEvento = (despesasQuery.data as any[])?.reduce((acc: Record<string, { pendente: number; pago: number }>, d: any) => {
    const evento = d.event?.name || 'Sem evento';
    if (!acc[evento]) {
      acc[evento] = { pendente: 0, pago: 0 };
    }
    const valor = parseFloat(String(d.valor_realizado)) || 0;
    if (['pending', 'pendente'].includes(d.status?.toLowerCase())) {
      acc[evento].pendente += valor;
    } else {
      acc[evento].pago += valor;
    }
    return acc;
  }, {} as Record<string, { pendente: number; pago: number }>) || {};

  return {
    verbas: verbasQuery.data || [],
    eventos: eventosQuery.data || [],
    despesas,
    verbaMetrics,
    eventoMetrics,
    fluxoCaixa,
    despesasPorEvento,
    isLoading: verbasQuery.isLoading || eventosQuery.isLoading || despesasQuery.isLoading,
    error: verbasQuery.error || eventosQuery.error || despesasQuery.error,
  };
}
