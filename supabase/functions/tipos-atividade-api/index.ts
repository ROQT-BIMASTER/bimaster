// tipos-atividade-api
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { validateApiKey } from "../_shared/auth.ts";

function mapTipoAtividade(row: Record<string, unknown>): Record<string, unknown> {
  return {
    cCodigo: row.codigo || "",
    cDescricao: row.descricao || "",
  };
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startMs = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/tipos-atividade-api\/?/, "/").replace(/\/+$/, "") || "/";

  try {
    // Health check
    if (req.method === "GET" && path === "/status") {
      return jsonResponse(
        { status: "ok", function: "tipos-atividade-api", routes: ["/listar", "/status"] },
        200, req, { startMs }
      );
    }

    // Auth
    await validateApiKey(req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // POST /listar — ListarTipoAtiv
    if (req.method === "POST" && (path === "/listar" || path === "/")) {
      let body: Record<string, unknown> = {};
      try {
        body = await req.json();
      } catch {
        // empty body is valid
      }

      const filtrarCodigo = typeof body.filtrar_por_codigo === "string" ? body.filtrar_por_codigo.trim() : "";
      const filtrarDescricao = typeof body.filtrar_por_descricao === "string" ? body.filtrar_por_descricao.trim() : "";

      let query = supabase
        .from("tipos_atividade_empresa")
        .select("*")
        .eq("ativo", true)
        .order("codigo", { ascending: true });

      if (filtrarCodigo) {
        query = query.ilike("codigo", `%${filtrarCodigo}%`);
      }
      if (filtrarDescricao) {
        query = query.ilike("descricao", `%${filtrarDescricao}%`);
      }

      const { data, error } = await query;

      if (error) {
        return errorResponse(500, "DB_ERROR", error.message, req, startMs);
      }

      return jsonResponse({
        lista_tipos_atividade: (data || []).map(mapTipoAtividade),
      }, 200, req, { startMs });
    }

    return errorResponse(404, "NOT_FOUND", `Rota não encontrada: ${req.method} ${path}`, req, startMs);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e.status === 401 || e.status === 403) {
      return errorResponse(e.status, "AUTH_ERROR", e.message || "Não autorizado", req, startMs);
    }
    console.error("❌ tipos-atividade-api error:", e);
    return errorResponse(500, "INTERNAL_ERROR", e.message || "Erro interno", req, startMs);
  }
});
