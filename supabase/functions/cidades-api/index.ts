// cidades-api
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { validateApiKey } from "../_shared/auth.ts";

function mapCidade(row: Record<string, unknown>): Record<string, unknown> {
  const nome = (row.nome as string) || "";
  const uf = (row.uf_sigla as string) || "";
  return {
    cCod: `${nome.toUpperCase()} (${uf})`,
    cNome: nome,
    cUF: uf,
    nCodIBGE: String(row.id || ""),
    nCodSIAFI: row.codigo_siafi ?? 0,
  };
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startMs = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/cidades-api\/?/, "/").replace(/\/+$/, "") || "/";

  try {
    // Health check
    if (req.method === "GET" && path === "/status") {
      return jsonResponse(
        { status: "ok", function: "cidades-api", routes: ["/listar", "/status"] },
        200, req, { startMs }
      );
    }

    // Auth
    await validateApiKey(req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // POST /listar — PesquisarCidades
    if (req.method === "POST" && (path === "/listar" || path === "/")) {
      let body: Record<string, unknown> = {};
      try {
        body = await req.json();
      } catch {
        // empty body is valid
      }

      const pagina = Math.max(1, Number(body.pagina) || 1);
      const registrosPorPagina = Math.min(500, Math.max(1, Number(body.registros_por_pagina) || 50));
      const ordenarPor = typeof body.ordenar_por === "string" && ["nome"].includes(body.ordenar_por) ? body.ordenar_por : "nome";
      const ordemDecrescente = body.ordem_descrescente === "S" || body.ordem_decrescente === "S";

      const filtrarCidadeContendo = typeof body.filtrar_cidade_contendo === "string" ? body.filtrar_cidade_contendo.trim() : "";
      const filtrarPorUf = typeof body.filtrar_por_uf === "string" ? body.filtrar_por_uf.trim().toUpperCase() : "";
      const filtrarPorCidade = typeof body.filtrar_por_cidade === "string" ? body.filtrar_por_cidade.trim() : "";

      let query = supabase
        .from("ibge_municipios")
        .select("id, nome, uf_sigla, codigo_siafi", { count: "exact" });

      if (filtrarCidadeContendo) {
        query = query.ilike("nome", `%${filtrarCidadeContendo}%`);
      }
      if (filtrarPorUf) {
        query = query.eq("uf_sigla", filtrarPorUf);
      }

      const from = (pagina - 1) * registrosPorPagina;
      const to = from + registrosPorPagina - 1;

      const { data, error, count } = await query
        .order(ordenarPor, { ascending: !ordemDecrescente })
        .range(from, to);

      if (error) {
        return errorResponse(500, "DB_ERROR", error.message, req, startMs);
      }

      // Client-side filter for cCod (constructed field)
      let filtered = (data || []) as Record<string, unknown>[];
      if (filtrarPorCidade) {
        const upper = filtrarPorCidade.toUpperCase();
        filtered = filtered.filter((r) => {
          const cCod = `${(r.nome as string || "").toUpperCase()} (${r.uf_sigla || ""})`;
          return cCod === upper;
        });
      }

      const totalRegistros = count || 0;
      const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina);

      return jsonResponse({
        pagina,
        total_de_paginas: totalPaginas,
        registros: filtered.length,
        total_de_registros: totalRegistros,
        lista_cidades: filtered.map(mapCidade),
      }, 200, req, { startMs });
    }

    return errorResponse(404, "NOT_FOUND", `Rota não encontrada: ${req.method} ${path}`, req, startMs);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e.status === 401 || e.status === 403) {
      return errorResponse(e.status, "AUTH_ERROR", e.message || "Não autorizado", req, startMs);
    }
    console.error("❌ cidades-api error:", e);
    return errorResponse(500, "INTERNAL_ERROR", e.message || "Erro interno", req, startMs);
  }
});
