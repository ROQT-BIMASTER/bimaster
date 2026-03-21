// origens-api
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { validateAnyAuth } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";

function mapOrigem(row: Record<string, unknown>): Record<string, unknown> {
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
  const path = url.pathname.replace(/^\/origens-api\/?/, "/").replace(/\/+$/, "") || "/";

  try {
    // Health check
    if (req.method === "GET" && path === "/status") {
      return jsonResponse({ status: "ok", function: "origens-api", routes: ["/listar", "/status"] }, 200, req, { startMs });
    }

    // Auth
    await validateApiKey(req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // POST /listar
    if (req.method === "POST" && (path === "/listar" || path === "/")) {
      let body: Record<string, unknown> = {};
      try {
        body = await req.json();
      } catch {
        // empty body is valid
      }

      const codigo = typeof body.codigo === "string" ? body.codigo.trim() : "";

      let query = supabase
        .from("origens_titulo")
        .select("*", { count: "exact" })
        .eq("ativo", true)
        .order("codigo", { ascending: true });

      if (codigo) {
        query = query.ilike("codigo", `%${codigo}%`);
      }

      const { data, error, count } = await query;

      if (error) {
        return errorResponse(500, "DB_ERROR", error.message, req, startMs);
      }

      const totalRegistros = count || 0;

      return jsonResponse({
        pagina: 1,
        total_de_paginas: 1,
        registros: data?.length || 0,
        total_de_registros: totalRegistros,
        origem: (data || []).map(mapOrigem),
      }, 200, req, { startMs });
    }

    return errorResponse(404, "NOT_FOUND", `Rota não encontrada: ${req.method} ${path}`, req, startMs);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e.status === 401 || e.status === 403) {
      return errorResponse(e.status, "AUTH_ERROR", e.message || "Não autorizado", req, startMs);
    }
    console.error("❌ origens-api error:", e);
    return errorResponse(500, "INTERNAL_ERROR", e.message || "Erro interno", req, startMs);
  }
});
