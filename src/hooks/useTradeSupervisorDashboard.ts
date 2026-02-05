import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import type {
  DateRangeFilter,
  ExecutiveKPIs,
  CampaignSummary,
  MonthlyEvolution,
  TopClient,
  RecentVisit,
  RecentPhoto,
  DatePreset,
} from "./useTradeExecutiveDashboard";

export { getDateRangeFromPreset } from "./useTradeExecutiveDashboard";
export type { DatePreset, DateRangeFilter };

export interface TeamMember {
  id: string;
  nome: string;
  email: string;
  supervisor_id: string | null;
  supervisor_nome: string | null;
}

export interface TeamHierarchy {
  supervisor: {
    id: string;
    nome: string;
  } | null;
  members: TeamMember[];
}

export function useTradeSupervisorDashboard(
  dateRange?: DateRangeFilter,
  selectedMemberId?: string | null
) {
  const { user } = useAuth();
  const today = new Date();
  const startDate = dateRange?.from || startOfMonth(today);
  const endDate = dateRange?.to || today;

  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];

  // Query para buscar APENAS subordinados diretos (supervisor_id = user.id)
  const teamQuery = useQuery({
    queryKey: ["trade-supervisor-team", user?.id],
    queryFn: async () => {
      if (!user?.id) return { flat: [], hierarchy: [] };

      // Buscar APENAS subordinados diretos do usuário atual
      const { data: profiles, error: profilesError } = await (supabase
        .from("profiles")
        .select("id, nome, email, supervisor_id") as any)
        .eq("supervisor_id", user.id)
        .eq("ativo", true);

      if (profilesError) throw profilesError;

      const allProfiles = profiles || [];
      if (allProfiles.length === 0) return { flat: [], hierarchy: [] };

      // Criar lista flat (todos são diretos do usuário atual)
      const flat: TeamMember[] = allProfiles
        .map(p => ({
          id: p.id,
          nome: p.nome,
          email: p.email,
          supervisor_id: p.supervisor_id,
          supervisor_nome: null, // Todos reportam diretamente ao usuário logado
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome));

      // Hierarquia simples - todos são diretos
      const hierarchy: TeamHierarchy[] = [{
        supervisor: null,
        members: flat,
      }];

      return { flat, hierarchy };
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
  });

  const teamFlat = teamQuery.data?.flat || [];
  const teamHierarchy = teamQuery.data?.hierarchy || [];
  const teamIds = teamFlat.map((m) => m.id);
  const filterIds = selectedMemberId ? [selectedMemberId] : teamIds;
  const hasTeam = filterIds.length > 0;
  const filterIdsKey = filterIds.join(",");

  // Query para KPIs principais - usando .in() para eficiência
  const kpisQuery = useQuery({
    queryKey: ["trade-supervisor-kpis", startDateStr, endDateStr, filterIdsKey],
    queryFn: async (): Promise<ExecutiveKPIs> => {
      if (!hasTeam) {
        return { pdvsAtivos: 0, visitasMes: 0, fotosMes: 0, roiMedio: 0 };
      }

      // Stores - usando .in() para buscar todos de uma vez
      const storesRes = await supabase
        .from("stores")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .in("vendedor_id", filterIds);
      
      // Visits - usando .in()
      const visitsRes = await supabase
        .from("visits")
        .select("id", { count: "exact", head: true })
        .in("atribuido_por", filterIds)
        .gte("scheduled_date", startDateStr)
        .lte("scheduled_date", endDateStr);

      // Photos - usando .in() com vendedor_id
      const photosRes = await (supabase
        .from("photos")
        .select("id", { count: "exact", head: true }) as any)
        .in("vendedor_id", filterIds)
        .gte("upload_date", startDateStr)
        .lte("upload_date", endDateStr);
        
      // ROI - usando .in()
      const roiRes = await supabase
        .from("trade_campaign_lancamentos")
        .select("roi_percentual")
        .in("created_by", filterIds)
        .not("roi_percentual", "is", null);
      
      const roiValues = (roiRes.data || []).map(l => parseFloat(String(l.roi_percentual)) || 0);
      const roiMedio = roiValues.length > 0 ? roiValues.reduce((a, b) => a + b, 0) / roiValues.length : 0;

      return { 
        pdvsAtivos: storesRes.count || 0, 
        visitasMes: visitsRes.count || 0, 
        fotosMes: photosRes.count || 0, 
        roiMedio 
      };
    },
    enabled: hasTeam,
    staleTime: 3 * 60 * 1000,
  });

  // Query para resumo de campanhas
  const campaignsQuery = useQuery({
    queryKey: ["trade-supervisor-campaigns", filterIdsKey],
    queryFn: async (): Promise<CampaignSummary> => {
      if (!hasTeam) {
        return { ativas: 0, concluidas: 0, valorInvestido: 0, byStatus: [] };
      }

      const res = await supabase
        .from("trade_campaign_lancamentos")
        .select("campaign_id, valor_pedido, status")
        .in("created_by", filterIds)
        .is("deleted_at", null);
      
      const allLancamentos = res.data || [];

      const valorInvestido = allLancamentos.reduce((sum, l) => sum + (parseFloat(String(l.valor_pedido)) || 0), 0);
      const statusCount: Record<string, number> = {};
      allLancamentos.forEach((l) => {
        const status = l.status || "pending";
        statusCount[status] = (statusCount[status] || 0) + 1;
      });

      const statusColors: Record<string, string> = {
        approved: "hsl(var(--chart-1))",
        pending: "hsl(var(--chart-5))",
        completed: "hsl(var(--chart-3))",
        pago: "hsl(var(--chart-3))",
        cancelled: "hsl(var(--chart-4))",
      };

      return {
        ativas: statusCount["pending"] || 0,
        concluidas: (statusCount["approved"] || 0) + (statusCount["pago"] || 0),
        valorInvestido,
        byStatus: Object.entries(statusCount).map(([status, count]) => ({
          status,
          count,
          color: statusColors[status] || "hsl(var(--muted))",
        })),
      };
    },
    enabled: hasTeam,
    staleTime: 3 * 60 * 1000,
  });

  // Query para evolução mensal
  const evolutionQuery = useQuery({
    queryKey: ["trade-supervisor-evolution", endDateStr, filterIdsKey],
    queryFn: async (): Promise<MonthlyEvolution[]> => {
      if (!hasTeam) return [];

      const evolution: MonthlyEvolution[] = [];

      for (let i = 5; i >= 0; i--) {
        const mesDate = subMonths(endDate, i);
        const mesInicio = startOfMonth(mesDate);
        const mesFim = endOfMonth(mesDate);
        const mesLabel = format(mesDate, "MMM/yy", { locale: ptBR });
        const mesInicioStr = mesInicio.toISOString().split("T")[0];
        const mesFimStr = mesFim.toISOString().split("T")[0];

        const [vRes, pRes, ppRes] = await Promise.all([
          supabase
            .from("visits")
            .select("id", { count: "exact", head: true })
            .in("atribuido_por", filterIds)
            .gte("scheduled_date", mesInicioStr)
            .lte("scheduled_date", mesFimStr),
          (supabase
            .from("photos")
            .select("id", { count: "exact", head: true }) as any)
            .in("vendedor_id", filterIds)
            .gte("upload_date", mesInicioStr)
            .lte("upload_date", mesFimStr),
          (supabase
            .from("photos")
            .select("id", { count: "exact", head: true }) as any)
            .in("vendedor_id", filterIds)
            .gte("upload_date", mesInicioStr)
            .lte("upload_date", mesFimStr)
            .not("ai_analysis", "is", null),
        ]);

        evolution.push({ 
          mes: mesLabel, 
          visitas: vRes.count || 0, 
          fotos: pRes.count || 0, 
          fotosProcessadas: ppRes.count || 0 
        });
      }

      return evolution;
    },
    enabled: hasTeam,
    staleTime: 5 * 60 * 1000,
  });

  // Query para top 10 clientes
  const topClientsQuery = useQuery({
    queryKey: ["trade-supervisor-top-clients", startDateStr, endDateStr, filterIdsKey],
    queryFn: async (): Promise<TopClient[]> => {
      if (!hasTeam) return [];

      const res = await supabase
        .from("trade_campaign_lancamentos")
        .select("customer_id, valor_pedido, prospect:prospects(nome_empresa)")
        .in("created_by", filterIds)
        .is("deleted_at", null)
        .gte("data_lancamento", startDateStr)
        .lte("data_lancamento", endDateStr);
      
      const allData = res.data || [];

      const clientMap: Record<string, { valor: number; quantidade: number; nome: string }> = {};
      allData.forEach((l: any) => {
        const clientId = l.customer_id;
        const nome = l.prospect?.nome_empresa || "Cliente não identificado";
        const valor = parseFloat(String(l.valor_pedido)) || 0;
        if (!clientMap[clientId]) clientMap[clientId] = { valor: 0, quantidade: 0, nome };
        clientMap[clientId].valor += valor;
        clientMap[clientId].quantidade += 1;
      });

      return Object.values(clientMap)
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 10)
        .map((c) => ({ cliente: c.nome, valor: c.valor, quantidade: c.quantidade }));
    },
    enabled: hasTeam,
    staleTime: 5 * 60 * 1000,
  });

  // Query para visitas recentes
  const visitsQuery = useQuery({
    queryKey: ["trade-supervisor-visits", startDateStr, endDateStr, filterIdsKey],
    queryFn: async (): Promise<RecentVisit[]> => {
      if (!hasTeam) return [];

      const res = await supabase
        .from("visits")
        .select("id, scheduled_date, duration_minutes, status, compliance_score, store:stores(name), atribuidor:profiles!visits_atribuido_por_fkey(nome)")
        .in("atribuido_por", filterIds)
        .gte("scheduled_date", startDateStr)
        .lte("scheduled_date", endDateStr)
        .order("scheduled_date", { ascending: false })
        .limit(20);
      
      const allData = res.data || [];

      return allData.map((v: any) => ({
        id: v.id,
        pdv: v.store?.name || "PDV não identificado",
        vendedor: v.atribuidor?.nome || "Vendedor não identificado",
        data: v.scheduled_date || "",
        duracao: v.duration_minutes,
        status: v.status || "pending",
        score: v.compliance_score,
      }));
    },
    enabled: hasTeam,
    staleTime: 2 * 60 * 1000,
  });

  // Query para fotos recentes
  const photosQuery = useQuery({
    queryKey: ["trade-supervisor-photos", startDateStr, endDateStr, filterIdsKey],
    queryFn: async (): Promise<RecentPhoto[]> => {
      if (!hasTeam) return [];

      const res = await (supabase
        .from("photos")
        .select("id, photo_url, upload_date, ai_analysis, store:stores(name)") as any)
        .in("vendedor_id", filterIds)
        .gte("upload_date", startDateStr)
        .lte("upload_date", endDateStr)
        .order("upload_date", { ascending: false })
        .limit(12);
      
      const allData = res.data || [];

      return allData.map((p: any) => {
        const analysis = p.ai_analysis as { overall_score?: number } | null;
        return {
          id: p.id,
          url: p.photo_url || "",
          pdv: p.store?.name || "PDV não identificado",
          data: p.upload_date || "",
          iaStatus: analysis ? "processed" : "pending",
          iaScore: analysis?.overall_score || null,
        };
      });
    },
    enabled: hasTeam,
    staleTime: 2 * 60 * 1000,
  });

  // Query para lançamentos
  const lancamentosQuery = useQuery({
    queryKey: ["trade-supervisor-lancamentos", startDateStr, endDateStr, filterIdsKey],
    queryFn: async () => {
      if (!hasTeam) return [];

      const res = await supabase
        .from("trade_campaign_lancamentos")
        .select("id, customer_id, valor_pedido, status, roi_percentual, crescimento_percentual, data_lancamento, prospect:prospects(nome_empresa, categoria), campaign:trade_campaigns(name)")
        .in("created_by", filterIds)
        .is("deleted_at", null)
        .gte("data_lancamento", startDateStr)
        .lte("data_lancamento", endDateStr)
        .order("data_lancamento", { ascending: false })
        .limit(50);

      return res.data || [];
    },
    enabled: hasTeam,
    staleTime: 3 * 60 * 1000,
  });

  // Query para distribuição por curva
  const curvaDistribuicaoQuery = useQuery({
    queryKey: ["trade-supervisor-curva", startDateStr, endDateStr, filterIdsKey],
    queryFn: async () => {
      if (!hasTeam) return [];

      const res = await supabase
        .from("trade_campaign_lancamentos")
        .select("id, valor_pedido, prospect:prospects(categoria)")
        .in("created_by", filterIds)
        .is("deleted_at", null)
        .gte("data_lancamento", startDateStr)
        .lte("data_lancamento", endDateStr);
      
      const allData = res.data || [];

      const curvaMap: Record<string, { count: number; valor: number }> = {
        A: { count: 0, valor: 0 },
        B: { count: 0, valor: 0 },
        C: { count: 0, valor: 0 },
        D: { count: 0, valor: 0 },
        "Não classificado": { count: 0, valor: 0 },
      };

      allData.forEach((l: any) => {
        const curva = l.prospect?.categoria || "Não classificado";
        const curvaKey = ["A", "B", "C", "D"].includes(curva) ? curva : "Não classificado";
        const valor = parseFloat(String(l.valor_pedido)) || 0;
        curvaMap[curvaKey].count += 1;
        curvaMap[curvaKey].valor += valor;
      });

      return Object.entries(curvaMap)
        .filter(([_, d]) => d.count > 0)
        .map(([curva, d]) => ({ curva, count: d.count, valor: d.valor }));
    },
    enabled: hasTeam,
    staleTime: 3 * 60 * 1000,
  });

  return {
    team: teamFlat,
    teamHierarchy,
    isLoadingTeam: teamQuery.isLoading,
    kpis: kpisQuery.data,
    campaigns: campaignsQuery.data,
    evolution: evolutionQuery.data,
    topClients: topClientsQuery.data,
    visits: visitsQuery.data,
    photos: photosQuery.data,
    lancamentos: lancamentosQuery.data,
    curvaDistribuicao: curvaDistribuicaoQuery.data,
    isLoading: kpisQuery.isLoading || campaignsQuery.isLoading || teamQuery.isLoading,
    isLoadingEvolution: evolutionQuery.isLoading,
    isLoadingVisits: visitsQuery.isLoading,
    isLoadingPhotos: photosQuery.isLoading,
    isLoadingLancamentos: lancamentosQuery.isLoading,
    isLoadingCurva: curvaDistribuicaoQuery.isLoading,
    error: kpisQuery.error || campaignsQuery.error || teamQuery.error,
    refetchAll: () => {
      teamQuery.refetch();
      kpisQuery.refetch();
      campaignsQuery.refetch();
      evolutionQuery.refetch();
      topClientsQuery.refetch();
      visitsQuery.refetch();
      photosQuery.refetch();
      lancamentosQuery.refetch();
      curvaDistribuicaoQuery.refetch();
    },
  };
}
