import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";
import { validateErpAuth, AuthError } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";

function json(body: unknown, status: number, req: Request, startMs: number) {
  const cors = getCorsHeaders(req);
  const headers = withSecurityHeaders(
    { ...cors, "Content-Type": "application/json" },
    status === 401 || status === 403
  );
  const meta = { processed_at: new Date().toISOString(), duration_ms: Date.now() - startMs };
  const responseBody = typeof body === "object" && body !== null && !Array.isArray(body)
    ? { ...body as Record<string, unknown>, meta }
    : { data: body, meta };
  return new Response(JSON.stringify(responseBody), { status, headers });
}

function errorResp(status: number, code: string, message: string, req: Request, startMs: number) {
  return json({ error: code, message }, status, req, startMs);
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startMs = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/erp-fornecedores-query\/?/, "/").replace(/\/+$/, "") || "/";

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
    await checkRateLimit({ prefix: "erp-fornecedores", limit: 60, req });
  } catch (e) {
    if (e instanceof RateLimitError) return errorResp(429, "RATE_LIMIT", e.message, req, startMs);
    throw e;
  }

  // --- Sync log helper ---
  async function logSync(endpoint: string, payload: unknown, statusCode: number) {
    try {
      await supabase.from("erp_sync_log").insert({
        entity_type: "fornecedores",
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
      const cnpjParam = url.searchParams.get("cnpj");

      let query = supabase
        .from("fabrica_fornecedores")
        .select("id, cnpj, razao_social, nome_fantasia, erp_code, erp_synced_at, email, telefone, ativo")
        .eq("ativo", true)
        .order("razao_social");

      if (cnpjParam) {
        const cnpjClean = cnpjParam.replace(/\D/g, "");
        if (cnpjClean.length >= 11) {
          query = query.ilike("cnpj", `%${cnpjClean}%`);
        } else {
          query = query.ilike("cnpj", `%${cnpjParam}%`);
        }
      }

      const { data, error } = await query;

      if (error) {
        await logSync("GET /", { cnpj: cnpjParam }, 500);
        return errorResp(500, "DB_ERROR", error.message, req, startMs);
      }

      if (!data || data.length === 0) {
        await logSync("GET /", { cnpj: cnpjParam }, 404);
        return errorResp(404, "NOT_FOUND", "Nenhum fornecedor encontrado", req, startMs);
      }

      await logSync("GET /", { cnpj: cnpjParam }, 200);
      return json({ fornecedores: data, total: data.length }, 200, req, startMs);
    }

    // ==================== 404 ====================
    await logSync(`${req.method} ${path}`, null, 404);
    return errorResp(404, "NOT_FOUND", `Rota ${req.method} ${path} não encontrada`, req, startMs);
  } catch (err: any) {
    await logSync(`${req.method} ${path}`, null, 500);
    return errorResp(500, "DB_ERROR", err.message || "Erro interno", req, startMs);
  }
});
