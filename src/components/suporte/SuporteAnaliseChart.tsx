import { useMemo, useRef } from "react";
import ReactECharts from "echarts-for-react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import {
  ensureRubyCorpTheme,
  colorForCategory,
  BRAND_BASE,
  BRAND_ACCENT,
} from "@/lib/charts/corporateTheme";
import {
  formatValor,
  axisFormatter,
  formatLabelTemporal,
  type SuporteMetrica,
  type SuporteDimensao,
} from "@/lib/suporte/analyticsFormat";

export type AnaliseChartTipo = "bar" | "line" | "area" | "pie" | "table";

export interface AnaliseRow {
  label: string;
  valor: number;
}

interface Props {
  tipo: AnaliseChartTipo;
  data: AnaliseRow[];
  metrica: SuporteMetrica;
  dimensao: SuporteDimensao;
  titulo?: string;
  highlightLabel?: string;
  height?: number;
  onInstance?: (inst: any) => void;
}

function tooltipFactory(metrica: SuporteMetrica) {
  return (params: any) => {
    const arr = Array.isArray(params) ? params : [params];
    const p = arr[0];
    const name = p.name ?? p.data?.name ?? "";
    const v = typeof p.value === "number" ? p.value : Number(p.data?.value ?? 0);
    return `<div style="font-size:11px;color:#6B7280;margin-bottom:2px">${name}</div>
            <div style="font-weight:600">${formatValor(v, metrica)}</div>`;
  };
}

export function SuporteAnaliseChart({
  tipo,
  data,
  metrica,
  dimensao,
  titulo,
  highlightLabel,
  height = 360,
  onInstance,
}: Props) {
  ensureRubyCorpTheme();
  const ref = useRef<any>(null);

  const option = useMemo(() => {
    const horizontal = tipo === "bar" && data.length > 8;
    const labels = data.map((d) => formatLabelTemporal(d.label, dimensao));
    const values = data.map((d) => d.valor);

    const baseTooltip = {
      trigger: tipo === "pie" ? "item" : "axis",
      confine: true,
      axisPointer: tipo === "pie" ? undefined : { type: (tipo === "line" || tipo === "area") ? "line" : "shadow" },
      borderColor: "hsl(var(--border))",
      textStyle: { color: "#0F1623", fontSize: 12 },
      formatter: tooltipFactory(metrica),
    };

    if (tipo === "pie") {
      return {
        tooltip: baseTooltip,
        legend: { type: "scroll", bottom: 0, textStyle: { fontSize: 11 } },
        series: [{
          type: "pie",
          radius: ["45%", "70%"],
          itemStyle: { borderColor: "#fff", borderWidth: 2 },
          label: { fontSize: 11 },
          data: data.map((d, i) => ({
            name: d.label,
            value: d.valor,
            itemStyle: { color: colorForCategory(d.label, i) },
          })),
        }],
      };
    }

    const seriesType = tipo === "line" || tipo === "area" ? "line" : "bar";
    const itemColor = (params: any) => {
      if (highlightLabel && params.name === highlightLabel) return BRAND_ACCENT;
      if (dimensao === "fila" || dimensao === "categoria" || dimensao === "agente" || dimensao === "canal") {
        return colorForCategory(String(params.name ?? ""), params.dataIndex);
      }
      return BRAND_BASE;
    };

    const small = data.length <= 8;
    const series: any = {
      type: seriesType,
      data: values,
      itemStyle: seriesType === "bar" ? { color: itemColor } : { color: BRAND_BASE },
      lineStyle: seriesType === "line" ? { color: BRAND_BASE, width: 2 } : undefined,
      areaStyle: tipo === "area" ? { color: BRAND_BASE, opacity: 0.18 } : undefined,
      smooth: seriesType === "line",
      showSymbol: seriesType === "line" ? data.length <= 40 : undefined,
      symbol: seriesType === "line" ? "circle" : undefined,
      symbolSize: 4,
      barMaxWidth: 36,
      label: small
        ? {
            show: true,
            position: seriesType === "bar" && !horizontal ? "top" : (horizontal ? "right" : "top"),
            fontSize: 10,
            color: "#6B7280",
            distance: 4,
            overflow: "truncate",
            formatter: (p: any) => formatValor(Number(p.value ?? 0), metrica),
          }
        : undefined,
    };

    const valFmt = axisFormatter(metrica);
    const catAxis = {
      type: "category",
      data: labels,
      axisLabel: {
        interval: "auto" as const,
        rotate: horizontal ? 0 : (labels.length > 10 ? 35 : (labels.length > 6 ? 20 : 0)),
        hideOverlap: true,
        fontSize: 10,
      },
    };
    const valAxis = { type: "value", axisLabel: { formatter: valFmt } };

    const temporal = dimensao === "dia" || dimensao === "semana" || dimensao === "mes";
    const showZoom = temporal && data.length > 30 && !horizontal;
    const zoomStart = showZoom ? Math.max(0, 100 - (30 / data.length) * 100) : 0;

    return {
      tooltip: baseTooltip,
      grid: {
        left: 8,
        right: showZoom ? 32 : 24,
        top: 24,
        bottom: showZoom ? 48 : 24,
        containLabel: true,
      },
      xAxis: horizontal ? valAxis : catAxis,
      yAxis: horizontal ? { ...catAxis, inverse: true } : valAxis,
      dataZoom: showZoom
        ? [
            {
              type: "inside",
              start: zoomStart,
              end: 100,
              minValueSpan: 7,
              zoomOnMouseWheel: true,
              moveOnMouseMove: true,
              moveOnMouseWheel: false,
            },
            { type: "slider", height: 18, bottom: 6, start: zoomStart, end: 100, minValueSpan: 7 },
          ]
        : undefined,
      series: [series],
    };

  }, [tipo, data, metrica, dimensao, highlightLabel]);

  const handleExport = () => {
    const inst = ref.current?.getEchartsInstance();
    if (!inst) return;
    const url = inst.getDataURL({ type: "png", backgroundColor: "#fff", pixelRatio: 2 });
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(titulo || "analise").toLowerCase().replace(/\s+/g, "-")}.png`;
    a.click();
  };

  if (tipo === "table") {
    const total = data.reduce((s, r) => s + (r.valor || 0), 0);
    return (
      <div className="overflow-auto border border-border rounded-md" style={{ maxHeight: height }}>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Categoria</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Valor</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground w-20">%</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={i} className="border-t border-border/60 hover:bg-muted/20">
                <td className="px-3 py-1.5">{formatLabelTemporal(r.label, dimensao)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatValor(r.valor, metrica)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                  {total > 0 ? `${((r.valor / total) * 100).toFixed(1)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="relative min-w-0 w-full">
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleExport} title="Exportar PNG">
          <Download className="h-3 w-3 mr-1" /> PNG
        </Button>
      </div>
      <ReactECharts
        ref={ref}
        option={option}
        theme="rubyCorp"
        style={{ height, width: "100%" }}
        notMerge
        lazyUpdate
        onChartReady={(inst) => onInstance?.(inst)}
      />
    </div>
  );
}
