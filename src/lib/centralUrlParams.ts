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
  // Strip control chars, normalize Unicode (NFC) so visually-equal strings hash equally,
  // collapse internal whitespace, trim and clamp to a sane upper bound.
  let cleaned = value.replace(/[\x00-\x1F\x7F]/g, "");
  try {
    cleaned = cleaned.normalize("NFC");
  } catch {
    /* normalize is supported in all modern runtimes — ignore failures */
  }
  cleaned = cleaned.replace(/\s+/g, " ").trim();
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

/**
 * Lower-case + trim the raw value of an enum-style param BEFORE feeding it to a
 * normalizer. We never accept "HOJE" or " hoje " as the canonical form, but we
 * do want to keep them out of toast warnings (they are silently corrected).
 */
function preNormalizeEnumValue(value: string | null): string | null {
  if (value === null) return null;
  return value.trim().toLowerCase();
}

/**
 * Single source of truth for the URL we write back to the browser. Given the
 * raw `URLSearchParams` (possibly with duplicated keys, mixed casing, control
 * chars, NBSPs, etc.), it returns a brand-new `URLSearchParams` containing
 * **only** the canonical keys/values for the active tab. Keys whose value
 * matches the system default are stripped entirely so the query string stays
 * minimal.
 *
 * Designed to be deterministic and idempotent: calling it twice on its own
 * output is a no-op.
 */
export function sanitizeCentralSearchParams(input: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();

  // 1. Tab — drives which other keys are valid.
  const tab = normalizeTab(preNormalizeEnumValue(input.get("tab")));
  if (tab !== DEFAULTS.tab) out.set("tab", tab);

  // 2. Filter — applies to tarefas only; on other tabs we drop it entirely.
  if (tab === "tarefas") {
    const filter = normalizeFilter(preNormalizeEnumValue(input.get("filter")));
    if (filter !== DEFAULTS.filter) out.set("filter", filter);
  }

  // 3. Task-only params (view/priority/project/q) live under tarefas.
  if (tab === "tarefas") {
    const view = normalizeView(preNormalizeEnumValue(input.get("view")));
    if (view !== DEFAULTS.view) out.set("view", view);

    const priority = normalizePriority(preNormalizeEnumValue(input.get("priority")));
    if (priority !== DEFAULTS.priority) out.set("priority", priority);

    // Project id is case-sensitive in the wire format but UUIDs are
    // hex-only — lower-casing keeps "ABCDEF..." and "abcdef..." in the same canonical form.
    const project = normalizeProject(preNormalizeEnumValue(input.get("project")));
    if (project !== DEFAULTS.project) out.set("project", project);

    const q = normalizeSearch(input.get("q"));
    if (q) out.set("q", q);
  }

  // 4. Inbox-only params.
  if (tab === "inbox") {
    const subtab = normalizeInboxSubtab(preNormalizeEnumValue(input.get("subtab")));
    if (subtab !== DEFAULTS.inboxSubtab) out.set("subtab", subtab);

    const group = normalizeInboxGroup(preNormalizeEnumValue(input.get("group")));
    if (group !== DEFAULTS.inboxGroup) out.set("group", group);

    // Comma-lists are de-duplicated by the normalizers; rebuild the canonical CSV.
    const tipos = normalizeInboxTipos(preNormalizeEnumValue(input.get("tipos")));
    if (tipos.length) out.set("tipos", tipos.join(","));

    const projetos = normalizeProjectIdList(input.get("projetos"));
    if (projetos.length) out.set("projetos", projetos.join(","));

    const q = normalizeSearch(input.get("q"));
    if (q) out.set("q", q);
  }

  return out;
}

/**
 * Convenience wrapper: returns true when the canonical query string differs
 * from the input (i.e. we should call `setSearchParams(..., { replace: true })`).
 */
export function searchParamsNeedRewrite(input: URLSearchParams): boolean {
  const sanitized = sanitizeCentralSearchParams(input);
  return sortedString(sanitized) !== sortedString(input);
}

function sortedString(p: URLSearchParams): string {
  const entries: [string, string][] = [];
  p.forEach((v, k) => entries.push([k, v]));
  entries.sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([k, v]) => `${k}=${v}`).join("&");
}

