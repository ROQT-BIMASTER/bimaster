// ─── Unified project constants ───
// Single source of truth for status/stage labels, options, and colors across all project views.

export const STATUS_LABELS: Record<string, string> = {
  pendente: "Não iniciado",
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  bloqueada: "Bloqueada",
  cancelada: "Cancelada",
};

export const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "pendente", label: "Não iniciado" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluida", label: "Concluído" },
  { value: "bloqueada", label: "Bloqueada" },
];

export const ESTAGIO_LABELS: Record<string, string> = {
  planejado: "Planejado",
  executivo: "Executivo",
  lancamento: "Lançamento",
};

export const ESTAGIO_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Sem estágio" },
  { value: "planejado", label: "Planejado" },
  { value: "executivo", label: "Executivo" },
  { value: "lancamento", label: "Lançamento" },
];

export const PRIORIDADE_LABELS: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};

export const PRIORITY_MAP: Record<string, number> = {
  baixa: 1, media: 2, normal: 3, alta: 4, urgente: 5,
};

export const PRIORITY_REVERSE: Record<number, string> = {
  1: "baixa", 2: "media", 3: "normal", 4: "alta", 5: "urgente",
};

// ─── View-specific color maps ───
// Each view uses different CSS patterns (badges, pills, bars), so colors remain view-specific but are centralized here.

export const STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  pendente: "secondary",
  nao_iniciado: "secondary",
  em_andamento: "warning",
  concluida: "success",
  bloqueada: "destructive",
};

// List view (solid badges)
export const STATUS_COLORS_LIST: Record<string, string> = {
  pendente: "bg-gray-400 text-white",
  nao_iniciado: "bg-gray-400 text-white",
  em_andamento: "bg-amber-500 text-white",
  concluida: "bg-emerald-500 text-white",
  bloqueada: "bg-red-500 text-white",
};

export const STATUS_COLORS_LIST_DARK: Record<string, string> = {
  pendente: "bg-gray-500 text-white",
  nao_iniciado: "bg-gray-500 text-white",
  em_andamento: "bg-amber-500 text-white",
  concluida: "bg-emerald-500 text-white",
  bloqueada: "bg-red-500 text-white",
};

// Kanban view (translucent badges)
export const STATUS_COLORS_KANBAN: Record<string, string> = {
  pendente: "bg-muted text-muted-foreground",
  nao_iniciado: "bg-pink-500/20 text-pink-400",
  em_andamento: "bg-amber-500/20 text-amber-400",
  concluida: "bg-emerald-500/20 text-emerald-400",
  bloqueada: "bg-red-500/20 text-red-400",
};

// Estagio colors per view
export const ESTAGIO_COLORS_LIST: Record<string, string> = {
  planejado: "bg-blue-500 text-white",
  executivo: "bg-amber-500 text-white",
  lancamento: "bg-emerald-500 text-white",
};

export const ESTAGIO_COLORS_KANBAN: Record<string, string> = {
  planejado: "bg-blue-500/20 text-blue-400",
  executivo: "bg-amber-500/20 text-amber-400",
  lancamento: "bg-emerald-500/20 text-emerald-400",
};

export const ESTAGIO_ACCENT_KANBAN: Record<string, string> = {
  planejado: "bg-blue-500",
  executivo: "bg-amber-500",
  lancamento: "bg-emerald-500",
};

// Cronograma (HSL for bar fill)
export const ESTAGIO_COLORS_CRONOGRAMA: Record<string, string> = {
  planejado: "hsl(210, 70%, 55%)",
  executivo: "hsl(40, 80%, 50%)",
  lancamento: "hsl(150, 60%, 45%)",
};

// Calendario pill colors
export const ESTAGIO_PILL_COLORS: Record<string, string> = {
  planejado: "bg-blue-500",
  executivo: "bg-amber-500",
  lancamento: "bg-emerald-500",
};

// Calendario analise panel (dark/light variants)
export const ESTAGIO_COLORS_ANALISE_DARK: Record<string, string> = {
  planejado: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  executivo: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  lancamento: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

export const ESTAGIO_COLORS_ANALISE_LIGHT: Record<string, string> = {
  planejado: "bg-blue-100 text-blue-700 border-blue-200",
  executivo: "bg-amber-100 text-amber-700 border-amber-200",
  lancamento: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

// Status icons for calendar view
export const STATUS_ICON_CONFIG: Record<string, { className: string; completed: boolean }> = {
  pendente: { className: "text-muted-foreground", completed: false },
  nao_iniciado: { className: "text-pink-500", completed: false },
  em_andamento: { className: "text-amber-500", completed: false },
  concluida: { className: "text-emerald-500", completed: true },
  bloqueada: { className: "text-red-500", completed: false },
};
