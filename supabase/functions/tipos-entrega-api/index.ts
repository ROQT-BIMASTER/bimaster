// tipos-entrega-api
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { validateAnyAuth } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { wafCheck, wafBlockResponse } from "../_shared/waf.ts";

function mapTipoEntrega(row: Record<string, unknown>): Record<string, unknown> {
  return {
    nCodTransp: row.n_cod_transp ?? 0,
    nCodEntrega: row.n_cod_entrega ?? 0,
    cCodIntEntrega: row.c_cod_int_entrega || "",
    cDescricao: row.c_descricao || "",
    cInativo: row.c_inativo || "N",
  };
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startMs = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/tipos-entrega-api\/?/, "/").replace(/\/+$/, "") || "/";

  try {
    // Health check
    if (req.method === "GET" && path === "/status") {
      return jsonResponse(
        { status: "ok", function: "tipos-entrega-api", routes: ["/incluir", "/alterar", "/consultar", "/excluir", "/listar", "/status"] },
        200, req, { startMs }
      );
    }

    // Auth
    const auth = await validateAnyAuth(req);
    await checkRateLimit({ prefix: "tipos-entrega", limit: 60, req, userId: auth.userId });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (req.method !== "POST") {
      return errorResponse(405, "METHOD_NOT_ALLOWED", "Apenas POST é permitido", req, startMs);
    }

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* empty */ }

    // POST /incluir — IncluirTipoEntrega
    if (path === "/incluir") {
      const c_descricao = typeof body.cDescricao === "string" ? body.cDescricao.trim() : "";
      if (!c_descricao) return errorResponse(400, "VALIDATION_ERROR", "cDescricao é obrigatório", req, startMs);

      const insertData: Record<string, unknown> = {
        c_descricao,
        n_cod_transp: typeof body.nCodTransp === "number" ? body.nCodTransp : null,
        c_cod_int_entrega: typeof body.cCodIntEntrega === "string" ? body.cCodIntEntrega.trim() || null : null,
        c_inativo: body.cInativo === "S" ? "S" : "N",
      };

      const { data, error } = await supabase.from("tipos_entrega").insert(insertData).select("n_cod_entrega, c_cod_int_entrega").single();
      if (error) return errorResponse(500, "DB_ERROR", error.message, req, startMs);

      return jsonResponse({
        nCodEntrega: data.n_cod_entrega,
        cCodIntEntrega: data.c_cod_int_entrega || "",
        cCodStatus: "0",
        cDesStatus: "Tipo de entrega incluído com sucesso",
      }, 201, req, { startMs });
    }

    // POST /alterar — AlterarTipoEntrega
    if (path === "/alterar") {
      const nCodEntrega = typeof body.nCodEntrega === "number" ? body.nCodEntrega : null;
      const cCodIntEntrega = typeof body.cCodIntEntrega === "string" ? body.cCodIntEntrega.trim() : "";
      if (!nCodEntrega && !cCodIntEntrega) return errorResponse(400, "VALIDATION_ERROR", "nCodEntrega ou cCodIntEntrega obrigatório", req, startMs);

      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof body.cDescricao === "string") updateData.c_descricao = body.cDescricao.trim();
      if (body.cInativo === "S" || body.cInativo === "N") updateData.c_inativo = body.cInativo;

      let query = supabase.from("tipos_entrega").update(updateData);
      if (nCodEntrega) query = query.eq("n_cod_entrega", nCodEntrega);
      else query = query.eq("c_cod_int_entrega", cCodIntEntrega);

      const { data, error } = await query.select("n_cod_entrega, c_cod_int_entrega").single();
      if (error) return errorResponse(error.code === "PGRST116" ? 404 : 500, error.code === "PGRST116" ? "NOT_FOUND" : "DB_ERROR", error.code === "PGRST116" ? "Tipo de entrega não encontrado" : error.message, req, startMs);

      return jsonResponse({
        nCodEntrega: data.n_cod_entrega,
        cCodIntEntrega: data.c_cod_int_entrega || "",
        cCodStatus: "0",
        cDesStatus: "Tipo de entrega alterado com sucesso",
      }, 200, req, { startMs });
    }

    // POST /consultar — ConsultarTipoEntrega
    if (path === "/consultar") {
      const nCodEntrega = typeof body.nCodEntrega === "number" ? body.nCodEntrega : null;
      const cCodIntEntrega = typeof body.cCodIntEntrega === "string" ? body.cCodIntEntrega.trim() : "";
      if (!nCodEntrega && !cCodIntEntrega) return errorResponse(400, "VALIDATION_ERROR", "nCodEntrega ou cCodIntEntrega obrigatório", req, startMs);

      let query = supabase.from("tipos_entrega").select("*");
      if (nCodEntrega) query = query.eq("n_cod_entrega", nCodEntrega);
      else query = query.eq("c_cod_int_entrega", cCodIntEntrega);

      const { data, error } = await query.single();
      if (error) return errorResponse(error.code === "PGRST116" ? 404 : 500, error.code === "PGRST116" ? "NOT_FOUND" : "DB_ERROR", error.code === "PGRST116" ? "Tipo de entrega não encontrado" : error.message, req, startMs);

      return jsonResponse(mapTipoEntrega(data), 200, req, { startMs });
    }

    // POST /excluir — ExcluirTipoEntrega
    if (path === "/excluir") {
      const nCodEntrega = typeof body.nCodEntrega === "number" ? body.nCodEntrega : null;
      const cCodIntEntrega = typeof body.cCodIntEntrega === "string" ? body.cCodIntEntrega.trim() : "";
      if (!nCodEntrega && !cCodIntEntrega) return errorResponse(400, "VALIDATION_ERROR", "nCodEntrega ou cCodIntEntrega obrigatório", req, startMs);

      let query = supabase.from("tipos_entrega").delete();
      if (nCodEntrega) query = query.eq("n_cod_entrega", nCodEntrega);
      else query = query.eq("c_cod_int_entrega", cCodIntEntrega);

      const { data, error } = await query.select("n_cod_entrega, c_cod_int_entrega").single();
      if (error) return errorResponse(error.code === "PGRST116" ? 404 : 500, error.code === "PGRST116" ? "NOT_FOUND" : "DB_ERROR", error.code === "PGRST116" ? "Tipo de entrega não encontrado" : error.message, req, startMs);

      return jsonResponse({
        nCodEntrega: data.n_cod_entrega,
        cCodIntEntrega: data.c_cod_int_entrega || "",
        cCodStatus: "0",
        cDesStatus: "Tipo de entrega excluído com sucesso",
      }, 200, req, { startMs });
    }

    // POST /listar — ListarTipoEntrega
    if (path === "/listar" || path === "/") {
      const nPagina = typeof body.nPagina === "number" && body.nPagina > 0 ? body.nPagina : 1;
      const nRegistrosPorPagina = typeof body.nRegistrosPorPagina === "number" && body.nRegistrosPorPagina > 0 ? Math.min(body.nRegistrosPorPagina, 500) : 50;
      const nCodTransp = typeof body.nCodTransp === "number" ? body.nCodTransp : null;

      let countQuery = supabase.from("tipos_entrega").select("id", { count: "exact", head: true });
      let dataQuery = supabase.from("tipos_entrega").select("*").order("n_cod_entrega", { ascending: true });

      // Filters
      if (nCodTransp) {
        countQuery = countQuery.eq("n_cod_transp", nCodTransp);
        dataQuery = dataQuery.eq("n_cod_transp", nCodTransp);
      }
      if (typeof body.dDtAltDe === "string" && body.dDtAltDe) {
        const parts = (body.dDtAltDe as string).split("/");
        if (parts.length === 3) {
          const iso = `${parts[2]}-${parts[1]}-${parts[0]}`;
          countQuery = countQuery.gte("updated_at", iso);
          dataQuery = dataQuery.gte("updated_at", iso);
        }
      }
      if (typeof body.dDtAltAte === "string" && body.dDtAltAte) {
        const parts = (body.dDtAltAte as string).split("/");
        if (parts.length === 3) {
          const iso = `${parts[2]}-${parts[1]}-${parts[0]}T23:59:59`;
          countQuery = countQuery.lte("updated_at", iso);
          dataQuery = dataQuery.lte("updated_at", iso);
        }
      }

      const { count } = await countQuery;
      const total = count ?? 0;
      const totalPaginas = Math.ceil(total / nRegistrosPorPagina) || 1;
      const from = (nPagina - 1) * nRegistrosPorPagina;
      const to = from + nRegistrosPorPagina - 1;

      const { data, error } = await dataQuery.range(from, to);
      if (error) return errorResponse(500, "DB_ERROR", error.message, req, startMs);

      return jsonResponse({
        nPagina,
        nTotalPaginas: totalPaginas,
        nRegistros: (data || []).length,
        nTotalRegistros: total,
        CadTiposEntrega: (data || []).map(mapTipoEntrega),
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
    console.error("❌ tipos-entrega-api error:", e);
    return errorResponse(500, "INTERNAL_ERROR", e.message || "Erro interno", req, startMs);
  }
});
