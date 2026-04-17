// parcelas-api
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { validateAnyAuth } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { withIdempotency } from "../_shared/idempotency.ts";

function mapParcela(row: Record<string, unknown>): Record<string, unknown> {
  return {
    nCodigo: row.codigo || "",
    cDescricao: row.descricao || "",
    nParcelas: row.numero_parcelas ?? 1,
  };
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startMs = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/parcelas-api\/?/, "/").replace(/\/+$/, "") || "/";

  try {
    // Auth
    const auth = await validateAnyAuth(req);
    await checkRateLimit({ prefix: "parcelas", limit: 60, req, userId: auth.userId });

    // Health check
    if (req.method === "GET" && path === "/status") {
      return jsonResponse(
        { status: "ok", function: "parcelas-api", routes: ["/incluir", "/listar", "/status"] },
        200, req, { startMs }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // POST /incluir — IncluirParcela
    if (req.method === "POST" && path === "/incluir") {
      const body = await req.json();
      const cParcela = typeof body.cParcela === "string" ? body.cParcela.trim() : "";

      if (!cParcela) {
        return errorResponse(400, "VALIDATION_ERROR", "cParcela é obrigatório", req, startMs);
      }

      // Parse "nParcelas" from description pattern like "30/60/90" → 3 parcels
      const parts = cParcela.split("/").filter((p: string) => p.trim().length > 0);
      const numeroParcelas = parts.length > 1 ? parts.length : 1;

      // Generate next sequential code
      const { data: lastRow } = await supabase
        .from("parcelas_condicoes")
        .select("codigo")
        .order("codigo", { ascending: false })
        .limit(1);

      const lastCode = lastRow && lastRow.length > 0 ? parseInt(lastRow[0].codigo, 10) : 0;
      const nextCode = String(Math.max(lastCode + 1, 1)).padStart(3, "0");

      const { data: inserted, error } = await supabase
        .from("parcelas_condicoes")
        .insert({
          codigo: nextCode,
          descricao: cParcela.slice(0, 30),
          numero_parcelas: numeroParcelas,
          importado_api: true,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          return errorResponse(409, "DUPLICATE", "Parcela já existe com este código", req, startMs);
        }
        return errorResponse(500, "DB_ERROR", error.message, req, startMs);
      }

      return jsonResponse({
        cCodStatus: "0",
        cDesStatus: "Parcela incluída com sucesso!",
        cCodParcela: inserted.codigo,
        cDesParcela: inserted.descricao,
      }, 201, req, { startMs });
    }

    // POST /listar — ListarParcelas
    if (req.method === "POST" && (path === "/listar" || path === "/")) {
      let body: Record<string, unknown> = {};
      try {
        body = await req.json();
      } catch {
        // empty body is valid
      }

      const pagina = Math.max(1, Number(body.pagina) || 1);
      const regPorPagina = Math.min(500, Math.max(1, Number(body.registros_por_pagina) || 50));
      const from = (pagina - 1) * regPorPagina;
      const to = from + regPorPagina - 1;

      let query = supabase
        .from("parcelas_condicoes")
        .select("*", { count: "exact" })
        .eq("ativo", true)
        .order("codigo", { ascending: true });

      // Filter by apenas_importado_api
      if (body.apenas_importado_api === "S") {
        query = query.eq("importado_api", true);
      }

      // Ordering
      if (body.ordem_decrescente === "S") {
        query = supabase
          .from("parcelas_condicoes")
          .select("*", { count: "exact" })
          .eq("ativo", true)
          .order("codigo", { ascending: false });
        if (body.apenas_importado_api === "S") {
          query = query.eq("importado_api", true);
        }
      }

      query = query.range(from, to);

      const { data, error, count } = await query;

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
        cadastros: (data || []).map(mapParcela),
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
    console.error("❌ parcelas-api error:", e);
    return errorResponse(500, "INTERNAL_ERROR", e.message || "Erro interno", req, startMs);
  }
});
