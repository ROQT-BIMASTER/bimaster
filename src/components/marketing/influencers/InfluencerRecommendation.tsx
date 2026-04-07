import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sparkles, Loader2, Trophy, CheckCircle, AlertTriangle, Target } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onAdded?: () => void;
}

export function InfluencerRecommendation({ onAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [form, setForm] = useState({
    niche: "",
    target_audience: "",
    budget: "",
    objective: "",
    description: "",
  });

  const handleAnalyze = async () => {
    if (!form.niche.trim() && !form.description.trim()) {
      toast.error("Descreva sua marca ou nicho");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // We use a dummy influencer_id since recommendation compares all
      const { data: influencers } = await supabase
        .from("influencers")
        .select("id")
        .eq("status", "active")
        .limit(1);

      if (!influencers || influencers.length === 0) {
        toast.error("Adicione influenciadores ao monitoramento primeiro");
        return;
      }

      const { data, error } = await supabase.functions.invoke("analyze-influencer", {
        body: {
          influencer_id: influencers[0].id,
          analysis_type: "recommendation",
          brand_context: form,
        },
      });

      if (error) throw error;
      setResult(data?.data);
      toast.success("Recomendações geradas!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar recomendações");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Target className="h-4 w-4" />
          Recomendar para minha marca
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Recomendação de Influenciadores com IA
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Nicho / Segmento</Label>
              <Input placeholder="Ex: Beleza, Tech, Fitness..." value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} />
            </div>
            <div>
              <Label>Público-alvo</Label>
              <Input placeholder="Ex: Mulheres 25-35, Gamers..." value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })} />
            </div>
            <div>
              <Label>Orçamento</Label>
              <Input placeholder="Ex: R$ 5.000 - R$ 20.000" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
            </div>
            <div>
              <Label>Objetivo</Label>
              <Input placeholder="Ex: Awareness, Vendas, Engajamento..." value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Descrição da marca/campanha</Label>
            <Textarea placeholder="Descreva sua marca, produto ou campanha..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>
          <Button onClick={handleAnalyze} disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Analisando influenciadores..." : "Gerar Recomendações"}
          </Button>

          {result && (
            <div className="space-y-4">
              {/* Rankings */}
              {result.rankings && result.rankings.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2"><Trophy className="h-4 w-4 text-yellow-600" /> Ranking de Influenciadores</h3>
                  {result.rankings.map((r: any, i: number) => (
                    <Card key={i} className={i === 0 ? "border-primary" : ""}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-muted-foreground">#{i + 1}</span>
                            <div>
                              <p className="font-semibold">@{r.username}</p>
                              <Badge variant="outline" className="text-xs capitalize">{r.platform}</Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-primary">{r.compatibility_score}%</p>
                            <p className="text-xs text-muted-foreground">compatibilidade</p>
                          </div>
                        </div>
                        <Progress value={r.compatibility_score} className="h-2 mb-3" />
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs font-medium text-green-600 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Prós</p>
                            <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                              {(r.pros || []).map((p: string, j: number) => <li key={j}>• {p}</li>)}
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-red-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Contras</p>
                            <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                              {(r.cons || []).map((c: string, j: number) => <li key={j}>• {c}</li>)}
                            </ul>
                          </div>
                        </div>
                        {r.best_for && <p className="text-xs text-muted-foreground mt-2"><strong>Melhor para:</strong> {r.best_for}</p>}
                        {r.estimated_cpm && <p className="text-xs text-muted-foreground"><strong>CPM estimado:</strong> {r.estimated_cpm}</p>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {result.strategy_recommendation && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Estratégia Recomendada</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground">{result.strategy_recommendation}</p></CardContent>
                </Card>
              )}

              {result.budget_suggestion && (
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm"><strong>Sugestão de orçamento:</strong> {result.budget_suggestion}</p>
                  </CardContent>
                </Card>
              )}

              {result.campaign_tips && result.campaign_tips.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Dicas para a Campanha</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      {result.campaign_tips.map((tip: string, i: number) => (
                        <li key={i} className="flex items-start gap-2"><Sparkles className="h-3 w-3 text-primary mt-1 shrink-0" />{tip}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
