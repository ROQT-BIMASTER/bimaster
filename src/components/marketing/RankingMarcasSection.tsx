import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { endOfDay, startOfDay } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
  ScatterChart,
  Scatter,
  ZAxis,
  ReferenceLine,
  ReferenceArea,
} from "recharts";

const nf = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const nfFull = new Intl.NumberFormat("pt-BR");
const pctFmt = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 2,
});

// Paleta suave inspirada na referência (Design Arena) — tokens semânticos + accents suaves.
const BAR_PALETTE = [
  "hsl(180 25% 55%)", // teal claro
  "hsl(160 22% 50%)", // verde-oliva escuro
  "hsl(85 30% 55%)",  // oliva
  "hsl(28 35% 55%)",  // terracota
  "hsl(45 40% 60%)",  // areia
  "hsl(200 15% 65%)", // cinza-azulado
  "hsl(140 15% 60%)", // sálvia
  "hsl(20 30% 60%)",  // barro
  "hsl(50 25% 65%)",  // trigo
  "hsl(210 20% 60%)",
  "hsl(120 12% 55%)",
  "hsl(0 20% 60%)",
];

type MarcaAgg = {
  marca_id: string;
  nome: string;
  posts: number;
  views: number;
  alcance: number;
  impressoes: number;
  eng: number;
  denom: number; // views || alcance || impressoes (por post, somado)
  taxa: number; // eng / denom
};

function useRankingMarcas(marcaId: string | null, from: Date, to: Date) {
  const fromIso = startOfDay(from).toISOString();
  const toIso = endOfDay(to).toISOString();
  return useQuery({
    queryKey: ["mkt", "ranking-marcas", marcaId, fromIso, toIso],
    queryFn: async () => {
      let q = supabase
        .from("mkt_posts")
        .select(
          "marca_id, curtidas, comentarios, compartilhamentos, saves, views, alcance, impressoes, mkt_marcas(id, nome, slug)"
        )
        .gte("publicado_em", fromIso)
        .lte("publicado_em", toIso)
        .not("marca_id", "is", null);
      if (marcaId) q = q.eq("marca_id", marcaId);
      const { data, error } = await q;
      if (error) throw error;

      const map = new Map<string, MarcaAgg>();
      for (const row of (data ?? []) as any[]) {
        const id = row.marca_id as string;
        const nome = row.mkt_marcas?.nome ?? "Sem marca";
        if (!map.has(id)) {
          map.set(id, {
            marca_id: id,
            nome,
            posts: 0,
            views: 0,
            alcance: 0,
            impressoes: 0,
            eng: 0,
            denom: 0,
            taxa: 0,
          });
        }
        const b = map.get(id)!;
        const views = Number(row.views ?? 0);
        const alcance = Number(row.alcance ?? 0);
        const impressoes = Number(row.impressoes ?? 0);
        // Denominador por post: views quando disponível; fallback alcance; fallback impressões.
        // Assim posts de formatos sem "views" (ex.: carrossel IG) ainda entram na taxa.
        const denomPost = views > 0 ? views : alcance > 0 ? alcance : impressoes;
        b.posts += 1;
        b.views += views;
        b.alcance += alcance;
        b.impressoes += impressoes;
        b.denom += denomPost;
        b.eng +=
          Number(row.curtidas ?? 0) +
          Number(row.comentarios ?? 0) +
          Number(row.compartilhamentos ?? 0) +
          Number(row.saves ?? 0);
      }
      for (const b of map.values()) {
        b.taxa = b.denom > 0 ? b.eng / b.denom : 0;
      }
      return Array.from(map.values());
    },
  });
}

function median(nums: number[]) {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-6 text-muted-foreground">
      <span>{label}</span>
      <span className="text-foreground font-medium tabular-nums">{value}</span>
    </div>
  );
}

function BrandTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as MarcaAgg;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md min-w-[200px] space-y-1">
      <div className="font-semibold text-sm">{d.nome}</div>
      <MetricRow label="Views" value={nfFull.format(d.views)} />
      <MetricRow label="Engajamento" value={nfFull.format(d.eng)} />
      <MetricRow label="Taxa de engajamento" value={pctFmt.format(d.taxa)} />
      <MetricRow label="Posts" value={String(d.posts)} />
    </div>
  );
}


// Label customizado ao lado de cada ponto do scatter
function ScatterNameLabel(props: any) {
  const { x, y, value } = props;
  if (typeof x !== "number" || typeof y !== "number") return null;
  return (
    <text
      x={x + 8}
      y={y - 6}
      fontSize={10}
      fill="hsl(var(--foreground))"
      style={{ pointerEvents: "none" }}
    >
      {value}
    </text>
  );
}

export function RankingMarcasSection({
  marcaId,
  from,
  to,
}: {
  marcaId: string | null;
  from: Date;
  to: Date;
}) {
  const { data: agg = [], isLoading } = useRankingMarcas(marcaId, from, to);

  const barData = useMemo(
    () => [...agg].sort((a, b) => b.eng - a.eng).slice(0, 12),
    [agg]
  );

  const scatterData = useMemo(
    () => agg.filter((m) => m.views > 0),
    [agg]
  );

  const medX = useMemo(() => median(scatterData.map((d) => d.views)), [scatterData]);
  const medY = useMemo(() => median(scatterData.map((d) => d.taxa)), [scatterData]);

  const totalPosts = agg.reduce((s, m) => s + m.posts, 0);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Ranking de marcas no período</h2>
        <p className="text-xs text-muted-foreground">
          {agg.length} {agg.length === 1 ? "marca" : "marcas"} • {totalPosts}{" "}
          {totalPosts === 1 ? "post" : "posts"}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1 — Barras ranqueadas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Engajamento total por marca</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-80 flex items-center justify-center text-sm text-muted-foreground">
                Carregando…
              </div>
            ) : barData.length === 0 ? (
              <div className="h-80 flex items-center justify-center text-sm text-muted-foreground">
                Sem posts no período.
              </div>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 24, right: 12, left: 0, bottom: 40 }}>
                    <CartesianGrid
                      vertical={false}
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="nome"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      height={60}
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      tickFormatter={(v) => nf.format(Number(v))}
                    />
                    <Tooltip content={<BarTooltip />} cursor={{ fill: "hsl(var(--muted)/0.4)" }} />
                    <Bar dataKey="eng" radius={[6, 6, 0, 0]}>
                      {barData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={i === 0 ? "hsl(var(--primary))" : BAR_PALETTE[i % BAR_PALETTE.length]}
                        />
                      ))}
                      <LabelList
                        dataKey="eng"
                        position="top"
                        formatter={(v: number) => nf.format(v)}
                        style={{
                          fontSize: 11,
                          fill: "hsl(var(--foreground))",
                          fontWeight: 600,
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2 — Scatter Views × Taxa de engajamento */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Views × Taxa de engajamento</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-80 flex items-center justify-center text-sm text-muted-foreground">
                Carregando…
              </div>
            ) : scatterData.length === 0 ? (
              <div className="h-80 flex items-center justify-center text-sm text-muted-foreground">
                Sem dados no período.
              </div>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 30, left: 10, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      type="number"
                      dataKey="views"
                      name="Views"
                      scale="log"
                      domain={["auto", "auto"]}
                      allowDataOverflow
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      tickFormatter={(v) => nf.format(Number(v))}
                      label={{
                        value: "Views (log)",
                        position: "insideBottom",
                        offset: -10,
                        fontSize: 11,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                    />
                    <YAxis
                      type="number"
                      dataKey="taxa"
                      name="Taxa de engajamento"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      tickFormatter={(v) => pctFmt.format(Number(v))}
                      label={{
                        value: "Engajamento",
                        angle: -90,
                        position: "insideLeft",
                        fontSize: 11,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                    />
                    <ZAxis type="number" dataKey="posts" range={[60, 400]} />
                    <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: "3 3" }} />
                    {medX > 0 && medY > 0 && (
                      <>
                        <ReferenceArea
                          x1={medX}
                          x2={Number.MAX_SAFE_INTEGER}
                          y1={medY}
                          y2={Number.MAX_SAFE_INTEGER}
                          fill="hsl(140 40% 50%)"
                          fillOpacity={0.08}
                          stroke="hsl(140 40% 50%)"
                          strokeOpacity={0.25}
                          strokeDasharray="4 4"
                        />
                        <ReferenceLine
                          x={medX}
                          stroke="hsl(var(--muted-foreground))"
                          strokeDasharray="3 3"
                        />
                        <ReferenceLine
                          y={medY}
                          stroke="hsl(var(--muted-foreground))"
                          strokeDasharray="3 3"
                        />
                      </>
                    )}
                    <Scatter data={scatterData} fill="hsl(var(--primary))" fillOpacity={0.75}>
                      <LabelList dataKey="nome" content={<ScatterNameLabel />} />
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
