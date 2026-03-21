// supabase/functions/paises-api/index.ts — ListarPaises (Omie)
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { validateApiKey } from "../_shared/auth.ts";

function mapPais(row: Record<string, unknown>): Record<string, unknown> {
  return {
    cCodigo: row.codigo || "",
    cDescricao: row.descricao || "",
    cCodigoISO: row.codigo_iso || "",
  };
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startMs = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/paises-api\/?/, "/").replace(/\/+$/, "") || "/";

  try {
    // Health check
    if (req.method === "GET" && path === "/status") {
      return jsonResponse(
        { status: "ok", function: "paises-api", routes: ["/listar", "/status"] },
        200, req, { startMs }
      );
    }

    // Auth
    await validateApiKey(req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // POST /listar — ListarPaises
    if (req.method === "POST" && (path === "/listar" || path === "/")) {
      let body: Record<string, unknown> = {};
      try {
        body = await req.json();
      } catch {
        // empty body is valid
      }

      const filtrarPorCodigo = typeof body.filtrar_por_codigo === "string" ? body.filtrar_por_codigo.trim() : "";
      const filtrarPorDescricao = typeof body.filtrar_por_descricao === "string" ? body.filtrar_por_descricao.trim() : "";
      const filtrarPorCodigoIso = typeof body.filtrar_por_codigo_iso === "string" ? body.filtrar_por_codigo_iso.trim().toUpperCase() : "";

      let query = supabase
        .from("paises")
        .select("*")
        .eq("ativo", true)
        .order("codigo", { ascending: true });

      if (filtrarPorCodigo) {
        query = query.ilike("codigo", `%${filtrarPorCodigo}%`);
      }
      if (filtrarPorDescricao) {
        query = query.ilike("descricao", `%${filtrarPorDescricao}%`);
      }
      if (filtrarPorCodigoIso) {
        query = query.ilike("codigo_iso", `%${filtrarPorCodigoIso}%`);
      }

      const { data, error } = await query;

      if (error) {
        return errorResponse(500, "DB_ERROR", error.message, req, startMs);
      }

      return jsonResponse({
        lista_paises: (data || []).map(mapPais),
      }, 200, req, { startMs });
    }

    return errorResponse(404, "NOT_FOUND", `Rota não encontrada: ${req.method} ${path}`, req, startMs);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e.status === 401 || e.status === 403) {
      return errorResponse(e.status, "AUTH_ERROR", e.message || "Não autorizado", req, startMs);
    }
    console.error("❌ paises-api error:", e);
    return errorResponse(500, "INTERNAL_ERROR", e.message || "Erro interno", req, startMs);
  }
});
