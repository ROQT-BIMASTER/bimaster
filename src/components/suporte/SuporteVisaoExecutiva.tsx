// Estado vazio já elegante quando não há dados.
import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts/core";
import { GaugeChart, SankeyChart, PieChart, BarChart, LineChart } from "echarts/charts";
import { subDays, format, differenceInCalendarDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, TrendingUp, TrendingDown, FileDown, Inbox } from "lucide-react";
import { ensureRubyCorpTheme, BRAND_BASE, RUBYCORP_PALETTE } from "@/lib/charts/corporateTheme";
import {
  useSuporteKpis,
  useSuporteAnalise,
  useTransferenciasFluxo,
  useCsatDistribuicao,
} from "@/hooks/suporte/useSuporteAnalytics";
import { useSuporteFilas } from "@/hooks/suporte/useSuporteFilas";
import { SuporteAnaliseChart } from "./SuporteAnaliseChart";
import { formatValor } from "@/lib/suporte/analyticsFormat";
import { exportRelatorioSuporte } from "@/lib/suporte/exportRelatorioSuporte";
import { toast } from "sonner";

echarts.use([GaugeChart, SankeyChart, PieChart, BarChart, LineChart]);

interface Props {
  de: string;
  ate: string;
  filaId: string | null; // null = "Todos"
  filaNome: string;
}

function delta(atual: number | null | undefined, ant: number | null | undefined) {
  const a = Number(atual ?? 0);
  const b = Number(ant ?? 0);
  if (!isFinite(a) || !isFinite(b)) return null;
  if (b === 0) return a === 0 ? 0 : null;
  return ((a - b) / Math.abs(b)) * 100;
}

function DeltaBadge({ pct, invert }: { pct: number | null; invert?: boolean }) {
  if (pct === null) return <span className="text-[10px] text-muted-foreground">—</span>;
  const positivo = invert ? pct < 0 : pct > 0;
  const zero = Math.abs(pct) < 0.1;
  const color = zero ? "text-muted-foreground" : positivo ? "text-emerald-600" : "text-red-600";
  const Icon = zero ? null : pct > 0 ? TrendingUp : TrendingDown;
  return (
    <span className={`text-[11px] inline-flex items-center gap-0.5 ${color}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {`${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`}
    </span>
  );
}

function KpiHero({
  label, value, delta: d, subtext, invertDelta,
}: {
  label: string;
  value: string;
  delta?: number | null;
  subtext?: string;
  invertDelta?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold tabular-nums leading-tight mt-0.5">{value}</div>
        <div className="flex items-center gap-2 mt-1">
          {d !== undefined && <DeltaBadge pct={d} invert={invertDelta} />}
          {subtext && <span className="text-[10px] text-muted-foreground">{subtext}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

export function SuporteVisaoExecutiva({ de, ate, filaId, filaNome }: Props) {
  ensureRubyCorpTheme();
  const { atual, anterior, isLoading } = useSuporteKpis(de, ate, filaId);
  const { data: filas = [] } = useSuporteFilas();

  const evolucaoNovos = useSuporteAnalise({ metrica: "chamados", dimensao: "dia", de, ate, fila_id: filaId });
  const evolucaoResolv = useSuporteAnalise({ metrica: "resolvidos", dimensao: "dia", de, ate, fila_id: filaId });
  const porCategoria = useSuporteAnalise({ metrica: "chamados", dimensao: "categoria", de, ate, fila_id: filaId });
  const porFila = useSuporteAnalise({ metrica: "chamados", dimensao: "fila", de, ate, fila_id: filaId, enabled: !filaId });
  const transf = useTransferenciasFluxo(de, ate, filaId);
  const csatDist = useCsatDistribuicao(de, ate, filaId);

  // Refs para grabbing dos gráficos ao gerar PDF
  const gaugeRef = useRef<any>(null);
  const evolRef = useRef<any>(null);
  const catRef = useRef<any>(null);
  const sankeyRef = useRef<any>(null);
  const csatRef = useRef<any>(null);

  // ---------- KPIs ----------
  const kpis = useMemo(() => {
    if (!atual) return [];
    return [
      { label: "Backlog atual", value: formatValor(atual.backlog_atual, "chamados"), delta: undefined, sub: "foto agora" },
      { label: "Novos", value: formatValor(atual.novos, "chamados"), delta: delta(atual.novos, anterior?.novos) },
      { label: "% SLA resolução", value: formatValor(atual.pct_sla_resolucao, "pct_sla_resolucao"), delta: delta(atual.pct_sla_resolucao, anterior?.pct_sla_resolucao) },
      { label: "1ª resposta média", value: formatValor(atual.frt_media_h, "frt_horas"), delta: delta(atual.frt_media_h, anterior?.frt_media_h), invert: true },
      { label: "Resolução média", value: formatValor(atual.resolucao_media_h, "resolucao_horas"), delta: delta(atual.resolucao_media_h, anterior?.resolucao_media_h), invert: true },
      { label: "CSAT", value: formatValor(atual.csat_media, "csat"), delta: delta(atual.csat_media, anterior?.csat_media), sub: `${atual.csat_respostas} resposta${atual.csat_respostas === 1 ? "" : "s"}` },
    ];
  }, [atual, anterior]);

  // ---------- Gauge SLA ----------
  const gaugeOption = useMemo(() => {
    const v = Number(atual?.pct_sla_resolucao ?? 0);
    return {
      tooltip: { confine: true },
      series: [{
        type: "gauge",
        min: 0, max: 100, startAngle: 210, endAngle: -30,
        axisLine: {
          lineStyle: {
            width: 16,
            color: [
              [0.7, "#ef4444"],
              [0.9, "#f59e0b"],
              [1, "#10b981"],
            ],
          },
        },
        pointer: { itemStyle: { color: "#0F1623" } },
        axisTick: { show: false },
        splitLine: { length: 6, lineStyle: { color: "#fff" } },
        axisLabel: { color: "#6B7280", fontSize: 10, distance: -22, formatter: (v: number) => `${v}` },
        detail: { valueAnimation: true, formatter: (val: number) => `${val.toFixed(1)}%`, fontSize: 22, offsetCenter: [0, "70%"] },
        data: [{ value: v, name: "SLA" }],
      }],
    };
  }, [atual]);

  // ---------- Evolução (área + linha) ----------
  const evolOption = useMemo(() => {
    const labels = Array.from(new Set([
      ...(evolucaoNovos.data ?? []).map((r) => r.label),
      ...(evolucaoResolv.data ?? []).map((r) => r.label),
    ])).sort();
    const mapN = new Map((evolucaoNovos.data ?? []).map((r) => [r.label, r.valor]));
    const mapR = new Map((evolucaoResolv.data ?? []).map((r) => [r.label, r.valor]));
    const displayLabels = labels.map((l) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(l);
      return m ? `${m[3]}/${m[2]}` : l;
    });
    const n = displayLabels.length;
    const showZoom = n > 30;
    const zoomStart = showZoom ? Math.max(0, 100 - (30 / n) * 100) : 0;
    return {
      tooltip: { trigger: "axis", confine: true, axisPointer: { type: "line" } },
      legend: { data: ["Novos", "Resolvidos"], bottom: 0, textStyle: { fontSize: 11 } },
      grid: { left: 8, right: 16, top: 24, bottom: showZoom ? 56 : 32, containLabel: true },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: displayLabels,
        axisLabel: {
          interval: "auto",
          rotate: n > 14 ? 35 : 0,
          hideOverlap: true,
          fontSize: 10,
        },
      },
      yAxis: { type: "value" },
      dataZoom: showZoom
        ? [
            { type: "inside", start: zoomStart, end: 100, minValueSpan: 7, zoomOnMouseWheel: true, moveOnMouseWheel: false },
            { type: "slider", height: 16, bottom: 24, start: zoomStart, end: 100, minValueSpan: 7 },
          ]
        : undefined,
      series: [
        { name: "Novos", type: "line", smooth: true, showSymbol: false, symbol: "circle", symbolSize: 4, areaStyle: { color: BRAND_BASE, opacity: 0.18 }, lineStyle: { color: BRAND_BASE, width: 2 }, itemStyle: { color: BRAND_BASE }, data: labels.map((l) => mapN.get(l) ?? 0) },
        { name: "Resolvidos", type: "line", smooth: true, showSymbol: false, symbol: "circle", symbolSize: 4, lineStyle: { color: "#10b981", width: 2 }, itemStyle: { color: "#10b981" }, data: labels.map((l) => mapR.get(l) ?? 0) },
      ],
    };
  }, [evolucaoNovos.data, evolucaoResolv.data]);

  // ---------- Sankey de transferências ----------
  const filaNomeMap = useMemo(() => {
    const m = new Map<string, string>();
    filas.forEach((f) => m.set(f.id, f.nome));
    return m;
  }, [filas]);

  const sankeyOption = useMemo(() => {
    const rows = transf.data ?? [];
    if (rows.length === 0) return null;
    const nodesSet = new Set<string>();
    rows.forEach((r) => {
      nodesSet.add(`de:${r.de_fila_id ?? "∅"}`);
      nodesSet.add(`para:${r.para_fila_id}`);
    });
    const nodes = Array.from(nodesSet).map((k) => {
      const [tipo, id] = k.split(":");
      const nome = id === "∅" ? "(sem origem)" : filaNomeMap.get(id) ?? "—";
      return { name: k, label: { formatter: `${tipo === "de" ? "◀ " : "▶ "}${nome}` } };
    });
    const links = rows.map((r) => ({
      source: `de:${r.de_fila_id ?? "∅"}`,
      target: `para:${r.para_fila_id}`,
      value: r.count,
    }));
    return {
      tooltip: {
        trigger: "item",
        confine: true,
        formatter: (p: any) => {
          if (p.dataType === "edge") {
            const s = String(p.data.source).replace(/^de:/, "");
            const t = String(p.data.target).replace(/^para:/, "");
            const sn = s === "∅" ? "(sem origem)" : filaNomeMap.get(s) ?? "—";
            const tn = filaNomeMap.get(t) ?? "—";
            return `${sn} → ${tn}<br/><b>${p.value} transferência${p.value === 1 ? "" : "s"}</b>`;
          }
          return p.name;
        },
      },
      series: [{
        type: "sankey",
        emphasis: { focus: "adjacency" },
        nodeAlign: "justify",
        nodeGap: 12,
        nodes,
        links,
        lineStyle: { color: "gradient", curveness: 0.5 },
        itemStyle: { borderWidth: 0 },
        label: { fontSize: 11, color: "#0F1623", overflow: "truncate", width: 140 },
      }],
    };
  }, [transf.data, filaNomeMap]);

  // ---------- CSAT distribuição ----------
  const csatOption = useMemo(() => {
    const dist = csatDist.data ?? [];
    return {
      tooltip: { trigger: "axis", confine: true, axisPointer: { type: "shadow" }, formatter: (params: any) => {
        const p = Array.isArray(params) ? params[0] : params;
        return `${p.name} estrela${p.name === "1" ? "" : "s"}<br/><b>${p.value} avaliação${p.value === 1 ? "" : "es"}</b>`;
      } },
      grid: { left: 8, right: 16, top: 16, bottom: 24, containLabel: true },
      xAxis: { type: "category", data: dist.map((d) => String(d.score)), axisLabel: { hideOverlap: true, fontSize: 10 } },
      yAxis: { type: "value" },
      series: [{
        type: "bar",
        data: dist.map((d, i) => ({ value: d.count, itemStyle: { color: RUBYCORP_PALETTE[i % RUBYCORP_PALETTE.length] } })),
        barMaxWidth: 44,
      }],
    };
  }, [csatDist.data]);

  const totalCsat = (csatDist.data ?? []).reduce((s, d) => s + d.count, 0);

  // ---------- PDF export ----------
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfTitulo, setPdfTitulo] = useState("");
  const [pdfConfig, setPdfConfig] = useState({
    kpis: true, evolucao: true, categorias: true, sla: true, csat: true, transferencias: true, tabela: false,
  });
  const [pdfGerando, setPdfGerando] = useState(false);

  useEffect(() => {
    setPdfTitulo(`Relatório de Suporte — ${filaNome}`);
  }, [filaNome]);

  const gerarPdf = async () => {
    if (!atual) return;
    setPdfGerando(true);
    try {
      await exportRelatorioSuporte({
        titulo: pdfTitulo || `Relatório de Suporte — ${filaNome}`,
        periodo: `${format(new Date(de), "dd/MM/yyyy")} a ${format(new Date(ate), "dd/MM/yyyy")}`,
        filaNome,
        kpis: atual,
        anterior: anterior ?? null,
        incluir: pdfConfig,
        imagens: {
          gauge: gaugeRef.current?.getEchartsInstance()?.getDataURL({ type: "png", backgroundColor: "#fff", pixelRatio: 2 }),
          evolucao: evolRef.current?.getEchartsInstance()?.getDataURL({ type: "png", backgroundColor: "#fff", pixelRatio: 2 }),
          categorias: catRef.current?.getEchartsInstance()?.getDataURL({ type: "png", backgroundColor: "#fff", pixelRatio: 2 }),
          sankey: sankeyRef.current?.getEchartsInstance()?.getDataURL({ type: "png", backgroundColor: "#fff", pixelRatio: 2 }),
          csat: csatRef.current?.getEchartsInstance()?.getDataURL({ type: "png", backgroundColor: "#fff", pixelRatio: 2 }),
        },
        tabelaCategorias: pdfConfig.tabela ? (porCategoria.data ?? []) : undefined,
      });
      setPdfOpen(false);
      toast.success("Relatório gerado");
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao gerar relatório");
    } finally {
      setPdfGerando(false);
    }
  };

  if (isLoading || !atual) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Cabeçalho compacto */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Visão executiva</h3>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {filaNome}
          </span>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {format(new Date(de), "dd/MM")} – {format(new Date(ate), "dd/MM/yyyy")}
          </span>
        </div>
        <Popover open={pdfOpen} onOpenChange={setPdfOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="gap-2 h-8">
              <FileDown className="h-4 w-4" /> Relatório executivo (PDF)
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Título</Label>
                <Input value={pdfTitulo} onChange={(e) => setPdfTitulo(e.target.value)} className="h-8 mt-1" />
              </div>
              <div className="space-y-1.5">
                {(Object.keys(pdfConfig) as (keyof typeof pdfConfig)[]).map((k) => (
                  <label key={k} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={pdfConfig[k]}
                      onCheckedChange={(v) => setPdfConfig({ ...pdfConfig, [k]: v === true })}
                    />
                    <span className="capitalize">{k}</span>
                  </label>
                ))}
              </div>
              <Button className="w-full" size="sm" onClick={gerarPdf} disabled={pdfGerando}>
                {pdfGerando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar PDF"}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>


      {/* KPI heroes */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k, i) => (
          <KpiHero key={i} label={k.label} value={k.value} delta={k.delta as any} subtext={k.sub} invertDelta={(k as any).invert} />
        ))}
      </div>

      {/* Gauge + evolução */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm">SLA resolução</CardTitle></CardHeader>
          <CardContent>
            <div className="min-w-0 w-full">
              <ReactECharts ref={gaugeRef} option={gaugeOption} theme="rubyCorp" style={{ height: 220, width: "100%" }} notMerge lazyUpdate />
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Novos × Resolvidos por dia</CardTitle></CardHeader>
          <CardContent>
            <div className="min-w-0 w-full">
              <ReactECharts ref={evolRef} option={evolOption} theme="rubyCorp" style={{ height: 240, width: "100%" }} notMerge lazyUpdate />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Categorias + Por departamento (quando Todos) */}
      <div className={`grid grid-cols-1 ${filaId ? "" : "lg:grid-cols-2"} gap-3`}>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Chamados por categoria</CardTitle></CardHeader>
          <CardContent>
            {(porCategoria.data ?? []).length === 0 ? (
              <EmptyState label="Sem chamados no período." />
            ) : (
              <SuporteAnaliseChart
                tipo="bar"
                data={porCategoria.data ?? []}
                metrica="chamados"
                dimensao="categoria"
                height={280}
                onInstance={(inst) => { catRef.current = { getEchartsInstance: () => inst }; }}
              />
            )}
          </CardContent>
        </Card>
        {!filaId && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Chamados por departamento</CardTitle></CardHeader>
            <CardContent>
              {(porFila.data ?? []).length === 0 ? (
                <EmptyState label="Sem chamados no período." />
              ) : (
                <SuporteAnaliseChart tipo="bar" data={porFila.data ?? []} metrica="chamados" dimensao="fila" height={280} />
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sankey + CSAT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Fluxo de transferências</CardTitle></CardHeader>
          <CardContent>
            {!sankeyOption ? (
              <EmptyState label="Nenhuma transferência no período." />
            ) : (
              <div className="min-w-0 w-full"><ReactECharts ref={sankeyRef} option={sankeyOption} theme="rubyCorp" style={{ height: 320, width: "100%" }} notMerge lazyUpdate /></div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">CSAT — distribuição</CardTitle>
            <div className="text-xs text-muted-foreground">
              Média: <span className="font-semibold text-foreground">{formatValor(atual.csat_media, "csat")}</span> · {totalCsat} avaliação{totalCsat === 1 ? "" : "es"}
            </div>
          </CardHeader>
          <CardContent>
            {totalCsat === 0 ? (
              <EmptyState label="Sem avaliações no período — as avaliações são coletadas ao resolver o chamado." />
            ) : (
              <div className="min-w-0 w-full"><ReactECharts ref={csatRef} option={csatOption} theme="rubyCorp" style={{ height: 260, width: "100%" }} notMerge lazyUpdate /></div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="h-[260px] flex flex-col items-center justify-center text-muted-foreground gap-1.5">
      <Inbox className="h-6 w-6" />
      <p className="text-xs text-center max-w-xs">{label}</p>
    </div>
  );
}
