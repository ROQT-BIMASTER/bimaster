// tipos-documento-api
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { validateAnyAuth } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";

function mapTipoDocumento(row: Record<string, unknown>): Record<string, unknown> {
  return {
    codigo: row.codigo || "",
    descricao: row.descricao || "",
  };
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startMs = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/tipos-documento-api\/?/, "/").replace(/\/+$/, "") || "/";

  try {
    // Health check
    if (req.method === "GET" && path === "/status") {
      return jsonResponse({ status: "ok", function: "tipos-documento-api", routes: ["/consultar", "/pesquisar", "/status"] }, 200, req, { startMs });
    }

    // Auth
    await validateApiKey(req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // GET /consultar?codigo=NF
    if (req.method === "GET" && path === "/consultar") {
      const codigo = url.searchParams.get("codigo");
      if (!codigo) {
        return errorResponse(400, "MISSING_PARAM", "Query param 'codigo' é obrigatório", req, startMs);
      }

      const { data, error } = await supabase
        .from("tipos_documento")
        .select("*")
        .eq("codigo", codigo)
        .maybeSingle();

      if (error) {
        return errorResponse(500, "DB_ERROR", error.message, req, startMs);
      }
      if (!data) {
        return errorResponse(404, "NOT_FOUND", `Tipo de documento com código '${codigo}' não encontrado`, req, startMs);
      }

      return jsonResponse(mapTipoDocumento(data), 200, req, { startMs });
    }

    // POST /pesquisar
    if (req.method === "POST" && path === "/pesquisar") {
      const body = await req.json().catch(() => ({}));
      const codigoFilter = body.codigo ?? "";

      let query = supabase
        .from("tipos_documento")
        .select("*")
        .eq("ativo", true)
        .order("codigo", { ascending: true });

      if (codigoFilter) {
        query = query.ilike("codigo", `%${codigoFilter}%`);
      }

      const { data, error } = await query;

      if (error) {
        return errorResponse(500, "DB_ERROR", error.message, req, startMs);
      }

      return jsonResponse({
        tipo_documento_cadastro: (data || []).map(mapTipoDocumento),
      }, 200, req, { startMs });
    }

    return errorResponse(404, "NOT_FOUND", `Rota não encontrada: ${req.method} ${path}`, req, startMs);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e.status === 401 || e.status === 403) {
      return errorResponse(e.status, "AUTH_ERROR", e.message || "Não autorizado", req, startMs);
    }
    console.error("❌ tipos-documento-api error:", e);
    return errorResponse(500, "INTERNAL_ERROR", e.message || "Erro interno", req, startMs);
  }
});
