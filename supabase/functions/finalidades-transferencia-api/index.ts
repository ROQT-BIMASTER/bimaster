// finalidades-transferencia-api
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { validateAnyAuth } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";

function mapCadastro(row: Record<string, unknown>): Record<string, unknown> {
  return {
    banco: "",
    codigo: row.codigo || "",
    descricao: row.descricao || "",
  };
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startMs = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/finalidades-transferencia-api\/?/, "/").replace(/\/+$/, "") || "/";

  try {
    // Auth
    const auth = await validateAnyAuth(req);
    await checkRateLimit({ prefix: "finalidades-transferencia", limit: 60, req, userId: auth.userId });

    // Health check
    if (req.method === "GET" && path === "/status") {
      return jsonResponse({ status: "ok", function: "finalidades-transferencia-api", routes: ["/consultar", "/listar", "/status"] }, 200, req, { startMs });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // GET /consultar?codigo=01
    if (req.method === "GET" && path === "/consultar") {
      const codigo = url.searchParams.get("codigo");
      if (!codigo) {
        return errorResponse(400, "MISSING_PARAM", "Query param 'codigo' é obrigatório", req, startMs);
      }

      const { data, error } = await supabase
        .from("finalidades_transferencia")
        .select("*")
        .eq("codigo", codigo)
        .maybeSingle();

      if (error) {
        return errorResponse(500, "DB_ERROR", error.message, req, startMs);
      }
      if (!data) {
        return errorResponse(404, "NOT_FOUND", `Finalidade com código '${codigo}' não encontrada`, req, startMs);
      }

      return jsonResponse(mapCadastro(data), 200, req, { startMs });
    }

    // GET /listar?pagina=1&registros_por_pagina=50
    if (req.method === "GET" && path === "/listar") {
      const pagina = Math.max(1, parseInt(url.searchParams.get("pagina") || "1"));
      const regPorPagina = Math.min(500, Math.max(1, parseInt(url.searchParams.get("registros_por_pagina") || "50")));

      const from = (pagina - 1) * regPorPagina;
      const to = from + regPorPagina - 1;

      const { data, error, count } = await supabase
        .from("finalidades_transferencia")
        .select("*", { count: "exact" })
        .eq("ativo", true)
        .order("codigo", { ascending: true })
        .range(from, to);

      if (error) {
        return errorResponse(500, "DB_ERROR", error.message, req, startMs);
      }

      const totalRegistros = count || 0;
      const totalPaginas = Math.ceil(totalRegistros / regPorPagina);

      return jsonResponse({
        pagina,
        total_de_paginas: totalPaginas,
        registros: data?.length || 0,
        total_de_registros: totalRegistros,
        cadastros: (data || []).map(mapCadastro),
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
    console.error("❌ finalidades-transferencia-api error:", e);
    return errorResponse(500, "INTERNAL_ERROR", e.message || "Erro interno", req, startMs);
  }
});
