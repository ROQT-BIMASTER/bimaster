import { useMemo, useRef } from "react";
import ReactECharts from "echarts-for-react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import {
  ensureRubyCorpTheme,
  formatValue,
  formatBRLcompact,
  formatBRL,
  formatQtd,
  formatInt,
  colorForCategory,
  BRAND_BASE,
  BRAND_ACCENT,
  type Metrica,
} from "@/lib/charts/corporateTheme";
import type { Unidade } from "@/lib/vendas/unidade";

export type AnaliseChartTipo = "bar" | "line" | "area" | "pie" | "treemap" | "table";

export interface AnaliseRow {
  label: string;
  valor: number;
}

interface Props {
  tipo: AnaliseChartTipo;
  data: AnaliseRow[];
  metrica: Metrica;
  unidade?: Unidade;
  dimensao?: string;
  titulo?: string;
  /** Marca um label como acento (mês atual, máximo etc.). */
  highlightLabel?: string;
  height?: number;
}

function tooltipFormatterFactory(metrica: Metrica, unidade: Unidade) {
  return (params: any) => {
    const arr = Array.isArray(params) ? params : [params];
    const p = arr[0];
    const name = p.name ?? p.data?.name ?? "";
    const v = typeof p.value === "number" ? p.value : (p.data?.value ?? 0);
    const formatted = metrica === "quantidade"
      ? formatQtd(v, unidade)
      : metrica === "notas" || metrica === "clientes"
      ? formatInt(v)
      : formatBRL(v, metrica === "ticket");
    return `<div style="font-size:11px;color:#6B7280;margin-bottom:2px">${name}</div>
            <div style="font-weight:600">${formatted}</div>`;
  };
}

function valueAxisFormatter(metrica: Metrica, unidade: Unidade) {
  return (v: number) => {
    if (metrica === "quantidade") return `${Math.round(v).toLocaleString("pt-BR")}`;
    if (metrica === "notas" || metrica === "clientes") return Math.round(v).toLocaleString("pt-BR");
    return formatBRLcompact(v);
  };
}

export function AnaliseChart({
  tipo,
  data,
  metrica,
  unidade = "UN",
  dimensao,
  titulo,
  highlightLabel,
  height = 360,
}: Props) {
  ensureRubyCorpTheme();
  const ref = useRef<any>(null);

  const option = useMemo(() => {
    const isTemporal = dimensao === "mes" || dimensao === "trimestre" || dimensao === "ano";
    const horizontal = tipo === "bar" && data.length > 8;
    const labels = data.map((d) => d.label);
    const values = data.map((d) => d.valor);

    const baseTooltip = {
      trigger: tipo === "pie" || tipo === "treemap" ? "item" : "axis",
      formatter: tooltipFormatterFactory(metrica, unidade),
    };

    if (tipo === "pie") {
      return {
        tooltip: { ...baseTooltip, trigger: "item" },
        legend: { type: "scroll", bottom: 0, textStyle: { fontSize: 11 } },
        series: [{
          type: "pie",
          radius: ["45%", "70%"],
          itemStyle: { borderColor: "#fff", borderWidth: 2 },
          label: { fontSize: 11 },
          data: data.map((d, i) => ({
            name: d.label,
            value: d.valor,
            itemStyle: { color: colorForCategory(d.label, i, dimensao) },
          })),
        }],
      };
    }

    if (tipo === "treemap") {
      return {
        tooltip: { ...baseTooltip, trigger: "item" },
        series: [{
          type: "treemap",
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          label: { fontSize: 11, color: "#fff" },
          data: data.map((d, i) => ({
            name: d.label,
            value: d.valor,
            itemStyle: { color: colorForCategory(d.label, i, dimensao) },
          })),
        }],
      };
    }

    // bar / line / area
    const seriesType = tipo === "line" || tipo === "area" ? "line" : "bar";
    const itemColor = (params: any) => {
      const lbl = params.name;
      if (highlightLabel && lbl === highlightLabel) return BRAND_ACCENT;
      if (dimensao === "tabela" || dimensao === "vendedor" || dimensao === "coordenador" || dimensao === "cliente" || dimensao === "empresa" || dimensao === "produto" || dimensao === "tipo_pedido") {
        return colorForCategory(lbl, params.dataIndex, dimensao);
      }
      return BRAND_BASE;
    };

    const series: any = {
      type: seriesType,
      data: values,
      itemStyle: seriesType === "bar" ? { color: itemColor } : { color: BRAND_BASE },
      lineStyle: seriesType === "line" ? { color: BRAND_BASE, width: 2 } : undefined,
      areaStyle: tipo === "area" ? { color: BRAND_BASE, opacity: 0.18 } : undefined,
      smooth: seriesType === "line",
      barMaxWidth: 36,
    };

    const valFmt = valueAxisFormatter(metrica, unidade);
    const catAxis = { type: "category", data: labels, axisLabel: { interval: 0, rotate: horizontal ? 0 : (labels.length > 6 ? 30 : 0) } };
    const valAxis = { type: "value", axisLabel: { formatter: valFmt } };

    return {
      tooltip: baseTooltip,
      grid: { left: 8, right: 24, top: 24, bottom: 24, containLabel: true },
      xAxis: horizontal ? valAxis : catAxis,
      yAxis: horizontal ? { ...catAxis, inverse: true } : valAxis,
      series: [series],
    };
  }, [tipo, data, metrica, unidade, dimensao, highlightLabel]);

  const handleExport = (kind: "png" | "svg") => {
    const inst = ref.current?.getEchartsInstance();
    if (!inst) return;
    const url = inst.getDataURL({ type: kind === "svg" ? "svg" : "png", backgroundColor: "#fff", pixelRatio: 2 });
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(titulo || "analise").toLowerCase().replace(/\s+/g, "-")}.${kind}`;
    a.click();
  };

  return (
    <div className="relative">
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleExport("png")} title="Exportar PNG">
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
      />
    </div>
  );
}
