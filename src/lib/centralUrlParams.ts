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

// Inbox-specific values (shared with the ProjetoInboxContent surface)
export const VALID_INBOX_SUBTABS = ["atividade", "mencoes", "favoritas", "arquivadas"] as const;
export type CentralInboxSubtab = typeof VALID_INBOX_SUBTABS[number];

export const VALID_INBOX_GROUPS = ["tempo", "projeto"] as const;
export type CentralInboxGroup = typeof VALID_INBOX_GROUPS[number];

export const VALID_INBOX_TIPOS = ["criou_tarefa", "completou", "comentou", "moveu"] as const;
export type CentralInboxTipo = typeof VALID_INBOX_TIPOS[number];

export const DEFAULTS = {
  tab: "hoje" as CentralTab,
  view: "list" as CentralView,
  priority: "all" as CentralPriority,
  filter: "all" as CentralFilter,
  project: "all",
  q: "",
  inboxSubtab: "atividade" as CentralInboxSubtab,
  inboxGroup: "tempo" as CentralInboxGroup,
};

const SEARCH_MAX_LENGTH = 100;
const MAX_ID_LIST_SIZE = 50;
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

export function normalizeInboxSubtab(
  value: string | null,
  fallback: CentralInboxSubtab = DEFAULTS.inboxSubtab,
): CentralInboxSubtab {
  return VALID_INBOX_SUBTABS.includes(value as CentralInboxSubtab)
    ? (value as CentralInboxSubtab)
    : fallback;
}

export function normalizeInboxGroup(
  value: string | null,
  fallback: CentralInboxGroup = DEFAULTS.inboxGroup,
): CentralInboxGroup {
  return VALID_INBOX_GROUPS.includes(value as CentralInboxGroup)
    ? (value as CentralInboxGroup)
    : fallback;
}

/**
 * Parse a comma-separated list of inbox tipos, silently dropping invalid entries
 * and removing duplicates. Returns an empty array for null/empty input.
 */
export function normalizeInboxTipos(value: string | null): CentralInboxTipo[] {
  if (!value) return [];
  const seen = new Set<CentralInboxTipo>();
  for (const raw of value.split(",")) {
    const trimmed = raw.trim();
    if (VALID_INBOX_TIPOS.includes(trimmed as CentralInboxTipo)) {
      seen.add(trimmed as CentralInboxTipo);
    }
    if (seen.size >= MAX_ID_LIST_SIZE) break;
  }
  return Array.from(seen);
}

/**
 * Parse a comma-separated list of project UUIDs, silently dropping invalid entries
 * and duplicates. The literal "all" is ignored (meaning: no project filter).
 */
export function normalizeProjectIdList(value: string | null): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  for (const raw of value.split(",")) {
    const trimmed = raw.trim();
    if (trimmed && trimmed !== "all" && UUID_RE.test(trimmed)) {
      seen.add(trimmed);
    }
    if (seen.size >= MAX_ID_LIST_SIZE) break;
  }
  return Array.from(seen);
}

