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

// ---------- Interfaces ----------

export interface VerbaConsolidada {
  id: string;
  name: string;
  code: string;
  total_amount: number;
  spent_amount: number;
  available_amount: number;
  origem: "trade" | "eventos" | "departamentos";
}

export interface VerbaMetrics {
  totalOrcado: number;
  totalUtilizado: number;
  saldoDisponivel: number;
  percentualUtilizado: number;
}

export interface DespesaMetrics {
  totalOrigens: number;
  itensAtivos: number;
  valorPendente: number;
  valorPago: number;
  percentualPago: number;
}

export interface FluxoCaixaItem {
  mes: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

export interface DespesaConsolidada {
  id: string;
  origem: "trade" | "eventos" | "departamentos";
  origemNome: string; // campaign name, event name, department name
  descricao: string;
  categoria: string;
  valorRealizado: number;
  status: string;
  data: string;
}

export interface DespesaPorOrigem {
  nome: string;
  origem: "trade" | "eventos" | "departamentos";
  pendente: number;
  pago: number;
  total: number;
}

const PAID_STATUSES = ["approved", "aprovado", "completed", "pago"];
const PENDING_STATUSES = ["pending", "pendente"];

function isPaid(status: string | null) {
  return PAID_STATUSES.includes((status || "").toLowerCase());
}
function isPending(status: string | null) {
  return PENDING_STATUSES.includes((status || "").toLowerCase());
}

export function useFinanceiroConsolidadoDashboard(dateRange?: DateRangeFilter) {
  const today = new Date();
  const startDate = dateRange?.from || startOfYear(today);
  const endDate = dateRange?.to || today;
  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];

  // ---- Trade Budgets (verbas de trade, excluindo as vinculadas a eventos) ----
  const tradeBudgetsQuery = useQuery({
    queryKey: ["consolidado-trade-budgets"],
    queryFn: async () => {
      // Pegar budget_ids vinculados a eventos para excluir
      const { data: eventBudgets } = await supabase
        .from("corporate_events")
        .select("budget_id")
        .not("budget_id", "is", null);

      const eventBudgetIds = new Set(eventBudgets?.map((e) => e.budget_id).filter(Boolean) || []);

      const { data, error } = await supabase
        .from("trade_budgets")
        .select("id, name, code, total_amount, spent_amount, available_amount, status, period_start")
        .eq("status", "active")
        .is("inactivated_at", null)
        .order("period_start", { ascending: false });

      if (error) throw error;

      // Separar trade puras das vinculadas a eventos
      const trade = (data || []).filter((b) => !eventBudgetIds.has(b.id));
      const eventos = (data || []).filter((b) => eventBudgetIds.has(b.id));

      return { trade, eventos };
    },
    staleTime: 3 * 60 * 1000,
  });

  // ---- Department Budgets ----
  const deptBudgetsQuery = useQuery({
    queryKey: ["consolidado-dept-budgets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("department_budgets")
        .select("id, name, total_amount, spent_amount, status, period_start, departamento:departamentos(nome)")
        .eq("status", "active")
        .eq("approval_status", "approved")
        .order("period_start", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: 3 * 60 * 1000,
  });

  // ---- Trade Campaign Expenses ----
  const tradeDespesasQuery = useQuery({
    queryKey: ["consolidado-trade-despesas", startDateStr, endDateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_campaign_expenses")
        .select("id, campaign_id, description, category, valor_realizado, status, expense_date, created_at, campaign:trade_campaigns(name)")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr + "T23:59:59")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: 3 * 60 * 1000,
  });

  // ---- Corporate Event Expenses ----
  const eventosDespesasQuery = useQuery({
    queryKey: ["consolidado-eventos-despesas", startDateStr, endDateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corporate_event_expenses")
        .select("id, event_id, description, category, valor_realizado, status, expense_date, created_at, event:corporate_events(name)")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr + "T23:59:59")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: 3 * 60 * 1000,
  });

  // ---- Department Expenses ----
  const deptDespesasQuery = useQuery({
    queryKey: ["consolidado-dept-despesas", startDateStr, endDateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("department_expenses")
        .select("id, department_id, description, category, valor_realizado, status, expense_date, created_at, departamento:departamentos(nome)")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr + "T23:59:59")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: 3 * 60 * 1000,
  });

  // ==================== CÁLCULOS ====================

  const tradeBudgets = tradeBudgetsQuery.data?.trade || [];
  const eventoBudgets = tradeBudgetsQuery.data?.eventos || [];
  const deptBudgets = deptBudgetsQuery.data || [];

  // --- Verbas consolidadas ---
  const verbasConsolidadas: VerbaConsolidada[] = [
    ...tradeBudgets.map((b) => ({
      id: b.id,
      name: b.name,
      code: b.code || "",
      total_amount: parseFloat(String(b.total_amount)) || 0,
      spent_amount: parseFloat(String(b.spent_amount)) || 0,
      available_amount: parseFloat(String(b.available_amount)) || 0,
      origem: "trade" as const,
    })),
    ...eventoBudgets.map((b) => ({
      id: b.id,
      name: b.name,
      code: b.code || "",
      total_amount: parseFloat(String(b.total_amount)) || 0,
      spent_amount: parseFloat(String(b.spent_amount)) || 0,
      available_amount: parseFloat(String(b.available_amount)) || 0,
      origem: "eventos" as const,
    })),
    ...deptBudgets.map((b: any) => {
      const total = parseFloat(String(b.total_amount)) || 0;
      const spent = parseFloat(String(b.spent_amount)) || 0;
      return {
        id: b.id,
        name: b.name || b.departamento?.nome || "Departamento",
        code: "",
        total_amount: total,
        spent_amount: spent,
        available_amount: total - spent,
        origem: "departamentos" as const,
      };
    }),
  ];

  const verbaMetrics: VerbaMetrics = {
    totalOrcado: verbasConsolidadas.reduce((s, v) => s + v.total_amount, 0),
    totalUtilizado: verbasConsolidadas.reduce((s, v) => s + v.spent_amount, 0),
    saldoDisponivel: 0,
    percentualUtilizado: 0,
  };
  verbaMetrics.saldoDisponivel = verbaMetrics.totalOrcado - verbaMetrics.totalUtilizado;
  verbaMetrics.percentualUtilizado =
    verbaMetrics.totalOrcado > 0 ? (verbaMetrics.totalUtilizado / verbaMetrics.totalOrcado) * 100 : 0;

  // --- Despesas consolidadas ---
  const allDespesas: DespesaConsolidada[] = [
    ...(tradeDespesasQuery.data || []).map((d: any) => ({
      id: d.id,
      origem: "trade" as const,
      origemNome: d.campaign?.name || "Campanha",
      descricao: d.description || "",
      categoria: d.category || "Geral",
      valorRealizado: parseFloat(String(d.valor_realizado)) || 0,
      status: d.status || "pending",
      data: d.expense_date || d.created_at?.split("T")[0] || "",
    })),
    ...(eventosDespesasQuery.data || []).map((d: any) => ({
      id: d.id,
      origem: "eventos" as const,
      origemNome: d.event?.name || "Evento",
      descricao: d.description || "",
      categoria: d.category || "Geral",
      valorRealizado: parseFloat(String(d.valor_realizado)) || 0,
      status: d.status || "pending",
      data: d.expense_date || d.created_at?.split("T")[0] || "",
    })),
    ...(deptDespesasQuery.data || []).map((d: any) => ({
      id: d.id,
      origem: "departamentos" as const,
      origemNome: d.departamento?.nome || "Departamento",
      descricao: d.description || "",
      categoria: d.category || "Geral",
      valorRealizado: parseFloat(String(d.valor_realizado)) || 0,
      status: d.status || "pending",
      data: d.expense_date || d.created_at?.split("T")[0] || "",
    })),
  ];

  const despesaMetrics: DespesaMetrics = {
    totalOrigens: 3,
    itensAtivos: allDespesas.length,
    valorPendente: allDespesas.filter((d) => isPending(d.status)).reduce((s, d) => s + d.valorRealizado, 0),
    valorPago: allDespesas.filter((d) => isPaid(d.status)).reduce((s, d) => s + d.valorRealizado, 0),
    percentualPago: 0,
  };
  const totalDesp = despesaMetrics.valorPendente + despesaMetrics.valorPago;
  despesaMetrics.percentualPago = totalDesp > 0 ? (despesaMetrics.valorPago / totalDesp) * 100 : 0;

  // --- Despesas por origem ---
  const despesasPorOrigemMap = allDespesas.reduce(
    (acc, d) => {
      const key = d.origemNome;
      if (!acc[key]) acc[key] = { nome: key, origem: d.origem, pendente: 0, pago: 0, total: 0 };
      const valor = d.valorRealizado;
      if (isPending(d.status)) acc[key].pendente += valor;
      else acc[key].pago += valor;
      acc[key].total += valor;
      return acc;
    },
    {} as Record<string, DespesaPorOrigem>,
  );
  const despesasPorOrigem = Object.values(despesasPorOrigemMap).sort((a, b) => b.total - a.total);

  // --- Fluxo de caixa (últimos 6 meses) ---
  const allBudgetsForFlux = [...tradeBudgets, ...eventoBudgets];
  const fluxoCaixa: FluxoCaixaItem[] = [];
  let saldoAcumulado = 0;

  for (let i = 5; i >= 0; i--) {
    const mesDate = subMonths(endDate, i);
    const mesInicio = startOfMonth(mesDate);
    const mesFim = endOfMonth(mesDate);
    const mesLabel = format(mesDate, "MMM/yy");

    // Entradas: verbas liberadas
    const entradasTrade = allBudgetsForFlux
      .filter((v) => {
        const vDate = new Date(v.period_start);
        return vDate >= mesInicio && vDate <= mesFim;
      })
      .reduce((s, v) => s + (parseFloat(String(v.total_amount)) || 0), 0);

    const entradasDept = deptBudgets
      .filter((v: any) => {
        const vDate = new Date(v.period_start);
        return vDate >= mesInicio && vDate <= mesFim;
      })
      .reduce((s: number, v: any) => s + (parseFloat(String(v.total_amount)) || 0), 0);

    const entradas = entradasTrade + entradasDept;

    // Saídas: despesas pagas
    const saidas = allDespesas
      .filter((d) => {
        const dDate = new Date(d.data);
        return dDate >= mesInicio && dDate <= mesFim && isPaid(d.status);
      })
      .reduce((s, d) => s + d.valorRealizado, 0);

    saldoAcumulado += entradas - saidas;
    fluxoCaixa.push({ mes: mesLabel, entradas, saidas, saldo: saldoAcumulado });
  }

  return {
    verbasConsolidadas,
    verbaMetrics,
    despesaMetrics,
    despesas: allDespesas,
    despesasPorOrigem,
    fluxoCaixa,
    isLoading:
      tradeBudgetsQuery.isLoading ||
      deptBudgetsQuery.isLoading ||
      tradeDespesasQuery.isLoading ||
      eventosDespesasQuery.isLoading ||
      deptDespesasQuery.isLoading,
    error:
      tradeBudgetsQuery.error ||
      deptBudgetsQuery.error ||
      tradeDespesasQuery.error ||
      eventosDespesasQuery.error ||
      deptDespesasQuery.error,
  };
}
