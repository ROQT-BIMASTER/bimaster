import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Brain, RefreshCw, ChevronDown, TrendingUp, AlertTriangle, Lightbulb, Target, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface OpportunityData {
  top_opportunities: Array<{
    username: string;
    platform: string;
    score: number;
    reason: string;
  }>;
  alerts: Array<{
    username: string;
    type: string;
    message: string;
  }>;
  trends: string[];
  suggested_actions: string[];
  generated_at: string;
}

interface AIOpportunitiesPanelProps {
  influencerCount: number;
  onRefresh?: () => void;
}

export function AIOpportunitiesPanel({ influencerCount, onRefresh }: AIOpportunitiesPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OpportunityData | null>(null);

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
        setData(result.data);
        toast.success("Análise de oportunidades atualizada!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar análise de oportunidades");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Brain className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Oportunidades IA</CardTitle>
              {data && (
                <Badge variant="secondary" className="text-xs">
                  {data.top_opportunities.length} oportunidades
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
            {!data ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Clique em "Atualizar Análise" para a IA gerar insights sobre seus influenciadores.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Top Opportunities */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5">
                    <Target className="h-4 w-4 text-primary" />
                    Top Oportunidades
                  </h4>
                  {data.top_opportunities.map((opp, i) => (
                    <div key={i} className="p-2 rounded-md bg-primary/5 border border-primary/10 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">@{opp.username}</span>
                        <Badge variant="default" className="text-xs">{opp.score}/100</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{opp.reason}</p>
                    </div>
                  ))}
                </div>

                {/* Alerts */}
                {data.alerts.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Alertas
                    </h4>
                    {data.alerts.map((alert, i) => (
                      <div key={i} className="p-2 rounded-md bg-amber-500/5 border border-amber-500/10 text-sm">
                        <span className="font-medium">@{alert.username}</span>
                        <p className="text-xs text-muted-foreground mt-1">{alert.message}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Trends */}
                {data.trends.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                      Tendências
                    </h4>
                    <ul className="space-y-1">
                      {data.trends.map((t, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <span className="text-emerald-500 mt-0.5">•</span> {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Suggested Actions */}
                {data.suggested_actions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold flex items-center gap-1.5">
                      <Lightbulb className="h-4 w-4 text-amber-500" />
                      Ações Sugeridas
                    </h4>
                    <ul className="space-y-1">
                      {data.suggested_actions.map((a, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <span className="text-primary mt-0.5">→</span> {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground col-span-full text-right">
                  Gerado em: {new Date(data.generated_at).toLocaleString("pt-BR")}
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
