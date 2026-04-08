import { useEffect, useState } from "react";
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
  ArrowLeft,
  Users,
  FileText,
  MessageCircle,
  Brain,
  Target,
  Download,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Minus,
} from "lucide-react";

const PAGE_SIZE = 20;

type InfluencerMap = Record<string, { username: string; platform: string | null }>;
type PostMap = Record<string, { influencer_id: string }>;

function sentimentBadge(sentiment: string | null) {
  if (!sentiment) return <Badge variant="outline"><Minus className="h-3 w-3 mr-1" />Sem análise</Badge>;
  if (sentiment === "positive") return <Badge variant="success"><ThumbsUp className="h-3 w-3 mr-1" />Positivo</Badge>;
  if (sentiment === "negative") return <Badge variant="destructive"><ThumbsDown className="h-3 w-3 mr-1" />Negativo</Badge>;
  return <Badge variant="secondary"><Minus className="h-3 w-3 mr-1" />Neutro</Badge>;
}

function fmtNumber(n: number | null | undefined) {
  if (n == null) return "–";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("pt-BR");
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [
    keys.join(","),
    ...rows.map((row) => keys.map((key) => `"${String(row[key] ?? "").replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function getCurrentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function fetchInfluencerMap(influencerIds: string[]): Promise<InfluencerMap> {
  if (!influencerIds.length) return {};

  const uniqueIds = [...new Set(influencerIds.filter(Boolean))];
  if (!uniqueIds.length) return {};

  const { data } = await supabase
    .from("influencers")
    .select("id, username, platform")
    .in("id", uniqueIds);

  return Object.fromEntries(
    (data || []).map((item) => [item.id, { username: item.username, platform: item.platform }]),
  );
}

async function fetchPostMap(postIds: string[]): Promise<PostMap> {
  if (!postIds.length) return {};

  const uniqueIds = [...new Set(postIds.filter(Boolean))];
  if (!uniqueIds.length) return {};

  const { data } = await supabase
    .from("influencer_posts")
    .select("id, influencer_id")
    .in("id", uniqueIds);

  return Object.fromEntries(
    (data || []).map((item) => [item.id, { influencer_id: item.influencer_id }]),
  );
}

function Paginator({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-end gap-2">
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

export default function MiningDataExplorer() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("influencers");

  return (
    <div className="min-h-screen space-y-4 bg-background p-4 md:p-6">
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
        <TabsList className="flex h-auto flex-wrap gap-1">
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

function InfluencersTab() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [platform, setPlatform] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [page, platform, search]);

  const load = async () => {
    setLoading(true);

    const userId = await getCurrentUserId();
    if (!userId) {
      setData([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    let query = supabase
      .from("influencers")
      .select("*", { count: "exact" })
      .eq("user_id", userId);

    if (platform !== "all") query = query.eq("platform", platform);
    if (search.trim()) query = query.ilike("username", `%${search.trim()}%`);

    const { data: rows, count } = await query
      .order("composite_score", { ascending: false, nullsFirst: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    setData(rows || []);
    setTotal(count || 0);
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" />
            Influenciadores ({total})
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar username..." className="w-48 pl-8" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
            </div>
            <Select value={platform} onValueChange={(value) => { setPlatform(value); setPage(1); }}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
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
            <Button variant="outline" size="sm" onClick={() => downloadCSV(data, "influenciadores.csv")}><Download className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
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
                {data.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">@{item.username}</TableCell>
                    <TableCell><Badge variant="outline">{item.platform}</Badge></TableCell>
                    <TableCell className="text-right">{fmtNumber(item.followers_count)}</TableCell>
                    <TableCell className="text-right">{item.engagement_rate ? `${Number(item.engagement_rate).toFixed(2)}%` : "–"}</TableCell>
                    <TableCell className="text-right font-semibold">{item.composite_score != null ? Number(item.composite_score).toFixed(1) : "–"}</TableCell>
                    <TableCell className="text-right">{item.rank_position ?? "–"}</TableCell>
                    <TableCell><Badge variant={item.status === "active" ? "default" : "secondary"}>{item.status === "active" ? "Ativo" : item.status}</Badge></TableCell>
                  </TableRow>
                ))}
                {!data.length && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nenhum influenciador encontrado</TableCell></TableRow>}
              </TableBody>
            </Table>
            <Paginator page={page} total={total} onChange={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PostsTab() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    void load();
  }, [page, typeFilter]);

  const load = async () => {
    setLoading(true);

    const userId = await getCurrentUserId();
    if (!userId) {
      setData([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    let query = supabase
      .from("influencer_posts")
      .select("*", { count: "exact" })
      .eq("user_id", userId);

    if (typeFilter !== "all") query = query.eq("post_type", typeFilter);

    const { data: rows, count } = await query
      .order("posted_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    const influencerMap = await fetchInfluencerMap((rows || []).map((item) => item.influencer_id));
    const enriched = (rows || []).map((item) => ({
      ...item,
      influencer_username: influencerMap[item.influencer_id]?.username ?? "?",
      influencer_platform: influencerMap[item.influencer_id]?.platform ?? null,
    }));

    setData(enriched);
    setTotal(count || 0);
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Posts ({total})
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={typeFilter} onValueChange={(value) => { setTypeFilter(value); setPage(1); }}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="image">Imagem</SelectItem>
                <SelectItem value="video">Vídeo</SelectItem>
                <SelectItem value="carousel">Carrossel</SelectItem>
                <SelectItem value="reel">Reel</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => downloadCSV(data, "posts.csv")}><Download className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Influenciador</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Likes</TableHead>
                  <TableHead className="text-right">Comentários</TableHead>
                  <TableHead className="text-right">Shares</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">@{item.influencer_username}</TableCell>
                    <TableCell><Badge variant="outline">{item.post_type}</Badge></TableCell>
                    <TableCell className="text-right">{fmtNumber(item.likes)}</TableCell>
                    <TableCell className="text-right">{fmtNumber(item.comments_count)}</TableCell>
                    <TableCell className="text-right">{fmtNumber(item.shares)}</TableCell>
                    <TableCell>{fmtDate(item.posted_at)}</TableCell>
                  </TableRow>
                ))}
                {!data.length && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum post encontrado</TableCell></TableRow>}
              </TableBody>
            </Table>
            <Paginator page={page} total={total} onChange={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CommentsTab() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [sentiment, setSentiment] = useState("all");

  useEffect(() => {
    void load();
  }, [page, sentiment]);

  const load = async () => {
    setLoading(true);

    const userId = await getCurrentUserId();
    if (!userId) {
      setData([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    const { data: userPosts } = await supabase
      .from("influencer_posts")
      .select("id, influencer_id")
      .eq("user_id", userId);

    const postIds = (userPosts || []).map((item) => item.id);
    if (!postIds.length) {
      setData([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    let query = supabase
      .from("influencer_comments")
      .select("*", { count: "exact" })
      .in("post_id", postIds);

    if (sentiment !== "all") query = query.eq("sentiment", sentiment);

    const { data: rows, count } = await query
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    const postMap = Object.fromEntries((userPosts || []).map((item) => [item.id, { influencer_id: item.influencer_id }]));
    const influencerMap = await fetchInfluencerMap((rows || []).map((item) => postMap[item.post_id]?.influencer_id).filter(Boolean));

    const enriched = (rows || []).map((item) => {
      const influencerId = postMap[item.post_id]?.influencer_id;
      return {
        ...item,
        influencer_username: influencerId ? influencerMap[influencerId]?.username ?? "?" : "?",
      };
    });

    setData(enriched);
    setTotal(count || 0);
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5 text-primary" />
            Comentários ({total})
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={sentiment} onValueChange={(value) => { setSentiment(value); setPage(1); }}>
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
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
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
                {data.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">@{item.influencer_username}</TableCell>
                    <TableCell>{item.author_username ?? "–"}</TableCell>
                    <TableCell className="max-w-xs truncate" title={item.comment_text}>{item.comment_text?.slice(0, 80)}{item.comment_text?.length > 80 ? "…" : ""}</TableCell>
                    <TableCell>{sentimentBadge(item.sentiment)}</TableCell>
                    <TableCell className="text-right">{item.sentiment_score != null ? Number(item.sentiment_score).toFixed(2) : "–"}</TableCell>
                    <TableCell>{item.is_spam ? <Badge variant="destructive">Spam</Badge> : "–"}</TableCell>
                    <TableCell>{fmtDate(item.created_at)}</TableCell>
                  </TableRow>
                ))}
                {!data.length && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nenhum comentário encontrado</TableCell></TableRow>}
              </TableBody>
            </Table>
            <Paginator page={page} total={total} onChange={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AnalysesTab() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    void load();
  }, [page]);

  const load = async () => {
    setLoading(true);

    const userId = await getCurrentUserId();
    if (!userId) {
      setData([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    const { data: rows, count } = await supabase
      .from("influencer_analyses")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    const influencerMap = await fetchInfluencerMap((rows || []).map((item) => item.influencer_id));
    const enriched = (rows || []).map((item) => ({
      ...item,
      influencer_username: influencerMap[item.influencer_id]?.username ?? "?",
      influencer_platform: influencerMap[item.influencer_id]?.platform ?? null,
    }));

    setData(enriched);
    setTotal(count || 0);
    setLoading(false);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5 text-primary" />
              Análises IA ({total})
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => downloadCSV(data, "analises.csv")}><Download className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
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
                  {data.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">@{item.influencer_username}</TableCell>
                      <TableCell><Badge variant="outline">{item.analysis_type}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.ai_model ?? "–"}</TableCell>
                      <TableCell>{fmtDate(item.created_at)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setSelected(item)}>
                          <Eye className="mr-1 h-4 w-4" />Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!data.length && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nenhuma análise encontrada</TableCell></TableRow>}
                </TableBody>
              </Table>
              <Paginator page={page} total={total} onChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Análise — @{selected?.influencer_username}</DialogTitle>
          </DialogHeader>
          {selected && <AnalysisResultView result={selected.result} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function AnalysisResultView({ result }: { result: unknown }) {
  if (!result) return <p className="text-muted-foreground">Sem dados</p>;

  const parsed = typeof result === "string" ? JSON.parse(result) : result;
  const data = parsed as Record<string, any>;
  const scores = data.scores || data.metrics || {};
  const summary = data.summary || data.resumo || data.analysis || null;
  const recommendations = data.recommendations || data.recomendacoes || [];
  const strengths = data.strengths || data.pontos_fortes || [];
  const weaknesses = data.weaknesses || data.pontos_fracos || [];

  return (
    <div className="space-y-4">
      {Object.keys(scores).length > 0 && (
        <div>
          <h4 className="mb-2 font-semibold">Scores</h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(scores).map(([key, value]) => (
              <div key={key} className="rounded-lg bg-muted p-3 text-center">
                <div className="text-xs capitalize text-muted-foreground">{key.replace(/_/g, " ")}</div>
                <div className="text-lg font-bold">{typeof value === "number" ? value.toFixed(1) : String(value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary && (
        <div>
          <h4 className="mb-1 font-semibold">Resumo</h4>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{summary}</p>
        </div>
      )}

      {strengths.length > 0 && (
        <div>
          <h4 className="mb-1 font-semibold">Pontos fortes</h4>
          <ul className="list-disc space-y-1 pl-5 text-sm">{strengths.map((item: string, index: number) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
        </div>
      )}

      {weaknesses.length > 0 && (
        <div>
          <h4 className="mb-1 font-semibold">Pontos fracos</h4>
          <ul className="list-disc space-y-1 pl-5 text-sm">{weaknesses.map((item: string, index: number) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
        </div>
      )}

      {recommendations.length > 0 && (
        <div>
          <h4 className="mb-1 font-semibold">Recomendações</h4>
          <ul className="list-disc space-y-1 pl-5 text-sm">{recommendations.map((item: string, index: number) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
        </div>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">JSON completo</summary>
        <pre className="mt-2 max-h-60 overflow-auto rounded bg-muted p-3">{JSON.stringify(data, null, 2)}</pre>
      </details>
    </div>
  );
}

function OpportunitiesTab() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    void load();
  }, [page]);

  const load = async () => {
    setLoading(true);

    const userId = await getCurrentUserId();
    if (!userId) {
      setData([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    const { data: rows, count } = await supabase
      .from("influencer_opportunities")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("score", { ascending: false, nullsFirst: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    setData(rows || []);
    setTotal(count || 0);
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-primary" />
            Oportunidades ({total})
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => downloadCSV(data, "oportunidades.csv")}><Download className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
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
                {data.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell><Badge variant="outline">{item.type}</Badge></TableCell>
                    <TableCell className="text-right font-semibold">{item.score != null ? Number(item.score).toFixed(1) : "–"}</TableCell>
                    <TableCell><Badge variant={item.status === "new" ? "default" : "secondary"}>{item.status === "new" ? "Novo" : item.status}</Badge></TableCell>
                    <TableCell className="max-w-sm truncate text-sm text-muted-foreground" title={item.description}>{item.description?.slice(0, 100)}</TableCell>
                    <TableCell>{fmtDate(item.generated_at || item.created_at)}</TableCell>
                  </TableRow>
                ))}
                {!data.length && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhuma oportunidade encontrada</TableCell></TableRow>}
              </TableBody>
            </Table>
            <Paginator page={page} total={total} onChange={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
