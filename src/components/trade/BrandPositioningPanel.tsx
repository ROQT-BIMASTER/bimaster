import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from "recharts";
import { Brain, Loader2, TrendingUp, AlertTriangle, Lightbulb, Clock, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { chartColors, chartPalette } from "@/lib/chart-colors";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BrandPositioningPanelProps {
  competitors: Array<{ id: string; name: string; brand: string | null }>;
}

interface AnalysisResult {
  our_brand: {
    name: string;
    scores: Record<string, number>;
    pontos_fortes: string[];
    pontos_fracos: string[];
  };
  competitors: Array<{
    name: string;
    scores: Record<string, number>;
    pontos_fortes: string[];
    pontos_fracos: string[];
  }>;
  oportunidades: string[];
  recomendacoes: string[];
  fontes_sugeridas: string[];
  resumo_executivo: string;
}

const AXIS_LABELS: Record<string, string> = {
  preco: "Preço",
  qualidade: "Qualidade",
  presenca_digital: "Presença Digital",
  inovacao: "Inovação",
  brand_awareness: "Brand Awareness",
};

export function BrandPositioningPanel({ competitors }: BrandPositioningPanelProps) {
  const [brands, setBrands] = useState<Array<{ id: string; brand_name: string }>>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    fetchBrands();
    fetchHistory();
  }, []);

  const fetchBrands = async () => {
    const { data } = await supabase.from("our_brands").select("id, brand_name").eq("active", true);
    setBrands(data || []);
    if (data?.length) setSelectedBrand(data[0].id);
  };

  const fetchHistory = async () => {
    const { data } = await supabase
      .from("brand_positioning_analyses")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);
    setHistory(data || []);
    setLoadingHistory(false);
  };

  const runAnalysis = async () => {
    if (!selectedBrand) {
      toast.error("Selecione uma marca");
      return;
    }
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-brand-positioning", {
        body: {
          brand_id: selectedBrand,
          competitor_ids: selectedCompetitors.length > 0 ? selectedCompetitors : undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAnalysis(data.analysis);
      toast.success("Análise de posicionamento concluída!");
      fetchHistory();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao analisar posicionamento");
    } finally {
      setAnalyzing(false);
    }
  };

  const loadFromHistory = (item: any) => {
    setAnalysis(item.analysis_result as AnalysisResult);
    toast.info("Análise carregada do histórico");
  };

  // Build radar chart data
  const radarData = analysis
    ? Object.keys(AXIS_LABELS).map((key) => ({
        axis: AXIS_LABELS[key],
        [analysis.our_brand.name]: analysis.our_brand.scores[key] || 0,
        ...Object.fromEntries(
          analysis.competitors.map((c) => [c.name, c.scores[key] || 0])
        ),
      }))
    : [];

  const allNames = analysis
    ? [analysis.our_brand.name, ...analysis.competitors.map((c) => c.name)]
    : [];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Análise de Posicionamento de Marca
          </CardTitle>
          <CardDescription>
            Compare o posicionamento da sua marca com os concorrentes usando IA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5 min-w-[200px]">
              <label className="text-sm font-medium">Nossa Marca</label>
              <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.brand_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <label className="text-sm font-medium">
                Concorrentes ({selectedCompetitors.length > 0 ? selectedCompetitors.length : "Todos"})
              </label>
              <div className="flex flex-wrap gap-1.5">
                {competitors.slice(0, 8).map((c) => (
                  <Badge
                    key={c.id}
                    variant={selectedCompetitors.includes(c.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() =>
                      setSelectedCompetitors((prev) =>
                        prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                      )
                    }
                  >
                    {c.name}
                  </Badge>
                ))}
              </div>
            </div>

            <Button onClick={runAnalysis} disabled={analyzing || !selectedBrand} className="gap-2">
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              {analyzing ? "Analisando..." : "Analisar Posicionamento"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {analysis && (
        <>
          {/* Executive Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resumo Executivo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">{analysis.resumo_executivo}</p>
            </CardContent>
          </Card>

          {/* Radar Chart */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Comparativo de Posicionamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="axis" tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    {allNames.map((name, i) => (
                      <Radar
                        key={name}
                        name={name}
                        dataKey={name}
                        stroke={chartPalette[i % chartPalette.length]}
                        fill={chartPalette[i % chartPalette.length]}
                        fillOpacity={i === 0 ? 0.25 : 0.1}
                        strokeWidth={i === 0 ? 2.5 : 1.5}
                      />
                    ))}
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Brand Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Our Brand */}
            <Card className="border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  {analysis.our_brand.name}
                  <Badge variant="default" className="ml-auto">Nossa Marca</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Pontos Fortes</p>
                  {analysis.our_brand.pontos_fortes.map((p, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-sm mb-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Pontos Fracos</p>
                  {analysis.our_brand.pontos_fracos.map((p, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-sm mb-1">
                      <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Competitor Cards */}
            {analysis.competitors.map((comp, idx) => (
              <Card key={idx}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    {comp.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Pontos Fortes</p>
                    {comp.pontos_fortes.slice(0, 3).map((p, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-sm mb-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                        <span>{p}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Pontos Fracos</p>
                    {comp.pontos_fracos.slice(0, 3).map((p, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-sm mb-1">
                        <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                        <span>{p}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Opportunities & Recommendations */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-warning" />
                  Oportunidades
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {analysis.oportunidades.map((o, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-primary font-bold">{i + 1}.</span>
                      {o}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Recomendações Estratégicas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {analysis.recomendacoes.map((r, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-primary font-bold">{i + 1}.</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Sources */}
          {analysis.fontes_sugeridas?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Fontes Sugeridas para Pesquisa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {analysis.fontes_sugeridas.map((f, i) => (
                    <Badge key={i} variant="outline">{f}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Análises Anteriores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((h) => (
                <button
                  key={h.id}
                  onClick={() => loadFromHistory(h)}
                  className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {(h.analysis_result as any)?.our_brand?.name || "Análise"} vs {(h.competitor_ids as string[])?.length || 0} concorrentes
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(h.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <Badge variant="outline">Carregar</Badge>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
