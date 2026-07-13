// _shared/empresa-scope.ts — Multi-tenant empresa scoping for portal APIs.
//
// Portal APIs (anexos, boletos, clientes, contas-pagar, contas-receber) run
// with SUPABASE_SERVICE_ROLE_KEY, bypassing RLS. Every read/delete/update MUST
// therefore be scoped to the caller's empresa(s):
//   - API-key callers: pinned to a single empresa_id resolved at auth time.
//   - JWT callers: scoped to the empresas mapped in user_empresas + admin bypass.
//
// Usage:
//   const scope = await getCallerEmpresaScope(auth);
//   if (!scope.isAdmin && scope.empresaIds.length === 0) {
//     return forbidden("Sem escopo de empresa");
//   }
//   let q = supabase.from("contas_pagar").select("*");
//   q = applyEmpresaFilter(q, scope);            // .in('empresa_id', ...)
//   // or, for a single-row lookup, use .maybeSingle() AFTER the .in filter.
import { createClient } from "npm:@supabase/supabase-js@2";

export type CallerAuthLike = {
  userId?: string;
  empresaId?: string;
  source?: "jwt" | "api_key" | string | null;
};

export type EmpresaScope =
  | { isAdmin: true; empresaIds: null; source: "jwt" | "api_key" | "none" }
  | { isAdmin: false; empresaIds: string[]; source: "jwt" | "api_key" | "none" };

/**
 * Resolve the empresa scope for the caller. Fail-closed:
 * - Missing/unknown source ⇒ empty scope (deny).
 * - JWT without user_empresas rows and not admin ⇒ empty scope.
 * - API key without empresa_id ⇒ empty scope.
 */
export async function getCallerEmpresaScope(auth: CallerAuthLike): Promise<EmpresaScope> {
  if (auth?.source === "api_key") {
    const id = auth.empresaId ? String(auth.empresaId) : "";
    return { isAdmin: false, empresaIds: id ? [id] : [], source: "api_key" };
  }
  if (auth?.source === "jwt" && auth.userId) {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    try {
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: auth.userId,
        _role: "admin",
      });
      if (isAdmin === true) return { isAdmin: true, empresaIds: null, source: "jwt" };
    } catch {
      // fall through — treat as non-admin
    }
    try {
      const { data } = await supabase
        .from("user_empresas")
        .select("empresa_id")
        .eq("user_id", auth.userId);
      const ids = Array.from(
        new Set((data || []).map((r: any) => (r?.empresa_id != null ? String(r.empresa_id) : "")).filter(Boolean)),
      );
      return { isAdmin: false, empresaIds: ids, source: "jwt" };
    } catch {
      return { isAdmin: false, empresaIds: [], source: "jwt" };
    }
  }
  return { isAdmin: false, empresaIds: [], source: "none" };
}

/**
 * Apply the empresa scope to a PostgREST query builder.
 * - Admin: no-op (all rows visible).
 * - Non-admin: adds `.in(column, empresaIds)`. Caller MUST check
 *   `scope.empresaIds.length > 0` before invoking; otherwise the filter
 *   silently matches nothing (defense-in-depth) but you'll skip a 403.
 */
export function applyEmpresaFilter<Q extends { in: (col: string, vals: any[]) => Q }>(
  query: Q,
  scope: EmpresaScope,
  column: string = "empresa_id",
): Q {
  if (scope.isAdmin) return query;
  const ids = scope.empresaIds.length > 0 ? scope.empresaIds : ["__NONE__"];
  return query.in(column, ids);
}

/** Convenience: true when the scope grants access to no rows (non-admin, no ids). */
export function isEmptyScope(scope: EmpresaScope): boolean {
  return !scope.isAdmin && scope.empresaIds.length === 0;
}
