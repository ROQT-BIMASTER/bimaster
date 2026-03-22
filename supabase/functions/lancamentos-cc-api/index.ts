import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";
import { validateErpAuth, AuthError } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { enqueueWebhookEvent } from "../_shared/webhook-enqueue.ts";

function json(body: unknown, status: number, req: Request, startMs: number) {
  const cors = getCorsHeaders(req);
  const headers = withSecurityHeaders(
    { ...cors, "Content-Type": "application/json" },
    status === 401 || status === 403
  );
  const meta = { processed_at: new Date().toISOString(), duration_ms: Date.now() - startMs };
  const responseBody = typeof body === "object" && body !== null && !Array.isArray(body)
    ? { ...body as Record<string, unknown>, meta }
    : { data: body, meta };
  return new Response(JSON.stringify(responseBody), { status, headers });
}

function errorResp(status: number, code: string, message: string, req: Request, startMs: number) {
  return json({ error: code, message }, status, req, startMs);
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startMs = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/lancamentos-cc-api\/?/, "/").replace(/\/+$/, "") || "/";

  // Health check — antes de auth
  if (path === "/status" && req.method === "GET") {
    return json({ status: "ok", service: "lancamentos-cc-api", version: "1.0.0" }, 200, req, startMs);
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
    await checkRateLimit({ prefix: "lancamentos-cc", limit: 60, req });
  } catch (e) {
    if (e instanceof RateLimitError) return errorResp(429, "RATE_LIMIT", e.message, req, startMs);
    throw e;
  }

  // --- Sync log helper ---
  async function logSync(endpoint: string, payload: unknown, statusCode: number) {
    try {
      await supabase.from("erp_sync_log").insert({
        entity_type: "lancamento_cc",
        entity_id: crypto.randomUUID(),
        action: endpoint,
        direction: "inbound",
        request_payload: payload as any,
        response_status: statusCode,
        success: statusCode >= 200 && statusCode < 300,
        duration_ms: Date.now() - startMs,
        empresa_id: empresaId,
      });
    } catch (e) {
      console.error("Failed to log sync:", e);
    }
  }

  // --- Field mappings (Huggs → DB) ---
  const API_TO_DB: Record<string, string> = {
    cCodIntLanc: "c_cod_int_lanc",
    nCodLanc: "n_cod_lanc",
    nCodAgrup: "n_cod_agrup",
    // cabecalho
    nCodCC: "conta_bancaria_id_ref",
    dDtLanc: "data_lancamento",
    nValorLanc: "valor",
    // detalhes
    cCodCateg: "categoria",
    cTipo: "c_tipo_documento",
    cNumDoc: "numero_documento",
    nCodCliente: "n_cod_cliente",
    nCodProjeto: "n_cod_projeto",
    cObs: "observacoes",
    // transferencia
    nCodCCDestino: "conta_destino_n_cod_cc",
    // diversos
    cOrigem: "c_origem_lanc",
    dDtConc: "data_conciliacao",
    cHrConc: "hora_conciliacao",
    cUsConc: "usuario_conciliacao",
    nCodVendedor: "n_cod_vendedor",
    nCodComprador: "n_cod_comprador",
    cNatureza: "c_natureza",
    cIdentLanc: "c_ident_lanc",
    nCodLancCP: "n_cod_lanc_cp",
    nCodLancCR: "n_cod_lanc_cr",
    // info
    cImpAPI: "importado_api",
  };

  function flattenHuggsInput(input: Record<string, unknown>): Record<string, unknown> {
    const flat: Record<string, unknown> = { ...input };
    // Flatten nested structures (cabecalho, detalhes, transferencia, diversos)
    for (const section of ["cabecalho", "detalhes", "transferencia", "diversos", "info"]) {
      if (typeof input[section] === "object" && input[section] !== null) {
        Object.assign(flat, input[section] as Record<string, unknown>);
        delete flat[section];
      }
    }
    return flat;
  }

  function mapHuggsToDb(input: Record<string, unknown>): Record<string, unknown> {
    const flat = flattenHuggsInput(input);
    const row: Record<string, unknown> = {};

    for (const [apiKey, dbCol] of Object.entries(API_TO_DB)) {
      if (flat[apiKey] !== undefined) {
        let val = flat[apiKey];
        // Convert Huggs S/N booleans
        if (typeof val === "string" && (val === "S" || val === "N")) {
          val = val === "S";
        }
        // Convert Huggs date format dd/mm/yyyy → yyyy-mm-dd
        if (dbCol === "data_lancamento" && typeof val === "string" && val.includes("/")) {
          const parts = (val as string).split("/");
          if (parts.length === 3) val = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        if (dbCol === "data_conciliacao" && typeof val === "string" && val.includes("/")) {
          const parts = (val as string).split("/");
          if (parts.length === 3) val = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        row[dbCol] = val;
      }
    }

    // Handle conta_bancaria_id resolution: nCodCC needs lookup
    if (flat.nCodCC !== undefined) {
      row["_nCodCC"] = flat.nCodCC; // Will be resolved later
    }

    // Handle rateio arrays
    if (flat.aCodCateg) row.rateio_categorias = flat.aCodCateg;
    if (flat.departamentos) row.rateio_departamentos = flat.departamentos;

    // Set empresa_id
    row.empresa_id = empresaId;

    return row;
  }

  async function resolveContaBancariaId(row: Record<string, unknown>): Promise<Record<string, unknown>> {
    const nCodCC = row["_nCodCC"];
    delete row["_nCodCC"];
    delete row["conta_bancaria_id_ref"];

    if (nCodCC) {
      const { data: cc } = await supabase
        .from("contas_bancarias")
        .select("id")
        .eq("n_cod_cc", nCodCC)
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (cc) {
        row.conta_bancaria_id = cc.id;
      }
    }
    return row;
  }

  function mapDbToHuggs(row: Record<string, unknown>): Record<string, unknown> {
    return {
      nCodLanc: row.n_cod_lanc ?? null,
      cCodIntLanc: row.c_cod_int_lanc ?? row.codigo_integracao ?? null,
      nCodAgrup: row.n_cod_agrup ?? null,
      cabecalho: {
        nCodCC: row.n_cod_cc_ref ?? null,
        dDtLanc: row.data_lancamento ?? null,
        nValorLanc: row.valor ?? 0,
      },
      detalhes: {
        cCodCateg: row.categoria ?? null,
        aCodCateg: row.rateio_categorias ?? [],
        cTipo: row.c_tipo_documento ?? null,
        cNumDoc: row.numero_documento ?? null,
        nCodCliente: row.n_cod_cliente ?? null,
        nCodProjeto: row.n_cod_projeto ?? null,
        cObs: row.observacoes ?? null,
      },
      transferencia: {
        nCodCCDestino: row.conta_destino_n_cod_cc ?? null,
      },
      departamentos: row.rateio_departamentos ?? [],
      diversos: {
        cOrigem: row.c_origem_lanc ?? row.origem ?? null,
        dDtConc: row.data_conciliacao ?? null,
        cHrConc: row.hora_conciliacao ?? null,
        cUsConc: row.usuario_conciliacao ?? null,
        nCodVendedor: row.n_cod_vendedor ?? null,
        nCodComprador: row.n_cod_comprador ?? null,
        cNatureza: row.c_natureza ?? null,
        cIdentLanc: row.c_ident_lanc ?? null,
        nCodLancCP: row.n_cod_lanc_cp ?? null,
        nCodLancCR: row.n_cod_lanc_cr ?? null,
      },
      info: {
        dInc: row.data_inc ?? row.created_at ?? null,
        hInc: row.hora_inc ?? null,
        uInc: row.user_inc ?? null,
        dAlt: row.data_alt ?? row.updated_at ?? null,
        hAlt: row.hora_alt ?? null,
        uAlt: row.user_alt ?? null,
        cImpAPI: (row.importado_api as boolean) ? "S" : "N",
      },
      id: row.id,
    };
  }

  try {
    // ==================== GET /status ====================
    if (req.method === "GET" && path === "/status") {
      await logSync("GET /status", null, 200);
      return json({ status: "online", service: "lancamentos-cc-api", empresa_id: empresaId }, 200, req, startMs);
    }

    // ==================== GET / (ListarLancCC) ====================
    if (req.method === "GET" && path === "/") {
      const pagina = parseInt(url.searchParams.get("nPagina") || url.searchParams.get("pagina") || "1");
      const registros = Math.min(parseInt(url.searchParams.get("nRegPorPagina") || url.searchParams.get("registros_por_pagina") || "20"), 500);
      const ordenarPor = url.searchParams.get("cOrdenarPor") || "created_at";
      const ordemDesc = url.searchParams.get("cOrdemDecrescente") === "S";
      const cOrigem = url.searchParams.get("cOrigem");
      const dDtIncDe = url.searchParams.get("dDtIncDe");
      const dDtIncAte = url.searchParams.get("dDtIncAte");
      const dDtAltDe = url.searchParams.get("dDtAltDe");
      const dDtAltAte = url.searchParams.get("dDtAltAte");
      const dtPagInicial = url.searchParams.get("dtPagInicial");
      const dtPagFinal = url.searchParams.get("dtPagFinal");
      const nCodCC = url.searchParams.get("nCodCC");
      const offset = (pagina - 1) * registros;

      // Count
      let countQ = supabase.from("lancamentos_conta_corrente").select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId).eq("inativo", false);
      if (cOrigem) countQ = countQ.eq("c_origem_lanc", cOrigem);
      if (dDtIncDe) countQ = countQ.gte("created_at", dDtIncDe);
      if (dDtIncAte) countQ = countQ.lte("created_at", dDtIncAte);
      if (dDtAltDe) countQ = countQ.gte("updated_at", dDtAltDe);
      if (dDtAltAte) countQ = countQ.lte("updated_at", dDtAltAte);
      if (dtPagInicial) countQ = countQ.gte("data_lancamento", dtPagInicial);
      if (dtPagFinal) countQ = countQ.lte("data_lancamento", dtPagFinal);

      const { count } = await countQ;
      const total = count || 0;
      const totalPaginas = Math.ceil(total / registros);

      // Data
      const orderCol = ["created_at", "updated_at", "data_lancamento", "valor", "n_cod_lanc"].includes(ordenarPor) ? ordenarPor : "created_at";
      let query = supabase.from("lancamentos_conta_corrente").select("*")
        .eq("empresa_id", empresaId).eq("inativo", false)
        .order(orderCol, { ascending: !ordemDesc })
        .range(offset, offset + registros - 1);

      if (cOrigem) query = query.eq("c_origem_lanc", cOrigem);
      if (dDtIncDe) query = query.gte("created_at", dDtIncDe);
      if (dDtIncAte) query = query.lte("created_at", dDtIncAte);
      if (dDtAltDe) query = query.gte("updated_at", dDtAltDe);
      if (dDtAltAte) query = query.lte("updated_at", dDtAltAte);
      if (dtPagInicial) query = query.gte("data_lancamento", dtPagInicial);
      if (dtPagFinal) query = query.lte("data_lancamento", dtPagFinal);

      // Filter by nCodCC → resolve to conta_bancaria_id
      if (nCodCC) {
        const { data: cc } = await supabase
          .from("contas_bancarias").select("id").eq("n_cod_cc", parseInt(nCodCC)).eq("empresa_id", empresaId).maybeSingle();
        if (cc) query = query.eq("conta_bancaria_id", cc.id);
        else {
          await logSync("GET /", { nCodCC }, 200);
          return json({ nPagina: pagina, nTotPaginas: 0, nRegistros: 0, nTotRegistros: 0, listaLancamentos: [] }, 200, req, startMs);
        }
      }

      const { data, error } = await query;
      if (error) {
        await logSync("GET /", null, 500);
        return errorResp(500, "QUERY_ERROR", error.message, req, startMs);
      }

      const mapped = (data || []).map(mapDbToHuggs);
      await logSync("GET /", { pagina, registros }, 200);
      return json({
        nPagina: pagina,
        nTotPaginas: totalPaginas,
        nRegistros: mapped.length,
        nTotRegistros: total,
        listaLancamentos: mapped,
      }, 200, req, startMs);
    }

    // ==================== GET /consultar ====================
    if (req.method === "GET" && path === "/consultar") {
      const id = url.searchParams.get("id");
      const cCodIntLanc = url.searchParams.get("cCodIntLanc");
      const nCodLanc = url.searchParams.get("nCodLanc");

      if (!id && !cCodIntLanc && !nCodLanc) {
        return errorResp(400, "PARAM_REQUIRED", "Informe id, cCodIntLanc ou nCodLanc", req, startMs);
      }

      let query = supabase.from("lancamentos_conta_corrente").select("*").eq("empresa_id", empresaId);
      if (id) query = query.eq("id", id);
      else if (cCodIntLanc) query = query.eq("c_cod_int_lanc", cCodIntLanc);
      else if (nCodLanc) query = query.eq("n_cod_lanc", parseInt(nCodLanc));

      const { data, error } = await query.maybeSingle();
      if (error) return errorResp(500, "QUERY_ERROR", error.message, req, startMs);
      if (!data) return errorResp(404, "NOT_FOUND", "Lançamento não encontrado", req, startMs);

      await logSync("GET /consultar", { id, cCodIntLanc, nCodLanc }, 200);
      return json({ lancamento: mapDbToHuggs(data) }, 200, req, startMs);
    }

    // ==================== POST /incluir ====================
    if (req.method === "POST" && path === "/incluir") {
      const body = await req.json();
      const dbRow = mapHuggsToDb(body);
      const resolved = await resolveContaBancariaId(dbRow);

      if (!resolved.conta_bancaria_id) {
        return errorResp(400, "CONTA_CORRENTE_REQUIRED", "nCodCC (conta corrente) é obrigatório e deve existir", req, startMs);
      }
      if (!resolved.valor) {
        return errorResp(400, "VALOR_REQUIRED", "Valor do lançamento é obrigatório (nValorLanc)", req, startMs);
      }

      resolved.importado_api = true;
      resolved.origem = resolved.c_origem_lanc || "MANU";
      resolved.tipo = resolved.c_natureza === "C" ? "credito" : "debito";
      resolved.descricao = resolved.observacoes || body.cCodIntLanc || "Lançamento via API";

      const { data, error } = await supabase.from("lancamentos_conta_corrente").insert(resolved).select().single();
      if (error) {
        await logSync("POST /incluir", body, 500);
        return errorResp(500, "INSERT_ERROR", error.message, req, startMs);
      }

      await logSync("POST /incluir", body, 201);
      enqueueWebhookEvent("lancamento_cc.criado", { id: data.id, nCodLanc: data.n_cod_lanc, valor: data.valor }, empresaId);
      return json({
        nCodLanc: data.n_cod_lanc,
        cCodIntLanc: data.c_cod_int_lanc || data.codigo_integracao,
        cCodStatus: "0",
        cDesStatus: "Lançamento incluído com sucesso",
      }, 201, req, startMs);
    }

    // ==================== PUT /alterar ====================
    if (req.method === "PUT" && path === "/alterar") {
      const body = await req.json();
      const cCodIntLanc = body.cCodIntLanc;
      const nCodLanc = body.nCodLanc;
      const id = body.id;

      if (!cCodIntLanc && !nCodLanc && !id) {
        return errorResp(400, "KEY_REQUIRED", "Informe cCodIntLanc, nCodLanc ou id", req, startMs);
      }

      const dbRow = mapHuggsToDb(body);
      const resolved = await resolveContaBancariaId(dbRow);
      delete resolved.empresa_id;
      delete resolved.c_cod_int_lanc;
      delete resolved.n_cod_lanc;
      resolved.updated_at = new Date().toISOString();

      let query = supabase.from("lancamentos_conta_corrente").update(resolved).eq("empresa_id", empresaId);
      if (id) query = query.eq("id", id);
      else if (cCodIntLanc) query = query.eq("c_cod_int_lanc", cCodIntLanc);
      else query = query.eq("n_cod_lanc", nCodLanc);

      const { data, error } = await query.select().maybeSingle();
      if (error) {
        await logSync("PUT /alterar", body, 500);
        return errorResp(500, "UPDATE_ERROR", error.message, req, startMs);
      }
      if (!data) return errorResp(404, "NOT_FOUND", "Lançamento não encontrado", req, startMs);

      await logSync("PUT /alterar", body, 200);
      return json({
        nCodLanc: data.n_cod_lanc,
        cCodIntLanc: data.c_cod_int_lanc,
        cCodStatus: "0",
        cDesStatus: "Lançamento alterado com sucesso",
      }, 200, req, startMs);
    }

    // ==================== DELETE /excluir ====================
    if (req.method === "DELETE" && path === "/excluir") {
      const id = url.searchParams.get("id");
      const cCodIntLanc = url.searchParams.get("cCodIntLanc");
      const nCodLanc = url.searchParams.get("nCodLanc");

      if (!id && !cCodIntLanc && !nCodLanc) {
        return errorResp(400, "KEY_REQUIRED", "Informe id, cCodIntLanc ou nCodLanc", req, startMs);
      }

      let query = supabase.from("lancamentos_conta_corrente")
        .update({ inativo: true, updated_at: new Date().toISOString() })
        .eq("empresa_id", empresaId);
      if (id) query = query.eq("id", id);
      else if (cCodIntLanc) query = query.eq("c_cod_int_lanc", cCodIntLanc);
      else query = query.eq("n_cod_lanc", parseInt(nCodLanc!));

      const { data, error } = await query.select().maybeSingle();
      if (error) return errorResp(500, "DELETE_ERROR", error.message, req, startMs);
      if (!data) return errorResp(404, "NOT_FOUND", "Lançamento não encontrado", req, startMs);

      await logSync("DELETE /excluir", { id, cCodIntLanc, nCodLanc }, 200);
      return json({
        nCodLanc: data.n_cod_lanc,
        cCodIntLanc: data.c_cod_int_lanc,
        cCodStatus: "0",
        cDesStatus: "Lançamento excluído com sucesso",
      }, 200, req, startMs);
    }

    // ==================== POST /upsert ====================
    if (req.method === "POST" && path === "/upsert") {
      const body = await req.json();
      const cCodIntLanc = body.cCodIntLanc;
      if (!cCodIntLanc) {
        return errorResp(400, "COD_INT_REQUIRED", "cCodIntLanc é obrigatório para upsert", req, startMs);
      }

      const dbRow = mapHuggsToDb(body);
      const resolved = await resolveContaBancariaId(dbRow);
      resolved.importado_api = true;
      resolved.origem = resolved.c_origem_lanc || "MANU";
      if (!resolved.tipo) resolved.tipo = resolved.c_natureza === "C" ? "credito" : "debito";
      if (!resolved.descricao) resolved.descricao = body.cObs || body.cCodIntLanc || "Lançamento via API";

      const { data: existing } = await supabase.from("lancamentos_conta_corrente").select("id")
        .eq("empresa_id", empresaId).eq("c_cod_int_lanc", cCodIntLanc).maybeSingle();

      let data, error;
      if (existing) {
        delete resolved.empresa_id;
        resolved.updated_at = new Date().toISOString();
        ({ data, error } = await supabase.from("lancamentos_conta_corrente").update(resolved).eq("id", existing.id).select().single());
      } else {
        if (!resolved.conta_bancaria_id) {
          return errorResp(400, "CONTA_CORRENTE_REQUIRED", "nCodCC (conta corrente) é obrigatório", req, startMs);
        }
        if (!resolved.valor) {
          return errorResp(400, "VALOR_REQUIRED", "nValorLanc é obrigatório", req, startMs);
        }
        ({ data, error } = await supabase.from("lancamentos_conta_corrente").insert(resolved).select().single());
      }

      if (error) {
        await logSync("POST /upsert", body, 500);
        return errorResp(500, "UPSERT_ERROR", error.message, req, startMs);
      }

      const status = existing ? 200 : 201;
      await logSync("POST /upsert", body, status);
      return json({
        nCodLanc: data.n_cod_lanc,
        cCodIntLanc: data.c_cod_int_lanc,
        cCodStatus: "0",
        cDesStatus: existing ? "Lançamento atualizado com sucesso" : "Lançamento incluído com sucesso",
      }, status, req, startMs);
    }

    // ==================== POST /upsert-lote ====================
    if (req.method === "POST" && path === "/upsert-lote") {
      const body = await req.json();
      const lote = body.lote || 1;
      const items: Record<string, unknown>[] = body.lancamentos || body.listaLancamentos || [];

      if (!Array.isArray(items) || items.length === 0) {
        return errorResp(400, "EMPTY_BATCH", "Array de lançamentos vazio", req, startMs);
      }
      if (items.length > 500) {
        return errorResp(400, "BATCH_TOO_LARGE", "Máximo 500 lançamentos por lote", req, startMs);
      }

      let processed = 0, errors = 0;
      const errorDetails: unknown[] = [];

      for (const item of items) {
        try {
          const cCodIntLanc = item.cCodIntLanc as string;
          if (!cCodIntLanc) { errors++; errorDetails.push({ error: "cCodIntLanc ausente" }); continue; }

          const dbRow = mapHuggsToDb(item);
          const resolved = await resolveContaBancariaId(dbRow);
          resolved.importado_api = true;
          resolved.origem = resolved.c_origem_lanc || "MANU";
          if (!resolved.tipo) resolved.tipo = (resolved.c_natureza === "C") ? "credito" : "debito";
          if (!resolved.descricao) resolved.descricao = (item as any).cObs || cCodIntLanc || "Lançamento via API";

          const { data: existing } = await supabase.from("lancamentos_conta_corrente").select("id")
            .eq("empresa_id", empresaId).eq("c_cod_int_lanc", cCodIntLanc).maybeSingle();

          if (existing) {
            delete resolved.empresa_id;
            resolved.updated_at = new Date().toISOString();
            const { error } = await supabase.from("lancamentos_conta_corrente").update(resolved).eq("id", existing.id);
            if (error) { errors++; errorDetails.push({ cCodIntLanc, error: error.message }); }
            else processed++;
          } else {
            if (!resolved.conta_bancaria_id || !resolved.valor) {
              errors++;
              errorDetails.push({ cCodIntLanc, error: "conta_bancaria_id ou valor ausente" });
              continue;
            }
            const { error } = await supabase.from("lancamentos_conta_corrente").insert(resolved);
            if (error) { errors++; errorDetails.push({ cCodIntLanc, error: error.message }); }
            else processed++;
          }
        } catch (e) {
          errors++;
          errorDetails.push({ error: e instanceof Error ? e.message : "Erro desconhecido" });
        }
      }

      await logSync("POST /upsert-lote", { lote, total: items.length }, 200);
      return json({
        lote,
        cCodStatus: errors === items.length ? "1" : "0",
        cDesStatus: `${processed} processado(s), ${errors} erro(s)`,
        total_processados: processed,
        total_erros: errors,
        ...(errorDetails.length > 0 ? { erros: errorDetails } : {}),
      }, 200, req, startMs);
    }

    // ==================== POST /sync (legado N8N) ====================
    if (req.method === "POST" && path === "/sync") {
      const body = await req.json();
      const lancamentos: Record<string, unknown>[] = body.lancamentos || [];

      if (!Array.isArray(lancamentos) || lancamentos.length === 0) {
        return errorResp(400, "EMPTY_PAYLOAD", "Array de lançamentos vazio", req, startMs);
      }

      let synced = 0, errors = 0;
      for (const item of lancamentos) {
        try {
          const dbRow = mapHuggsToDb(item);
          const resolved = await resolveContaBancariaId(dbRow);
          resolved.importado_api = true;
          resolved.enviado_erp = true;
          resolved.origem = resolved.c_origem_lanc || "MANU";
          if (!resolved.tipo) resolved.tipo = (resolved.c_natureza === "C") ? "credito" : "debito";
          if (!resolved.descricao) resolved.descricao = (item as any).cObs || "Lançamento sync";

          const codInt = item.cCodIntLanc || item.codigo_integracao;
          if (codInt) {
            const { data: existing } = await supabase.from("lancamentos_conta_corrente").select("id")
              .eq("empresa_id", empresaId).eq("c_cod_int_lanc", codInt as string).maybeSingle();
            if (existing) {
              delete resolved.empresa_id;
              resolved.updated_at = new Date().toISOString();
              await supabase.from("lancamentos_conta_corrente").update(resolved).eq("id", existing.id);
              synced++;
              continue;
            }
          }

          if (resolved.conta_bancaria_id && resolved.valor) {
            await supabase.from("lancamentos_conta_corrente").insert(resolved);
            synced++;
          } else {
            errors++;
          }
        } catch {
          errors++;
        }
      }

      await logSync("POST /sync", { total: lancamentos.length }, 200);
      return json({
        synced,
        errors,
        total: lancamentos.length,
        message: `${synced} sincronizado(s), ${errors} erro(s)`,
      }, 200, req, startMs);
    }

    // ==================== GET /extrato (ListarExtrato) ====================
    if (req.method === "GET" && path === "/extrato") {
      const nCodCC = url.searchParams.get("nCodCC");
      const cCodIntCC = url.searchParams.get("cCodIntCC");
      const dPeriodoInicial = url.searchParams.get("dPeriodoInicial");
      const dPeriodoFinal = url.searchParams.get("dPeriodoFinal");
      const cExibirApenasSaldo = url.searchParams.get("cExibirApenasSaldo");

      if (!nCodCC && !cCodIntCC) {
        return errorResp(400, "PARAM_REQUIRED", "Informe nCodCC ou cCodIntCC", req, startMs);
      }

      // Resolve conta corrente
      let ccQuery = supabase.from("contas_bancarias").select("*").eq("empresa_id", empresaId);
      if (nCodCC) ccQuery = ccQuery.eq("n_cod_cc", parseInt(nCodCC));
      else if (cCodIntCC) ccQuery = ccQuery.eq("codigo_integracao", cCodIntCC);

      const { data: cc, error: ccErr } = await ccQuery.maybeSingle();
      if (ccErr || !cc) {
        return errorResp(404, "CC_NOT_FOUND", "Conta corrente não encontrada", req, startMs);
      }

      // Parse dates (dd/mm/yyyy or yyyy-mm-dd)
      function parseDate(d: string | null): string | null {
        if (!d) return null;
        if (d.includes("/")) {
          const p = d.split("/");
          if (p.length === 3) return `${p[2]}-${p[1]}-${p[0]}`;
        }
        return d;
      }
      function formatDateHuggs(d: string | null): string {
        if (!d) return "";
        if (d.includes("-")) {
          const p = d.split("T")[0].split("-");
          return `${p[2]}/${p[1]}/${p[0]}`;
        }
        return d;
      }

      const periodoIni = parseDate(dPeriodoInicial);
      const periodoFin = parseDate(dPeriodoFinal);

      // Calculate saldo anterior (movements before period)
      let saldoAnterior = cc.saldo_inicial || 0;
      if (periodoIni) {
        const { data: prevMovs } = await supabase
          .from("vw_extrato_conta_corrente")
          .select("valor, tipo")
          .eq("conta_bancaria_id", cc.id)
          .lt("data", periodoIni);
        if (prevMovs) {
          for (const m of prevMovs) {
            const v = Number(m.valor) || 0;
            saldoAnterior += m.tipo === "credito" ? v : -v;
          }
        }
      }

      // Get movements in period
      let movQuery = supabase
        .from("vw_extrato_conta_corrente")
        .select("*")
        .eq("conta_bancaria_id", cc.id)
        .order("data", { ascending: true });
      if (periodoIni) movQuery = movQuery.gte("data", periodoIni);
      if (periodoFin) movQuery = movQuery.lte("data", periodoFin);

      const { data: movimentos, error: movErr } = await movQuery;
      if (movErr) {
        return errorResp(500, "QUERY_ERROR", movErr.message, req, startMs);
      }

      // Calculate running balance and map movements
      let saldoCorrente = saldoAnterior;
      const listaMovimentos = (movimentos || []).map((m: Record<string, unknown>) => {
        const valor = Number(m.valor) || 0;
        const natureza = m.tipo === "credito" ? "C" : "D";
        saldoCorrente += natureza === "C" ? valor : -valor;

        return {
          nCodLancamento: m.n_cod_lanc ?? m.id ?? null,
          nCodLancRelac: null,
          cSituacao: m.status ?? null,
          dDataLancamento: formatDateHuggs(m.data as string),
          cDesCliente: m.fornecedor_nome ?? m.cliente_nome ?? m.descricao ?? null,
          cTipoDocumento: m.tipo_documento ?? null,
          cNumero: m.numero_documento ?? null,
          nValorDocumento: valor,
          nSaldo: Math.round(saldoCorrente * 100) / 100,
          cCodCategoria: m.categoria ?? null,
          cDesCategoria: m.categoria_nome ?? null,
          cDocumentoFiscal: m.documento_fiscal ?? null,
          cParcela: m.parcela ?? null,
          cNossoNumero: m.nosso_numero ?? null,
          cOrigem: m.origem ?? null,
          cVendedor: null,
          cProjeto: m.projeto ?? null,
          nCodCliente: m.n_cod_cliente ?? null,
          cRazCliente: m.fornecedor_razao ?? m.cliente_razao ?? null,
          cDocCliente: m.fornecedor_documento ?? m.cliente_documento ?? null,
          cObservacoes: m.observacoes ?? null,
          cDataInclusao: formatDateHuggs(m.created_at as string),
          cHoraInclusao: null,
          cNatureza: natureza,
          cBloqueado: "N",
          dDataConciliacao: formatDateHuggs(m.data_conciliacao as string),
        };
      });

      const nSaldoAtual = Math.round(saldoCorrente * 100) / 100;

      const resp: Record<string, unknown> = {
        nCodCC: cc.n_cod_cc ?? null,
        cCodIntCC: cc.codigo_integracao ?? null,
        nCodAgencia: cc.agencia ?? null,
        nCodBanco: cc.codigo_banco ?? null,
        nNumConta: cc.numero_conta ?? null,
        cDescricao: cc.nome ?? cc.descricao ?? null,
        cCodTipo: cc.tipo ?? null,
        cDesTipo: null,
        cFluxoCaixa: "S",
        cResumoExecutivo: "S",
        dPeriodoInicial: dPeriodoInicial || "",
        dPeriodoFinal: dPeriodoFinal || "",
        nSaldoAnterior: Math.round(saldoAnterior * 100) / 100,
        nSaldoAtual,
        nSaldoConciliado: nSaldoAtual,
        nSaldoProvisorio: nSaldoAtual,
        nLimiteCreditoTotal: cc.valor_limite ?? 0,
        nSaldoDisponivel: nSaldoAtual + (cc.valor_limite ?? 0),
      };

      if (cExibirApenasSaldo !== "S") {
        resp.listaMovimentos = listaMovimentos;
      }

      await logSync("GET /extrato", { nCodCC, cCodIntCC, dPeriodoInicial, dPeriodoFinal }, 200);
      return json(resp, 200, req, startMs);
    }

    // --- 404 ---
    return errorResp(404, "NOT_FOUND", `Rota não encontrada: ${req.method} ${path}`, req, startMs);

  } catch (e) {
    console.error("lancamentos-cc-api error:", e);
    await logSync("ERROR", { error: e instanceof Error ? e.message : "unknown" }, 500);
    return errorResp(500, "INTERNAL_ERROR", e instanceof Error ? e.message : "Erro interno", req, startMs);
  }
});
