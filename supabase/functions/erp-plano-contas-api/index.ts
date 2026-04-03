import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { validateErpAuth, AuthError } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";

function json(body: unknown, status: number, req: Request, startMs: number) {
  return jsonResponse(body, status, req, { startMs });
}

function errorResp(status: number, code: string, message: string, req: Request, startMs: number) {
  return errorResponse(status, code, message, req, startMs);
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startMs = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/erp-plano-contas-api\/?/, "/").replace(/\/+$/, "") || "/";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // --- Authenticate ---
  let empresaId: string;
  try {
    const auth = await validateErpAuth(req);
    empresaId = auth.empresaId;
  } catch (e) {
    if (e instanceof AuthError) return errorResp(e.status, "UNAUTHORIZED", e.message, req, startMs);
    throw e;
  }

  // --- Rate limit ---
  try {
    await checkRateLimit({ prefix: "erp-plano-contas", limit: 60, req });
  } catch (e) {
    if (e instanceof RateLimitError) return errorResp(429, "RATE_LIMIT", e.message, req, startMs);
    throw e;
  }

  // --- Sync log helper ---
  async function logSync(endpoint: string, payload: unknown, statusCode: number) {
    try {
      await supabase.from("erp_sync_log").insert({
        entity_type: "plano_contas",
        entity_id: crypto.randomUUID(),
        action: endpoint,
        direction: "inbound",
        request_payload: payload as any,
        response_status: statusCode,
        success: statusCode >= 200 && statusCode < 300,
        duration_ms: Date.now() - startMs,
        empresa_id: empresaId,
      });
    } catch (e) {
      console.error("Failed to log sync:", e);
    }
  }

  try {
    // ==================== GET / ====================
    if (req.method === "GET" && path === "/") {
      const { data, error } = await supabase
        .from("trade_chart_of_accounts")
        .select("id, code, name, erp_code, account_type, is_active")
        .eq("is_active", true)
        .order("code", { ascending: true });

      if (error) {
        await logSync("GET /", null, 500);
        return errorResp(500, "DB_ERROR", error.message, req, startMs);
      }

      const planoContas = (data || []).map((row: any) => ({
        id: row.id,
        codigo: row.code,
        nome: row.name,
        erp_code: row.erp_code,
        tipo: row.account_type === "receita" || row.account_type === "R" ? "R" : "D",
        ativo: row.is_active,
      }));

      await logSync("GET /", null, 200);
      return json({ plano_contas: planoContas, total: planoContas.length }, 200, req, startMs);
    }

    // ==================== 404 ====================
    await logSync(`${req.method} ${path}`, null, 404);
    return errorResp(404, "NOT_FOUND", `Rota ${req.method} ${path} não encontrada`, req, startMs);
  } catch (err: any) {
    await logSync(`${req.method} ${path}`, null, 500);
    return errorResp(500, "DB_ERROR", err.message || "Erro interno", req, startMs);
  }
});
