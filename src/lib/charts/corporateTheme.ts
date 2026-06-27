import * as echarts from "echarts/core";
import {
  BarChart,
  LineChart,
  PieChart,
  TreemapChart,
} from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DatasetComponent,
  ToolboxComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { Unidade } from "@/lib/vendas/unidade";
import { UNIDADE_SUFIXO } from "@/lib/vendas/unidade";
import { getTabelaColor } from "@/lib/vendas/tabelaPrecoColors";

echarts.use([
  BarChart, LineChart, PieChart, TreemapChart,
  GridComponent, TooltipComponent, LegendComponent, TitleComponent, DatasetComponent, ToolboxComponent,
  CanvasRenderer,
]);

export const RUBYCORP_PALETTE = [
  "#185FA5", "#0F6E56", "#854F0B", "#534AB7",
  "#1D9E75", "#5F5E5A", "#993556", "#378ADD",
];

export const BRAND_BASE = "#185FA5";
export const BRAND_ACCENT = "#C0507A";

const AXIS = "#6B7280";
const SPLIT = "rgba(15,22,35,0.10)";

const THEME = {
  color: RUBYCORP_PALETTE,
  backgroundColor: "transparent",
  textStyle: {
    fontFamily: "inherit",
    color: "#1F2937",
  },
  title: {
    textStyle: { color: "#0F1623", fontWeight: 600 },
  },
  legend: {
    textStyle: { color: AXIS, fontSize: 11 },
    itemWidth: 10, itemHeight: 10,
  },
  tooltip: {
    backgroundColor: "#ffffff",
    borderColor: "rgba(15,22,35,0.08)",
    borderWidth: 1,
    extraCssText: "box-shadow:0 8px 24px -4px rgba(15,22,35,0.12);border-radius:8px;",
    textStyle: { color: "#0F1623", fontSize: 12 },
  },
  grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
  categoryAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: AXIS, fontSize: 11 },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: AXIS, fontSize: 11 },
    splitLine: { lineStyle: { color: SPLIT, type: "dashed" } },
  },
  bar: { itemStyle: { borderRadius: [6, 6, 0, 0] } },
  line: { lineStyle: { width: 2 }, symbol: "circle", symbolSize: 6 },
};

let registered = false;
export function ensureRubyCorpTheme() {
  if (registered) return;
  echarts.registerTheme("rubyCorp", THEME);
  registered = true;
}

// Formatters
const fmtBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtBRLcents = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtNum = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function formatBRL(v: number, withCents = false): string {
  if (!isFinite(v)) return "—";
  return (withCents ? fmtBRLcents : fmtBRL).format(v);
}

export function formatBRLcompact(v: number): string {
  if (!isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (abs >= 1_000) return `R$ ${Math.round(v / 1000)}K`;
  return formatBRL(v);
}

export function formatQtd(v: number, unidade: Unidade = "UN"): string {
  if (!isFinite(v)) return "—";
  return `${fmtNum.format(Math.round(v))} ${UNIDADE_SUFIXO[unidade]}`;
}

export function formatInt(v: number): string {
  if (!isFinite(v)) return "—";
  return fmtNum.format(Math.round(v));
}

export type Metrica =
  | "faturamento"
  | "faturamento_impostos"
  | "quantidade"
  | "notas"
  | "ticket"
  | "clientes"
  | "desconto";

export function isMonetaria(m: Metrica): boolean {
  return m === "faturamento" || m === "faturamento_impostos" || m === "ticket" || m === "desconto";
}

export function formatValue(v: number, metrica: Metrica, unidade: Unidade = "UN"): string {
  if (metrica === "quantidade") return formatQtd(v, unidade);
  if (metrica === "notas" || metrica === "clientes") return formatInt(v);
  return formatBRLcompact(v);
}

export function colorForCategory(label: string, idx: number, dimensao?: string): string {
  if (dimensao === "tabela") return getTabelaColor(label);
  return RUBYCORP_PALETTE[idx % RUBYCORP_PALETTE.length];
}

export { echarts };
