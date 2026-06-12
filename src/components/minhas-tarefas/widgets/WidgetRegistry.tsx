import {
  Clock, AlertTriangle, CheckCircle2, TrendingUp,
  BarChart3, PieChart, Activity, ListChecks, CalendarClock,
  Grid3x3, Trophy, Target, Layers, Hourglass,
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
  description?: string;
}

export const WIDGET_REGISTRY: WidgetMeta[] = [
  // KPIs
  { type: "kpi_pendentes", label: "Pendentes", icon: Clock, defaultSize: "sm", category: "kpi", description: "Total de tarefas ativas" },
  { type: "kpi_atrasadas", label: "Atrasadas", icon: AlertTriangle, defaultSize: "sm", category: "kpi", description: "Tarefas com prazo vencido" },
  { type: "kpi_concluidas_hoje", label: "Concluídas Hoje", icon: CheckCircle2, defaultSize: "sm", category: "kpi", description: "Entregas do dia" },
  { type: "kpi_produtividade", label: "Produtividade", icon: TrendingUp, defaultSize: "sm", category: "kpi", description: "% concluído na semana" },
  { type: "kpi_taxa_prazo", label: "Taxa de Cumprimento", icon: Target, defaultSize: "sm", category: "kpi", description: "% entregue no prazo" },

  // Charts
  { type: "tarefas_por_projeto", label: "Tarefas por Projeto", icon: BarChart3, defaultSize: "lg", category: "chart" },
  { type: "tarefas_por_prioridade", label: "Por Prioridade", icon: PieChart, defaultSize: "md", category: "chart" },
  { type: "tarefas_por_status", label: "Por Status", icon: PieChart, defaultSize: "md", category: "chart" },
  { type: "timeline_conclusoes", label: "Timeline de Conclusões", icon: Activity, defaultSize: "lg", category: "chart" },
  { type: "heatmap_produtividade", label: "Heatmap de Produtividade", icon: Grid3x3, defaultSize: "lg", category: "chart", description: "28 dias × dia da semana" },
  { type: "carga_capacidade", label: "Carga vs Capacidade", icon: Layers, defaultSize: "md", category: "chart", description: "Hoje, semana e próxima" },
  { type: "aging_tarefas", label: "Aging de Tarefas", icon: Hourglass, defaultSize: "md", category: "chart", description: "Idade das pendências" },
  { type: "gauge_taxa_prazo", label: "Gauge: Taxa no Prazo", icon: Target, defaultSize: "md", category: "chart", description: "Cumprimento de prazo em 30 dias" },


  // Lists
  { type: "lista_atrasadas", label: "Lista de Atrasadas", icon: ListChecks, defaultSize: "md", category: "list" },
  { type: "lista_proximas", label: "Próximas Tarefas", icon: CalendarClock, defaultSize: "md", category: "list" },
  { type: "leaderboard_projetos", label: "Ranking de Projetos", icon: Trophy, defaultSize: "md", category: "list", description: "Top 5 por velocidade" },
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
