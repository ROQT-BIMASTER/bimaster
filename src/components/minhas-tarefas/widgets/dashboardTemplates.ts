import {
  LayoutDashboard, Briefcase, Target, Zap, FilePlus,
  type LucideIcon,
} from "lucide-react";
import type { WidgetConfig } from "./WidgetRegistry";

export interface DashboardTemplate {
  id: string;
  nome: string;
  descricao: string;
  icon: LucideIcon;
  /** Composition shown as small schematic in the gallery card. */
  preview: ("kpi" | "chart-lg" | "chart-md" | "list" | "heatmap")[];
  widgets: WidgetConfig[];
}

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  {
    id: "executiva",
    nome: "Visão Executiva",
    descricao: "Para gestores. KPIs principais, tendência de conclusões e distribuição por projeto.",
    icon: LayoutDashboard,
    preview: ["kpi", "kpi", "kpi", "kpi", "chart-lg", "chart-md"],
    widgets: [
      { type: "kpi_pendentes", order: 0, size: "sm" },
      { type: "kpi_atrasadas", order: 1, size: "sm" },
      { type: "kpi_concluidas_hoje", order: 2, size: "sm" },
      { type: "kpi_taxa_prazo", order: 3, size: "sm" },
      { type: "timeline_conclusoes", order: 4, size: "lg" },
      { type: "tarefas_por_projeto", order: 5, size: "md" },
      { type: "tarefas_por_status", order: 6, size: "md" },
    ],
  },
  {
    id: "operacional",
    nome: "Operação Diária",
    descricao: "Para quem executa. Atrasadas, próximas e distribuição por prioridade em destaque.",
    icon: Briefcase,
    preview: ["kpi", "kpi", "kpi", "list", "list", "chart-md"],
    widgets: [
      { type: "kpi_atrasadas", order: 0, size: "sm" },
      { type: "kpi_pendentes", order: 1, size: "sm" },
      { type: "kpi_concluidas_hoje", order: 2, size: "sm" },
      { type: "carga_capacidade", order: 3, size: "md" },
      { type: "lista_atrasadas", order: 4, size: "md" },
      { type: "lista_proximas", order: 5, size: "md" },
      { type: "tarefas_por_prioridade", order: 6, size: "md" },
    ],
  },
  {
    id: "foco-semana",
    nome: "Foco da Semana",
    descricao: "Para ICs e seniores. Heatmap de produtividade, carga semanal e taxa de cumprimento.",
    icon: Target,
    preview: ["kpi", "kpi", "kpi", "heatmap", "list", "chart-md"],
    widgets: [
      { type: "kpi_produtividade", order: 0, size: "sm" },
      { type: "kpi_concluidas_hoje", order: 1, size: "sm" },
      { type: "kpi_taxa_prazo", order: 2, size: "sm" },
      { type: "heatmap_produtividade", order: 3, size: "lg" },
      { type: "carga_capacidade", order: 4, size: "md" },
      { type: "lista_proximas", order: 5, size: "md" },
    ],
  },
  {
    id: "pmo",
    nome: "Performance de Projetos",
    descricao: "Para PMO. Ranking de projetos, aging de pendências e taxa de cumprimento.",
    icon: Zap,
    preview: ["kpi", "kpi", "kpi", "list", "chart-md", "chart-lg"],
    widgets: [
      { type: "kpi_pendentes", order: 0, size: "sm" },
      { type: "kpi_atrasadas", order: 1, size: "sm" },
      { type: "kpi_taxa_prazo", order: 2, size: "sm" },
      { type: "leaderboard_projetos", order: 3, size: "md" },
      { type: "aging_tarefas", order: 4, size: "md" },
      { type: "tarefas_por_projeto", order: 5, size: "lg" },
    ],
  },
  {
    id: "em-branco",
    nome: "Em branco",
    descricao: "Sem widgets. Monte do zero adicionando o que precisar.",
    icon: FilePlus,
    preview: [],
    widgets: [],
  },
];

export function getTemplate(id: string): DashboardTemplate | undefined {
  return DASHBOARD_TEMPLATES.find((t) => t.id === id);
}
