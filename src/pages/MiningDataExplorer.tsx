import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, Users, FileText, MessageCircle, Brain, Target,
  Download, Loader2, ChevronLeft, ChevronRight, Search, Eye,
  ThumbsUp, ThumbsDown, Minus, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 20;

// ─── Helpers ────────────────────────────────────────────
function sentimentBadge(s: string | null) {
  if (!s) return <Badge variant="outline"><Minus className="h-3 w-3 mr-1" />Sem análise</Badge>;
  if (s === "positive") return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"><ThumbsUp className="h-3 w-3 mr-1" />Positivo</Badge>;
  if (s === "negative") return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"><ThumbsDown className="h-3 w-3 mr-1" />Negativo</Badge>;
  return <Badge variant="secondary"><Minus className="h-3 w-3 mr-1" />Neutro</Badge>;
}

function fmtNumber(n: number | null) {
  if (n == null) return "–";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("pt-BR");
}

function fmtDate(d: string | null) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function downloadCSV(rows: Record<string, any>[], filename: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(","), ...rows.map(r => keys.map(k => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Pagination ─────────────────────────────────────────
function Paginator({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center gap-2 justify-end mt-4">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm text-muted-foreground">{page} / {pages}</span>
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────
export default function MiningDataExplorer() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("influencers");

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Explorador de Dados Minerados</h1>
          <p className="text-sm text-muted-foreground">Analise em detalhes todos os dados coletados pelo Autopilot</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="influencers" className="gap-1"><Users className="h-4 w-4" />Influenciadores</TabsTrigger>
          <TabsTrigger value="posts" className="gap-1"><FileText className="h-4 w-4" />Posts</TabsTrigger>
          <TabsTrigger value="comments" className="gap-1"><MessageCircle className="h-4 w-4" />Comentários</TabsTrigger>
          <TabsTrigger value="analyses" className="gap-1"><Brain className="h-4 w-4" />Análises IA</TabsTrigger>
          <TabsTrigger value="opportunities" className="gap-1"><Target className="h-4 w-4" />Oportunidades</TabsTrigger>
        </TabsList>

        <TabsContent value="influencers"><InfluencersTab /></TabsContent>
        <TabsContent value="posts"><PostsTab /></TabsContent>
        <TabsContent value="comments"><CommentsTab /></TabsContent>
        <TabsContent value="analyses"><AnalysesTab /></TabsContent>
        <TabsContent value="opportunities"><OpportunitiesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Influencers Tab ────────────────────────────────────
function InfluencersTab() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [platform, setPlatform] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => { load(); }, [page, platform]);

  const load = async () => {
    setLoading(true);
    let q = (supabase as any).from("influencer_profiles").select("*", { count: "exact" });
    if (platform !== "all") q = q.eq("platform", platform);
    if (search) q = q.ilike("username", `%${search}%`);
    const { data: d, count } = await q.order("composite_score", { ascending: false, nullsFirst: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    setData(d || []);
    setTotal(count || 0);
    setLoading(false);
  };

  useEffect(() => { if (search !== undefined) { const t = setTimeout(() => { setPage(1); load(); }, 400); return () => clearTimeout(t); } }, [search]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Influenciadores ({total})
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar username..." className="pl-8 w-48" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={platform} onValueChange={v => { setPlatform(v); setPage(1); }}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => downloadCSV(data, "influenciadores.csv")}><Download className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
          <>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Plataforma</TableHead>
                    <TableHead className="text-right">Seguidores</TableHead>
                    <TableHead className="text-right">Engagement</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Rank</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map(i => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">@{i.username}</TableCell>
                      <TableCell><Badge variant="outline">{i.platform}</Badge></TableCell>
                      <TableCell className="text-right">{fmtNumber(i.followers_count)}</TableCell>
                      <TableCell className="text-right">{i.engagement_rate ? `${i.engagement_rate.toFixed(2)}%` : "–"}</TableCell>
                      <TableCell className="text-right font-semibold">{i.composite_score?.toFixed(1) ?? "–"}</TableCell>
                      <TableCell className="text-right">{i.rank ?? "–"}</TableCell>
                      <TableCell>
                        <Badge variant={i.is_active ? "default" : "secondary"}>{i.is_active ? "Ativo" : "Inativo"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!data.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum influenciador encontrado</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
            <Paginator page={page} total={total} onChange={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Posts Tab ───────────────────────────────────────────
function PostsTab() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => { load(); }, [page, typeFilter]);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("influencer_posts").select("*, influencer_profiles!inner(username, platform)", { count: "exact" });
    if (typeFilter !== "all") q = q.eq("post_type", typeFilter);
    const { data: d, count } = await q.order("posted_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    setData(d || []);
    setTotal(count || 0);
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Posts ({total})
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1); }}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="image">Imagem</SelectItem>
                <SelectItem value="video">Vídeo</SelectItem>
                <SelectItem value="carousel">Carrossel</SelectItem>
                <SelectItem value="reel">Reel</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => downloadCSV(data.map(d => ({ ...d, influencer: (d as any).influencer_profiles?.username })), "posts.csv")}><Download className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
          <>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Influenciador</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Likes</TableHead>
                    <TableHead className="text-right">Comentários</TableHead>
                    <TableHead className="text-right">Shares</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">@{(p as any).influencer_profiles?.username ?? "?"}</TableCell>
                      <TableCell><Badge variant="outline">{p.post_type}</Badge></TableCell>
                      <TableCell className="text-right">{fmtNumber(p.likes_count)}</TableCell>
                      <TableCell className="text-right">{fmtNumber(p.comments_count)}</TableCell>
                      <TableCell className="text-right">{fmtNumber(p.shares_count)}</TableCell>
                      <TableCell className="text-right">{fmtNumber(p.views_count)}</TableCell>
                      <TableCell>{fmtDate(p.posted_at)}</TableCell>
                    </TableRow>
                  ))}
                  {!data.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum post encontrado</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
            <Paginator page={page} total={total} onChange={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Comments Tab ───────────────────────────────────────
function CommentsTab() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [sentFilter, setSentFilter] = useState("all");

  useEffect(() => { load(); }, [page, sentFilter]);

  const load = async () => {
    setLoading(true);
    let q = (supabase as any).from("influencer_post_comments").select("*, influencer_posts!inner(influencer_profiles!inner(username))", { count: "exact" });
    if (sentFilter !== "all") q = q.eq("sentiment", sentFilter);
    const { data: d, count } = await q.order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    setData(d || []);
    setTotal(count || 0);
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Comentários ({total})
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={sentFilter} onValueChange={v => { setSentFilter(v); setPage(1); }}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="positive">Positivos</SelectItem>
                <SelectItem value="neutral">Neutros</SelectItem>
                <SelectItem value="negative">Negativos</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => downloadCSV(data, "comentarios.csv")}><Download className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
          <>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Influenciador</TableHead>
                    <TableHead>Autor</TableHead>
                    <TableHead className="max-w-xs">Texto</TableHead>
                    <TableHead>Sentimento</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead>Spam</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">@{(c as any).influencer_posts?.influencer_profiles?.username ?? "?"}</TableCell>
                      <TableCell>{c.author_username ?? "–"}</TableCell>
                      <TableCell className="max-w-xs truncate" title={c.comment_text}>{c.comment_text?.slice(0, 80)}{c.comment_text?.length > 80 ? "…" : ""}</TableCell>
                      <TableCell>{sentimentBadge(c.sentiment)}</TableCell>
                      <TableCell className="text-right">{c.sentiment_score?.toFixed(2) ?? "–"}</TableCell>
                      <TableCell>{c.is_spam ? <Badge variant="destructive">Spam</Badge> : "–"}</TableCell>
                      <TableCell>{fmtDate(c.created_at)}</TableCell>
                    </TableRow>
                  ))}
                  {!data.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum comentário encontrado</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
            <Paginator page={page} total={total} onChange={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Analyses Tab ───────────────────────────────────────
function AnalysesTab() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => { load(); }, [page]);

  const load = async () => {
    setLoading(true);
    const { data: d, count } = await supabase.from("influencer_analyses")
      .select("*, influencer_profiles!inner(username, platform)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    setData(d || []);
    setTotal(count || 0);
    setLoading(false);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Análises IA ({total})
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => downloadCSV(data.map(d => ({ ...d, influencer: (d as any).influencer_profiles?.username })), "analises.csv")}><Download className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
            <>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Influenciador</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Modelo IA</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">@{(a as any).influencer_profiles?.username ?? "?"}</TableCell>
                        <TableCell><Badge variant="outline">{a.analysis_type}</Badge></TableCell>
                        <TableCell className="text-muted-foreground text-sm">{a.model_used ?? "–"}</TableCell>
                        <TableCell>{fmtDate(a.created_at)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => setSelected(a)}>
                            <Eye className="h-4 w-4 mr-1" />Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!data.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma análise encontrada</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
              <Paginator page={page} total={total} onChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Análise — @{(selected as any)?.influencer_profiles?.username}</DialogTitle>
          </DialogHeader>
          {selected && <AnalysisResultView result={selected.result} type={selected.analysis_type} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function AnalysisResultView({ result, type }: { result: any; type: string }) {
  if (!result) return <p className="text-muted-foreground">Sem dados</p>;

  const data = typeof result === "string" ? JSON.parse(result) : result;

  // Render scores if present
  const scores = data.scores || data.metrics || {};
  const summary = data.summary || data.resumo || data.analysis || null;
  const recommendations = data.recommendations || data.recomendacoes || [];
  const strengths = data.strengths || data.pontos_fortes || [];
  const weaknesses = data.weaknesses || data.pontos_fracos || [];

  return (
    <div className="space-y-4">
      {/* Scores */}
      {Object.keys(scores).length > 0 && (
        <div>
          <h4 className="font-semibold mb-2">Scores</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(scores).map(([key, val]) => (
              <div key={key} className="bg-muted rounded-lg p-3 text-center">
                <div className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</div>
                <div className="text-lg font-bold">{typeof val === "number" ? (val as number).toFixed(1) : String(val)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div>
          <h4 className="font-semibold mb-1">Resumo</h4>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{summary}</p>
        </div>
      )}

      {/* Strengths */}
      {strengths.length > 0 && (
        <div>
          <h4 className="font-semibold mb-1 text-emerald-600">Pontos Fortes</h4>
          <ul className="list-disc pl-5 text-sm space-y-1">{strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}

      {/* Weaknesses */}
      {weaknesses.length > 0 && (
        <div>
          <h4 className="font-semibold mb-1 text-red-600">Pontos Fracos</h4>
          <ul className="list-disc pl-5 text-sm space-y-1">{weaknesses.map((w: string, i: number) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div>
          <h4 className="font-semibold mb-1 text-blue-600">Recomendações</h4>
          <ul className="list-disc pl-5 text-sm space-y-1">{recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
        </div>
      )}

      {/* Raw JSON fallback */}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">JSON completo</summary>
        <pre className="bg-muted rounded p-3 mt-2 overflow-auto max-h-60">{JSON.stringify(data, null, 2)}</pre>
      </details>
    </div>
  );
}

// ─── Opportunities Tab ──────────────────────────────────
function OpportunitiesTab() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => { load(); }, [page]);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: d, count } = await supabase.from("autopilot_opportunities")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("score", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    setData(d || []);
    setTotal(count || 0);
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Oportunidades ({total})
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => downloadCSV(data, "oportunidades.csv")}><Download className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
          <>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="max-w-sm">Descrição</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map(o => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.title}</TableCell>
                      <TableCell><Badge variant="outline">{o.opportunity_type}</Badge></TableCell>
                      <TableCell className="text-right font-semibold">{o.score?.toFixed(1) ?? "–"}</TableCell>
                      <TableCell>
                        <Badge variant={o.status === "new" ? "default" : "secondary"}>
                          {o.status === "new" ? "Novo" : o.status === "viewed" ? "Visto" : o.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-sm truncate text-sm text-muted-foreground" title={o.description}>{o.description?.slice(0, 100)}</TableCell>
                      <TableCell>{fmtDate(o.created_at)}</TableCell>
                    </TableRow>
                  ))}
                  {!data.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma oportunidade encontrada</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
            <Paginator page={page} total={total} onChange={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
