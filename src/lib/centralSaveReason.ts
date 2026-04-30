/**
 * Tracks the human-readable cause of the last Central de Trabalho preference
 * save, scoped by user id. Stored in localStorage so it survives navigations
 * and is shared across the components that trigger / display saves.
 *
 * This is a presentation-only audit hint — the canonical audit trail lives in
 * `central_preferences_audit` on the server.
 */

export type CentralSaveCause =
  | "filter_change"
  | "view_change"
  | "tab_change"
  | "priority_change"
  | "project_change"
  | "role_change"
  | "manual_save"
  | "reset_full"
  | "reset_filters_only"
  | "multiple_changes";

export interface CentralSaveReason {
  cause: CentralSaveCause;
  /** Free-form Portuguese label shown to the user. */
  label: string;
  /** ISO timestamp at the moment the save was issued (client clock). */
  at: string;
}

const KEY_PREFIX = "central:last-save-reason:";

const LABELS: Record<CentralSaveCause, string> = {
  filter_change: "salvo após mudança de filtro de período",
  view_change: "salvo após mudança de visualização",
  tab_change: "salvo após mudança de aba",
  priority_change: "salvo após mudança de prioridade",
  project_change: "salvo após mudança de projeto",
  manual_save: "salvo manualmente pelo botão Salvar agora",
  reset_full: "salvo após restaurar todas as preferências padrão",
  reset_filters_only: "salvo após limpar filtros e busca",
  multiple_changes: "salvo após múltiplas alterações",
};

export function buildReason(cause: CentralSaveCause): CentralSaveReason {
  return { cause, label: LABELS[cause], at: new Date().toISOString() };
}

/**
 * Build a label from the set of preference fields that changed in a single
 * autosave cycle. Returns `multiple_changes` if more than one differs.
 */
export function reasonFromChangedFields(
  fields: Array<"default_view" | "default_filter" | "default_priority" | "default_project" | "default_tab">
): CentralSaveReason {
  if (fields.length === 0) return buildReason("manual_save");
  if (fields.length > 1) return buildReason("multiple_changes");
  const map: Record<string, CentralSaveCause> = {
    default_view: "view_change",
    default_filter: "filter_change",
    default_priority: "priority_change",
    default_project: "project_change",
    default_tab: "tab_change",
  };
  return buildReason(map[fields[0]] ?? "manual_save");
}

export function rememberReason(userId: string | undefined | null, reason: CentralSaveReason): void {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY_PREFIX + userId, JSON.stringify(reason));
  } catch {
    // Storage may be unavailable (private mode, quota). Audit hint is best-effort.
  }
}

export function readReason(userId: string | undefined | null): CentralSaveReason | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CentralSaveReason;
    if (!parsed?.cause || !parsed?.label || !parsed?.at) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearReason(userId: string | undefined | null): void {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY_PREFIX + userId);
  } catch {
    /* noop */
  }
}
