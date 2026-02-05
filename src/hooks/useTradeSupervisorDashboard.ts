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

  // Query para buscar subordinados
  const teamQuery = useQuery({
    queryKey: ["trade-supervisor-team", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase.rpc("get_subordinados", {
        _user_id: user.id,
      });

      if (error) throw error;

      const subordinadoIds = data?.map((s: { subordinado_id: string }) => s.subordinado_id) || [];
      if (subordinadoIds.length === 0) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", subordinadoIds);

      if (profilesError) throw profilesError;

      return (profiles || []) as TeamMember[];
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
  });

  const teamIds = teamQuery.data?.map((m) => m.id) || [];
  const filterIds = selectedMemberId ? [selectedMemberId] : teamIds;
  const hasTeam = filterIds.length > 0;
  const filterIdsKey = filterIds.join(",");

  // Query para KPIs principais
  const kpisQuery = useQuery({
    queryKey: ["trade-supervisor-kpis", startDateStr, endDateStr, filterIdsKey],
    queryFn: async (): Promise<ExecutiveKPIs> => {
      if (!hasTeam) {
        return { pdvsAtivos: 0, visitasMes: 0, fotosMes: 0, roiMedio: 0 };
      }

      let storesCount = 0;
      let visitsCount = 0;
      let photosCount = 0;
      const allRoiValues: number[] = [];

      for (const id of filterIds) {
        // Stores
        const storesRes = await supabase
          .from("stores")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .eq("vendedor_id", id);
        storesCount += storesRes.count || 0;

        // Visits
        const visitsRes = await supabase
          .from("visits")
          .select("id", { count: "exact", head: true })
          .eq("atribuido_por", id)
          .gte("scheduled_date", startDateStr)
          .lte("scheduled_date", endDateStr);
        visitsCount += visitsRes.count || 0;

        // Photos  
        const photosRes = await (supabase
          .from("photos")
          .select("id", { count: "exact", head: true }) as any)
          .eq("created_by", id)
          .gte("upload_date", startDateStr)
          .lte("upload_date", endDateStr);
        photosCount += photosRes.count || 0;
        
        // ROI
        const roiRes = await supabase
          .from("trade_campaign_lancamentos")
          .select("roi_percentual")
          .eq("created_by", id)
          .not("roi_percentual", "is", null);
        (roiRes.data || []).forEach((l) => {
          allRoiValues.push(parseFloat(String(l.roi_percentual)) || 0);
        });
      }

      const roiMedio = allRoiValues.length > 0 ? allRoiValues.reduce((a, b) => a + b, 0) / allRoiValues.length : 0;

      return { pdvsAtivos: storesCount, visitasMes: visitsCount, fotosMes: photosCount, roiMedio };
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

      const allLancamentos: { campaign_id: string | null; valor_pedido: number | null; status: string | null }[] = [];
      for (const id of filterIds) {
        const res = await supabase
          .from("trade_campaign_lancamentos")
          .select("campaign_id, valor_pedido, status")
          .eq("created_by", id)
          .is("deleted_at", null);
        (res.data || []).forEach((l) => allLancamentos.push(l));
      }

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

        let visitsCount = 0;
        let photosCount = 0;
        let photosProcessedCount = 0;

        for (const id of filterIds) {
          const vRes = await supabase
            .from("visits")
            .select("id", { count: "exact", head: true })
            .eq("atribuido_por", id)
            .gte("scheduled_date", mesInicioStr)
            .lte("scheduled_date", mesFimStr);
          visitsCount += vRes.count || 0;

          const pRes = await (supabase
            .from("photos")
            .select("id", { count: "exact", head: true }) as any)
            .eq("created_by", id)
            .gte("upload_date", mesInicioStr)
            .lte("upload_date", mesFimStr);
          photosCount += pRes.count || 0;
          
          const ppRes = await (supabase
            .from("photos")
            .select("id", { count: "exact", head: true }) as any)
            .eq("created_by", id)
            .gte("upload_date", mesInicioStr)
            .lte("upload_date", mesFimStr)
            .not("ai_analysis", "is", null);
          photosProcessedCount += ppRes.count || 0;
        }

        evolution.push({ mes: mesLabel, visitas: visitsCount, fotos: photosCount, fotosProcessadas: photosProcessedCount });
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

      type LancData = { customer_id: string; valor_pedido: number | null; prospect: { nome_empresa: string | null } | null };
      const allData: LancData[] = [];
      
      for (const id of filterIds) {
        const res = await supabase
          .from("trade_campaign_lancamentos")
          .select("customer_id, valor_pedido, prospect:prospects(nome_empresa)")
          .eq("created_by", id)
          .is("deleted_at", null)
          .gte("data_lancamento", startDateStr)
          .lte("data_lancamento", endDateStr);
        (res.data || []).forEach((l) => allData.push(l as LancData));
      }

      const clientMap: Record<string, { valor: number; quantidade: number; nome: string }> = {};
      allData.forEach((l) => {
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

      type VisitData = { id: string; scheduled_date: string | null; duration_minutes: number | null; status: string | null; compliance_score: number | null; store: { name: string | null } | null; atribuidor: { nome: string | null } | null };
      const allData: VisitData[] = [];
      
      for (const id of filterIds) {
        const res = await supabase
          .from("visits")
          .select("id, scheduled_date, duration_minutes, status, compliance_score, store:stores(name), atribuidor:profiles!visits_atribuido_por_fkey(nome)")
          .eq("atribuido_por", id)
          .gte("scheduled_date", startDateStr)
          .lte("scheduled_date", endDateStr)
          .order("scheduled_date", { ascending: false })
          .limit(10);
        (res.data || []).forEach((v) => allData.push(v as VisitData));
      }

      return allData
        .sort((a, b) => new Date(b.scheduled_date || 0).getTime() - new Date(a.scheduled_date || 0).getTime())
        .slice(0, 10)
        .map((v) => ({
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

      type PhotoData = { id: string; photo_url: string | null; upload_date: string | null; ai_analysis: unknown; store: { name: string | null } | null };
      const allData: PhotoData[] = [];
      
      for (const id of filterIds) {
        const res = await (supabase
          .from("photos")
          .select("id, photo_url, upload_date, ai_analysis, store:stores(name)") as any)
          .eq("created_by", id)
          .gte("upload_date", startDateStr)
          .lte("upload_date", endDateStr)
          .order("upload_date", { ascending: false })
          .limit(12);
        (res.data || []).forEach((p: any) => allData.push(p as PhotoData));
      }

      return allData
        .sort((a, b) => new Date(b.upload_date || 0).getTime() - new Date(a.upload_date || 0).getTime())
        .slice(0, 12)
        .map((p) => {
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

      const allData: unknown[] = [];
      for (const id of filterIds) {
        const res = await supabase
          .from("trade_campaign_lancamentos")
          .select("id, customer_id, valor_pedido, status, roi_percentual, crescimento_percentual, data_lancamento, prospect:prospects(nome_empresa, categoria), campaign:trade_campaigns(name)")
          .eq("created_by", id)
          .is("deleted_at", null)
          .gte("data_lancamento", startDateStr)
          .lte("data_lancamento", endDateStr)
          .order("data_lancamento", { ascending: false })
          .limit(50);
        (res.data || []).forEach((l) => allData.push(l));
      }

      return allData.sort((a: any, b: any) => new Date(b.data_lancamento).getTime() - new Date(a.data_lancamento).getTime()).slice(0, 50);
    },
    enabled: hasTeam,
    staleTime: 3 * 60 * 1000,
  });

  // Query para distribuição por curva
  const curvaDistribuicaoQuery = useQuery({
    queryKey: ["trade-supervisor-curva", startDateStr, endDateStr, filterIdsKey],
    queryFn: async () => {
      if (!hasTeam) return [];

      type CurvaData = { id: string; valor_pedido: number | null; prospect: { categoria: string | null } | null };
      const allData: CurvaData[] = [];
      
      for (const id of filterIds) {
        const res = await supabase
          .from("trade_campaign_lancamentos")
          .select("id, valor_pedido, prospect:prospects(categoria)")
          .eq("created_by", id)
          .is("deleted_at", null)
          .gte("data_lancamento", startDateStr)
          .lte("data_lancamento", endDateStr);
        (res.data || []).forEach((l) => allData.push(l as CurvaData));
      }

      const curvaMap: Record<string, { count: number; valor: number }> = {
        A: { count: 0, valor: 0 },
        B: { count: 0, valor: 0 },
        C: { count: 0, valor: 0 },
        D: { count: 0, valor: 0 },
        "Não classificado": { count: 0, valor: 0 },
      };

      allData.forEach((l) => {
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
    team: teamQuery.data,
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
