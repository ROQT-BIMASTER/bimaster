import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Bot, Database, FileText, MessageCircle, ThumbsUp, ThumbsDown, Minus,
  Users, BarChart3, Shield, Clock, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface MiningStats {
  totalInfluencers: number;
  scoredInfluencers: number;
  totalPosts: number;
  totalComments: number;
  commentsWithSentiment: number;
  analysesCount: Record<string, number>;
  lastAnalysisDate: string | null;
  lastAutopilotRun: string | null;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  totalOpportunities: number;
  topScored: { username: string; platform: string; composite_score: number }[];
  recentAnalyses: { influencer_username: string; analysis_type: string; created_at: string }[];
}

export function AutopilotMiningPanel() {
  const [stats, setStats] = useState<MiningStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Parallel queries
      const [
        influencersRes,
        postsRes,
        commentsRes,
        sentimentRes,
        analysesRes,
        profileRes,
        topScoredRes,
        recentAnalysesRes,
        opportunitiesRes,
      ] = await Promise.all([
        supabase.from("influencers").select("id, composite_score", { count: "exact" }).eq("user_id", user.id).eq("status", "active"),
        supabase.from("influencer_posts").select("id", { count: "exact" }).limit(1),
        supabase.from("influencer_comments").select("id, sentiment", { count: "exact" }).limit(1000),
        supabase.from("influencer_comments").select("sentiment").not("sentiment", "is", null).limit(1000),
        supabase.from("influencer_analyses").select("analysis_type, created_at").order("created_at", { ascending: false }).limit(50),
        supabase.from("influencer_company_profile").select("last_autopilot_run").eq("user_id", user.id).maybeSingle(),
        supabase.from("influencers").select("username, platform, composite_score").eq("user_id", user.id).eq("status", "active").not("composite_score", "is", null).order("composite_score", { ascending: false }).limit(5),
        supabase.from("influencer_analyses").select("influencer_id, analysis_type, created_at").order("created_at", { ascending: false }).limit(10),
        supabase.from("influencer_opportunities").select("id, type, status", { count: "exact" }).limit(1),
      ]);

      // Count analyses by type
      const analysesCount: Record<string, number> = {};
      (analysesRes.data || []).forEach((a: any) => {
        analysesCount[a.analysis_type] = (analysesCount[a.analysis_type] || 0) + 1;
      });

      // Sentiment breakdown
      const sentimentBreakdown = { positive: 0, neutral: 0, negative: 0 };
      (sentimentRes.data || []).forEach((c: any) => {
        if (c.sentiment === "positive") sentimentBreakdown.positive++;
        else if (c.sentiment === "negative") sentimentBreakdown.negative++;
        else sentimentBreakdown.neutral++;
      });

      // Get influencer usernames for recent analyses
      const influencerIds = [...new Set((recentAnalysesRes.data || []).map((a: any) => a.influencer_id))];
      let infMap: Record<string, string> = {};
      if (influencerIds.length > 0) {
        const { data: infData } = await supabase.from("influencers").select("id, username").in("id", influencerIds);
        infMap = Object.fromEntries((infData || []).map((i: any) => [i.id, i.username]));
      }

      const scored = (influencersRes.data || []).filter((i: any) => i.composite_score != null).length;

      setStats({
        totalInfluencers: influencersRes.count || 0,
        scoredInfluencers: scored,
        totalPosts: postsRes.count || 0,
        totalComments: commentsRes.count || 0,
        commentsWithSentiment: sentimentRes.data?.length || 0,
        analysesCount,
        lastAnalysisDate: analysesRes.data?.[0]?.created_at || null,
        lastAutopilotRun: profileRes.data?.last_autopilot_run || null,
        sentimentBreakdown,
        topScored: (topScoredRes.data || []).map((i: any) => ({
          username: i.username,
          platform: i.platform,
          composite_score: i.composite_score,
        })),
        recentAnalyses: (recentAnalysesRes.data || []).map((a: any) => ({
          influencer_username: infMap[a.influencer_id] || "—",
          analysis_type: a.analysis_type,
          created_at: a.created_at,
        })),
      });
    } catch (err) {
      console.error("Erro ao carregar stats de mineração:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const totalSentiment = stats.sentimentBreakdown.positive + stats.sentimentBreakdown.neutral + stats.sentimentBreakdown.negative;
  const posPct = totalSentiment > 0 ? (stats.sentimentBreakdown.positive / totalSentiment) * 100 : 0;
  const neuPct = totalSentiment > 0 ? (stats.sentimentBreakdown.neutral / totalSentiment) * 100 : 0;
  const negPct = totalSentiment > 0 ? (stats.sentimentBreakdown.negative / totalSentiment) * 100 : 0;

  const analysisTypeLabels: Record<string, string> = {
    full_360: "Análise 360°",
    recommendation: "Recomendação IA",
    reputation: "Reputação",
    sentiment: "Sentimento",
    content: "Conteúdo",
  };

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bot className="h-4 w-4 text-emerald-600" />
                Dados Minerados pelo Autopilot
                <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                  <Database className="h-3 w-3 mr-1" />
                  {stats.totalPosts + stats.totalComments + Object.values(stats.analysesCount).reduce((a, b) => a + b, 0)} registros
                </Badge>
              </CardTitle>
              {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
            {!expanded && (
              <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                <span>{stats.totalInfluencers} influenciadores</span>
                <span>•</span>
                <span>{stats.totalPosts} posts</span>
                <span>•</span>
                <span>{stats.totalComments} comentários</span>
                {stats.lastAutopilotRun && (
                  <>
                    <span>•</span>
                    <span>Última execução: {new Date(stats.lastAutopilotRun).toLocaleDateString("pt-BR")}</span>
                  </>
                )}
              </div>
            )}
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-5">
            {/* KPIs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MiniKPI icon={Users} label="Influenciadores Analisados" value={`${stats.scoredInfluencers}/${stats.totalInfluencers}`} />
              <MiniKPI icon={FileText} label="Posts Coletados" value={String(stats.totalPosts)} />
              <MiniKPI icon={MessageCircle} label="Comentários" value={String(stats.totalComments)} />
              <MiniKPI icon={BarChart3} label="Análises IA" value={String(Object.values(stats.analysesCount).reduce((a, b) => a + b, 0))} />
            </div>

            {/* Sentiment Breakdown */}
            {totalSentiment > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground">Sentimento dos Comentários ({stats.commentsWithSentiment} analisados)</h4>
                <div className="flex gap-1 h-3 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 transition-all" style={{ width: `${posPct}%` }} />
                  <div className="bg-amber-400 transition-all" style={{ width: `${neuPct}%` }} />
                  <div className="bg-red-500 transition-all" style={{ width: `${negPct}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3 text-emerald-500" /> {posPct.toFixed(0)}% Positivo</span>
                  <span className="flex items-center gap-1"><Minus className="h-3 w-3 text-amber-400" /> {neuPct.toFixed(0)}% Neutro</span>
                  <span className="flex items-center gap-1"><ThumbsDown className="h-3 w-3 text-red-500" /> {negPct.toFixed(0)}% Negativo</span>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {/* Analyses by Type */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground">Análises por Tipo</h4>
                <div className="space-y-1.5">
                  {Object.entries(stats.analysesCount).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between text-xs">
                      <span>{analysisTypeLabels[type] || type}</span>
                      <Badge variant="outline" className="text-[10px]">{count}</Badge>
                    </div>
                  ))}
                  {Object.keys(stats.analysesCount).length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhuma análise realizada</p>
                  )}
                </div>
              </div>

              {/* Top Scored */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground">Top 5 por Score Composto</h4>
                <div className="space-y-1.5">
                  {stats.topScored.map((inf, i) => (
                    <div key={inf.username} className="flex items-center gap-2 text-xs">
                      <span className="w-4 text-muted-foreground font-mono">#{i + 1}</span>
                      <span className="flex-1 truncate font-medium">@{inf.username}</span>
                      <Badge variant="secondary" className="text-[10px] capitalize">{inf.platform}</Badge>
                      <span className="font-semibold tabular-nums">{inf.composite_score.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Analyses Timeline */}
            {stats.recentAnalyses.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Últimas Análises
                </h4>
                <div className="space-y-1">
                  {stats.recentAnalyses.slice(0, 6).map((a, i) => (
                    <div key={i} className="flex items-center justify-between text-xs border-b border-border/50 last:border-0 pb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">@{a.influencer_username}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {analysisTypeLabels[a.analysis_type] || a.analysis_type}
                        </Badge>
                      </div>
                      <span className="text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats.lastAutopilotRun && (
              <div className="text-[10px] text-muted-foreground text-right">
                Última execução do Autopilot: {new Date(stats.lastAutopilotRun).toLocaleString("pt-BR")}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function MiniKPI({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 bg-muted/30">
      <Icon className="h-4 w-4 text-primary shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}
