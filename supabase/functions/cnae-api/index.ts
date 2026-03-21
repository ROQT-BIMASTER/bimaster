// cnae-api
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { validateAnyAuth } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";

function mapCnae(row: Record<string, unknown>): Record<string, unknown> {
  return {
    nCodigo: row.codigo || "",
    cDescricao: row.descricao || "",
    cEstrutura: row.estrutura || "",
  };
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startMs = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/cnae-api\/?/, "/").replace(/\/+$/, "") || "/";

  try {
    // Health check
    if (req.method === "GET" && path === "/status") {
      return jsonResponse(
        { status: "ok", function: "cnae-api", routes: ["/listar", "/status"] },
        200, req, { startMs }
      );
    }

    // Auth
    const auth = await validateAnyAuth(req);
    await checkRateLimit({ prefix: "cnae", limit: 60, req, userId: auth.userId });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // POST /listar — ListarCNAE
    if (req.method === "POST" && (path === "/listar" || path === "/")) {
      let body: Record<string, unknown> = {};
      try {
        body = await req.json();
      } catch {
        // empty body is valid
      }

      const pagina = Math.max(1, Number(body.pagina) || 1);
      const registrosPorPagina = Math.min(500, Math.max(1, Number(body.registros_por_pagina) || 50));
      const ordenarPor = typeof body.ordenar_por === "string" && ["descricao"].includes(body.ordenar_por) ? body.ordenar_por : "codigo";
      const ordemDecrescente = body.ordem_decrescente === "S";

      const from = (pagina - 1) * registrosPorPagina;
      const to = from + registrosPorPagina - 1;

      const { data, error, count } = await supabase
        .from("cnaes")
        .select("*", { count: "exact" })
        .eq("ativo", true)
        .order(ordenarPor, { ascending: !ordemDecrescente })
        .range(from, to);

      if (error) {
        return errorResponse(500, "DB_ERROR", error.message, req, startMs);
      }

      const totalRegistros = count || 0;
      const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina);

      return jsonResponse({
        pagina,
        total_de_paginas: totalPaginas,
        registros: data?.length || 0,
        total_de_registros: totalRegistros,
        cadastros: (data || []).map(mapCnae),
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
    console.error("❌ cnae-api error:", e);
    return errorResponse(500, "INTERNAL_ERROR", e.message || "Erro interno", req, startMs);
  }
});
