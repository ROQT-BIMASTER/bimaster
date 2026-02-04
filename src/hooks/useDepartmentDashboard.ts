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

interface DespesaMetrics {
  qtdDespesas: number;
  despesasAtivas: number;
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
  categoria: string;
  descricao: string;
  valorPrevisto: number;
  valorRealizado: number;
  status: string;
  data: string;
}

export function useDepartmentDashboard(departmentId: string, dateRange?: DateRangeFilter) {
  const today = new Date();
  const startDate = dateRange?.from || startOfMonth(today);
  const endDate = dateRange?.to || today;
  
  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];

  // Query para verbas do departamento
  const verbasQuery = useQuery({
    queryKey: ['department-dashboard-verbas', departmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("department_budgets")
        .select("id, name, code, total_amount, spent_amount, status, period_start, approval_status")
        .eq("department_id", departmentId)
        .eq("status", "active")
        .eq("approval_status", "approved")
        .order("period_start", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!departmentId,
    staleTime: 3 * 60 * 1000,
  });

  // Query para despesas do departamento
  const despesasQuery = useQuery({
    queryKey: ['department-dashboard-despesas', departmentId, startDateStr, endDateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("department_expenses")
        .select(`
          id,
          budget_id,
          category,
          description,
          valor_previsto,
          valor_realizado,
          status,
          expense_date,
          created_at
        `)
        .eq("department_id", departmentId)
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr + "T23:59:59")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!departmentId,
    staleTime: 3 * 60 * 1000,
  });

  // Calcular métricas de verbas
  const activeBudgetIds = new Set(verbasQuery.data?.map(v => v.id) || []);
  
  const totalUtilizadoReal = (despesasQuery.data as any[])?.filter((d: any) => {
    const isApproved = ['approved', 'aprovado', 'completed', 'pago', 'paid'].includes(d.status?.toLowerCase());
    const budgetId = d.budget_id;
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

  // Calcular métricas de despesas
  const despesasAtivas = (despesasQuery.data as any[])?.filter((d: any) => 
    ['approved', 'pending', 'pending_financial'].includes(d.status?.toLowerCase())
  ).length || 0;

  const despesaMetrics: DespesaMetrics = {
    qtdDespesas: despesasQuery.data?.length || 0,
    despesasAtivas,
    valorPendente: (despesasQuery.data as any[])?.filter((d: any) => 
      ['pending', 'pendente', 'pending_financial'].includes(d.status?.toLowerCase())
    ).reduce((sum: number, d: any) => sum + (parseFloat(String(d.valor_realizado)) || 0), 0) || 0,
    valorPago: (despesasQuery.data as any[])?.filter((d: any) => 
      ['approved', 'aprovado', 'completed', 'pago', 'paid'].includes(d.status?.toLowerCase())
    ).reduce((sum: number, d: any) => sum + (parseFloat(String(d.valor_realizado)) || 0), 0) || 0,
    percentualPago: 0,
  };
  const totalDespesas = despesaMetrics.valorPendente + despesaMetrics.valorPago;
  despesaMetrics.percentualPago = totalDespesas > 0 
    ? (despesaMetrics.valorPago / totalDespesas) * 100 
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
      const isApproved = ['approved', 'aprovado', 'completed', 'pago', 'paid'].includes(d.status?.toLowerCase());
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
    categoria: d.category || 'Geral',
    descricao: d.description || '',
    valorPrevisto: parseFloat(String(d.valor_previsto)) || 0,
    valorRealizado: parseFloat(String(d.valor_realizado)) || 0,
    status: d.status || 'pending',
    data: d.expense_date || d.created_at?.split('T')[0] || '',
  })) || [];

  // Despesas por categoria
  const despesasPorCategoria = (despesasQuery.data as any[])?.reduce((acc: Record<string, { pendente: number; pago: number }>, d: any) => {
    const categoria = d.category || 'Outros';
    if (!acc[categoria]) {
      acc[categoria] = { pendente: 0, pago: 0 };
    }
    const valor = parseFloat(String(d.valor_realizado)) || 0;
    if (['pending', 'pendente', 'pending_financial'].includes(d.status?.toLowerCase())) {
      acc[categoria].pendente += valor;
    } else if (['approved', 'aprovado', 'completed', 'pago', 'paid'].includes(d.status?.toLowerCase())) {
      acc[categoria].pago += valor;
    }
    return acc;
  }, {} as Record<string, { pendente: number; pago: number }>) || {};

  return {
    verbas: verbasQuery.data || [],
    despesas,
    verbaMetrics,
    despesaMetrics,
    fluxoCaixa,
    despesasPorCategoria,
    isLoading: verbasQuery.isLoading || despesasQuery.isLoading,
    error: verbasQuery.error || despesasQuery.error,
  };
}
