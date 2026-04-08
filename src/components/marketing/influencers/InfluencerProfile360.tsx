import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfluencerAvatar } from "./InfluencerAvatar";
import { Progress } from "@/components/ui/progress";
import {
  Users, TrendingUp, Heart, MessageCircle, Shield, Sparkles,
  Loader2, AlertTriangle, CheckCircle, ThumbsUp, ThumbsDown, Minus,
  BarChart3, FileText, RefreshCw, ExternalLink, DollarSign, Globe,
  Newspaper, ShieldAlert, Zap, Star, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PostDetailDialog } from "./PostDetailDialog";
import { getPostMediaSource } from "@/lib/utils/post-media";
import { useResolvePostMedia } from "@/hooks/useResolvePostMedia";
import { CommentsHighlightsSection } from "./CommentsHighlightsSection";
import { AudienceProfileSection } from "./AudienceProfileSection";


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
}

interface Props {
  influencer: Influencer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function InfluencerProfile360({ influencer, open, onOpenChange }: Props) {
  const [posts, setPosts] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [income, setIncome] = useState<any[]>([]);
  const [audience, setAudience] = useState<any>(null);
  const [reputation, setReputation] = useState<any>(null);
  const [reputationHistory, setReputationHistory] = useState<any[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingIncome, setLoadingIncome] = useState(false);
  const [loadingAudience, setLoadingAudience] = useState(false);
  const [loadingReputation, setLoadingReputation] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const loadReputationHistory = async () => {
    const { data } = await supabase
      .from("influencer_analyses")
      .select("*")
      .eq("influencer_id", influencer.id)
      .eq("analysis_type", "reputation")
      .order("created_at", { ascending: false });
    if (data && data.length > 0) {
      setReputationHistory(data);
      // Set latest as current reputation if not already set
      if (!reputation) {
        setReputation((data[0].result as any));
      }
    }
  };

  useEffect(() => {
    if (open) {
      loadPosts();
      loadLatestAnalysis();
      loadIncome();
      loadReputationHistory();
    }
  }, [open, influencer.id]);

  const loadPosts = async () => {
    const { data } = await supabase
      .from("influencer_posts")
      .select("*")
      .eq("influencer_id", influencer.id)
      .order("posted_at", { ascending: false })
      .limit(30);
    setPosts(data || []);
  };

  const loadLatestAnalysis = async () => {
    const { data } = await supabase
      .from("influencer_analyses")
      .select("*")
      .eq("influencer_id", influencer.id)
      .eq("analysis_type", "full_360")
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      setAnalysis(data[0].result);
      // Load reputation from analysis if available
      const result = data[0].result as any;
      if (result?.reputation_analysis) {
        setReputation(result.reputation_analysis);
      }
    }
  };

  const loadIncome = async () => {
    const { data } = await supabase
      .from("influencer_income")
      .select("*")
      .eq("influencer_id", influencer.id)
      .order("transaction_date", { ascending: false })
      .limit(50);
    setIncome(data || []);
  };

  const handleFetchContent = async () => {
    setLoadingContent(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-influencer-content", {
        body: { influencer_id: influencer.id },
      });
      if (error) throw error;
      toast.success(`${data?.data?.posts_saved || 0} posts coletados (fonte: ${data?.data?.source})`);
      loadPosts();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao coletar conteúdo");
    } finally {
      setLoadingContent(false);
    }
  };

  const handleAnalyze360 = async () => {
    setLoadingAnalysis(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-influencer", {
        body: { influencer_id: influencer.id, analysis_type: "full_360" },
      });
      if (error) throw error;
      setAnalysis(data?.data);
      if (data?.data?.reputation_analysis) {
        setReputation(data.data.reputation_analysis);
      }
      toast.success("Análise 360° concluída!");
    } catch (err) {
      console.error(err);
      toast.error("Erro na análise");
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleResearchReputation = async () => {
    setLoadingReputation(true);
    try {
      const { data, error } = await supabase.functions.invoke("research-influencer-reputation", {
        body: {
          platform: influencer.platform,
          username: influencer.username,
          display_name: influencer.display_name,
          influencer_id: influencer.id,
        },
      });
      if (error) throw error;
      setReputation(data?.data);
      // Reload history after new research
      loadReputationHistory();
      toast.success("Pesquisa de reputação concluída!");
    } catch (err: any) {
      console.error(err);
      if (err?.message?.includes("429")) {
        toast.error("Limite de requisições excedido, tente novamente em breve");
      } else if (err?.message?.includes("402")) {
        toast.error("Créditos insuficientes. Adicione créditos em Settings > Workspace > Usage");
      } else {
        toast.error("Erro na pesquisa de reputação");
      }
    } finally {
      setLoadingReputation(false);
    }
  };

  const handleFetchAudience = async () => {
    setLoadingAudience(true);
    try {
      const { data, error } = await supabase.functions.invoke("phyllo-proxy", {
        body: { action: "search_creators", platform: influencer.platform === "twitter" ? "X" : influencer.platform.charAt(0).toUpperCase() + influencer.platform.slice(1), username: influencer.username },
      });
      if (error) throw error;
      const creators = data?.data?.data || [];
      if (creators.length > 0 && creators[0].account_id) {
        const { data: audData, error: audErr } = await supabase.functions.invoke("phyllo-proxy", {
          body: { action: "get_audience", account_id: creators[0].account_id },
        });
        if (!audErr && audData?.data) {
          setAudience(audData.data);
          toast.success("Dados de audiência carregados!");
        }
      } else {
        toast.info("Perfil não encontrado no Phyllo para dados demográficos");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao buscar audiência");
    } finally {
      setLoadingAudience(false);
    }
  };

  const handleFetchIncome = async () => {
    setLoadingIncome(true);
    try {
      const { data, error } = await supabase.functions.invoke("phyllo-proxy", {
        body: { action: "search_creators", platform: influencer.platform === "twitter" ? "X" : influencer.platform.charAt(0).toUpperCase() + influencer.platform.slice(1), username: influencer.username },
      });
      if (error) throw error;
      const creators = data?.data?.data || [];
      if (creators.length > 0 && creators[0].account_id) {
        const { data: incData } = await supabase.functions.invoke("phyllo-proxy", {
          body: { action: "get_income", account_id: creators[0].account_id, limit: 50 },
        });
        if (incData?.data?.data) {
          const { data: { user } } = await supabase.auth.getUser();
          for (const tx of incData.data.data) {
            await supabase.from("influencer_income").insert({
              influencer_id: influencer.id,
              user_id: user!.id,
              platform: influencer.platform,
              transaction_type: tx.type || "earning",
              amount: tx.amount || 0,
              currency: tx.currency || "USD",
              description: tx.description,
              transaction_date: tx.created_at || tx.date,
              payout_status: tx.status,
              raw_data: tx,
            });
          }
          loadIncome();
          toast.success("Dados de receita carregados!");
        }
      } else {
        toast.info("Dados de receita requerem conexão via Phyllo SDK");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao buscar receita");
    } finally {
      setLoadingIncome(false);
    }
  };

  const initials = (influencer.display_name || influencer.username).substring(0, 2).toUpperCase();
  const fraudScore = influencer.fraud_score ?? analysis?.fraud_detection?.fraud_score;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="relative">
              <InfluencerAvatar
                platform={influencer.platform}
                username={influencer.username}
                displayName={influencer.display_name}
                avatarUrl={influencer.avatar_url}
              />
              {reputation?.crisis_active && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-destructive items-center justify-center">
                    <AlertTriangle className="h-2.5 w-2.5 text-destructive-foreground" />
                  </span>
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span>{influencer.display_name || influencer.username}</span>
                <Badge variant="outline" className="capitalize">{influencer.platform}</Badge>
                {reputation && (
                  <Badge
                    variant={reputation.brand_safety_level === "safe" || reputation.brand_safety_level === "low_risk" ? "default" : reputation.brand_safety_level === "medium_risk" ? "warning" : "destructive"}
                    className="text-xs"
                  >
                    <ShieldAlert className="h-3 w-3 mr-1" />
                    Safety {reputation.brand_safety_score}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground font-normal">@{influencer.username}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <MetricCard icon={Users} label="Seguidores" value={formatNumber(influencer.followers_count)} />
          <MetricCard icon={TrendingUp} label="Engajamento" value={`${influencer.engagement_rate}%`} />
          <MetricCard icon={Heart} label="Média Likes" value={formatNumber(influencer.avg_likes)} />
          <MetricCard icon={Shield} label="Autenticidade" value={fraudScore != null ? `${fraudScore}%` : "—"} color={fraudScore != null ? (fraudScore >= 70 ? "text-green-600" : fraudScore >= 40 ? "text-yellow-600" : "text-red-600") : undefined} />
          <MetricCard icon={ShieldAlert} label="Brand Safety" value={reputation?.brand_safety_score != null ? `${reputation.brand_safety_score}` : "—"} color={reputation?.brand_safety_score != null ? (reputation.brand_safety_score >= 70 ? "text-green-600" : reputation.brand_safety_score >= 40 ? "text-yellow-600" : "text-red-600") : undefined} />
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleFetchContent} disabled={loadingContent}>
            {loadingContent ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Coletar Conteúdo
          </Button>
          <Button size="sm" onClick={handleAnalyze360} disabled={loadingAnalysis}>
            {loadingAnalysis ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Análise 360° com IA
          </Button>
          <Button variant="outline" size="sm" onClick={handleResearchReputation} disabled={loadingReputation} className="border-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-950">
            {loadingReputation ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Newspaper className="h-4 w-4 mr-1" />}
            Pesquisar Reputação
          </Button>
          {influencer.profile_url && (
            <Button variant="ghost" size="sm" asChild>
              <a href={influencer.profile_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" /> Perfil
              </a>
            </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="content">Conteúdo</TabsTrigger>
            <TabsTrigger value="sentiment">Sentimento</TabsTrigger>
            <TabsTrigger value="authenticity">Autenticidade</TabsTrigger>
            <TabsTrigger value="audience">Audiência</TabsTrigger>
            <TabsTrigger value="income">Receita</TabsTrigger>
            <TabsTrigger value="reputation" className="relative">
              Reputação
              {reputation?.crisis_active && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <OverviewTab analysis={analysis} influencer={influencer} posts={posts} reputation={reputation} />
          </TabsContent>

          <TabsContent value="content" className="space-y-4">
            {posts.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Última coleta: {posts[0]?.created_at ? new Date(posts[0].created_at).toLocaleDateString('pt-BR') : '-'}</span>
                <span>•</span>
                <span>{posts.length} posts</span>
              </div>
            )}
            <ContentTab analysis={analysis} posts={posts} />
            <CommentsHighlightsSection influencerId={influencer.id} />
          </TabsContent>

          <TabsContent value="sentiment" className="space-y-4">
            <SentimentTab analysis={analysis} />
          </TabsContent>

          <TabsContent value="authenticity" className="space-y-4">
            <AuthenticityTab analysis={analysis} />
          </TabsContent>

          <TabsContent value="audience" className="space-y-4">
            <AudienceTab audience={audience} loading={loadingAudience} onFetch={handleFetchAudience} />
            <AudienceProfileSection influencerId={influencer.id} />
          </TabsContent>

          <TabsContent value="income" className="space-y-4">
            <IncomeTab income={income} loading={loadingIncome} onFetch={handleFetchIncome} />
          </TabsContent>

          <TabsContent value="reputation" className="space-y-4">
            <ReputationTab reputation={reputation} loading={loadingReputation} onFetch={handleResearchReputation} history={reputationHistory} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color?: string }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-lg font-bold ${color || ""}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Reputation Tab ───
function ReputationTab({ reputation, loading, onFetch, history }: { reputation: any; loading: boolean; onFetch: () => void; history: any[] }) {
  if (!reputation) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Newspaper className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p className="font-medium">Inteligência de Reputação</p>
        <p className="text-sm mb-4">Pesquisa na web por notícias, polêmicas, processos e reputação do influenciador usando IA</p>
        <Button onClick={onFetch} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Pesquisar Reputação com IA
        </Button>
      </div>
    );
  }

  const safetyColor = reputation.brand_safety_level === "safe" || reputation.brand_safety_level === "low_risk"
    ? "text-green-600" : reputation.brand_safety_level === "medium_risk"
    ? "text-yellow-600" : "text-red-600";

  const safetyBg = reputation.brand_safety_level === "safe" || reputation.brand_safety_level === "low_risk"
    ? "bg-green-500" : reputation.brand_safety_level === "medium_risk"
    ? "bg-yellow-500" : "bg-red-500";

  const safetyLabel: Record<string, string> = {
    safe: "Seguro",
    low_risk: "Risco Baixo",
    medium_risk: "Risco Médio",
    high_risk: "Risco Alto",
    critical: "Crítico",
  };

  return (
    <>
      {/* Crisis Alert Banner */}
      {reputation.crisis_active && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive animate-pulse" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-destructive">⚠️ Crise Ativa Detectada</p>
              <p className="text-sm text-muted-foreground">Este influenciador está envolvido em uma controvérsia ativa. Avalie os riscos antes de associar marcas.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scores Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium">Brand Safety Score</p>
                <p className={`text-3xl font-bold ${safetyColor}`}>{reputation.brand_safety_score}</p>
              </div>
              <Badge variant={reputation.brand_safety_level === "safe" || reputation.brand_safety_level === "low_risk" ? "default" : reputation.brand_safety_level === "medium_risk" ? "warning" : "destructive"}>
                {safetyLabel[reputation.brand_safety_level] || reputation.brand_safety_level}
              </Badge>
            </div>
            <Progress value={reputation.brand_safety_score} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2">Indica a segurança para marcas se associarem</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium">Reputation Score</p>
                <p className={`text-3xl font-bold ${reputation.reputation_score >= 70 ? "text-green-600" : reputation.reputation_score >= 40 ? "text-yellow-600" : "text-red-600"}`}>
                  {reputation.reputation_score}
                </p>
              </div>
              <Star className={`h-8 w-8 ${reputation.reputation_score >= 70 ? "text-green-500" : reputation.reputation_score >= 40 ? "text-yellow-500" : "text-red-500"}`} />
            </div>
            <Progress value={reputation.reputation_score} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2">Reputação geral na mídia e público</p>
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      {reputation.summary && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm">{reputation.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Media Sentiment */}
      {reputation.media_sentiment && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Sentimento da Mídia</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <SentimentBar label="Positivo" value={reputation.media_sentiment.positive_pct || 0} color="bg-green-500" />
            <SentimentBar label="Neutro" value={reputation.media_sentiment.neutral_pct || 0} color="bg-yellow-500" />
            <SentimentBar label="Negativo" value={reputation.media_sentiment.negative_pct || 0} color="bg-red-500" />
          </CardContent>
        </Card>
      )}

      {/* News Timeline */}
      {reputation.news_timeline && reputation.news_timeline.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Newspaper className="h-4 w-4" /> Timeline de Notícias</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {reputation.news_timeline.map((news: any, i: number) => (
                <div key={i} className="flex items-start gap-3 border-b last:border-0 pb-3">
                  <div className={`mt-1 h-3 w-3 rounded-full shrink-0 ${
                    news.sentiment === "positive" ? "bg-green-500" : news.sentiment === "negative" ? "bg-red-500" : "bg-yellow-500"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{news.title}</p>
                      {news.severity && news.severity !== "low" && (
                        <Badge variant={news.severity === "critical" ? "destructive" : news.severity === "high" ? "destructive" : "warning"} className="text-xs">
                          {news.severity}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{news.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{news.date}</span>
                      {news.source && <span className="text-xs text-muted-foreground">· {news.source}</span>}
                      <Badge variant="outline" className="text-xs capitalize">{news.category}</Badge>
                      {news.url && (
                        <a href={news.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                          <ExternalLink className="h-3 w-3" /> Ver
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controversies */}
      {reputation.controversies && reputation.controversies.length > 0 && (
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><AlertCircle className="h-4 w-4 text-yellow-600" /> Polêmicas & Controvérsias</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {reputation.controversies.map((c: any, i: number) => (
              <div key={i} className="border-b last:border-0 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className={`h-4 w-4 shrink-0 ${
                    c.severity === "critical" ? "text-red-600" : c.severity === "high" ? "text-red-500" : c.severity === "medium" ? "text-yellow-600" : "text-gray-400"
                  }`} />
                  <p className="text-sm font-medium">{c.title}</p>
                  <Badge variant={c.status === "resolved" ? "secondary" : c.status === "ongoing" ? "destructive" : "outline"} className="text-xs">
                    {c.status === "resolved" ? "Resolvido" : c.status === "ongoing" ? "Em andamento" : "Desconhecido"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground ml-6">{c.description}</p>
                {c.impact_on_brands && (
                  <p className="text-xs text-yellow-600 ml-6 mt-1">📢 Impacto para marcas: {c.impact_on_brands}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Risk Factors & Positive Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {reputation.risk_factors && reputation.risk_factors.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-red-600" /> Fatores de Risco</CardTitle></CardHeader>
            <CardContent>
              <ul className="text-sm space-y-1.5 text-muted-foreground">
                {reputation.risk_factors.map((r: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <AlertTriangle className="h-3 w-3 text-red-500 mt-1 shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {reputation.positive_highlights && reputation.positive_highlights.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><CheckCircle className="h-4 w-4 text-green-600" /> Destaques Positivos</CardTitle></CardHeader>
            <CardContent>
              <ul className="text-sm space-y-1.5 text-muted-foreground">
                {reputation.positive_highlights.map((h: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500 mt-1 shrink-0" />
                    {h}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Strategic Recommendation */}
      {reputation.strategic_recommendation && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Sparkles className="h-4 w-4 text-primary" /> Recomendação Estratégica</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm">{reputation.strategic_recommendation}</p>
          </CardContent>
        </Card>
      )}

      {/* Reputation History */}
      {history.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1">
              <TrendingUp className="h-4 w-4" /> Histórico de Reputação ({history.length} análises)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Mini sparkline */}
            <div className="flex items-end gap-1 h-16 mb-4">
              {[...history].reverse().map((h: any, i: number) => {
                const score = (h.result as any)?.brand_safety_score ?? 50;
                return (
                  <div key={h.id} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-t ${score >= 70 ? "bg-green-500" : score >= 40 ? "bg-yellow-500" : "bg-destructive"}`}
                      style={{ height: `${Math.max(score * 0.6, 4)}px` }}
                      title={`${score} — ${new Date(h.created_at).toLocaleDateString("pt-BR")}`}
                    />
                  </div>
                );
              })}
            </div>
            {/* History list */}
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {history.map((h: any, i: number) => {
                const r = h.result as any;
                const prevScore = i < history.length - 1 ? (history[i + 1].result as any)?.brand_safety_score : null;
                const currentScore = r?.brand_safety_score ?? 0;
                const trend = prevScore != null ? currentScore - prevScore : null;
                return (
                  <div key={h.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(h.created_at).toLocaleDateString("pt-BR")} {new Date(h.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {i === 0 && <Badge variant="outline" className="text-xs">Atual</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${currentScore >= 70 ? "text-green-600" : currentScore >= 40 ? "text-yellow-600" : "text-destructive"}`}>
                        {currentScore}
                      </span>
                      {trend !== null && trend !== 0 && (
                        <span className={`text-xs flex items-center ${trend > 0 ? "text-green-600" : "text-destructive"}`}>
                          {trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingUp className="h-3 w-3 rotate-180" />}
                          {trend > 0 ? "+" : ""}{trend}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Refresh button */}
      <div className="flex justify-center pt-2">
        <Button variant="outline" size="sm" onClick={onFetch} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Atualizar Pesquisa
        </Button>
        {reputation.researched_at && (
          <span className="text-xs text-muted-foreground ml-3 self-center">
            Atualizado em {new Date(reputation.researched_at).toLocaleString("pt-BR")}
          </span>
        )}
      </div>
    </>
  );
}

// ─── Audience Tab ───
function AudienceTab({ audience, loading, onFetch }: { audience: any; loading: boolean; onFetch: () => void }) {
  if (!audience) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Dados demográficos da audiência via Phyllo</p>
        <p className="text-sm mb-4">Requer que o criador tenha conectado a conta via SDK</p>
        <Button variant="outline" size="sm" onClick={onFetch} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Globe className="h-4 w-4 mr-1" />}
          Buscar Dados de Audiência
        </Button>
      </div>
    );
  }

  const demographics = audience.data || audience;
  const genders = demographics.gender_distribution || demographics.genders || [];
  const ages = demographics.age_distribution || demographics.ages || [];
  const countries = demographics.country_distribution || demographics.countries || [];
  const cities = demographics.city_distribution || demographics.cities || [];
  const languages = demographics.language_distribution || demographics.languages || [];

  return (
    <>
      {genders.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição por Gênero</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {genders.map((g: any, i: number) => (
              <SentimentBar key={i} label={g.name || g.gender || g.type} value={parseFloat(g.value || g.percentage || 0)} color={i === 0 ? "bg-blue-500" : i === 1 ? "bg-pink-500" : "bg-gray-400"} />
            ))}
          </CardContent>
        </Card>
      )}

      {ages.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição por Idade</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {ages.map((a: any, i: number) => (
              <SentimentBar key={i} label={a.name || a.range || a.code} value={parseFloat(a.value || a.percentage || 0)} color="bg-primary" />
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {countries.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Top Países</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1">
                {countries.slice(0, 10).map((c: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{c.name || c.code}</span>
                    <span className="text-muted-foreground">{parseFloat(c.value || c.percentage || 0).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {languages.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Idiomas</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1">
                {languages.slice(0, 8).map((l: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{l.name || l.code}</span>
                    <span className="text-muted-foreground">{parseFloat(l.value || l.percentage || 0).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {cities.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top Cidades</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {cities.slice(0, 10).map((c: any, i: number) => (
                <Badge key={i} variant="secondary">{c.name || c.city} ({parseFloat(c.value || c.percentage || 0).toFixed(1)}%)</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

// ─── Income Tab ───
function IncomeTab({ income, loading, onFetch }: { income: any[]; loading: boolean; onFetch: () => void }) {
  const totalEarnings = income.reduce((s, i) => s + Number(i.amount || 0), 0);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Total de receita registrada</p>
          <p className="text-2xl font-bold">{totalEarnings > 0 ? `$${totalEarnings.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onFetch} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <DollarSign className="h-4 w-4 mr-1" />}
          Buscar Receita via Phyllo
        </Button>
      </div>

      {income.length > 0 ? (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Transações</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {income.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between border-b last:border-0 pb-2">
                  <div>
                    <p className="text-sm font-medium">{tx.description || tx.transaction_type}</p>
                    <p className="text-xs text-muted-foreground">
                      {tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString("pt-BR") : "—"} · {tx.platform}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">${Number(tx.amount).toFixed(2)}</p>
                    {tx.payout_status && <Badge variant="outline" className="text-xs">{tx.payout_status}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Nenhum dado de receita disponível</p>
          <p className="text-sm">Dados de receita requerem conexão do criador via Phyllo SDK</p>
        </div>
      )}
    </>
  );
}

// ─── Overview Tab ───
function OverviewTab({ analysis, influencer, posts, reputation }: { analysis: any; influencer: Influencer; posts: any[]; reputation: any }) {
  const content = analysis?.content_analysis;
  const fraud = analysis?.fraud_detection;

  return (
    <>
      {reputation?.crisis_active && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="p-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <p className="text-sm font-medium text-destructive">Crise de reputação ativa detectada — veja a aba Reputação</p>
          </CardContent>
        </Card>
      )}

      {influencer.notes && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{influencer.notes}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Conteúdo</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {content ? (
              <>
                <div className="flex justify-between text-sm">
                  <span>Qualidade</span>
                  <Badge variant={content.content_quality === "high" ? "default" : "secondary"}>{content.content_quality}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tom</span>
                  <span className="text-muted-foreground">{content.tone}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Frequência</span>
                  <span className="text-muted-foreground">{content.posting_frequency}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Posts patrocinados</span>
                  <span className="text-muted-foreground">{content.sponsored_ratio}%</span>
                </div>
                {content.overall_score != null && (
                  <div className="pt-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Score geral</span>
                      <span>{content.overall_score}/100</span>
                    </div>
                    <Progress value={content.overall_score} />
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Execute a análise 360° para ver dados</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Autenticidade</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {fraud ? (
              <>
                <div className="flex justify-between text-sm">
                  <span>Nível de risco</span>
                  <Badge variant={fraud.risk_level === "low" ? "default" : fraud.risk_level === "medium" ? "secondary" : "destructive"}>{fraud.risk_level}</Badge>
                </div>
                {fraud.followers_quality && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span>Seguidores reais</span>
                      <span className="text-green-600">{fraud.followers_quality.estimated_real}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Bots estimados</span>
                      <span className="text-red-600">{fraud.followers_quality.estimated_bots}%</span>
                    </div>
                  </>
                )}
                {fraud.fraud_score != null && (
                  <div className="pt-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Score autenticidade</span>
                      <span>{fraud.fraud_score}/100</span>
                    </div>
                    <Progress value={fraud.fraud_score} />
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Execute a análise 360° para ver dados</p>
            )}
          </CardContent>
        </Card>
      </div>

      {content?.themes && content.themes.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Temas Principais</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {content.themes.map((t: any, i: number) => (
                <Badge key={i} variant="secondary">{t.name} ({t.frequency})</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {content?.recommendations && content.recommendations.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Recomendações</CardTitle></CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1 text-muted-foreground">
              {content.recommendations.map((r: string, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function ContentTab({ analysis, posts }: { analysis: any; posts: any[] }) {
  const content = analysis?.content_analysis;
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [failedMedia, setFailedMedia] = useState<Record<string, boolean>>({});
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});
  const [resolvingIds, setResolvingIds] = useState<Record<string, boolean>>({});
  const { resolve } = useResolvePostMedia();

  // Resolve storage paths to signed URLs on mount
  useEffect(() => {
    const storagePosts = posts.filter((p) => {
      const m = getPostMediaSource(p);
      return m.kind === "storage" && !resolvedUrls[p.id];
    });
    if (storagePosts.length === 0) return;

    storagePosts.forEach(async (p) => {
      const m = getPostMediaSource(p);
      if (m.kind !== "storage") return;
      const { data } = await supabase.storage
        .from("post-media")
        .createSignedUrl(m.storagePath!, 3600);
      if (data?.signedUrl) {
        setResolvedUrls((c) => ({ ...c, [p.id]: data.signedUrl }));
      }
    });
  }, [posts]);

  const handleThumbError = async (postId: string, fallbackSrc: string) => {
    if (resolvingIds[postId] || resolvedUrls[postId]) {
      setFailedMedia((c) => ({ ...c, [postId]: true }));
      return;
    }
    setResolvingIds((c) => ({ ...c, [postId]: true }));
    const result = await resolve(postId);
    setResolvingIds((c) => ({ ...c, [postId]: false }));
    if (result?.media_url || result?.thumbnail_url) {
      setResolvedUrls((c) => ({ ...c, [postId]: (result.media_url || result.thumbnail_url)! }));
    } else {
      setFailedMedia((c) => ({ ...c, [postId]: true }));
    }
  };

  return (
    <>
      <PostDetailDialog post={selectedPost} open={!!selectedPost} onOpenChange={(o) => !o && setSelectedPost(null)} />
      {posts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {posts.slice(0, 18).map((post: any) => {
            const media = getPostMediaSource(post);
            const previewSrc = failedMedia[post.id]
              ? media.fallback
              : resolvedUrls[post.id] || media.src;
            return (
              <Card key={post.id} className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all" onClick={() => setSelectedPost(post)}>
                <div className="aspect-square relative overflow-hidden bg-muted">
                  {resolvingIds[post.id] ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <img
                      src={previewSrc}
                      alt={post.caption ? `Prévia do post: ${post.caption.slice(0, 60)}` : "Prévia do post"}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={() => handleThumbError(post.id, media.fallback)}
                    />
                  )}
                  <div className="absolute top-2 left-2 flex gap-1">
                    <Badge variant="secondary" className="text-[10px] capitalize bg-background/80 backdrop-blur-sm">{post.post_type}</Badge>
                    {failedMedia[post.id] && (
                      <Badge variant="secondary" className="text-[10px] bg-background/80 backdrop-blur-sm">Prévia</Badge>
                    )}
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <div className="flex items-center gap-3 text-xs text-white">
                      <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {formatNumber(post.likes)}</span>
                      <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {formatNumber(post.comments_count)}</span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Nenhum post coletado ainda.</p>
          <p className="text-sm">Clique em "Coletar Conteúdo" para buscar posts.</p>
        </div>
      )}

      {content?.top_performing_content && content.top_performing_content.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top Performance</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {content.top_performing_content.map((tp: any, i: number) => (
              <div key={i} className="flex justify-between items-center text-sm border-b last:border-0 pb-2">
                <span className="flex-1 truncate">{tp.caption_summary}</span>
                <div className="flex items-center gap-2 ml-2">
                  <Badge variant="secondary" className="text-xs">{formatNumber(tp.likes)} likes</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}

function SentimentTab({ analysis }: { analysis: any }) {
  const sentiment = analysis?.sentiment_analysis;

  if (!sentiment) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ThumbsUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Execute a análise 360° para ver o sentimento.</p>
      </div>
    );
  }

  const sentimentIcon = sentiment.overall_sentiment === "positive" ? ThumbsUp : sentiment.overall_sentiment === "negative" ? ThumbsDown : Minus;
  const SIcon = sentimentIcon;

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <SIcon className={`h-6 w-6 ${sentiment.overall_sentiment === "positive" ? "text-green-600" : sentiment.overall_sentiment === "negative" ? "text-red-600" : "text-yellow-600"}`} />
            <div>
              <p className="font-semibold capitalize">{sentiment.overall_sentiment}</p>
              <p className="text-xs text-muted-foreground">Sentimento geral da audiência</p>
            </div>
          </div>

          {sentiment.sentiment_distribution && (
            <div className="space-y-2">
              <SentimentBar label="Positivo" value={parseFloat(sentiment.sentiment_distribution.positive)} color="bg-green-500" />
              <SentimentBar label="Neutro" value={parseFloat(sentiment.sentiment_distribution.neutral)} color="bg-yellow-500" />
              <SentimentBar label="Negativo" value={parseFloat(sentiment.sentiment_distribution.negative)} color="bg-red-500" />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><ThumbsUp className="h-4 w-4 text-green-600" /> Temas Positivos</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {(sentiment.key_positive_themes || []).map((t: string, i: number) => (
                <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><ThumbsDown className="h-4 w-4 text-red-600" /> Temas Negativos</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {(sentiment.key_negative_themes || []).map((t: string, i: number) => (
                <Badge key={i} variant="destructive" className="text-xs">{t}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{sentiment.spam_percentage || 0}%</p>
            <p className="text-xs text-muted-foreground">Spam detectado</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold capitalize">{sentiment.audience_engagement_quality || "—"}</p>
            <p className="text-xs text-muted-foreground">Qualidade do engajamento</p>
          </CardContent>
        </Card>
      </div>

      {sentiment.bot_activity_indicators && sentiment.bot_activity_indicators.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-yellow-600" /> Indicadores de Bots</CardTitle></CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1 text-muted-foreground">
              {sentiment.bot_activity_indicators.map((b: string, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle className="h-3 w-3 text-yellow-600 mt-1 shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {sentiment.notable_comments && sentiment.notable_comments.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Comentários Notáveis</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {sentiment.notable_comments.map((c: any, i: number) => (
              <div key={i} className="border-b last:border-0 pb-2">
                <div className="flex items-center gap-2">
                  <Badge variant={c.sentiment === "positive" ? "default" : c.sentiment === "negative" ? "destructive" : "secondary"} className="text-xs">{c.sentiment}</Badge>
                </div>
                <p className="text-sm mt-1">"{c.text}"</p>
                <p className="text-xs text-muted-foreground mt-0.5">{c.reason}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}

function SentimentBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs w-16">{label}</span>
      <div className="flex-1 bg-muted rounded-full h-2">
        <div className={`${color} rounded-full h-2 transition-all`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-xs w-10 text-right">{value}%</span>
    </div>
  );
}

function AuthenticityTab({ analysis }: { analysis: any }) {
  const fraud = analysis?.fraud_detection;

  if (!fraud) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Execute a análise 360° para ver autenticidade.</p>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold text-lg">{fraud.fraud_score}/100</p>
              <p className="text-sm text-muted-foreground">Score de Autenticidade</p>
            </div>
            <Badge variant={fraud.risk_level === "low" ? "default" : fraud.risk_level === "medium" ? "secondary" : "destructive"} className="text-sm">
              Risco {fraud.risk_level}
            </Badge>
          </div>
          <Progress value={fraud.fraud_score} className="h-3" />
        </CardContent>
      </Card>

      {fraud.followers_quality && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Qualidade dos Seguidores</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <SentimentBar label="Reais" value={parseFloat(fraud.followers_quality.estimated_real)} color="bg-green-500" />
            <SentimentBar label="Bots" value={parseFloat(fraud.followers_quality.estimated_bots)} color="bg-red-500" />
            <SentimentBar label="Inativos" value={parseFloat(fraud.followers_quality.estimated_inactive)} color="bg-gray-400" />
          </CardContent>
        </Card>
      )}

      {fraud.red_flags && fraud.red_flags.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-red-600" /> Bandeiras Vermelhas</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {fraud.red_flags.map((rf: any, i: number) => (
              <div key={i} className="flex items-start gap-2 border-b last:border-0 pb-2">
                <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${rf.severity === "high" ? "text-red-600" : rf.severity === "medium" ? "text-yellow-600" : "text-gray-400"}`} />
                <div>
                  <p className="text-sm font-medium">{rf.indicator}</p>
                  <p className="text-xs text-muted-foreground">{rf.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {fraud.positive_signals && fraud.positive_signals.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><CheckCircle className="h-4 w-4 text-green-600" /> Sinais Positivos</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {fraud.positive_signals.map((ps: any, i: number) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{ps.indicator}</p>
                  <p className="text-xs text-muted-foreground">{ps.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {fraud.engagement_authenticity && (
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Autenticidade do Engajamento</span>
              <span className="font-bold">{fraud.engagement_authenticity.score}/100</span>
            </div>
            <Progress value={fraud.engagement_authenticity.score} className="h-2 mb-3" />
            {fraud.engagement_authenticity.suspicious_patterns && (
              <ul className="text-xs text-muted-foreground space-y-1">
                {fraud.engagement_authenticity.suspicious_patterns.map((p: string, i: number) => (
                  <li key={i}>• {p}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {fraud.growth_analysis && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-1">Análise de Crescimento</p>
            <p className="text-sm text-muted-foreground">{fraud.growth_analysis}</p>
          </CardContent>
        </Card>
      )}

      {fraud.recommendations && fraud.recommendations.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Recomendações</CardTitle></CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1 text-muted-foreground">
              {fraud.recommendations.map((r: string, i: number) => (
                <li key={i} className="flex items-start gap-2"><CheckCircle className="h-3 w-3 text-primary mt-1 shrink-0" />{r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}
