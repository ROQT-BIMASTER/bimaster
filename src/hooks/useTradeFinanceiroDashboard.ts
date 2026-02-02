import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

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
  valor: number;
  status: string;
  roi: number | null;
  data: string;
}

export function useTradeFinanceiroDashboard() {
  // Query para verbas ativas
  const verbasQuery = useQuery({
    queryKey: ['trade-dashboard-verbas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_budgets")
        .select("*")
        .eq("status", "active")
        .order("period_start", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 3 * 60 * 1000,
  });

  // Query para campanhas com despesas
  const campanhasQuery = useQuery({
    queryKey: ['trade-dashboard-campanhas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_campaigns")
        .select(`
          id,
          name,
          status,
          budget_amount,
          start_date,
          end_date
        `)
        .in("status", ["active", "in_progress", "completed"])
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 3 * 60 * 1000,
  });

  // Query para despesas de campanhas
  const despesasQuery = useQuery({
    queryKey: ['trade-dashboard-despesas'],
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
          campaign:trade_campaigns(name)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 3 * 60 * 1000,
  });

  // Query para lançamentos com clientes
  const lancamentosQuery = useQuery({
    queryKey: ['trade-dashboard-lancamentos'],
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
          prospect:prospects(nome_empresa),
          campaign:trade_campaigns(name)
        `)
        .order("data_lancamento", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 3 * 60 * 1000,
  });

  // Calcular métricas de verbas
  const verbaMetrics: VerbaMetrics = {
    totalOrcado: verbasQuery.data?.reduce((sum, v) => sum + (parseFloat(String(v.total_amount)) || 0), 0) || 0,
    totalUtilizado: verbasQuery.data?.reduce((sum, v) => sum + (parseFloat(String(v.spent_amount)) || 0), 0) || 0,
    saldoDisponivel: 0,
    percentualUtilizado: 0,
  };
  verbaMetrics.saldoDisponivel = verbaMetrics.totalOrcado - verbaMetrics.totalUtilizado;
  verbaMetrics.percentualUtilizado = verbaMetrics.totalOrcado > 0
    ? (verbaMetrics.totalUtilizado / verbaMetrics.totalOrcado) * 100 
    : 0;

  // Calcular métricas de campanhas
  const campanhaMetrics: CampanhaMetrics = {
    qtdCampanhas: campanhasQuery.data?.length || 0,
    valorPendente: (despesasQuery.data as any[])?.filter((d: any) => d.status === 'pending')
      .reduce((sum: number, d: any) => sum + (parseFloat(String(d.valor_realizado)) || 0), 0) || 0,
    valorPago: (despesasQuery.data as any[])?.filter((d: any) => d.status === 'approved' || d.status === 'completed')
      .reduce((sum: number, d: any) => sum + (parseFloat(String(d.valor_realizado)) || 0), 0) || 0,
    percentualPago: 0,
  };
  const totalDespesas = campanhaMetrics.valorPendente + campanhaMetrics.valorPago;
  campanhaMetrics.percentualPago = totalDespesas > 0 
    ? (campanhaMetrics.valorPago / totalDespesas) * 100 
    : 0;

  // Calcular fluxo de caixa mensal (últimos 6 meses)
  const fluxoCaixa: FluxoCaixaItem[] = [];
  const today = new Date();
  let saldoAcumulado = 0;

  for (let i = 5; i >= 0; i--) {
    const mesDate = subMonths(today, i);
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
      return dDate >= mesInicio && dDate <= mesFim && d.status !== 'pending';
    }).reduce((sum: number, d: any) => sum + (parseFloat(String(d.valor_realizado)) || 0), 0) || 0;

    saldoAcumulado += entradas - saidas;

    fluxoCaixa.push({
      mes: mesLabel,
      entradas,
      saidas,
      saldo: saldoAcumulado,
    });
  }

  // Formatar lançamentos
  const lancamentos: Lancamento[] = lancamentosQuery.data?.map(l => ({
    id: l.id,
    cliente: (l.prospect as any)?.nome_empresa || 'Cliente não identificado',
    campanha: (l.campaign as any)?.name || 'Campanha não identificada',
    valor: parseFloat(String(l.valor_pedido)) || 0,
    status: l.status || 'pending',
    roi: l.roi_percentual ? parseFloat(String(l.roi_percentual)) : null,
    data: l.data_lancamento || '',
  })) || [];

  // Lista de despesas por campanha para o card
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

  return {
    verbas: verbasQuery.data || [],
    campanhas: campanhasQuery.data || [],
    despesas: despesasQuery.data || [],
    lancamentos,
    verbaMetrics,
    campanhaMetrics,
    fluxoCaixa,
    despesasPorCampanha,
    isLoading: verbasQuery.isLoading || campanhasQuery.isLoading || despesasQuery.isLoading || lancamentosQuery.isLoading,
    error: verbasQuery.error || campanhasQuery.error || despesasQuery.error || lancamentosQuery.error,
  };
}
