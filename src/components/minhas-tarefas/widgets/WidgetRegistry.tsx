import {
  Clock, AlertTriangle, CheckCircle2, TrendingUp,
  BarChart3, PieChart, Activity, ListChecks, CalendarClock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface WidgetConfig {
  type: string;
  order: number;
  size: "sm" | "md" | "lg";
}

export interface WidgetMeta {
  type: string;
  label: string;
  icon: LucideIcon;
  defaultSize: "sm" | "md" | "lg";
  category: "kpi" | "chart" | "list";
}

export const WIDGET_REGISTRY: WidgetMeta[] = [
  { type: "kpi_pendentes", label: "KPI Pendentes", icon: Clock, defaultSize: "sm", category: "kpi" },
  { type: "kpi_atrasadas", label: "KPI Atrasadas", icon: AlertTriangle, defaultSize: "sm", category: "kpi" },
  { type: "kpi_concluidas_hoje", label: "KPI Concluídas Hoje", icon: CheckCircle2, defaultSize: "sm", category: "kpi" },
  { type: "kpi_produtividade", label: "KPI Produtividade", icon: TrendingUp, defaultSize: "sm", category: "kpi" },
  { type: "tarefas_por_projeto", label: "Tarefas por Projeto", icon: BarChart3, defaultSize: "lg", category: "chart" },
  { type: "tarefas_por_prioridade", label: "Por Prioridade", icon: PieChart, defaultSize: "md", category: "chart" },
  { type: "tarefas_por_status", label: "Por Status", icon: PieChart, defaultSize: "md", category: "chart" },
  { type: "timeline_conclusoes", label: "Timeline Conclusões", icon: Activity, defaultSize: "lg", category: "chart" },
  { type: "lista_atrasadas", label: "Lista Atrasadas", icon: ListChecks, defaultSize: "md", category: "list" },
  { type: "lista_proximas", label: "Próximas Tarefas", icon: CalendarClock, defaultSize: "md", category: "list" },
];

export const DEFAULT_WIDGETS: WidgetConfig[] = [
  { type: "kpi_pendentes", order: 0, size: "sm" },
  { type: "kpi_atrasadas", order: 1, size: "sm" },
  { type: "kpi_concluidas_hoje", order: 2, size: "sm" },
  { type: "kpi_produtividade", order: 3, size: "sm" },
  { type: "tarefas_por_projeto", order: 4, size: "lg" },
  { type: "tarefas_por_prioridade", order: 5, size: "md" },
  { type: "tarefas_por_status", order: 6, size: "md" },
];

export function getWidgetMeta(type: string): WidgetMeta | undefined {
  return WIDGET_REGISTRY.find((w) => w.type === type);
}
