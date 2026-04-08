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
import { Users, TrendingUp, Heart, Search, Info, LayoutGrid, Trophy, RefreshCw, Bot, Loader2, Brain, MapPin } from "lucide-react";
import { REGIOES, REGIOES_UFS, getUFsByRegiao } from "@/lib/constants/regioes";
import { toast } from "sonner";

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

  const loadInfluencers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("influencers")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("composite_score", { ascending: false });

      if (error) throw error;
      setInfluencers(data || []);

      // Check autopilot
      const { data: profile } = await supabase
        .from("influencer_company_profile")
        .select("autopilot_enabled")
        .eq("user_id", user.id)
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

  const availableUFs = regiaoFilter !== "all" ? (getUFsByRegiao(regiaoFilter) || []) : null;

  const filtered = influencers.filter((i) => {
    const matchesSearch =
      !search ||
      i.username.toLowerCase().includes(search.toLowerCase()) ||
      (i.display_name || "").toLowerCase().includes(search.toLowerCase());
    const matchesPlatform = platformFilter === "all" || i.platform === platformFilter;
    const matchesRegiao = regiaoFilter === "all" || i.regiao === regiaoFilter;
    const matchesUF = ufFilter === "all" || i.uf === ufFilter;
    return matchesSearch && matchesPlatform && matchesRegiao && matchesUF;
  });

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
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="flex items-center gap-2">
          Central de Inteligência de Influenciadores com ranking automático e análise por IA.
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
