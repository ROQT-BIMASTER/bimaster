/**
 * Validation and normalization helpers for Central de Trabalho URL params.
 * Any invalid value falls back to its default.
 */

export const VALID_TABS = ["hoje", "tarefas", "inbox"] as const;
export type CentralTab = typeof VALID_TABS[number];

export const VALID_VIEWS = ["list", "board", "calendar", "dashboard"] as const;
export type CentralView = typeof VALID_VIEWS[number];

export const VALID_PRIORITIES = ["all", "urgente", "alta", "media", "baixa"] as const;
export type CentralPriority = typeof VALID_PRIORITIES[number];

export const VALID_FILTERS = ["all", "atrasadas", "hoje"] as const;
export type CentralFilter = typeof VALID_FILTERS[number];

export const DEFAULTS = {
  tab: "hoje" as CentralTab,
  view: "list" as CentralView,
  priority: "all" as CentralPriority,
  filter: "all" as CentralFilter,
  project: "all",
  q: "",
};

const SEARCH_MAX_LENGTH = 100;
// UUID v4-ish or "all"
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeTab(value: string | null, fallback: CentralTab = DEFAULTS.tab): CentralTab {
  return VALID_TABS.includes(value as CentralTab) ? (value as CentralTab) : fallback;
}

export function normalizeView(value: string | null, fallback: CentralView = DEFAULTS.view): CentralView {
  return VALID_VIEWS.includes(value as CentralView) ? (value as CentralView) : fallback;
}

export function normalizePriority(value: string | null, fallback: CentralPriority = DEFAULTS.priority): CentralPriority {
  return VALID_PRIORITIES.includes(value as CentralPriority) ? (value as CentralPriority) : fallback;
}

export function normalizeFilter(value: string | null, fallback: CentralFilter = DEFAULTS.filter): CentralFilter {
  return VALID_FILTERS.includes(value as CentralFilter) ? (value as CentralFilter) : fallback;
}

export function normalizeProject(value: string | null, fallback: string = DEFAULTS.project): string {
  if (!value) return fallback;
  if (value === "all") return "all";
  return UUID_RE.test(value) ? value : fallback;
}

export function normalizeSearch(value: string | null): string {
  if (!value) return "";
  // Trim and clamp; strip control chars to avoid breaking the URL
  const cleaned = value.replace(/[\x00-\x1F\x7F]/g, "").trim();
  return cleaned.slice(0, SEARCH_MAX_LENGTH);
}
