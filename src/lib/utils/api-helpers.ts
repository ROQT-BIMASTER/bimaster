import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Map of endpoint -> HTTP method per contas-pagar-api router
const METHOD_MAP: Record<string, string> = {
  // GET (query/read)
  "/listar": "GET",
  "/query": "GET",
  "/consultar": "GET",
  "/parcelas": "GET",
  "/pagamentos": "GET",
  "/anexos": "GET",
  "/stats": "GET",
  "/last-sync": "GET",
  "/status": "GET",
  "/chunks-progress": "GET",
  // PUT
  "/alterar": "PUT",
  "/update": "PUT",
  // DELETE
  "/excluir": "DELETE",
  // POST (default)
};

function resolveMethod(path: string): string {
  return METHOD_MAP[path] || "POST";
}

/**
 * Centralized API caller for edge functions with 401/429/500 handling.
 *
 * Routes via subpath: extracts `path` from body and appends to function name.
 * GET endpoints serialize remaining body as query string.
 * POST/PUT/DELETE send remaining body as JSON.
 */
export async function callApi(fn: string, body: any) {
  const idempotencyKey = crypto.randomUUID();
  const { path, ...rest } = body || {};

  // Backwards-compat: if no path, fall back to invoke (POST to root)
  if (!path) {
    const { data, error } = await supabase.functions.invoke(fn, {
      body: rest,
      headers: { "X-Idempotency-Key": idempotencyKey },
    });
    if (error) {
      handleApiError(error);
      throw error;
    }
    return data;
  }

  const method = resolveMethod(path);
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const { data: { session } } = await supabase.auth.getSession();

  let url = `${SUPABASE_URL}/functions/v1/${fn}${cleanPath}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };

  let init: RequestInit = { method, headers };

  if (method === "GET") {
    const qs = new URLSearchParams();
    Object.entries(rest).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const qsStr = qs.toString();
    if (qsStr) url += `?${qsStr}`;
  } else {
    headers["X-Idempotency-Key"] = idempotencyKey;
    init = { ...init, body: JSON.stringify(rest) };
  }

  const res = await fetch(url, init);

  if (!res.ok) {
    if (res.status === 401) {
      toast.error("Sessão expirada. Faça login novamente.", { id: "auth-expired" });
      throw new Error("Não autorizado");
    }
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "30");
      toast.warning(`Muitas requisições. Aguarde ${retryAfter}s.`, { id: "rate-limit", duration: retryAfter * 1000 });
      throw new Error("Rate limit excedido");
    }
    const err = await res.json().catch(() => ({}));
    const msg = err?.error || err?.message || `Erro do servidor (${res.status})`;
    toast.error(msg, { id: `api-err-${res.status}` });
    throw new Error(msg);
  }

  const data = await res.json();
  if (data?.meta?.request_id) {
    console.debug(`[API] ${fn}${cleanPath} → request_id=${data.meta.request_id} duration=${data.meta.duration_ms ?? "?"}ms`);
  }
  return data;
}

/**
 * Centralized fetch caller for export API with proper error handling
 */
export async function callExportApi(path: string, method = "GET", body?: any) {
  const { data: { session } } = await supabase.auth.getSession();
  const needsIdempotency = method === "POST" || method === "PUT";
  const res = await fetch(`${SUPABASE_URL}/functions/v1/contas-pagar-export-api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(needsIdempotency ? { "X-Idempotency-Key": crypto.randomUUID() } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    if (res.status === 401) {
      toast.error("Sessão expirada. Faça login novamente.", { id: "auth-expired" });
      throw new Error("Não autorizado");
    }
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "30");
      toast.warning(`Muitas requisições. Aguarde ${retryAfter}s.`, { id: "rate-limit", duration: retryAfter * 1000 });
      throw new Error("Rate limit excedido");
    }
    const err = await res.json().catch(() => ({}));
    toast.error(err.error || `Erro do servidor (${res.status})`, { id: `api-err-${res.status}` });
    throw new Error(err.error || `Erro ${res.status}`);
  }
  return res.json();
}

function handleApiError(error: any) {
  const msg = error?.message || "";
  if (msg.includes("401") || msg.includes("Unauthorized")) {
    toast.error("Sessão expirada. Faça login novamente.", { id: "auth-expired" });
  } else if (msg.includes("429")) {
    toast.warning("Muitas requisições. Aguarde antes de continuar.", { id: "rate-limit" });
  } else if (msg.includes("500")) {
    toast.error("Erro interno no servidor. Tente novamente.", { id: "server-error" });
  }
}

export function formatBRL(v: number | null | undefined) {
  if (v == null) return "R$ 0,00";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    const date = new Date(d);
    return date.toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
}

export function fmtDateTime(d: string | null | undefined) {
  if (!d) return "—";
  try {
    const date = new Date(d);
    return `${date.toLocaleDateString("pt-BR")} ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return d;
  }
}

/**
 * Convert YYYY-MM-DD to DD/MM/AAAA for API submission
 */
export function dateToApi(d: string): string {
  if (!d) return "";
  if (d.includes("/")) return d;
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

/**
 * Enqueue an ERP sync log entry
 */
export async function enqueueErpSync(opts: {
  contaPagarId: string;
  operacao: string;
  entityType?: string;
  action?: string;
}) {
  const { error } = await supabase.from("erp_sync_log" as any).insert({
    entity_type: opts.entityType || "conta_pagar",
    entity_id: opts.contaPagarId,
    conta_pagar_id: opts.contaPagarId,
    action: opts.action || `export_${opts.operacao}`,
    direction: "outbound",
    sync_status: "pendente",
    tabela_origem: "contas_pagar",
    registro_id: opts.contaPagarId,
    operacao: opts.operacao,
  });
  if (error) console.error("ERP enqueue error:", error);
  return !error;
}
