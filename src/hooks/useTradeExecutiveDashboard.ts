import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface ExecutiveKPIs {
  pdvsAtivos: number;
  visitasMes: number;
  fotosMes: number;
  roiMedio: number;
}

export interface CampaignSummary {
  ativas: number;
  concluidas: number;
  valorInvestido: number;
  byStatus: { status: string; count: number; color: string }[];
}

export interface MonthlyEvolution {
  mes: string;
  visitas: number;
  fotos: number;
  fotosProcessadas: number;
}

export interface TopClient {
  cliente: string;
  valor: number;
  quantidade: number;
}

export interface RecentVisit {
  id: string;
  pdv: string;
  vendedor: string;
  data: string;
  duracao: number | null;
  status: string;
  score: number | null;
}

export interface RecentPhoto {
  id: string;
  url: string;
  pdv: string;
  data: string;
  iaStatus: string | null;
  iaScore: number | null;
}

export function useTradeExecutiveDashboard() {
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthStartStr = monthStart.toISOString().split("T")[0];

  // Query para KPIs principais
  const kpisQuery = useQuery({
    queryKey: ['trade-executive-kpis'],
    queryFn: async () => {
      const [storesRes, visitsRes, photosRes, lancamentosRes] = await Promise.all([
        supabase.from("stores").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("visits").select("*", { count: "exact", head: true }).gte("scheduled_date", monthStartStr),
        supabase.from("photos").select("*", { count: "exact", head: true }).gte("upload_date", monthStartStr),
        supabase.from("trade_campaign_lancamentos").select("roi_percentual").not("roi_percentual", "is", null)
      ]);

      const roiValues = lancamentosRes.data?.map(l => parseFloat(String(l.roi_percentual)) || 0) || [];
      const roiMedio = roiValues.length > 0 ? roiValues.reduce((a, b) => a + b, 0) / roiValues.length : 0;

      return {
        pdvsAtivos: storesRes.count || 0,
        visitasMes: visitsRes.count || 0,
        fotosMes: photosRes.count || 0,
        roiMedio,
      } as ExecutiveKPIs;
    },
    staleTime: 3 * 60 * 1000,
  });

  // Query para resumo de campanhas
  const campaignsQuery = useQuery({
    queryKey: ['trade-executive-campaigns'],
    queryFn: async () => {
      const { data: campaigns, error } = await supabase
        .from("trade_campaigns")
        .select("id, status, estimated_cost")
        .is("deleted_at", null);

      if (error) throw error;

      const ativas = campaigns?.filter(c => c.status === 'active' || c.status === 'in_progress').length || 0;
      const concluidas = campaigns?.filter(c => c.status === 'completed').length || 0;
      const valorInvestido = campaigns?.reduce((sum, c) => sum + (parseFloat(String(c.estimated_cost)) || 0), 0) || 0;

      // Agrupar por status
      const statusCount: Record<string, number> = {};
      campaigns?.forEach(c => {
        const status = c.status || 'draft';
        statusCount[status] = (statusCount[status] || 0) + 1;
      });

      const statusColors: Record<string, string> = {
        active: "hsl(var(--chart-1))",
        in_progress: "hsl(var(--chart-2))",
        completed: "hsl(var(--chart-3))",
        cancelled: "hsl(var(--chart-4))",
        draft: "hsl(var(--chart-5))",
      };

      const byStatus = Object.entries(statusCount).map(([status, count]) => ({
        status,
        count,
        color: statusColors[status] || "hsl(var(--muted))",
      }));

      return {
        ativas,
        concluidas,
        valorInvestido,
        byStatus,
      } as CampaignSummary;
    },
    staleTime: 3 * 60 * 1000,
  });

  // Query para evolução mensal (últimos 6 meses)
  const evolutionQuery = useQuery({
    queryKey: ['trade-executive-evolution'],
    queryFn: async () => {
      const evolution: MonthlyEvolution[] = [];

      for (let i = 5; i >= 0; i--) {
        const mesDate = subMonths(today, i);
        const mesInicio = startOfMonth(mesDate);
        const mesFim = endOfMonth(mesDate);
        const mesLabel = format(mesDate, "MMM/yy", { locale: ptBR });

        const [visitsRes, photosRes, photosProcessedRes] = await Promise.all([
          supabase
            .from("visits")
            .select("*", { count: "exact", head: true })
            .gte("scheduled_date", mesInicio.toISOString().split("T")[0])
            .lte("scheduled_date", mesFim.toISOString().split("T")[0]),
          supabase
            .from("photos")
            .select("*", { count: "exact", head: true })
            .gte("upload_date", mesInicio.toISOString().split("T")[0])
            .lte("upload_date", mesFim.toISOString().split("T")[0]),
          supabase
            .from("photos")
            .select("*", { count: "exact", head: true })
            .gte("upload_date", mesInicio.toISOString().split("T")[0])
            .lte("upload_date", mesFim.toISOString().split("T")[0])
            .not("ai_analysis", "is", null),
        ]);

        evolution.push({
          mes: mesLabel,
          visitas: visitsRes.count || 0,
          fotos: photosRes.count || 0,
          fotosProcessadas: photosProcessedRes.count || 0,
        });
      }

      return evolution;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Query para top 10 clientes por lançamentos
  const topClientsQuery = useQuery({
    queryKey: ['trade-executive-top-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_campaign_lancamentos")
        .select(`
          customer_id,
          valor_pedido,
          prospect:prospects(nome_empresa)
        `)
        .is("deleted_at", null);

      if (error) throw error;

      // Agrupar por cliente
      const clientMap: Record<string, { valor: number; quantidade: number; nome: string }> = {};
      
      data?.forEach(l => {
        const clientId = l.customer_id;
        const nome = (l.prospect as any)?.nome_empresa || 'Cliente não identificado';
        const valor = parseFloat(String(l.valor_pedido)) || 0;

        if (!clientMap[clientId]) {
          clientMap[clientId] = { valor: 0, quantidade: 0, nome };
        }
        clientMap[clientId].valor += valor;
        clientMap[clientId].quantidade += 1;
      });

      // Ordenar e pegar top 10
      const sorted = Object.values(clientMap)
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 10);

      return sorted.map(c => ({
        cliente: c.nome,
        valor: c.valor,
        quantidade: c.quantidade,
      })) as TopClient[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Query para visitas recentes
  const visitsQuery = useQuery({
    queryKey: ['trade-executive-visits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visits")
        .select(`
          id,
          scheduled_date,
          duration_minutes,
          status,
          compliance_score,
          store:stores(name),
          vendedor:profiles!visits_vendedor_id_fkey(nome)
        `)
        .order("scheduled_date", { ascending: false })
        .limit(10);

      if (error) throw error;

      return (data || []).map(v => {
        return {
          id: v.id,
          pdv: (v.store as any)?.name || 'PDV não identificado',
          vendedor: (v.vendedor as any)?.nome || 'Vendedor não identificado',
          data: v.scheduled_date || '',
          duracao: v.duration_minutes,
          status: v.status || 'pending',
          score: v.compliance_score,
        };
      }) as RecentVisit[];
    },
    staleTime: 2 * 60 * 1000,
  });

  // Query para fotos recentes
  const photosQuery = useQuery({
    queryKey: ['trade-executive-photos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("photos")
        .select(`
          id,
          photo_url,
          upload_date,
          ai_analysis,
          store:stores(name)
        `)
        .order("upload_date", { ascending: false })
        .limit(12);

      if (error) throw error;

      return (data || []).map(p => {
        const analysis = p.ai_analysis as any;
        return {
          id: p.id,
          url: p.photo_url || '',
          pdv: (p.store as any)?.name || 'PDV não identificado',
          data: p.upload_date || '',
          iaStatus: analysis ? 'processed' : 'pending',
          iaScore: analysis?.overall_score || null,
        };
      }) as RecentPhoto[];
    },
    staleTime: 2 * 60 * 1000,
  });

  // Query para tabela de lançamentos
  const lancamentosQuery = useQuery({
    queryKey: ['trade-executive-lancamentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_campaign_lancamentos")
        .select(`
          id,
          customer_id,
          valor_pedido,
          status,
          roi_percentual,
          crescimento_percentual,
          data_lancamento,
          prospect:prospects(nome_empresa),
          campaign:trade_campaigns(name)
        `)
        .is("deleted_at", null)
        .order("data_lancamento", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    staleTime: 3 * 60 * 1000,
  });

  return {
    kpis: kpisQuery.data,
    campaigns: campaignsQuery.data,
    evolution: evolutionQuery.data,
    topClients: topClientsQuery.data,
    visits: visitsQuery.data,
    photos: photosQuery.data,
    lancamentos: lancamentosQuery.data,
    isLoading: kpisQuery.isLoading || campaignsQuery.isLoading,
    isLoadingEvolution: evolutionQuery.isLoading,
    isLoadingVisits: visitsQuery.isLoading,
    isLoadingPhotos: photosQuery.isLoading,
    isLoadingLancamentos: lancamentosQuery.isLoading,
    error: kpisQuery.error || campaignsQuery.error,
    refetchAll: () => {
      kpisQuery.refetch();
      campaignsQuery.refetch();
      evolutionQuery.refetch();
      topClientsQuery.refetch();
      visitsQuery.refetch();
      photosQuery.refetch();
      lancamentosQuery.refetch();
    },
  };
}
