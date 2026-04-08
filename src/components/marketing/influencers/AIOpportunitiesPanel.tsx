import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Brain, RefreshCw, ChevronDown, TrendingUp, AlertTriangle, Lightbulb, Target, Loader2, CheckCircle, Eye } from "lucide-react";
import { toast } from "sonner";

interface SavedOpportunity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  score: number | null;
  alert_type: string | null;
  status: string;
  generated_at: string;
}

interface AIOpportunitiesPanelProps {
  influencerCount: number;
  onRefresh?: () => void;
}

export function AIOpportunitiesPanel({ influencerCount, onRefresh }: AIOpportunitiesPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingDb, setLoadingDb] = useState(true);
  const [items, setItems] = useState<SavedOpportunity[]>([]);

  useEffect(() => {
    loadSavedOpportunities();
  }, []);

  const loadSavedOpportunities = async () => {
    try {
      setLoadingDb(true);
      const { data, error } = await supabase
        .from("influencer_opportunities")
        .select("id, type, title, description, score, alert_type, status, generated_at")
        .order("generated_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      setItems(data || []);
      if ((data || []).length > 0) setOpen(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDb(false);
    }
  };

  const runAnalysis = async () => {
    if (influencerCount === 0) {
      toast.error("Adicione influenciadores antes de gerar oportunidades");
      return;
    }
    setLoading(true);
    setOpen(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("influencer-autopilot", {
        body: { action: "analyze_opportunities" },
      });
      if (error) throw error;
      if (result?.data) {
        toast.success(`Análise atualizada — ${result.data.persisted || 0} registros salvos!`);
        await loadSavedOpportunities();
        onRefresh?.();
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar análise de oportunidades");
    } finally {
      setLoading(false);
    }
  };

  const markAsViewed = async (id: string) => {
    await supabase.from("influencer_opportunities").update({ status: "viewed" }).eq("id", id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: "viewed" } : i));
  };

  const opportunities = items.filter(i => i.type === "opportunity");
  const alerts = items.filter(i => i.type === "alert");
  const trends = items.filter(i => i.type === "trend");
  const actions = items.filter(i => i.type === "action");
  const newCount = items.filter(i => i.status === "new").length;

  // Group by generation batch
  const latestBatch = items.length > 0 ? items[0].generated_at : null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Brain className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Oportunidades IA</CardTitle>
              {opportunities.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {opportunities.length} oportunidades
                </Badge>
              )}
              {newCount > 0 && (
                <Badge variant="default" className="text-xs animate-pulse">
                  {newCount} novas
                </Badge>
              )}
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <Button size="sm" variant="outline" onClick={runAnalysis} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              {loading ? "Analisando..." : "Atualizar Análise"}
            </Button>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {loadingDb ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Clique em "Atualizar Análise" para a IA gerar insights sobre seus influenciadores.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Top Opportunities */}
                {opportunities.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold flex items-center gap-1.5">
                      <Target className="h-4 w-4 text-primary" />
                      Top Oportunidades
                    </h4>
                    {opportunities.map((opp) => (
                      <div key={opp.id} className="p-2 rounded-md bg-primary/5 border border-primary/10 text-sm group relative">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{opp.title}</span>
                          <div className="flex items-center gap-1">
                            {opp.status === "new" && (
                              <button onClick={() => markAsViewed(opp.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <Eye className="h-3 w-3 text-muted-foreground hover:text-primary" />
                              </button>
                            )}
                            <Badge variant="default" className="text-xs">{opp.score}/100</Badge>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{opp.description}</p>
                        {opp.status === "new" && (
                          <div className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary animate-pulse" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Alerts */}
                {alerts.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Alertas
                    </h4>
                    {alerts.map((alert) => (
                      <div key={alert.id} className="p-2 rounded-md bg-amber-500/5 border border-amber-500/10 text-sm">
                        <span className="font-medium">{alert.title}</span>
                        {alert.alert_type && (
                          <Badge variant="outline" className="ml-2 text-[10px]">{alert.alert_type}</Badge>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">{alert.description}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Trends */}
                {trends.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                      Tendências
                    </h4>
                    <ul className="space-y-1">
                      {trends.map((t) => (
                        <li key={t.id} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <span className="text-emerald-500 mt-0.5">•</span> {t.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Actions */}
                {actions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold flex items-center gap-1.5">
                      <Lightbulb className="h-4 w-4 text-amber-500" />
                      Ações Sugeridas
                    </h4>
                    <ul className="space-y-1">
                      {actions.map((a) => (
                        <li key={a.id} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <span className="text-primary mt-0.5">→</span> {a.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {latestBatch && (
                  <p className="text-[10px] text-muted-foreground col-span-full text-right">
                    Última análise: {new Date(latestBatch).toLocaleString("pt-BR")}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
