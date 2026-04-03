import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { validateErpAuth, AuthError } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";

function json(body: unknown, status: number, req: Request, startMs: number) {
  return jsonResponse(body, status, req, { startMs });
}

function errorResp(status: number, code: string, message: string, req: Request, startMs: number) {
  return errorResponse(status, code, message, req, startMs);
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startMs = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/orcamentos-caixa-api\/?/, "/").replace(/\/+$/, "") || "/";

  // Health check — antes de auth
  if (path === "/status" && req.method === "GET") {
    return json({ status: "ok", service: "orcamentos-caixa-api", version: "1.0.0" }, 200, req, startMs);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // --- Authenticate ---
  let empresaId: string;
  try {
    const auth = await validateErpAuth(req);
    empresaId = auth.empresaId;
  } catch (e) {
    if (e instanceof AuthError) return errorResp(e.status, "UNAUTHORIZED", e.message, req, startMs);
    throw e;
  }

  // --- Rate limit ---
  try {
    await checkRateLimit({ prefix: "orcamentos-caixa", limit: 60, req });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return json({ error: "RATE_LIMIT", message: e.message }, 429, req, startMs);
    }
    throw e;
  }

  try {
    // ==================== GET /status ====================
    if (path === "/status" && req.method === "GET") {
      return json({ status: "ok", service: "orcamentos-caixa-api", version: "1.0.0" }, 200, req, startMs);
    }

    // ==================== GET /listar ====================
    if (path === "/listar" && req.method === "GET") {
      const nAno = parseInt(url.searchParams.get("nAno") || "");
      const nMes = parseInt(url.searchParams.get("nMes") || "");

      if (!nAno || !nMes || nMes < 1 || nMes > 12) {
        return errorResp(400, "PARAMS_REQUIRED", "nAno e nMes (1-12) são obrigatórios", req, startMs);
      }

      // 1. Fetch planned budgets
      const { data: orcamentos, error: orcErr } = await supabase
        .from("orcamentos_caixa")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("ano", nAno)
        .eq("mes", nMes)
        .order("codigo_categoria");

      if (orcErr) throw orcErr;

      // 2. Calculate realized values from lancamentos_conta_corrente
      const startDate = `${nAno}-${String(nMes).padStart(2, "0")}-01`;
      const endDate = nMes === 12
        ? `${nAno + 1}-01-01`
        : `${nAno}-${String(nMes + 1).padStart(2, "0")}-01`;

      const { data: realizados, error: realErr } = await supabase
        .from("lancamentos_conta_corrente")
        .select("codigo_categoria, valor, tipo")
        .eq("empresa_id", empresaId)
        .gte("data_lancamento", startDate)
        .lt("data_lancamento", endDate);

      if (realErr) throw realErr;

      // Aggregate realized by category
      const realizadoMap: Record<string, number> = {};
      for (const r of realizados || []) {
        const cat = r.codigo_categoria || "";
        const valor = Number(r.valor) || 0;
        realizadoMap[cat] = (realizadoMap[cat] || 0) + valor;
      }

      // 3. Build response merging planned + realized
      const categoriasSet = new Set<string>();
      const planMap: Record<string, { descricao: string; previsto: number }> = {};

      for (const o of orcamentos || []) {
        categoriasSet.add(o.codigo_categoria);
        planMap[o.codigo_categoria] = {
          descricao: o.descricao_categoria || "",
          previsto: Number(o.valor_previsto) || 0,
        };
      }

      // Include categories that have realized but no plan
      for (const cat of Object.keys(realizadoMap)) {
        if (cat) categoriasSet.add(cat);
      }

      const sortedCats = Array.from(categoriasSet).sort();

      const ListaOrcamentos = sortedCats.map((cat) => ({
        cCodCateg: cat,
        cDesCateg: planMap[cat]?.descricao || "",
        nValorPrevisto: planMap[cat]?.previsto || 0,
        nValorRealizado: Math.round((realizadoMap[cat] || 0) * 100) / 100,
      }));

      return json({
        nAno: nAno,
        nMes: nMes,
        ListaOrcamentos,
      }, 200, req, startMs);
    }

    // ==================== POST /incluir ====================
    if (path === "/incluir" && req.method === "POST") {
      const body = await req.json();
      const { nAno, nMes, cCodCateg, cDesCateg, nValorPrevisto } = body;

      if (!nAno || !nMes || !cCodCateg) {
        return errorResp(400, "PARAMS_REQUIRED", "nAno, nMes e cCodCateg são obrigatórios", req, startMs);
      }

      const { data, error } = await supabase
        .from("orcamentos_caixa")
        .upsert({
          empresa_id: empresaId,
          ano: nAno,
          mes: nMes,
          codigo_categoria: cCodCateg,
          descricao_categoria: cDesCateg || null,
          valor_previsto: nValorPrevisto || 0,
          importado_api: true,
        }, { onConflict: "empresa_id,ano,mes,codigo_categoria" })
        .select()
        .single();

      if (error) throw error;

      return json({
        cCodStatus: "0",
        cDesStatus: "Orçamento cadastrado/atualizado com sucesso",
        nAno,
        nMes,
        cCodCateg,
        nValorPrevisto: Number(data.valor_previsto),
      }, 200, req, startMs);
    }

    // ==================== POST /incluir-lote ====================
    if (path === "/incluir-lote" && req.method === "POST") {
      const body = await req.json();
      const { nAno, nMes, orcamentos: items } = body;

      if (!nAno || !nMes || !Array.isArray(items) || items.length === 0) {
        return errorResp(400, "PARAMS_REQUIRED", "nAno, nMes e orcamentos[] são obrigatórios", req, startMs);
      }

      if (items.length > 500) {
        return errorResp(400, "BATCH_TOO_LARGE", "Máximo 500 itens por lote", req, startMs);
      }

      const records = items.map((item: { cCodCateg: string; cDesCateg?: string; nValorPrevisto?: number }) => ({
        empresa_id: empresaId,
        ano: nAno,
        mes: nMes,
        codigo_categoria: item.cCodCateg,
        descricao_categoria: item.cDesCateg || null,
        valor_previsto: item.nValorPrevisto || 0,
        importado_api: true,
      }));

      const { error } = await supabase
        .from("orcamentos_caixa")
        .upsert(records, { onConflict: "empresa_id,ano,mes,codigo_categoria" });

      if (error) throw error;

      return json({
        cCodStatus: "0",
        cDesStatus: `${records.length} orçamento(s) cadastrado(s)/atualizado(s)`,
        nAno,
        nMes,
        nTotal: records.length,
      }, 200, req, startMs);
    }

    // ==================== 404 ====================
    return errorResp(404, "NOT_FOUND", `Rota ${req.method} ${path} não encontrada`, req, startMs);

  } catch (err) {
    console.error("orcamentos-caixa-api error:", err);
    const msg = err instanceof Error ? err.message : "Erro interno";
    return errorResp(500, "INTERNAL_ERROR", msg, req, startMs);
  }
});
