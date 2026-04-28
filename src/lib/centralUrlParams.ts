/**
 * Validation and normalization for Central de Trabalho URL params.
 *
 * Architecture
 * ------------
 * A SINGLE registry (`PARAM_SCHEMAS`) describes every supported param.
 * A SINGLE parser (`parseCentralParams`) walks the registry and produces a
 * fully-validated, fully-typed snapshot. All public helpers
 * (`normalizeTab`, `normalizeView`, …, `sanitizeCentralSearchParams`,
 * `searchParamsNeedRewrite`) are thin wrappers around it, so any future
 * tweak to a param's rules lives in exactly one place.
 *
 * Hard limits keep the parser O(n) and crash-proof for adversarial input:
 *   - per-value byte ceiling (`MAX_RAW_VALUE_LENGTH`)
 *   - search clamp (`SEARCH_MAX_LENGTH`)
 *   - csv length clamp (`MAX_CSV_LENGTH`) and item-count clamp (`MAX_ID_LIST_SIZE`)
 *
 * Any invalid value falls back to the param's default. The function is
 * deterministic and idempotent: feeding its own output back in is a no-op.
 */

/* -------------------------------------------------------------------------- */
/* Public types and constants                                                  */
/* -------------------------------------------------------------------------- */

export const VALID_TABS = ["hoje", "tarefas", "inbox"] as const;
export type CentralTab = typeof VALID_TABS[number];

export const VALID_VIEWS = ["list", "board", "calendar", "dashboard"] as const;
export type CentralView = typeof VALID_VIEWS[number];

export const VALID_PRIORITIES = ["all", "urgente", "alta", "media", "baixa"] as const;
export type CentralPriority = typeof VALID_PRIORITIES[number];

export const VALID_FILTERS = ["all", "atrasadas", "hoje", "sem_data"] as const;
export type CentralFilter = typeof VALID_FILTERS[number];

export const VALID_SORTS = ["default", "urgent"] as const;
export type CentralSort = typeof VALID_SORTS[number];

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
  sort: "default" as CentralSort,
  project: "all",
  q: "",
  inboxSubtab: "atividade" as CentralInboxSubtab,
  inboxGroup: "tempo" as CentralInboxGroup,
};

const SEARCH_MAX_LENGTH = 100;
const MAX_ID_LIST_SIZE = 50;
/**
 * Hard ceiling applied to every raw value before any other work. Protects the
 * parser from quadratic regex / normalize / split costs on adversarial input.
 * Generous enough to fit a full CSV of 50 UUIDs (~50 * 37 = 1850) plus slack.
 */
const MAX_RAW_VALUE_LENGTH = 4096;
const MAX_CSV_LENGTH = 4096;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                            */
/* -------------------------------------------------------------------------- */

/** Cap raw input length up-front so downstream regexes are bounded. */
function clampRaw(value: string | null): string | null {
  if (value === null) return null;
  return value.length > MAX_RAW_VALUE_LENGTH
    ? value.slice(0, MAX_RAW_VALUE_LENGTH)
    : value;
}

/** Lower-case + trim — used for every enum-style param. */
function preNormalizeEnumValue(value: string | null): string | null {
  const v = clampRaw(value);
  if (v === null) return null;
  return v.trim().toLowerCase();
}

/** Strip control chars, NFC, collapse whitespace, trim, clamp. */
function cleanFreeText(value: string | null, maxLen: number): string {
  const v = clampRaw(value);
  if (!v) return "";
  let cleaned = v.replace(/[\x00-\x1F\x7F]/g, "");
  try {
    cleaned = cleaned.normalize("NFC");
  } catch {
    /* normalize is supported in all modern runtimes — ignore failures */
  }
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  // Clamp by Unicode codepoints (not UTF-16 code units) so 4-byte chars
  // such as emoji are not split mid-surrogate-pair.
  const codepoints = Array.from(cleaned);
  return codepoints.length > maxLen ? codepoints.slice(0, maxLen).join("") : cleaned;
}

/** Parse a CSV with per-item validation, dedup and item-count cap. */
function parseCsv<T extends string>(
  value: string | null,
  validate: (item: string) => T | null,
): T[] {
  const v = clampRaw(value);
  if (!v) return [];
  const csv = v.length > MAX_CSV_LENGTH ? v.slice(0, MAX_CSV_LENGTH) : v;
  const seen = new Set<T>();
  for (const raw of csv.split(",")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const accepted = validate(trimmed);
    if (accepted !== null) seen.add(accepted);
    if (seen.size >= MAX_ID_LIST_SIZE) break;
  }
  return Array.from(seen);
}

/* -------------------------------------------------------------------------- */
/* Schema registry                                                             */
/*                                                                             */
/* Adding a new param = adding a single entry here. Every public helper        */
/* below is automatically wired through this registry.                         */
/* -------------------------------------------------------------------------- */

interface ParamSchema<T> {
  /** Default value when the param is absent or invalid. */
  default: T;
  /**
   * Tolerant parser used by the canonical sanitizer and by `parseCentralParams`.
   * Trims/lowercases enum values, NFC-normalizes free text, etc.
   */
  parse(value: string | null): T;
  /**
   * Strict parser used by the public `normalize*` field helpers. Preserves the
   * historical behavior where enum-style helpers (e.g. `normalizeTab("HOJE")`)
   * fall back to the default for non-canonical casing/whitespace. CSV and
   * free-text schemas reuse `parse` (their tolerance was already part of the
   * legacy contract).
   */
  parseStrict(value: string | null, fallback: T): T;
}

function enumSchema<T extends string>(
  values: readonly T[],
  fallback: T,
): ParamSchema<T> {
  return {
    default: fallback,
    parse(value) {
      const pre = preNormalizeEnumValue(value);
      return values.includes(pre as T) ? (pre as T) : fallback;
    },
    parseStrict(value, fb) {
      // No trim, no lowercase — bytes must be canonical to be accepted.
      return values.includes(value as T) ? (value as T) : fb;
    },
  };
}

const projectSchema: ParamSchema<string> = {
  default: DEFAULTS.project,
  parse(value) {
    const pre = preNormalizeEnumValue(value);
    if (!pre) return DEFAULTS.project;
    if (pre === "all") return "all";
    return UUID_RE.test(pre) ? pre : DEFAULTS.project;
  },
  parseStrict(value, fb) {
    if (!value) return fb;
    if (value === "all") return "all";
    return UUID_RE.test(value) ? value : fb;
  },
};

const searchSchema: ParamSchema<string> = {
  default: "",
  parse(value) {
    return cleanFreeText(value, SEARCH_MAX_LENGTH);
  },
  parseStrict(value) {
    // Free text has no "strict" form — both modes share the same cleanup.
    return cleanFreeText(value, SEARCH_MAX_LENGTH);
  },
};

const inboxTiposSchema: ParamSchema<CentralInboxTipo[]> = {
  default: [],
  parse(value) {
    return parseCsv<CentralInboxTipo>(value, (item) => {
      const lowered = item.toLowerCase();
      return VALID_INBOX_TIPOS.includes(lowered as CentralInboxTipo)
        ? (lowered as CentralInboxTipo)
        : null;
    });
  },
  parseStrict(value) {
    // Legacy contract trimmed each CSV entry but did NOT lowercase.
    return parseCsv<CentralInboxTipo>(value, (item) =>
      VALID_INBOX_TIPOS.includes(item as CentralInboxTipo)
        ? (item as CentralInboxTipo)
        : null,
    );
  },
};

const projectIdListSchema: ParamSchema<string[]> = {
  default: [],
  parse(value) {
    return parseCsv<string>(value, (item) => {
      const lowered = item.toLowerCase();
      if (!lowered || lowered === "all") return null;
      return UUID_RE.test(lowered) ? lowered : null;
    });
  },
  parseStrict(value) {
    return parseCsv<string>(value, (item) => {
      if (!item || item === "all") return null;
      return UUID_RE.test(item) ? item : null;
    });
  },
};

const PARAM_SCHEMAS = {
  tab: enumSchema(VALID_TABS, DEFAULTS.tab),
  view: enumSchema(VALID_VIEWS, DEFAULTS.view),
  priority: enumSchema(VALID_PRIORITIES, DEFAULTS.priority),
  filter: enumSchema(VALID_FILTERS, DEFAULTS.filter),
  sort: enumSchema(VALID_SORTS, DEFAULTS.sort),
  project: projectSchema,
  q: searchSchema,
  subtab: enumSchema(VALID_INBOX_SUBTABS, DEFAULTS.inboxSubtab),
  group: enumSchema(VALID_INBOX_GROUPS, DEFAULTS.inboxGroup),
  tipos: inboxTiposSchema,
  projetos: projectIdListSchema,
} as const;

/* -------------------------------------------------------------------------- */
/* Public per-field helpers — thin wrappers over the registry                  */
/* (kept for backwards compat with the 8 callers across the app).              */
/* -------------------------------------------------------------------------- */

export function normalizeTab(
  value: string | null,
  fallback: CentralTab = DEFAULTS.tab,
): CentralTab {
  return PARAM_SCHEMAS.tab.parseStrict(value, fallback);
}

export function normalizeView(
  value: string | null,
  fallback: CentralView = DEFAULTS.view,
): CentralView {
  return PARAM_SCHEMAS.view.parseStrict(value, fallback);
}

export function normalizePriority(
  value: string | null,
  fallback: CentralPriority = DEFAULTS.priority,
): CentralPriority {
  return PARAM_SCHEMAS.priority.parseStrict(value, fallback);
}

export function normalizeFilter(
  value: string | null,
  fallback: CentralFilter = DEFAULTS.filter,
): CentralFilter {
  return PARAM_SCHEMAS.filter.parseStrict(value, fallback);
}

export function normalizeSort(
  value: string | null,
  fallback: CentralSort = DEFAULTS.sort,
): CentralSort {
  return PARAM_SCHEMAS.sort.parseStrict(value, fallback);
}

export function normalizeProject(
  value: string | null,
  fallback: string = DEFAULTS.project,
): string {
  return PARAM_SCHEMAS.project.parseStrict(value, fallback);
}

export function normalizeSearch(value: string | null): string {
  return PARAM_SCHEMAS.q.parse(value);
}

export function normalizeInboxSubtab(
  value: string | null,
  fallback: CentralInboxSubtab = DEFAULTS.inboxSubtab,
): CentralInboxSubtab {
  return PARAM_SCHEMAS.subtab.parseStrict(value, fallback);
}

export function normalizeInboxGroup(
  value: string | null,
  fallback: CentralInboxGroup = DEFAULTS.inboxGroup,
): CentralInboxGroup {
  return PARAM_SCHEMAS.group.parseStrict(value, fallback);
}

export function normalizeInboxTipos(value: string | null): CentralInboxTipo[] {
  return PARAM_SCHEMAS.tipos.parseStrict(value, []);
}

export function normalizeProjectIdList(value: string | null): string[] {
  return PARAM_SCHEMAS.projetos.parseStrict(value, []);
}

/* -------------------------------------------------------------------------- */
/* Unified parser — single entry point used by the sanitizer                   */
/* -------------------------------------------------------------------------- */

export interface ParsedCentralParams {
  tab: CentralTab;
  view: CentralView;
  priority: CentralPriority;
  filter: CentralFilter;
  sort: CentralSort;
  project: string;
  q: string;
  subtab: CentralInboxSubtab;
  group: CentralInboxGroup;
  tipos: CentralInboxTipo[];
  projetos: string[];
}

/**
 * Run every schema in the registry against `input` and return a fully-typed
 * snapshot. This is the *only* place that touches the registry — every other
 * exported function in this module delegates here (directly or via the thin
 * field wrappers above).
 */
export function parseCentralParams(input: URLSearchParams): ParsedCentralParams {
  return {
    tab: PARAM_SCHEMAS.tab.parse(input.get("tab")),
    view: PARAM_SCHEMAS.view.parse(input.get("view")),
    priority: PARAM_SCHEMAS.priority.parse(input.get("priority")),
    filter: PARAM_SCHEMAS.filter.parse(input.get("filter")),
    sort: PARAM_SCHEMAS.sort.parse(input.get("sort")),
    project: PARAM_SCHEMAS.project.parse(input.get("project")),
    q: PARAM_SCHEMAS.q.parse(input.get("q")),
    subtab: PARAM_SCHEMAS.subtab.parse(input.get("subtab")),
    group: PARAM_SCHEMAS.group.parse(input.get("group")),
    tipos: PARAM_SCHEMAS.tipos.parse(input.get("tipos")),
    projetos: PARAM_SCHEMAS.projetos.parse(input.get("projetos")),
  };
}

/* -------------------------------------------------------------------------- */
/* Canonical query string                                                      */
/* -------------------------------------------------------------------------- */

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
  const parsed = parseCentralParams(input);
  const out = new URLSearchParams();

  // 1. Tab — drives which other keys are valid.
  if (parsed.tab !== DEFAULTS.tab) out.set("tab", parsed.tab);

  // 2. Filter — applies to tarefas only.
  if (parsed.tab === "tarefas" && parsed.filter !== DEFAULTS.filter) {
    out.set("filter", parsed.filter);
  }

  // 3. Task-only params live under tarefas.
  if (parsed.tab === "tarefas") {
    if (parsed.view !== DEFAULTS.view) out.set("view", parsed.view);
    if (parsed.priority !== DEFAULTS.priority) out.set("priority", parsed.priority);
    if (parsed.sort !== DEFAULTS.sort) out.set("sort", parsed.sort);
    if (parsed.project !== DEFAULTS.project) out.set("project", parsed.project);
    if (parsed.q) out.set("q", parsed.q);
  }

  // 4. Inbox-only params.
  if (parsed.tab === "inbox") {
    if (parsed.subtab !== DEFAULTS.inboxSubtab) out.set("subtab", parsed.subtab);
    if (parsed.group !== DEFAULTS.inboxGroup) out.set("group", parsed.group);
    if (parsed.tipos.length) out.set("tipos", parsed.tipos.join(","));
    if (parsed.projetos.length) out.set("projetos", parsed.projetos.join(","));
    if (parsed.q) out.set("q", parsed.q);
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
