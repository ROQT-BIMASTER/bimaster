import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";
import { validateErpAuth, AuthError } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";

const MAX_SYNC_RECORDS = 5000;

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
  const path = url.pathname.replace(/^\/erp-portadores-api\/?/, "/").replace(/\/+$/, "") || "/";

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

  // Convert empresaId to number for tables that use integer empresa_id
  const empresaIdNum = typeof empresaId === 'number' ? empresaId : parseInt(String(empresaId));
  if (isNaN(empresaIdNum)) {
    return errorResp(422, "VALIDATION_ERROR", "empresa_id deve ser numérico para esta API", req, startMs);
  }

  // --- Rate limit ---
  try {
    await checkRateLimit({ prefix: "erp-portadores", limit: 60, req });
  } catch (e) {
    if (e instanceof RateLimitError) return errorResp(429, "RATE_LIMIT", e.message, req, startMs);
    throw e;
  }

  // --- Sync log helper ---
  async function logSync(endpoint: string, payload: unknown, statusCode: number) {
    try {
      await supabase.from("erp_sync_log").insert({
        entity_type: "portadores",
        entity_id: crypto.randomUUID(),
        action: endpoint,
        direction: "inbound",
        request_payload: payload as any,
        response_status: statusCode,
        success: statusCode >= 200 && statusCode < 300,
        duration_ms: Date.now() - startMs,
        empresa_id: empresaIdNum,
      });
    } catch (e) {
      console.error("Failed to log sync:", e);
    }
  }

  try {
    // ==================== GET / ====================
    if (req.method === "GET" && path === "/") {
      const { data, error } = await supabase
        .from("portadores")
        .select("id, nome, banco_codigo, banco_nome, agencia, conta, tipo, codigo_erp")
        .eq("empresa_id", empresaIdNum)
        .eq("ativo", true)
        .order("nome");

      if (error) {
        await logSync("GET /", null, 500);
        return errorResp(500, "DB_ERROR", error.message, req, startMs);
      }

      await logSync("GET /", null, 200);
      return json({ data, total: data.length }, 200, req, startMs);
    }

    // ==================== POST /sync ====================
    if (req.method === "POST" && path === "/sync") {
      let body: any;
      try {
        body = await req.json();
      } catch {
        await logSync("POST /sync", null, 422);
        return errorResp(422, "VALIDATION_ERROR", "Body JSON inválido", req, startMs);
      }

      if (!Array.isArray(body?.portadores) || body.portadores.length === 0) {
        await logSync("POST /sync", body, 422);
        return errorResp(422, "VALIDATION_ERROR", "Campo 'portadores' deve ser um array não vazio", req, startMs);
      }

      if (body.portadores.length > MAX_SYNC_RECORDS) {
        await logSync("POST /sync", { count: body.portadores.length }, 413);
        return errorResp(413, "PAYLOAD_TOO_LARGE", `Máximo ${MAX_SYNC_RECORDS} registros por request. Recebido: ${body.portadores.length}`, req, startMs);
      }

      const rows = body.portadores.map((p: any) => ({
        empresa_id: empresaIdNum,
        codigo_erp: p.codigo_erp,
        nome: p.nome,
        banco_codigo: p.banco_codigo || null,
        banco_nome: p.banco_nome || null,
        agencia: p.agencia || null,
        conta: p.conta || null,
        tipo: p.tipo || null,
        ativo: true,
        updated_at: new Date().toISOString(),
      }));

      for (const r of rows) {
        if (!r.codigo_erp || !r.nome) {
          await logSync("POST /sync", body, 422);
          return errorResp(422, "VALIDATION_ERROR", "Cada portador deve ter 'codigo_erp' e 'nome'", req, startMs);
        }
      }

      const { data, error } = await supabase
        .from("portadores")
        .upsert(rows, { onConflict: "empresa_id,codigo_erp", ignoreDuplicates: false })
        .select("id");

      if (error) {
        await logSync("POST /sync", body, 500);
        return errorResp(500, "DB_ERROR", error.message, req, startMs);
      }

      const result = { success: true, upserted: data?.length || 0 };
      await logSync("POST /sync", body, 200);
      return json(result, 200, req, startMs);
    }

    // ==================== 404 ====================
    await logSync(`${req.method} ${path}`, null, 404);
    return errorResp(404, "NOT_FOUND", `Rota ${req.method} ${path} não encontrada`, req, startMs);
  } catch (err: any) {
    await logSync(`${req.method} ${path}`, null, 500);
    return errorResp(500, "DB_ERROR", err.message || "Erro interno", req, startMs);
  }
});
