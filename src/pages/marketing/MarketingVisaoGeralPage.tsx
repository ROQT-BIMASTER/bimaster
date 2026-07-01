import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Instagram,
  Music2,
  Facebook,
  Sparkles,
  Eye,
  Users,
  Heart,
  BarChart3,
  Video,
  Image as ImageIcon,
  Film,
  Layers,
  CalendarIcon,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { addDays, differenceInDays, endOfDay, format, startOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { RankingMarcasSection } from "@/components/marketing/RankingMarcasSection";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

// ---------- helpers ----------
const nf = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const nfFull = new Intl.NumberFormat("pt-BR");
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 });

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const PLATAFORMA_META: Record<
  string,
  { label: string; icon: typeof Instagram; tint: string; text: string }
> = {
  instagram: {
    label: "Instagram",
    icon: Instagram,
    tint: "bg-primary/10 border-primary/30",
    text: "text-primary",
  },
  tiktok: {
    label: "TikTok",
    icon: Music2,
    tint: "bg-foreground/5 border-foreground/20",
    text: "text-foreground",
  },
  facebook: {
    label: "Facebook",
    icon: Facebook,
    tint: "bg-accent/40 border-accent",
    text: "text-accent-foreground",
  },
};

const TIPO_ICON: Record<string, typeof Video> = {
  VIDEO: Video,
  REELS: Film,
  IMAGE: ImageIcon,
  CAROUSEL_ALBUM: Layers,
};

// ---------- data hooks ----------
function useMarcas() {
  return useQuery({
    queryKey: ["mkt", "marcas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mkt_marcas")
        .select("id, nome, slug")
        .eq("ativo", true)
        .neq("slug", "nao-atribuido")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useMetricas(marcaId: string | null, from: Date, to: Date) {
  const fromIso = isoDate(from);
  const toIso = isoDate(to);
  return useQuery({
    queryKey: ["mkt", "metricas", marcaId, fromIso, toIso],
    queryFn: async () => {
      let q = supabase
        .from("mkt_metricas_conta")
        .select("data, views, alcance, engajamento, conta_id, marca_id, mkt_contas(plataforma)")
        .gte("data", fromIso)
        .lte("data", toIso);
      if (marcaId) q = q.eq("marca_id", marcaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useTopPosts(marcaId: string | null, from: Date, to: Date) {
  const fromIso = startOfDay(from).toISOString();
  const toIso = endOfDay(to).toISOString();
  return useQuery({
    queryKey: ["mkt", "posts-top", marcaId, fromIso, toIso],
    queryFn: async () => {
      let q = supabase
        .from("mkt_posts")
        .select(
          "id, tipo, publicado_em, permalink, curtidas, comentarios, compartilhamentos, saves, alcance, views, midia_cache_path, midia_content_type, midia_status, mkt_contas(handle, plataforma)"
        )
        .gte("publicado_em", fromIso)
        .lte("publicado_em", toIso)
        .order("views", { ascending: false, nullsFirst: false })
        .limit(8);
      if (marcaId) q = q.eq("marca_id", marcaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

const PAGE_SIZE = 24;

function usePostsPeriodo(marcaId: string | null, from: Date, to: Date, page: number) {
  const fromIso = startOfDay(from).toISOString();
  const toIso = endOfDay(to).toISOString();
  return useQuery({
    queryKey: ["mkt", "posts-periodo", marcaId, fromIso, toIso, page],
    queryFn: async () => {
      const rangeFrom = page * PAGE_SIZE;
      const rangeTo = rangeFrom + PAGE_SIZE - 1;
      let q = supabase
        .from("mkt_posts")
        .select(
          "id, tipo, publicado_em, permalink, curtidas, comentarios, compartilhamentos, saves, alcance, views, midia_cache_path, midia_content_type, midia_status, mkt_contas(handle, plataforma)",
          { count: "exact" }
        )
        .gte("publicado_em", fromIso)
        .lte("publicado_em", toIso)
        .order("publicado_em", { ascending: false })
        .range(rangeFrom, rangeTo);
      if (marcaId) q = q.eq("marca_id", marcaId);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data ?? [], total: count ?? 0 };
    },
  });
}

// ---------- signed URLs para mídia cacheada ----------
function useSignedUrls(paths: string[]) {
  const key = paths.join("|");
  return useQuery({
    queryKey: ["mkt", "signed-urls", key],
    enabled: paths.length > 0,
    staleTime: 55 * 60 * 1000, // renova antes de 1h
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("mkt-midia")
        .createSignedUrls(paths, 3600);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const item of data ?? []) {
        if (item.signedUrl && item.path) map[item.path] = item.signedUrl;
      }
      return map;
    },
  });
}

// ---------- sub-components ----------
function KpiCard({
  label,
  value,
  icon: Icon,
  delta,
}: {
  label: string;
  value: string;
  icon: typeof Eye;
  delta?: { pct: number | null };
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
        {delta && (
          <div className="mt-1 text-xs">
            {delta.pct === null ? (
              <span className="text-muted-foreground">— vs. período anterior</span>
            ) : (
              <span
                className={cn(
                  "inline-flex items-center gap-1 font-medium",
                  delta.pct >= 0 ? "text-emerald-600" : "text-destructive"
                )}
              >
                {delta.pct >= 0 ? (
                  <ArrowUp className="h-3 w-3" />
                ) : (
                  <ArrowDown className="h-3 w-3" />
                )}
                {pct.format(Math.abs(delta.pct))}
                <span className="text-muted-foreground font-normal">vs. anterior</span>
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PlataformaCard({
  slug,
  views,
  contas,
}: {
  slug: string;
  views: number;
  contas: number;
}) {
  const meta = PLATAFORMA_META[slug] ?? {
    label: slug,
    icon: BarChart3,
    tint: "bg-muted border-border",
    text: "text-foreground",
  };
  const Icon = meta.icon;
  return (
    <Card className={`border ${meta.tint}`}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${meta.text}`} />
          <span className={`text-sm font-medium ${meta.text}`}>{meta.label}</span>
        </div>
        <div className="mt-3 text-2xl font-semibold">{nf.format(views)}</div>
        <div className="text-xs text-muted-foreground mt-1">
          {contas} {contas === 1 ? "conta" : "contas"}
        </div>
      </CardContent>
    </Card>
  );
}

function PaidPlaceholderCard() {
  return (
    <Card className="border-2 border-dashed">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="h-5 w-5" />
          <span className="text-sm font-medium">Mídia paga</span>
        </div>
        <div className="mt-3 text-sm text-muted-foreground">A conectar (Meta Ads)</div>
      </CardContent>
    </Card>
  );
}

type PostRow = {
  id: string;
  tipo: string | null;
  publicado_em: string | null;
  permalink: string | null;
  curtidas: number | null;
  comentarios: number | null;
  compartilhamentos: number | null;
  saves: number | null;
  alcance: number | null;
  views: number | null;
  midia_cache_path: string | null;
  midia_content_type: string | null;
  midia_status: string | null;
  mkt_contas: { handle: string | null; plataforma: string | null } | null;
};

function PostThumb({
  post,
  signedUrl,
  className,
}: {
  post: PostRow;
  signedUrl?: string;
  className?: string;
}) {
  const tipo = (post.tipo ?? "").toUpperCase();
  const Icon = TIPO_ICON[tipo] ?? ImageIcon;
  const [broken, setBroken] = useState(false);

  const isVideo = (post.midia_content_type ?? "").toLowerCase().startsWith("video/");
  const canShow = post.midia_status === "ok" && signedUrl && !broken;

  if (canShow) {
    if (isVideo) {
      return (
        <video
          src={signedUrl}
          className={cn("h-full w-full object-cover", className)}
          muted
          playsInline
          preload="metadata"
          onError={() => setBroken(true)}
        />
      );
    }
    return (
      <img
        src={signedUrl}
        alt={tipo || "post"}
        loading="lazy"
        className={cn("h-full w-full object-cover", className)}
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <div
      className={cn(
        "h-full w-full flex items-center justify-center bg-muted",
        className
      )}
    >
      <Icon className="h-10 w-10 text-muted-foreground" />
    </div>
  );
}

function TopPostTile({ post, signedUrl }: { post: PostRow; signedUrl?: string }) {
  const tipo = (post.tipo ?? "").toUpperCase();
  const eng =
    (post.curtidas ?? 0) +
    (post.comentarios ?? 0) +
    (post.compartilhamentos ?? 0) +
    (post.saves ?? 0);
  const taxa = post.alcance && post.alcance > 0 ? eng / post.alcance : null;
  const dataFmt = post.publicado_em
    ? format(new Date(post.publicado_em), "dd MMM yyyy", { locale: ptBR })
    : "—";

  const inner = (
    <Card className="h-full transition hover:border-primary/50 overflow-hidden">
      <div className="aspect-square bg-muted">
        <PostThumb post={post} signedUrl={signedUrl} />
      </div>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="text-[10px]">
            {tipo || "POST"}
          </Badge>
          <span className="text-xs text-muted-foreground truncate">
            {post.mkt_contas?.handle ?? ""}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">{dataFmt}</div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-muted-foreground">Views</div>
            <div className="font-semibold">{nf.format(post.views ?? 0)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Curtidas</div>
            <div className="font-semibold">{nf.format(post.curtidas ?? 0)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Comentários</div>
            <div className="font-semibold">{nf.format(post.comentarios ?? 0)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Engaj.</div>
            <div className="font-semibold">{taxa !== null ? pct.format(taxa) : "—"}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return post.permalink ? (
    <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="block">
      {inner}
    </a>
  ) : (
    inner
  );
}

function PeriodoPostTile({ post, signedUrl }: { post: PostRow; signedUrl?: string }) {
  const tipo = (post.tipo ?? "").toUpperCase();
  const dataFmt = post.publicado_em
    ? format(new Date(post.publicado_em), "dd/MM/yyyy", { locale: ptBR })
    : "—";
  const inner = (
    <Card className="h-full overflow-hidden transition hover:border-primary/50">
      <div className="aspect-square bg-muted">
        <PostThumb post={post} signedUrl={signedUrl} />
      </div>
      <CardContent className="pt-3 space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {tipo || "POST"}
          </Badge>
          <span className="text-[10px] text-muted-foreground">{dataFmt}</span>
        </div>
        <div className="grid grid-cols-3 gap-1 text-[11px]">
          <div>
            <div className="text-muted-foreground">V</div>
            <div className="font-semibold">{nf.format(post.views ?? 0)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">♥</div>
            <div className="font-semibold">{nf.format(post.curtidas ?? 0)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">💬</div>
            <div className="font-semibold">{nf.format(post.comentarios ?? 0)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
  return post.permalink ? (
    <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="block">
      {inner}
    </a>
  ) : (
    inner
  );
}

// ---------- main page ----------
export default function MarketingVisaoGeralPage() {
  const [marcaId, setMarcaId] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange>(() => ({
    from: subDays(new Date(), 90),
    to: new Date(),
  }));
  const [page, setPage] = useState(0);

  const from = range.from ?? subDays(new Date(), 90);
  const to = range.to ?? new Date();

  // Período anterior: mesmo tamanho, terminando 1 dia antes de `from`.
  const days = Math.max(1, differenceInDays(to, from) + 1);
  const prevTo = subDays(from, 1);
  const prevFrom = subDays(prevTo, days - 1);

  const { data: marcas = [] } = useMarcas();
  const { data: metricas = [], isLoading: mLoad } = useMetricas(marcaId, from, to);
  const { data: metricasPrev = [] } = useMetricas(marcaId, prevFrom, prevTo);
  const { data: topPosts = [], isLoading: pLoad } = useTopPosts(marcaId, from, to);
  const { data: periodoData, isLoading: perLoad } = usePostsPeriodo(marcaId, from, to, page);

  // reseta paginação ao mudar filtro
  useEffect(() => {
    setPage(0);
  }, [marcaId, from.getTime(), to.getTime()]);

  const applyPreset = (dias: number) => {
    const today = new Date();
    setRange({ from: subDays(today, dias - 1), to: today });
  };

  const kpis = useMemo(() => {
    const calc = (rows: any[]) => {
      let views = 0,
        alcance = 0,
        eng = 0;
      const contasSet = new Set<string>();
      for (const m of rows) {
        views += Number(m.views ?? 0);
        alcance += Number(m.alcance ?? 0);
        eng += Number(m.engajamento ?? 0);
        contasSet.add(m.conta_id);
      }
      return { views, alcance, eng, contas: contasSet.size };
    };
    const cur = calc(metricas as any[]);
    const prev = calc(metricasPrev as any[]);
    const delta = (a: number, b: number) => (b > 0 ? (a - b) / b : null);
    return {
      ...cur,
      dViews: delta(cur.views, prev.views),
      dAlcance: delta(cur.alcance, prev.alcance),
      dEng: delta(cur.eng, prev.eng),
    };
  }, [metricas, metricasPrev]);

  const porPlataforma = useMemo(() => {
    const map = new Map<string, { views: number; contas: Set<string> }>();
    for (const m of metricas as any[]) {
      const plat = m.mkt_contas?.plataforma ?? "outro";
      if (!map.has(plat)) map.set(plat, { views: 0, contas: new Set() });
      const b = map.get(plat)!;
      b.views += Number(m.views ?? 0);
      b.contas.add(m.conta_id);
    }
    const ordem = ["instagram", "tiktok", "facebook"];
    return ordem
      .map((slug) => ({
        slug,
        views: map.get(slug)?.views ?? 0,
        contas: map.get(slug)?.contas.size ?? 0,
      }))
      .concat(
        Array.from(map.entries())
          .filter(([k]) => !ordem.includes(k))
          .map(([slug, b]) => ({ slug, views: b.views, contas: b.contas.size }))
      );
  }, [metricas]);

  const serieDiaria = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of metricas as any[]) {
      const d = m.data as string;
      map.set(d, (map.get(d) ?? 0) + Number(m.views ?? 0));
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, views]) => {
        const d = parseLocalDate(data) ?? new Date(`${data}T00:00:00`);
        return {
          data,
          views,
          label: format(d, "dd/MM", { locale: ptBR }),
        };
      });
  }, [metricas]);

  // Signed URLs em batch (top posts + posts do período)
  const allPaths = useMemo(() => {
    const set = new Set<string>();
    for (const p of topPosts as PostRow[]) {
      if (p.midia_status === "ok" && p.midia_cache_path) set.add(p.midia_cache_path);
    }
    for (const p of (periodoData?.rows ?? []) as PostRow[]) {
      if (p.midia_status === "ok" && p.midia_cache_path) set.add(p.midia_cache_path);
    }
    return Array.from(set);
  }, [topPosts, periodoData]);
  const { data: signedUrls = {} } = useSignedUrls(allPaths);

  const totalPeriodo = periodoData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalPeriodo / PAGE_SIZE));

  return (
    <DashboardLayout>
    <div className="container mx-auto py-6 space-y-6">
      {/* Header + filtros */}
      <div className="flex flex-col gap-4">
        <div>
          <Link
            to="/dashboard/marketing"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para Marketing
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Visão geral orgânica</h1>
          <p className="text-sm text-muted-foreground">
            Desempenho consolidado das redes sociais por marca no período.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={marcaId === null ? "default" : "outline"}
              onClick={() => setMarcaId(null)}
            >
              Todas
            </Button>
            {marcas.map((m: any) => (
              <Button
                key={m.id}
                size="sm"
                variant={marcaId === m.id ? "default" : "outline"}
                onClick={() => setMarcaId(m.id)}
              >
                {m.nome}
              </Button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Date range picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-2 font-normal"
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {format(from, "dd/MM/yyyy", { locale: ptBR })}
                  <span className="text-muted-foreground">–</span>
                  {format(to, "dd/MM/yyyy", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  numberOfMonths={2}
                  selected={range}
                  onSelect={(r) => r && setRange(r)}
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            {/* Presets */}
            <div className="flex gap-1 rounded-md border p-0.5">
              {[7, 30, 90].map((d) => (
                <Button
                  key={d}
                  size="sm"
                  variant="ghost"
                  onClick={() => applyPreset(d)}
                  className="h-7 px-3"
                >
                  {d}d
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPIs com comparação P-vs-P */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Views"
          value={nf.format(kpis.views)}
          icon={Eye}
          delta={{ pct: kpis.dViews }}
        />
        <KpiCard
          label="Alcance"
          value={nf.format(kpis.alcance)}
          icon={Users}
          delta={{ pct: kpis.dAlcance }}
        />
        <KpiCard
          label="Engajamento"
          value={nf.format(kpis.eng)}
          icon={Heart}
          delta={{ pct: kpis.dEng }}
        />
        <KpiCard label="Contas" value={String(kpis.contas)} icon={BarChart3} />
      </div>

      {/* Por plataforma */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {porPlataforma.map((p) => (
          <PlataformaCard key={p.slug} slug={p.slug} views={p.views} contas={p.contas} />
        ))}
        <PaidPlaceholderCard />
      </div>

      {/* Série diária */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Views por dia</CardTitle>
        </CardHeader>
        <CardContent>
          {mLoad ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
              Carregando…
            </div>
          ) : serieDiaria.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
              Sem dados no período.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serieDiaria}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="label"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickFormatter={(v) => nf.format(Number(v))}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      color: "hsl(var(--popover-foreground))",
                      fontSize: 12,
                    }}
                    formatter={(v: number) => nfFull.format(v)}
                    labelFormatter={(l) => `Dia ${l}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="views"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top posts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Top posts</h2>
          <span className="text-xs text-muted-foreground">Ordenado por views no período</span>
        </div>
        {pLoad ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : topPosts.length === 0 ? (
          <div className="text-sm text-muted-foreground">Sem posts no período.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(topPosts as PostRow[]).map((p) => (
              <TopPostTile
                key={p.id}
                post={p}
                signedUrl={p.midia_cache_path ? signedUrls[p.midia_cache_path] : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Posts do período (paginado) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Posts do período</h2>
          <span className="text-xs text-muted-foreground">
            {totalPeriodo} {totalPeriodo === 1 ? "post" : "posts"} • página {page + 1}/{totalPages}
          </span>
        </div>
        {perLoad ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : (periodoData?.rows ?? []).length === 0 ? (
          <div className="text-sm text-muted-foreground">Sem posts no período.</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {((periodoData?.rows ?? []) as PostRow[]).map((p) => (
                <PeriodoPostTile
                  key={p.id}
                  post={p}
                  signedUrl={p.midia_cache_path ? signedUrls[p.midia_cache_path] : undefined}
                />
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                Próxima
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Ranking de marcas — inspirado em Design Arena */}
      <RankingMarcasSection marcaId={marcaId} from={from} to={to} />

      {/* Leitura da Claude (placeholder) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Leitura da Claude
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Análise de IA em breve — os insights automáticos deste período aparecerão aqui
            quando disponíveis.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
