// bandeiras-api
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { validateAnyAuth } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";

function mapBandeira(row: Record<string, unknown>): Record<string, unknown> {
  return {
    cCodigo: row.codigo || "",
    cDescricao: row.descricao || "",
    cTipo: row.tipo || "",
  };
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startMs = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/bandeiras-api\/?/, "/").replace(/\/+$/, "") || "/";

  try {
    // Auth
    const auth = await validateAnyAuth(req);
    await checkRateLimit({ prefix: "bandeiras", limit: 60, req, userId: auth.userId });

    // Health check
    if (req.method === "GET" && path === "/status") {
      return jsonResponse({ status: "ok", function: "bandeiras-api", routes: ["/listar", "/status"] }, 200, req, { startMs });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // GET /listar
    if (req.method === "GET" && (path === "/listar" || path === "/")) {
      const nPagina = Math.max(1, parseInt(url.searchParams.get("nPagina") || "1"));
      const nRegPorPagina = Math.min(500, Math.max(1, parseInt(url.searchParams.get("nRegPorPagina") || "50")));

      const from = (nPagina - 1) * nRegPorPagina;
      const to = from + nRegPorPagina - 1;

      const { data, error, count } = await supabase
        .from("bandeiras_cartao")
        .select("*", { count: "exact" })
        .eq("ativo", true)
        .order("codigo", { ascending: true })
        .range(from, to);

      if (error) {
        return errorResponse(500, "DB_ERROR", error.message, req, startMs);
      }

      const nTotRegistros = count || 0;
      const nTotPaginas = Math.ceil(nTotRegistros / nRegPorPagina);

      return jsonResponse({
        nPagina,
        nTotPaginas,
        nRegistros: data?.length || 0,
        nTotRegistros,
        listaBandeira: (data || []).map(mapBandeira),
      }, 200, req, { startMs });
    }

    return errorResponse(404, "NOT_FOUND", `Rota não encontrada: ${req.method} ${path}`, req, startMs);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; name?: string };
    if (e.name === "RateLimitError" || (e as any) instanceof RateLimitError) {
      return errorResponse(429, "RATE_LIMIT", e.message || "Rate limit excedido", req, startMs);
    }
    if (e.status === 401 || e.status === 403) {
      return errorResponse(e.status, "AUTH_ERROR", e.message || "Não autorizado", req, startMs);
    }
    console.error("❌ bandeiras-api error:", e);
    return errorResponse(500, "INTERNAL_ERROR", e.message || "Erro interno", req, startMs);
  }
});
