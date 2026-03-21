// bancos-api
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { validateApiKey } from "../_shared/auth.ts";

function mapBancoToHuggs(banco: Record<string, unknown>): Record<string, unknown> {
  return {
    codigo: banco.codigo_compe || "",
    nome: banco.nome || "",
    tipo: "CB",
    cod_compen: banco.codigo_compe || "",
    cod_ispb: banco.ispb || "",
    cnab_cob: "N",
    cnab_pag: "N",
    cnab_altve: "N",
    cnab_altvl: "N",
    crawler_sn: "N",
    cwr_cobrem: "N",
    cwr_cobret: "N",
    cwr_pagrem: "N",
    cwr_pagret: "N",
    cwr_extr: "N",
    obank_sn: "N",
    obank_cobr: "N",
    obank_extr: "N",
    obank_pagt: "N",
    obank_pix: "N",
    descond_sn: "N",
    descond_qt: 0,
    entf_cnpj: "",
  };
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startMs = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/bancos-api\/?/, "/").replace(/\/+$/, "") || "/";

  try {
    // Health check
    if (req.method === "GET" && path === "/status") {
      return jsonResponse({ status: "ok", function: "bancos-api", routes: ["/consultar", "/listar", "/status"] }, 200, req, { startMs });
    }

    // Auth
    await validateApiKey(req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // GET /consultar?codigo=001
    if (req.method === "GET" && path === "/consultar") {
      const codigo = url.searchParams.get("codigo");
      if (!codigo) {
        return errorResponse(400, "MISSING_PARAM", "Query param 'codigo' é obrigatório", req, startMs);
      }

      const { data, error } = await supabase
        .from("bancos")
        .select("*")
        .eq("codigo_compe", codigo)
        .maybeSingle();

      if (error) {
        return errorResponse(500, "DB_ERROR", error.message, req, startMs);
      }
      if (!data) {
        return errorResponse(404, "NOT_FOUND", `Banco com código '${codigo}' não encontrado`, req, startMs);
      }

      return jsonResponse(mapBancoToHuggs(data), 200, req, { startMs });
    }

    // GET /listar?pagina=1&registros_por_pagina=100&tipo=CB
    if (req.method === "GET" && path === "/listar") {
      const pagina = Math.max(1, parseInt(url.searchParams.get("pagina") || "1"));
      const regPorPagina = Math.min(500, Math.max(1, parseInt(url.searchParams.get("registros_por_pagina") || "100")));
      const tipo = url.searchParams.get("tipo"); // CB, CX, CV, AC — we only have CB-type data

      let query = supabase
        .from("bancos")
        .select("*", { count: "exact" })
        .eq("ativo", true)
        .order("codigo_compe", { ascending: true });

      // tipo filter is informational — our bancos table is all CB
      const from = (pagina - 1) * regPorPagina;
      const to = from + regPorPagina - 1;
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
        fin_banco_cadastro: (data || []).map(mapBancoToHuggs),
      }, 200, req, { startMs });
    }

    return errorResponse(404, "NOT_FOUND", `Rota não encontrada: ${req.method} ${path}`, req, startMs);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e.status === 401 || e.status === 403) {
      return errorResponse(e.status, "AUTH_ERROR", e.message || "Não autorizado", req, startMs);
    }
    console.error("❌ bancos-api error:", e);
    return errorResponse(500, "INTERNAL_ERROR", e.message || "Erro interno", req, startMs);
  }
});
