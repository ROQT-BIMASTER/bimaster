import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ---------- helpers ----------
const nf = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const nfFull = new Intl.NumberFormat("pt-BR");
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 });

type PeriodoDias = 7 | 30 | 90;

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
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

function useMetricas(marcaId: string | null, dias: PeriodoDias) {
  return useQuery({
    queryKey: ["mkt", "metricas", marcaId, dias],
    queryFn: async () => {
      const desde = isoDaysAgo(dias);
      let q = supabase
        .from("mkt_metricas_conta")
        .select("data, views, alcance, engajamento, conta_id, marca_id, mkt_contas(plataforma)")
        .gte("data", desde);
      if (marcaId) q = q.eq("marca_id", marcaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

function usePosts(marcaId: string | null, dias: PeriodoDias) {
  return useQuery({
    queryKey: ["mkt", "posts", marcaId, dias],
    queryFn: async () => {
      const desdeIso = new Date(Date.now() - dias * 86400 * 1000).toISOString();
      let q = supabase
        .from("mkt_posts")
        .select(
          "id, tipo, publicado_em, permalink, curtidas, comentarios, compartilhamentos, saves, alcance, views, mkt_contas(handle, plataforma)"
        )
        .gte("publicado_em", desdeIso)
        .order("views", { ascending: false, nullsFirst: false })
        .limit(8);
      if (marcaId) q = q.eq("marca_id", marcaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ---------- sub-components ----------
function KpiCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Eye;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
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
        <div className="mt-3 text-sm text-muted-foreground">
          A conectar (Meta Ads)
        </div>
      </CardContent>
    </Card>
  );
}

function TopPostTile({
  post,
}: {
  post: {
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
    mkt_contas: { handle: string | null; plataforma: string | null } | null;
  };
}) {
  const tipo = (post.tipo ?? "").toUpperCase();
  const Icon = TIPO_ICON[tipo] ?? ImageIcon;
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
    <Card className="h-full transition hover:border-primary/50">
      <CardContent className="pt-5">
        <div className="aspect-square rounded-md bg-muted flex items-center justify-center mb-3">
          <Icon className="h-10 w-10 text-muted-foreground" />
        </div>
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
            <div className="font-semibold">
              {taxa !== null ? pct.format(taxa) : "—"}
            </div>
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
  const [dias, setDias] = useState<PeriodoDias>(90);

  const { data: marcas = [] } = useMarcas();
  const { data: metricas = [], isLoading: mLoad } = useMetricas(marcaId, dias);
  const { data: posts = [], isLoading: pLoad } = usePosts(marcaId, dias);

  const kpis = useMemo(() => {
    let views = 0,
      alcance = 0,
      eng = 0;
    const contasSet = new Set<string>();
    for (const m of metricas as any[]) {
      views += Number(m.views ?? 0);
      alcance += Number(m.alcance ?? 0);
      eng += Number(m.engajamento ?? 0);
      contasSet.add(m.conta_id);
    }
    return { views, alcance, eng, contas: contasSet.size };
  }, [metricas]);

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
      .map(([data, views]) => ({
        data,
        views,
        label: format(new Date(`${data}T00:00:00`), "dd/MM", { locale: ptBR }),
      }));
  }, [metricas]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header + filtros */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Visão geral orgânica
          </h1>
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
          <div className="ml-auto flex gap-1 rounded-md border p-0.5">
            {([7, 30, 90] as const).map((d) => (
              <Button
                key={d}
                size="sm"
                variant={dias === d ? "secondary" : "ghost"}
                onClick={() => setDias(d)}
                className="h-7 px-3"
              >
                {d}d
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Views" value={nf.format(kpis.views)} icon={Eye} />
        <KpiCard label="Alcance" value={nf.format(kpis.alcance)} icon={Users} />
        <KpiCard label="Engajamento" value={nf.format(kpis.eng)} icon={Heart} />
        <KpiCard label="Contas" value={String(kpis.contas)} icon={BarChart3} />
      </div>

      {/* Por plataforma */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {porPlataforma.map((p) => (
          <PlataformaCard
            key={p.slug}
            slug={p.slug}
            views={p.views}
            contas={p.contas}
          />
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
          <span className="text-xs text-muted-foreground">
            Ordenado por views no período
          </span>
        </div>
        {pLoad ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : posts.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Sem posts no período.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(posts as any[]).map((p) => (
              <TopPostTile key={p.id} post={p} />
            ))}
          </div>
        )}
      </div>

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
