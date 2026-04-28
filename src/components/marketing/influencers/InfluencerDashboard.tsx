import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { InfluencerProfileCard } from "./InfluencerProfileCard";
import { AddInfluencerDialog } from "./AddInfluencerDialog";
import { InfluencerDiscovery } from "./InfluencerDiscovery";
import { InfluencerRecommendation } from "./InfluencerRecommendation";
import { CompanyProfileDrawer } from "./CompanyProfileDrawer";
import { InfluencerRankingPanel } from "./InfluencerRankingPanel";
import { AIOpportunitiesPanel } from "./AIOpportunitiesPanel";
import { ContentIntelligencePanel } from "./ContentIntelligencePanel";
import { AutopilotMiningPanel } from "./AutopilotMiningPanel";
import { InfluencerSuggestionsPanel } from "./InfluencerSuggestionsPanel";
import { RegionalPerformancePanel } from "./RegionalPerformancePanel";
import { Users, TrendingUp, Heart, Search, Info, LayoutGrid, Trophy, RefreshCw, Bot, Loader2, Brain, MapPin, Sparkles, BadgeCheck } from "lucide-react";
import { REGIOES, REGIOES_UFS, getUFsByRegiao } from "@/lib/constants/regioes";
import { toast } from "sonner";
import { PaineisTabs } from "./paineis/PaineisTabs";
import { usePaineisInfluencers } from "./paineis/usePaineisInfluencers";
import { aplicarFiltrosPainel, type PainelFiltros } from "./paineis/painelFilters";

interface Influencer {
  id: string;
  platform: string;
  username: string;
  display_name: string | null;
  profile_url: string | null;
  avatar_url: string | null;
  followers_count: number;
  engagement_rate: number;
  avg_likes: number;
  avg_comments: number;
  fraud_score: number | null;
  status: string;
  notes: string | null;
  composite_score?: number;
  rank_position?: number;
  opportunity_score?: number;
  regiao?: string | null;
  uf?: string | null;
  marca?: string | null;
  nicho?: string | null;
}

type ViewMode = "grid" | "ranking" | "regional";

export function InfluencerDashboard() {
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [regiaoFilter, setRegiaoFilter] = useState("all");
  const [ufFilter, setUfFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("ranking");
  const [autopilotEnabled, setAutopilotEnabled] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [refreshingData, setRefreshingData] = useState(false);
  const [syncingApify, setSyncingApify] = useState(false);
  const [enrichBatchId, setEnrichBatchId] = useState<string | null>(null);
  const [enrichTotal, setEnrichTotal] = useState(0);
  const [enrichDone, setEnrichDone] = useState(0);
  const { painelAtivo } = usePaineisInfluencers();

  const loadInfluencers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Escopo de equipe Marketing — RLS controla a visibilidade
      const { data, error } = await supabase
        .from("influencers")
        .select("*")
        .eq("status", "active")
        .order("composite_score", { ascending: false });

      if (error) throw error;
      setInfluencers(data || []);

      // Autopilot: pega qualquer perfil ativo da equipe (compartilhado)
      const { data: profile } = await supabase
        .from("influencer_company_profile")
        .select("autopilot_enabled")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (profile) setAutopilotEnabled(profile.autopilot_enabled || false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInfluencers();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("influencers")
        .update({ status: "inactive" })
        .eq("id", id);
      if (error) throw error;
      toast.success("Influenciador removido");
      loadInfluencers();
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke("influencer-autopilot", {
        body: { action: "calculate_scores" },
      });
      if (error) throw error;
      toast.success(`Ranking recalculado — ${data?.data?.updated || 0} influenciadores`);
      loadInfluencers();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao recalcular ranking");
    } finally {
      setRecalculating(false);
    }
  };

  const handleRefreshData = async () => {
    setRefreshingData(true);
    toast.info("Atualizando dados via IA... isso pode levar alguns minutos.");
    try {
      const { data, error } = await supabase.functions.invoke("influencer-autopilot", {
        body: { action: "refresh_all_data" },
      });
      if (error) throw error;
      const updated = data?.data?.updated || 0;
      const total = data?.data?.total_influencers || 0;
      toast.success(`${updated} de ${total} influenciadores atualizados com dados da web`);
      loadInfluencers();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar dados dos influenciadores");
    } finally {
      setRefreshingData(false);
    }
  };

  const handleBulkApifySync = async () => {
    // Sincroniza até 25 perfis Instagram/TikTok visíveis (limite do edge)
    const eligible = filtered
      .filter((i) => ["instagram", "tiktok"].includes(i.platform))
      .slice(0, 25)
      .map((i) => i.id);
    if (eligible.length === 0) {
      toast.info("Nenhum perfil Instagram/TikTok elegível na visão atual.");
      return;
    }
    setSyncingApify(true);
    toast.info(`Sincronizando ${eligible.length} perfil(is) via fonte oficial...`);
    try {
      const { data, error } = await supabase.functions.invoke("apify-sync-influencer", {
        body: { influencer_ids: eligible },
      });
      if (error) throw error;
      const s = data?.data?.summary;
      toast.success(`${s?.succeeded || 0}/${s?.total || 0} atualizados · ${s?.posts_upserted || 0} posts coletados`);
      loadInfluencers();
    } catch (err) {
      console.error(err);
      toast.error("Erro na sincronização em massa");
    } finally {
      setSyncingApify(false);
    }
  };

  const handleEnrichAll = async () => {
    const ok = window.confirm(`Enriquecer todos os influenciadores ativos via Apify? Isso atualizará foto de perfil, bio, métricas e posts recentes. Pode consumir várias execuções de scraping.`);
    if (!ok) return;
    try {
      const { data, error } = await supabase.functions.invoke("apify-bulk-enrich", {
        body: {},
      });
      if (error) throw error;
      const batch = data?.data?.batch_id;
      const total = data?.data?.total ?? 0;
      if (!batch || total === 0) {
        toast.info(data?.data?.message || "Nada para processar");
        return;
      }
      setEnrichBatchId(batch);
      setEnrichTotal(total);
      setEnrichDone(0);
      toast.success(`Enriquecimento iniciado · ${total} perfis em fila`);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao iniciar enriquecimento em lote");
    }
  };

  // Polling do progresso do batch de enrich
  useEffect(() => {
    if (!enrichBatchId) return;
    const tick = async () => {
      const { data } = await supabase
        .from("apify_run_log")
        .select("actor_id,status")
        .eq("batch_id", enrichBatchId);
      const items = (data || []).filter((r: any) => r.actor_id === "bulk-enrich:item");
      const done = items.length;
      setEnrichDone(done);
      const finished = (data || []).some((r: any) => r.actor_id === "bulk-enrich:done");
      if (finished || done >= enrichTotal) {
        toast.success(`Enriquecimento concluído · ${done}/${enrichTotal}`);
        setEnrichBatchId(null);
        loadInfluencers();
      }
    };
    const id = setInterval(tick, 4000);
    tick();
    return () => clearInterval(id);
  }, [enrichBatchId, enrichTotal]);

  // Filtros locais (UI) — somados sobre os filtros do painel ativo
  const filtrosLocais: PainelFiltros = {
    busca: search || undefined,
    plataformas: platformFilter !== "all" ? [platformFilter] : undefined,
    regioes: regiaoFilter !== "all" ? [regiaoFilter] : undefined,
    ufs: ufFilter !== "all" ? [ufFilter] : undefined,
  };
  const baseDoPainel = aplicarFiltrosPainel(influencers, painelAtivo?.filtros);
  const filtered = aplicarFiltrosPainel(baseDoPainel, filtrosLocais);

  const totalFollowers = influencers.reduce((s, i) => s + i.followers_count, 0);
  const avgEngagement =
    influencers.length > 0
      ? influencers.reduce((s, i) => s + Number(i.engagement_rate), 0) / influencers.length
      : 0;
  const avgScore =
    influencers.length > 0
      ? influencers.reduce((s, i) => s + (i.composite_score || 0), 0) / influencers.length
      : 0;

  return (
    <div className="space-y-6">
      <PaineisTabs filtrosAtuais={filtrosLocais} />

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="flex items-center gap-2">
          {painelAtivo
            ? `Painel: ${painelAtivo.nome}${painelAtivo.descricao ? ` — ${painelAtivo.descricao}` : ""}`
            : "Central de Inteligência de Influenciadores com ranking automático e análise por IA."}
          {autopilotEnabled && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 animate-pulse">
              <Bot className="h-3 w-3 mr-1" />
              Autopilot ON
            </Badge>
          )}
        </AlertDescription>
      </Alert>

      {/* AI Opportunities Panel */}
      <AIOpportunitiesPanel influencerCount={influencers.length} onRefresh={loadInfluencers} />

      {/* Content Intelligence Panel */}
      <ContentIntelligencePanel />

      {/* Autopilot Mining Panel */}
      {autopilotEnabled && <AutopilotMiningPanel />}

      {/* Influencer Suggestions Panel */}
      {autopilotEnabled && <InfluencerSuggestionsPanel onApproved={loadInfluencers} />}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Influenciadores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{influencers.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Alcance Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">
                {totalFollowers >= 1_000_000
                  ? `${(totalFollowers / 1_000_000).toFixed(1)}M`
                  : totalFollowers >= 1_000
                  ? `${(totalFollowers / 1_000).toFixed(1)}K`
                  : totalFollowers}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Engajamento Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{avgEngagement.toFixed(2)}%</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Score Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{avgScore.toFixed(0)}</span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Actions */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar influenciador..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Plataforma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="twitter">Twitter / X</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
            </SelectContent>
          </Select>
          <Select value={regiaoFilter} onValueChange={(v) => { setRegiaoFilter(v); setUfFilter("all"); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Região" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Regiões</SelectItem>
              {REGIOES.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={ufFilter} onValueChange={setUfFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="UF" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos UFs</SelectItem>
              {(availableUFs || Object.values(REGIOES_UFS).flat().sort()).map((uf) => (
                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* View toggle */}
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === "ranking" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("ranking")}
              className="rounded-r-none"
            >
              <Trophy className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "regional" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("regional")}
            >
              <MapPin className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="rounded-l-none"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={handleBulkApifySync} disabled={syncingApify}>
            {syncingApify ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <BadgeCheck className="h-4 w-4 mr-1" />}
            {syncingApify ? "Sincronizando..." : "Sync via Fonte Oficial"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleRefreshData} disabled={refreshingData}>
            {refreshingData ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
            {refreshingData ? "Atualizando..." : "Atualizar Dados (IA)"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleRecalculate} disabled={recalculating}>
            {recalculating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Recalcular
          </Button>
          <CompanyProfileDrawer autopilotEnabled={autopilotEnabled} onAutopilotChange={setAutopilotEnabled} />
          <InfluencerRecommendation />
          <InfluencerDiscovery onAdded={loadInfluencers} />
          <AddInfluencerDialog onAdded={loadInfluencers} />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <p className="text-muted-foreground text-center py-8">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          Nenhum influenciador encontrado. Use o botão acima para adicionar.
        </p>
      ) : viewMode === "ranking" ? (
        <InfluencerRankingPanel influencers={filtered} />
      ) : viewMode === "regional" ? (
        <RegionalPerformancePanel influencers={influencers} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((inf) => (
            <InfluencerProfileCard
              key={inf.id}
              influencer={inf}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
