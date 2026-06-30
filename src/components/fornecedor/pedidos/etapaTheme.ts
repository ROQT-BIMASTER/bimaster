// Tema visual por etapa canônica do pedido (cores via tokens semânticos do projeto).
// Mantém harmonia com badges/tabelas existentes; sem hex literal.

export type EtapaCanonica =
  | "digitacao"
  | "aberto"
  | "separacao"
  | "separado"
  | "conferido"
  | "faturado"
  | "em_rota"
  | "entregue"
  | "finalizado"
  | "baixado"
  | "cancelado";

interface EtapaThemeEntry {
  label: string;
  /** classes para a borda superior do card (Kanban). */
  border: string;
  /** classes para badge na tabela. */
  badge: string;
}

export const ETAPA_THEME: Record<EtapaCanonica, EtapaThemeEntry> = {
  digitacao: {
    label: "Em digitação",
    border: "border-t-4 border-t-sky-500",
    badge: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30",
  },
  aberto: {
    label: "Aberto",
    border: "border-t-4 border-t-sky-500",
    badge: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30",
  },
  separacao: {
    label: "Em separação",
    border: "border-t-4 border-t-amber-500",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  separado: {
    label: "Separado",
    border: "border-t-4 border-t-amber-500",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  conferido: {
    label: "Conferido",
    border: "border-t-4 border-t-violet-500",
    badge: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30",
  },
  faturado: {
    label: "Faturado",
    border: "border-t-4 border-t-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  em_rota: {
    label: "Em rota",
    border: "border-t-4 border-t-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  entregue: {
    label: "Entregue",
    border: "border-t-4 border-t-emerald-600",
    badge: "bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 border-emerald-600/40",
  },
  finalizado: {
    label: "Finalizado",
    border: "border-t-4 border-t-muted-foreground",
    badge: "bg-muted text-muted-foreground border-border",
  },
  baixado: {
    label: "Baixado",
    border: "border-t-4 border-t-muted-foreground",
    badge: "bg-muted text-muted-foreground border-border",
  },
  cancelado: {
    label: "Cancelado",
    border: "border-t-4 border-t-destructive",
    badge: "bg-destructive/10 text-destructive border-destructive/30",
  },
};

export type KanbanColuna = { id: EtapaCanonica; etapas: EtapaCanonica[]; label: string };

/** Colunas visíveis no Kanban Futura (ordem canônica). 'aberto' é agrupado em 'digitacao'. */
export const KANBAN_COLUNAS: KanbanColuna[] = [
  { id: "digitacao", etapas: ["digitacao", "aberto"], label: "Em digitação" },
  { id: "separacao", etapas: ["separacao"], label: "Em separação" },
  { id: "separado", etapas: ["separado"], label: "Separado" },
  { id: "conferido", etapas: ["conferido"], label: "Conferido" },
  { id: "faturado", etapas: ["faturado"], label: "Faturado" },
];

/** Colunas do Kanban Result (Ruby_SP) — inclui "Entregue" ao final. */
export const KANBAN_COLUNAS_RESULT: KanbanColuna[] = [
  { id: "digitacao", etapas: ["digitacao", "aberto"], label: "Em digitação" },
  { id: "separacao", etapas: ["separacao"], label: "Em separação" },
  { id: "separado", etapas: ["separado"], label: "Separado" },
  { id: "conferido", etapas: ["conferido"], label: "Conferido" },
  { id: "faturado", etapas: ["faturado"], label: "Faturado" },
  { id: "entregue", etapas: ["entregue"], label: "Entregue" },
];

export function formatTempoEtapa(dias: number | null | undefined): string {
  if (dias == null || Number.isNaN(dias)) return "—";
  if (dias < 1) {
    const horas = Math.max(0, Math.round(dias * 24));
    return `${horas}h`;
  }
  return `${Math.round(dias)}d`;
}

export function getEtapaTheme(etapa: string): EtapaThemeEntry {
  return (
    ETAPA_THEME[etapa as EtapaCanonica] ?? {
      label: etapa,
      border: "border-t-4 border-t-border",
      badge: "bg-muted text-muted-foreground border-border",
    }
  );
}
