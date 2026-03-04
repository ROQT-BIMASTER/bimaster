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

interface CampanhaMetrics {
  qtdCampanhas: number;
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

interface Lancamento {
  id: string;
  cliente: string;
  campanha: string;
  valorPedido: number;
  valorPago: number | null;
  status: string;
  roi: number | null;
  data: string;
  campaign_id?: string;
  customer_id?: string;
  evidencias?: string[];
  sell_out_anterior?: number;
  sell_out_atual?: number;
  tipo_brinde?: string;
  acoes_manuais?: string;
  source?: 'campaign' | 'financial_entry';
  description?: string;
  supplier_name?: string;
  entry_type?: string;
}

export function useTradeFinanceiroDashboard(dateRange?: DateRangeFilter) {
  const today = new Date();
  const startDate = dateRange?.from || startOfMonth(today);
  const endDate = dateRange?.to || today;
  
  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];

  // Query para verbas ativas (exclui inativas)
  const verbasQuery = useQuery({
    queryKey: ['trade-dashboard-verbas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_budgets")
        .select("*")
        .eq("status", "active")
        .is("inactivated_at", null)
        .order("period_start", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 3 * 60 * 1000,
  });

  // Query para campanhas com despesas e budget_id
  const campanhasQuery = useQuery({
    queryKey: ['trade-dashboard-campanhas', startDateStr, endDateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_campaigns")
        .select(`
          id,
          name,
          status,
          start_date,
          end_date,
          budget_id
        `)
        .in("status", ["active", "approved", "in_progress", "completed", "pago"])
        .or(`start_date.gte.${startDateStr},end_date.lte.${endDateStr}`)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 3 * 60 * 1000,
  });

  // Query para despesas de campanhas com budget_id
  const despesasQuery = useQuery({
    queryKey: ['trade-dashboard-despesas', startDateStr, endDateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_campaign_expenses")
        .select(`
          id,
          campaign_id,
          valor_orcado,
          valor_realizado,
          status,
          created_at,
          campaign:trade_campaigns(name, budget_id)
        `)
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr + "T23:59:59")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 3 * 60 * 1000,
  });

  // Query para lançamentos de campanha
  const lancamentosQuery = useQuery({
    queryKey: ['trade-dashboard-lancamentos', startDateStr, endDateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_campaign_lancamentos")
        .select(`
          id,
          customer_id,
          campaign_id,
          valor_pedido,
          status,
          roi_percentual,
          data_lancamento,
          sell_out_anterior,
          sell_out_atual,
          tipo_brinde,
          acoes_manuais,
          evidencias,
          prospect:prospects(nome_empresa),
          campaign:trade_campaigns(name),
          expense:trade_campaign_expenses(valor_realizado, status)
        `)
        .gte("data_lancamento", startDateStr)
        .lte("data_lancamento", endDateStr)
        .order("data_lancamento", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 3 * 60 * 1000,
  });

  // Query para lançamentos financeiros diretos (trade_financial_entries)
  const financialEntriesQuery = useQuery({
    queryKey: ['trade-dashboard-financial-entries', startDateStr, endDateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_financial_entries")
        .select(`
          *,
          store:stores(name, code),
          budget:trade_budgets(name, code, total_amount, spent_amount, reserved_amount),
          campaign:trade_campaigns(name)
        `)
        .gte("entry_date", startDateStr)
        .lte("entry_date", endDateStr)
        .order("entry_date", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 3 * 60 * 1000,
  });

  // Calcular métricas de verbas - usando despesas aprovadas vinculadas a campanhas com budget
  const activeBudgetIds = new Set(verbasQuery.data?.map(v => v.id) || []);
  
  // Calcular total utilizado somando despesas aprovadas de campanhas vinculadas a verbas ativas
  const totalUtilizadoReal = (despesasQuery.data as any[])?.filter((d: any) => {
    const isApproved = ['approved', 'aprovado', 'completed', 'pago'].includes(d.status?.toLowerCase());
    const budgetId = d.campaign?.budget_id;
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

  // Calcular métricas de campanhas (incluindo financial entries)
  const financialEntries = financialEntriesQuery.data || [];
  const feApproved = financialEntries.filter((e: any) => 
    ['approved', 'aprovado', 'completed', 'pago', 'paid'].includes(e.status?.toLowerCase() || e.approval_status?.toLowerCase())
  );
  const fePending = financialEntries.filter((e: any) => 
    ['pending', 'pendente'].includes(e.status?.toLowerCase() || e.approval_status?.toLowerCase())
  );

  const feValorPago = feApproved.reduce((sum: number, e: any) => sum + (parseFloat(String(e.amount)) || 0), 0);
  const feValorPendente = fePending.reduce((sum: number, e: any) => sum + (parseFloat(String(e.amount)) || 0), 0);

  const campanhaMetrics: CampanhaMetrics = {
    qtdCampanhas: campanhasQuery.data?.length || 0,
    valorPendente: ((despesasQuery.data as any[])?.filter((d: any) => 
      ['pending', 'pendente'].includes(d.status?.toLowerCase())
    ).reduce((sum: number, d: any) => sum + (parseFloat(String(d.valor_realizado)) || 0), 0) || 0) + feValorPendente,
    valorPago: ((despesasQuery.data as any[])?.filter((d: any) => 
      ['approved', 'aprovado', 'completed', 'pago'].includes(d.status?.toLowerCase())
    ).reduce((sum: number, d: any) => sum + (parseFloat(String(d.valor_realizado)) || 0), 0) || 0) + feValorPago,
    percentualPago: 0,
  };
  const totalDespesas = campanhaMetrics.valorPendente + campanhaMetrics.valorPago;
  campanhaMetrics.percentualPago = totalDespesas > 0 
    ? (campanhaMetrics.valorPago / totalDespesas) * 100 
    : 0;

  // Calcular fluxo de caixa mensal (últimos 6 meses a partir da data de referência)
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

    // Saídas: despesas realizadas no mês (aprovadas ou pagas) + financial entries aprovadas
    const saidasCampanha = despesasQuery.data?.filter((d: any) => {
      const dDate = new Date(d.created_at);
      const isApproved = ['approved', 'aprovado', 'completed', 'pago'].includes(d.status?.toLowerCase());
      return dDate >= mesInicio && dDate <= mesFim && isApproved;
    }).reduce((sum: number, d: any) => sum + (parseFloat(String(d.valor_realizado)) || 0), 0) || 0;

    const saidasEntries = financialEntries.filter((e: any) => {
      const eDate = new Date(e.entry_date);
      const isApproved = ['approved', 'aprovado', 'completed', 'pago', 'paid'].includes(e.status?.toLowerCase() || e.approval_status?.toLowerCase());
      return eDate >= mesInicio && eDate <= mesFim && isApproved;
    }).reduce((sum: number, e: any) => sum + (parseFloat(String(e.amount)) || 0), 0);

    const saidas = saidasCampanha + saidasEntries;
    saldoAcumulado += entradas - saidas;

    fluxoCaixa.push({
      mes: mesLabel,
      entradas,
      saidas,
      saldo: saldoAcumulado,
    });
  }

  // Formatar lançamentos de campanha
  const lancamentosCampanha: Lancamento[] = lancamentosQuery.data?.map(l => {
    const expenses = l.expense as any[] || [];
    const valorPago = expenses.length > 0 
      ? expenses.reduce((sum: number, e: any) => sum + (parseFloat(String(e.valor_realizado)) || 0), 0)
      : null;
    
    return {
      id: l.id,
      cliente: (l.prospect as any)?.nome_empresa || 'Cliente não identificado',
      campanha: (l.campaign as any)?.name || 'Campanha não identificada',
      valorPedido: parseFloat(String(l.valor_pedido)) || 0,
      valorPago,
      status: l.status || 'pending',
      roi: l.roi_percentual ? parseFloat(String(l.roi_percentual)) : null,
      data: l.data_lancamento || '',
      campaign_id: l.campaign_id || undefined,
      customer_id: l.customer_id || undefined,
      evidencias: (l.evidencias as string[]) || [],
      sell_out_anterior: l.sell_out_anterior ? parseFloat(String(l.sell_out_anterior)) : undefined,
      sell_out_atual: l.sell_out_atual ? parseFloat(String(l.sell_out_atual)) : undefined,
      tipo_brinde: l.tipo_brinde || undefined,
      acoes_manuais: l.acoes_manuais || undefined,
      source: 'campaign' as const,
    };
  }) || [];

  // Formatar lançamentos financeiros diretos
  const lancamentosFinanceiros: Lancamento[] = financialEntries.map((e: any) => ({
    id: e.id,
    cliente: e.supplier_name || (e.store as any)?.name || 'Não identificado',
    campanha: (e.campaign as any)?.name || 'Lançamento direto',
    valorPedido: parseFloat(String(e.amount)) || 0,
    valorPago: ['approved', 'aprovado', 'completed', 'pago', 'paid'].includes(e.status?.toLowerCase()) 
      ? parseFloat(String(e.amount)) || 0 
      : null,
    status: e.status || e.approval_status || 'pending',
    roi: null,
    data: e.entry_date || '',
    source: 'financial_entry' as const,
    description: e.description,
    supplier_name: e.supplier_name,
    entry_type: e.entry_type,
  }));

  const lancamentos = [...lancamentosCampanha, ...lancamentosFinanceiros]
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
    .slice(0, 50);

  // Lista de despesas por campanha para o card (inclui financial entries)
  const despesasPorCampanha = (despesasQuery.data as any[])?.reduce((acc: Record<string, { pendente: number; pago: number }>, d: any) => {
    const campanha = d.campaign?.name || 'Sem campanha';
    if (!acc[campanha]) {
      acc[campanha] = { pendente: 0, pago: 0 };
    }
    const valor = parseFloat(String(d.valor_realizado)) || 0;
    if (d.status === 'pending') {
      acc[campanha].pendente += valor;
    } else {
      acc[campanha].pago += valor;
    }
    return acc;
  }, {} as Record<string, { pendente: number; pago: number }>) || {};

  // Adicionar financial entries ao despesasPorCampanha
  financialEntries.forEach((e: any) => {
    const campanha = (e.campaign as any)?.name || 'Lançamentos Diretos';
    if (!despesasPorCampanha[campanha]) {
      despesasPorCampanha[campanha] = { pendente: 0, pago: 0 };
    }
    const valor = parseFloat(String(e.amount)) || 0;
    const isPending = ['pending', 'pendente'].includes(e.status?.toLowerCase() || e.approval_status?.toLowerCase());
    if (isPending) {
      despesasPorCampanha[campanha].pendente += valor;
    } else {
      despesasPorCampanha[campanha].pago += valor;
    }
  });

  return {
    verbas: verbasQuery.data || [],
    campanhas: campanhasQuery.data || [],
    despesas: despesasQuery.data || [],
    lancamentos,
    verbaMetrics,
    campanhaMetrics,
    fluxoCaixa,
    despesasPorCampanha,
    isLoading: verbasQuery.isLoading || campanhasQuery.isLoading || despesasQuery.isLoading || lancamentosQuery.isLoading || financialEntriesQuery.isLoading,
    error: verbasQuery.error || campanhasQuery.error || despesasQuery.error || lancamentosQuery.error || financialEntriesQuery.error,
  };
}
