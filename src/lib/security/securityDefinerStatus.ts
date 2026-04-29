import type { Tables } from "@/integrations/supabase/types";

export type SecurityDefinerStatus = "mantida" | "ajustada" | "revogada";

export interface SecurityDefinerFunctionRaw {
  schema_name: string;
  function_name: string;
  function_args: string;
  function_signature: string;
  return_type: string;
  language: string;
  volatility: string;
  granted_to_authenticated: boolean;
  granted_to_anon: boolean;
  granted_to_service_role: boolean;
  callers: Array<{ file: string; line: number }>;
}

export type SecurityDefinerOverride = Tables<"security_definer_overrides">;

export interface SecurityDefinerFunctionEnriched extends SecurityDefinerFunctionRaw {
  status_inferred: SecurityDefinerStatus;
  status_final: SecurityDefinerStatus;
  override?: SecurityDefinerOverride;
  used_in_frontend: boolean;
  callers_count: number;
}

/** Deriva status automático com base em grants. */
export function inferStatus(fn: SecurityDefinerFunctionRaw): SecurityDefinerStatus {
  if (!fn.granted_to_anon && !fn.granted_to_authenticated) return "revogada";
  // "ajustada" só por override; aqui a inferência é mantida por padrão
  return "mantida";
}

/** Combina inferência + override → status final exibido. */
export function resolveStatus(
  fn: SecurityDefinerFunctionRaw,
  override?: SecurityDefinerOverride,
): { inferred: SecurityDefinerStatus; final: SecurityDefinerStatus } {
  const inferred = inferStatus(fn);
  const final = (override?.status_override as SecurityDefinerStatus | null) ?? inferred;
  return { inferred, final };
}

export const STATUS_LABELS: Record<SecurityDefinerStatus, string> = {
  mantida: "Mantida",
  ajustada: "Ajustada",
  revogada: "Revogada",
};

export const STATUS_BADGE_CLASS: Record<SecurityDefinerStatus, string> = {
  mantida:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  ajustada:
    "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  revogada: "bg-muted text-muted-foreground border-border",
};
