import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain,
  Sparkles,
  PenTool,
  Loader2,
  Copy,
  Check,
  TrendingUp,
  Clock,
  Hash,
  FileText,
  Lightbulb,
  BarChart3,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { SaveAnalysisDialog } from "./SaveAnalysisDialog";

interface PatternData {
  top_formats: { format: string; avg_engagement: number; percentage: number }[];
  best_times: { day: string; time_range: string; engagement_boost?: string }[];
  trending_themes: { theme: string; examples: number; avg_engagement?: number }[];
  top_hashtags: { hashtag: string; frequency: number; avg_engagement?: number }[];
  caption_insights?: { optimal_length?: string; best_tone?: string; cta_usage?: string };
  summary: string;
}

interface Suggestion {
  title: string;
  format: string;
  platform: string;
  description: string;
  justification: string;
  hashtags: string[];
}

interface GeneratedPost {
  main_text: string;
  caption_variations: string[];
  hashtags: { tag: string; relevance: number }[];
  recommended_format: string;
  best_time: string;
  tips?: string;
}

export function ContentIntelligencePanel() {
  const [patterns, setPatterns] = useState<PatternData | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [generatedPost, setGeneratedPost] = useState<GeneratedPost | null>(null);
  const [loadingPatterns, setLoadingPatterns] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingPost, setLoadingPost] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [saveDialog, setSaveDialog] = useState<{ open: boolean; type: "patterns" | "suggestions" | "post"; data: any; title?: string }>({
    open: false, type: "patterns", data: null,
  });

  // Post generator form
  const [theme, setTheme] = useState("");
  const [objective, setObjective] = useState("engajamento");
  const [platform, setPlatform] = useState("instagram");
  const [tone, setTone] = useState("profissional");
  const [activeTab, setActiveTab] = useState("analysis");

  const analyzePatterns = async () => {
    setLoadingPatterns(true);
    try {
      const { data, error } = await supabase.functions.invoke("influencer-content-intelligence", {
        body: { action: "analyze_patterns" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPatterns(data.data);
      toast.success("Análise concluída!");
    } catch (err: any) {
      toast.error(err.message || "Erro na análise");
    } finally {
      setLoadingPatterns(false);
    }
  };

  const suggestContent = async () => {
    if (!patterns) {
      toast.error("Analise os padrões primeiro");
      return;
    }
    setLoadingSuggestions(true);
    try {
      const { data, error } = await supabase.functions.invoke("influencer-content-intelligence", {
        body: { action: "suggest_content", patterns },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSuggestions(data.data?.suggestions || []);
      toast.success("Sugestões geradas!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar sugestões");
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const generatePost = async (prefillTheme?: string) => {
    const t = prefillTheme || theme;
    if (!t.trim()) {
      toast.error("Informe o tema da postagem");
      return;
    }
    setLoadingPost(true);
    try {
      const { data, error } = await supabase.functions.invoke("influencer-content-intelligence", {
        body: { action: "generate_post", theme: t, objective, platform, tone, patterns },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setGeneratedPost(data.data);
      toast.success("Postagem gerada!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar postagem");
    } finally {
      setLoadingPost(false);
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success("Copiado!");
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSuggestionCreate = (s: Suggestion) => {
    setTheme(s.title);
    setPlatform(s.platform.toLowerCase().includes("tiktok") ? "tiktok" : s.platform.toLowerCase().includes("youtube") ? "youtube" : "instagram");
    setActiveTab("creator");
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Inteligência de Conteúdo</CardTitle>
        </div>
        <CardDescription>
          Analise padrões de performance e gere conteúdo otimizado com IA
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="analysis" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Análise
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="gap-1.5">
              <Lightbulb className="h-3.5 w-3.5" />
              Sugestões
            </TabsTrigger>
            <TabsTrigger value="creator" className="gap-1.5">
              <PenTool className="h-3.5 w-3.5" />
              Criar Post
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Analysis */}
          <TabsContent value="analysis" className="space-y-4">
            <Button onClick={analyzePatterns} disabled={loadingPatterns} className="w-full">
              {loadingPatterns ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {loadingPatterns ? "Analisando posts..." : "Analisar Conteúdo dos Influenciadores"}
            </Button>

            {patterns && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{patterns.summary}</p>

                {/* Top Formats */}
                <div>
                  <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
                    <FileText className="h-4 w-4 text-primary" /> Top Formatos
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {patterns.top_formats.map((f, i) => (
                      <Badge key={i} variant="secondary" className="gap-1">
                        {f.format}
                        <span className="text-primary font-bold">{f.avg_engagement?.toFixed(1)}%</span>
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Best Times */}
                <div>
                  <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
                    <Clock className="h-4 w-4 text-primary" /> Melhores Horários
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {patterns.best_times.map((t, i) => (
                      <div key={i} className="bg-muted rounded-md p-2 text-sm">
                        <span className="font-medium">{t.day}</span>
                        <span className="text-muted-foreground ml-1">{t.time_range}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Trending Themes */}
                <div>
                  <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
                    <TrendingUp className="h-4 w-4 text-primary" /> Temas em Alta
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {patterns.trending_themes.map((t, i) => (
                      <Badge key={i} variant="outline">
                        {t.theme} ({t.examples})
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Top Hashtags */}
                <div>
                  <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
                    <Hash className="h-4 w-4 text-primary" /> Hashtags Mais Efetivas
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {patterns.top_hashtags.map((h, i) => (
                      <Badge
                        key={i}
                        variant="ghost"
                        className="cursor-pointer hover:bg-primary/10"
                        onClick={() => copyText(h.hashtag, h.hashtag)}
                      >
                        {h.hashtag}
                        {copied === h.hashtag ? <Check className="h-3 w-3 ml-1" /> : <Copy className="h-3 w-3 ml-1 opacity-50" />}
                      </Badge>
                    ))}
                  </div>
                </div>

                {patterns.caption_insights && (
                  <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                    <h4 className="font-medium">Insights de Legenda</h4>
                    {patterns.caption_insights.optimal_length && (
                      <p>📏 Tamanho ideal: {patterns.caption_insights.optimal_length}</p>
                    )}
                    {patterns.caption_insights.best_tone && (
                      <p>🎯 Tom: {patterns.caption_insights.best_tone}</p>
                    )}
                    {patterns.caption_insights.cta_usage && (
                      <p>📢 CTA: {patterns.caption_insights.cta_usage}</p>
                    )}
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => setSaveDialog({ open: true, type: "patterns", data: patterns })}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Análise
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Tab 2: Suggestions */}
          <TabsContent value="suggestions" className="space-y-4">
            <Button onClick={suggestContent} disabled={loadingSuggestions || !patterns} className="w-full">
              {loadingSuggestions ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lightbulb className="h-4 w-4 mr-2" />}
              {!patterns ? "Analise os padrões primeiro" : loadingSuggestions ? "Gerando sugestões..." : "Gerar Sugestões para sua Marca"}
            </Button>

            {suggestions.length > 0 && (
              <div className="space-y-3">
                {suggestions.map((s, i) => (
                  <Card key={i} className="bg-muted/30">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{s.title}</h4>
                          <div className="flex gap-1.5 mt-1">
                            <Badge variant="secondary" className="text-xs">{s.format}</Badge>
                            <Badge variant="outline" className="text-xs">{s.platform}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-2">{s.description}</p>
                          <p className="text-xs text-muted-foreground mt-1 italic">💡 {s.justification}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {s.hashtags.slice(0, 5).map((h, j) => (
                              <span key={j} className="text-xs text-primary">{h}</span>
                            ))}
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleSuggestionCreate(s)}>
                          <PenTool className="h-3.5 w-3.5 mr-1" />
                          Criar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab 3: Post Creator */}
          <TabsContent value="creator" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium mb-1 block">Tema / Assunto</label>
                <Input
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="Ex: Lançamento de novo produto, dicas do setor..."
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Objetivo</label>
                <Select value={objective} onValueChange={setObjective}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="engajamento">Engajamento</SelectItem>
                    <SelectItem value="vendas">Vendas</SelectItem>
                    <SelectItem value="awareness">Awareness</SelectItem>
                    <SelectItem value="educacao">Educação</SelectItem>
                    <SelectItem value="autoridade">Autoridade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Plataforma</label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="twitter">Twitter / X</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Tom</label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="profissional">Profissional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="humoristico">Humorístico</SelectItem>
                    <SelectItem value="inspiracional">Inspiracional</SelectItem>
                    <SelectItem value="educativo">Educativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={() => generatePost()} disabled={loadingPost} className="w-full">
              {loadingPost ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {loadingPost ? "Gerando postagem..." : "Gerar com IA"}
            </Button>

            {generatedPost && (
              <div className="space-y-4">
                {/* Main Text */}
                <div className="relative">
                  <label className="text-sm font-medium mb-1 block">Texto Principal</label>
                  <div className="bg-muted rounded-lg p-3 text-sm whitespace-pre-wrap">{generatedPost.main_text}</div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-0 right-0"
                    onClick={() => copyText(generatedPost.main_text, "main")}
                  >
                    {copied === "main" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>

                {/* Variations */}
                {generatedPost.caption_variations?.length > 0 && (
                  <div>
                    <label className="text-sm font-medium mb-1 block">Variações de Legenda</label>
                    <div className="space-y-2">
                      {generatedPost.caption_variations.map((v, i) => (
                        <div key={i} className="bg-muted/50 rounded-md p-2.5 text-sm flex items-start justify-between gap-2">
                          <span className="flex-1">{v}</span>
                          <Button size="sm" variant="ghost" onClick={() => copyText(v, `var-${i}`)}>
                            {copied === `var-${i}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>
                      ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setSaveDialog({ open: true, type: "suggestions", data: suggestions })}
              >
                <Save className="h-4 w-4 mr-2" />
                Salvar Sugestões
              </Button>
            </div>
            )}

                {/* Hashtags */}
                <div>
                  <label className="text-sm font-medium mb-1 block">Hashtags (por relevância)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {generatedPost.hashtags.map((h, i) => (
                      <Badge
                        key={i}
                        variant={h.relevance >= 8 ? "default" : h.relevance >= 5 ? "secondary" : "outline"}
                        className="cursor-pointer"
                        onClick={() => copyText(h.tag, h.tag)}
                      >
                        {h.tag}
                        {copied === h.tag ? <Check className="h-3 w-3 ml-1" /> : <Copy className="h-3 w-3 ml-1 opacity-40" />}
                      </Badge>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => copyText(generatedPost.hashtags.map((h) => h.tag).join(" "), "all-hashtags")}
                  >
                    {copied === "all-hashtags" ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                    Copiar todas hashtags
                  </Button>
                </div>

                {/* Meta */}
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span>📱 Formato: <strong className="text-foreground">{generatedPost.recommended_format}</strong></span>
                  <span>🕐 Melhor horário: <strong className="text-foreground">{generatedPost.best_time}</strong></span>
                </div>

                {generatedPost.tips && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
                    💡 {generatedPost.tips}
                  </div>
                )}

                {/* Copy All */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const full = `${generatedPost.main_text}\n\n${generatedPost.hashtags.map((h) => h.tag).join(" ")}`;
                    copyText(full, "all");
                  }}
                >
                  {copied === "all" ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  Copiar Texto + Hashtags
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
