import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";
import { validateErpAuth, AuthError } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";

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
  const path = url.pathname.replace(/^\/contas-correntes-api\/?/, "/").replace(/\/+$/, "") || "/";

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
    await checkRateLimit({ prefix: "contas-correntes", limit: 60, req });
  } catch (e) {
    if (e instanceof RateLimitError) return errorResp(429, "RATE_LIMIT", e.message, req, startMs);
    throw e;
  }

  // --- Sync log helper ---
  async function logSync(endpoint: string, payload: unknown, statusCode: number) {
    try {
      await supabase.from("erp_sync_log").insert({
        entity_type: "conta_corrente",
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
    cCodCCInt: "codigo_integracao",
    nCodCC: "n_cod_cc",
    tipo_conta_corrente: "tipo_conta_corrente",
    codigo_banco: "codigo_banco",
    descricao: "descricao",
    codigo_agencia: "agencia",
    numero_conta_corrente: "conta",
    saldo_inicial: "saldo_inicial",
    valor_limite: "valor_limite",
    nao_fluxo: "nao_fluxo",
    nao_resumo: "nao_resumo",
    observacao: "observacao",
    cobr_sn: "cobr_sn",
    per_juros: "per_juros",
    per_multa: "per_multa",
    bol_instr1: "bol_instr1",
    bol_instr2: "bol_instr2",
    bol_instr3: "bol_instr3",
    bol_instr4: "bol_instr4",
    bol_sn: "bol_sn",
    pix_sn: "pix_sn",
    cnab_esp: "cnab_esp",
    cobr_esp: "cobr_esp",
    dias_rcomp: "dias_rcomp",
    modalidade: "modalidade",
    cancinstr: "cancinstr",
    cCnpjInstFinanc: "cnpj_inst_financ",
    nome_gerente: "nome_gerente",
    ddd: "ddd",
    telefone: "telefone_gerente",
    email: "email_gerente",
    endereco: "endereco_agencia",
    numero: "numero_endereco",
    bairro: "bairro",
    complemento: "complemento",
    estado: "estado_agencia",
    cidade: "cidade_agencia",
    cep: "cep_agencia",
    codigo_pais: "codigo_pais",
  };

  function mapHuggsToDb(input: Record<string, unknown>): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    for (const [apiKey, dbCol] of Object.entries(API_TO_DB)) {
      if (input[apiKey] !== undefined) {
        const val = input[apiKey];
        // Convert Huggs S/N booleans
        if (typeof val === "string" && (val === "S" || val === "N")) {
          row[dbCol] = val === "S";
        } else {
          row[dbCol] = val;
        }
      }
    }
    // Map bank name from codigo_banco if descricao is also the bank name
    if (input.descricao && !row["nome"]) {
      row["nome"] = input.descricao;
    }
    return row;
  }

  function mapDbToHuggs(row: Record<string, unknown>): Record<string, unknown> {
    return {
      nCodCC: row.n_cod_cc ?? null,
      cCodCCInt: row.codigo_integracao ?? null,
      tipo_conta_corrente: row.tipo_conta_corrente ?? null,
      codigo_banco: row.codigo_banco ?? null,
      descricao: row.descricao ?? row.nome ?? null,
      codigo_agencia: row.agencia ?? null,
      numero_conta_corrente: row.conta ?? null,
      saldo_inicial: row.saldo_inicial ?? 0,
      valor_limite: row.valor_limite ?? 0,
      nao_fluxo: (row.nao_fluxo as boolean) ? "S" : "N",
      nao_resumo: (row.nao_resumo as boolean) ? "S" : "N",
      observacao: row.observacao ?? null,
      cobr_sn: (row.cobr_sn as boolean) ? "S" : "N",
      per_juros: row.per_juros ?? 0,
      per_multa: row.per_multa ?? 0,
      bol_instr1: row.bol_instr1 ?? null,
      bol_instr2: row.bol_instr2 ?? null,
      bol_instr3: row.bol_instr3 ?? null,
      bol_instr4: row.bol_instr4 ?? null,
      bol_sn: (row.bol_sn as boolean) ? "S" : "N",
      pix_sn: (row.pix_sn as boolean) ? "S" : "N",
      cnab_esp: row.cnab_esp ?? null,
      cobr_esp: row.cobr_esp ?? null,
      dias_rcomp: row.dias_rcomp ?? 0,
      modalidade: row.modalidade ?? null,
      cancinstr: row.cancinstr ?? null,
      cCnpjInstFinanc: row.cnpj_inst_financ ?? null,
      nome_gerente: row.nome_gerente ?? null,
      ddd: row.ddd ?? null,
      telefone: row.telefone_gerente ?? null,
      email: row.email_gerente ?? null,
      endereco: row.endereco_agencia ?? null,
      numero: row.numero_endereco ?? null,
      bairro: row.bairro ?? null,
      complemento: row.complemento ?? null,
      estado: row.estado_agencia ?? null,
      cidade: row.cidade_agencia ?? null,
      cep: row.cep_agencia ?? null,
      codigo_pais: row.codigo_pais ?? null,
      importado_api: (row.importado_api as boolean) ? "S" : "N",
      bloqueado: (row.bloqueado as boolean) ? "S" : "N",
      inativo: (row.ativo === false) ? "S" : "N",
      id: row.id,
    };
  }

  try {
    // ==================== GET /status ====================
    if (req.method === "GET" && path === "/status") {
      await logSync("GET /status", null, 200);
      return json({ status: "online", service: "contas-correntes-api", empresa_id: empresaId }, 200, req, startMs);
    }

    // ==================== GET / (ListarContasCorrentes) ====================
    if (req.method === "GET" && path === "/") {
      const pagina = parseInt(url.searchParams.get("pagina") || "1");
      const registros = Math.min(parseInt(url.searchParams.get("registros_por_pagina") || "100"), 500);
      const apenasImportado = url.searchParams.get("apenas_importado_api") === "S";
      const apenasAtivo = url.searchParams.get("filtrar_apenas_ativo") !== "N";
      const ordenarPor = url.searchParams.get("ordenar_por") || "nome";
      const ordemDesc = url.searchParams.get("ordem_descendente") === "S";
      const offset = (pagina - 1) * registros;

      let query = supabase
        .from("contas_bancarias")
        .select("*", { count: "exact" })
        .order(ordenarPor, { ascending: !ordemDesc })
        .range(offset, offset + registros - 1);

      if (apenasAtivo) query = query.eq("ativo", true);
      if (apenasImportado) query = query.eq("importado_api", true);

      const { data, error, count } = await query;
      if (error) {
        await logSync("GET /", null, 500);
        return errorResp(500, "DB_ERROR", error.message, req, startMs);
      }

      const total = count || 0;
      const mapped = (data || []).map((r: any) => mapDbToHuggs(r));

      await logSync("GET /", null, 200);
      return json({
        pagina,
        total_de_paginas: Math.ceil(total / registros),
        registros: mapped.length,
        total_de_registros: total,
        ListarContasCorrentes: mapped,
      }, 200, req, startMs);
    }

    // ==================== GET /resumo (ListarResumoContasCorrentes) ====================
    if (req.method === "GET" && path === "/resumo") {
      const pagina = parseInt(url.searchParams.get("pagina") || "1");
      const registros = Math.min(parseInt(url.searchParams.get("registros_por_pagina") || "100"), 500);
      const apenasAtivo = url.searchParams.get("filtrar_apenas_ativo") !== "N";
      const offset = (pagina - 1) * registros;

      let query = supabase
        .from("contas_bancarias")
        .select("id, codigo_integracao, nome, descricao, codigo_banco, agencia, conta, tipo, n_cod_cc, saldo_inicial, valor_limite, tipo_conta_corrente, nome_gerente, ativo", { count: "exact" })
        .order("nome", { ascending: true })
        .range(offset, offset + registros - 1);

      if (apenasAtivo) query = query.eq("ativo", true);

      const { data, error, count } = await query;
      if (error) {
        await logSync("GET /resumo", null, 500);
        return errorResp(500, "DB_ERROR", error.message, req, startMs);
      }

      const total = count || 0;
      const lista = (data || []).map((r: any) => ({
        nCodCC: r.n_cod_cc,
        cCodCCInt: r.codigo_integracao,
        descricao: r.descricao ?? r.nome,
        codigo_banco: r.codigo_banco,
        codigo_agencia: r.agencia,
        conta_corrente: r.conta,
        nome_gerente: r.nome_gerente,
        tipo: r.tipo_conta_corrente ?? r.tipo,
        saldo_inicial: r.saldo_inicial,
        valor_limite: r.valor_limite,
        id: r.id,
      }));

      await logSync("GET /resumo", null, 200);
      return json({
        pagina,
        total_de_paginas: Math.ceil(total / registros),
        registros: lista.length,
        total_de_registros: total,
        conta_corrente_lista: lista,
      }, 200, req, startMs);
    }

    // ==================== GET /consultar (ConsultarContaCorrente) ====================
    if (req.method === "GET" && path === "/consultar") {
      const id = url.searchParams.get("id");
      const codInt = url.searchParams.get("cCodCCInt") || url.searchParams.get("codigo_integracao");
      const nCodCC = url.searchParams.get("nCodCC");

      if (!id && !codInt && !nCodCC) {
        return errorResp(400, "CAMPO_OBRIGATORIO", "Informe id, cCodCCInt ou nCodCC", req, startMs);
      }

      let query = supabase.from("contas_bancarias").select("*");
      if (id) query = query.eq("id", id);
      else if (codInt) query = query.eq("codigo_integracao", codInt);
      else if (nCodCC) query = query.eq("n_cod_cc", parseInt(nCodCC));

      const { data, error } = await query.maybeSingle();
      if (error) {
        await logSync("GET /consultar", { id, codInt, nCodCC }, 500);
        return errorResp(500, "DB_ERROR", error.message, req, startMs);
      }
      if (!data) {
        await logSync("GET /consultar", { id, codInt, nCodCC }, 404);
        return errorResp(404, "NAO_ENCONTRADO", "Conta corrente não encontrada", req, startMs);
      }

      await logSync("GET /consultar", { id, codInt, nCodCC }, 200);
      return json({ fin_conta_corrente_cadastro: mapDbToHuggs(data) }, 200, req, startMs);
    }

    // ==================== POST /incluir (IncluirContaCorrente) ====================
    if (req.method === "POST" && path === "/incluir") {
      const body = await req.json();
      if (!body.cCodCCInt && !body.descricao) {
        return errorResp(400, "CAMPO_OBRIGATORIO", "cCodCCInt ou descricao são obrigatórios", req, startMs);
      }

      const row = mapHuggsToDb(body);
      row.importado_api = true;
      row.ativo = true;
      if (body.cCodCCInt) row.codigo_integracao = body.cCodCCInt;
      if (!row.nome && body.descricao) row.nome = body.descricao;

      const { data, error } = await supabase
        .from("contas_bancarias")
        .insert(row)
        .select("id, codigo_integracao, n_cod_cc")
        .single();

      if (error) {
        await logSync("POST /incluir", body, 400);
        return errorResp(400, "ERRO_INCLUSAO", error.message, req, startMs);
      }

      await logSync("POST /incluir", body, 201);
      return json({
        nCodCC: data.n_cod_cc,
        cCodCCInt: data.codigo_integracao,
        cCodStatus: "0",
        cDesStatus: "Conta corrente incluída com sucesso",
      }, 201, req, startMs);
    }

    // ==================== PUT /alterar (AlterarContaCorrente) ====================
    if (req.method === "PUT" && path === "/alterar") {
      const body = await req.json();
      const id = body.id;
      const codInt = body.cCodCCInt;
      const nCodCC = body.nCodCC;

      if (!id && !codInt && !nCodCC) {
        return errorResp(400, "CAMPO_OBRIGATORIO", "Informe id, cCodCCInt ou nCodCC", req, startMs);
      }

      const row = mapHuggsToDb(body);
      delete row.nome; // avoid overwriting nome from descricao mapping

      let query = supabase.from("contas_bancarias").update(row);
      if (id) query = query.eq("id", id);
      else if (codInt) query = query.eq("codigo_integracao", codInt);
      else query = query.eq("n_cod_cc", nCodCC);

      const { data, error } = await query.select("id, codigo_integracao, n_cod_cc").single();
      if (error) {
        await logSync("PUT /alterar", body, 400);
        return errorResp(400, "ERRO_ALTERACAO", error.message, req, startMs);
      }

      await logSync("PUT /alterar", body, 200);
      return json({
        nCodCC: data.n_cod_cc,
        cCodCCInt: data.codigo_integracao,
        cCodStatus: "0",
        cDesStatus: "Conta corrente alterada com sucesso",
      }, 200, req, startMs);
    }

    // ==================== DELETE /excluir (ExcluirContaCorrente) ====================
    if (req.method === "DELETE" && path === "/excluir") {
      const id = url.searchParams.get("id");
      const codInt = url.searchParams.get("cCodCCInt");
      const nCodCC = url.searchParams.get("nCodCC");

      if (!id && !codInt && !nCodCC) {
        return errorResp(400, "CAMPO_OBRIGATORIO", "Informe id, cCodCCInt ou nCodCC", req, startMs);
      }

      let query = supabase.from("contas_bancarias").update({ ativo: false });
      if (id) query = query.eq("id", id);
      else if (codInt) query = query.eq("codigo_integracao", codInt);
      else query = query.eq("n_cod_cc", parseInt(nCodCC!));

      const { data, error } = await query.select("id, codigo_integracao, n_cod_cc").single();
      if (error) {
        await logSync("DELETE /excluir", { id, codInt, nCodCC }, 400);
        return errorResp(400, "ERRO_EXCLUSAO", error.message, req, startMs);
      }

      await logSync("DELETE /excluir", { id, codInt, nCodCC }, 200);
      return json({
        nCodCC: data.n_cod_cc,
        cCodCCInt: data.codigo_integracao,
        cCodStatus: "0",
        cDesStatus: "Conta corrente excluída (inativada) com sucesso",
      }, 200, req, startMs);
    }

    // ==================== POST /upsert (UpsertContaCorrente) ====================
    if (req.method === "POST" && path === "/upsert") {
      const body = await req.json();
      if (!body.cCodCCInt) {
        return errorResp(400, "CAMPO_OBRIGATORIO", "cCodCCInt é obrigatório para upsert", req, startMs);
      }

      const row = mapHuggsToDb(body);
      row.importado_api = true;
      row.ativo = true;
      row.codigo_integracao = body.cCodCCInt;
      if (!row.nome && body.descricao) row.nome = body.descricao;

      const { data: existing } = await supabase
        .from("contas_bancarias")
        .select("id")
        .eq("codigo_integracao", body.cCodCCInt)
        .maybeSingle();

      let data: any, error: any;
      if (existing) {
        ({ data, error } = await supabase
          .from("contas_bancarias")
          .update(row)
          .eq("id", existing.id)
          .select("id, codigo_integracao, n_cod_cc")
          .single());
      } else {
        ({ data, error } = await supabase
          .from("contas_bancarias")
          .insert(row)
          .select("id, codigo_integracao, n_cod_cc")
          .single());
      }

      if (error) {
        await logSync("POST /upsert", body, 400);
        return errorResp(400, "ERRO_UPSERT", error.message, req, startMs);
      }

      await logSync("POST /upsert", body, 200);
      return json({
        nCodCC: data.n_cod_cc,
        cCodCCInt: data.codigo_integracao,
        cCodStatus: "0",
        cDesStatus: existing ? "Conta corrente atualizada via upsert" : "Conta corrente incluída via upsert",
      }, 200, req, startMs);
    }

    // ==================== POST /upsert-lote (UpsertContaCorrentePorLote) ====================
    if (req.method === "POST" && path === "/upsert-lote") {
      const body = await req.json();
      const lote = body.lote || 1;
      const items: Record<string, unknown>[] = body.fin_conta_corrente_cadastro || body.contas || [];

      if (!Array.isArray(items) || items.length === 0) {
        return errorResp(400, "PAYLOAD_INVALIDO", "Array de contas correntes é obrigatório", req, startMs);
      }
      if (items.length > 500) {
        return errorResp(413, "PAYLOAD_EXCEDIDO", "Máximo de 500 contas por lote", req, startMs);
      }

      let successCount = 0;
      let errorCount = 0;

      for (const item of items) {
        const codInt = item.cCodCCInt as string;
        if (!codInt) { errorCount++; continue; }

        const row = mapHuggsToDb(item);
        row.importado_api = true;
        row.ativo = true;
        row.codigo_integracao = codInt;
        if (!row.nome && item.descricao) row.nome = item.descricao;

        const { data: existing } = await supabase
          .from("contas_bancarias")
          .select("id")
          .eq("codigo_integracao", codInt)
          .maybeSingle();

        let err: any;
        if (existing) {
          ({ error: err } = await supabase.from("contas_bancarias").update(row).eq("id", existing.id));
        } else {
          ({ error: err } = await supabase.from("contas_bancarias").insert(row));
        }

        if (err) errorCount++;
        else successCount++;
      }

      await logSync("POST /upsert-lote", { lote, total: items.length }, 200);
      return json({
        lote,
        cCodStatus: errorCount === 0 ? "0" : "1",
        cDesStatus: `${successCount} processado(s), ${errorCount} erro(s)`,
        total_processados: successCount,
        total_erros: errorCount,
      }, 200, req, startMs);
    }

    // ==================== POST /sync (Sync legado) ====================
    if (req.method === "POST" && path === "/sync") {
      const body = await req.json();
      const items: Record<string, unknown>[] = Array.isArray(body) ? body : (body.contas || body.fin_conta_corrente_cadastro || []);

      if (!Array.isArray(items) || items.length === 0) {
        return errorResp(400, "PAYLOAD_INVALIDO", "Array de contas correntes é obrigatório", req, startMs);
      }

      let successCount = 0;
      for (const item of items) {
        const codInt = item.cCodCCInt as string || item.codigo_integracao as string;
        const row = mapHuggsToDb(item);
        row.importado_api = true;
        row.ativo = true;
        if (codInt) row.codigo_integracao = codInt;
        if (!row.nome && (item.descricao || item.nome)) row.nome = (item.descricao || item.nome) as string;

        if (codInt) {
          const { data: existing } = await supabase
            .from("contas_bancarias")
            .select("id")
            .eq("codigo_integracao", codInt)
            .maybeSingle();

          if (existing) {
            await supabase.from("contas_bancarias").update(row).eq("id", existing.id);
          } else {
            await supabase.from("contas_bancarias").insert(row);
          }
        } else {
          await supabase.from("contas_bancarias").insert(row);
        }
        successCount++;
      }

      await logSync("POST /sync", { total: items.length }, 200);
      return json({
        success: true,
        message: `${successCount} conta(s) corrente(s) sincronizada(s)`,
        total: successCount,
      }, 200, req, startMs);
    }

    // ==================== 404 ====================
    await logSync(`${req.method} ${path}`, null, 404);
    return errorResp(404, "NOT_FOUND", `Rota ${req.method} ${path} não encontrada`, req, startMs);
  } catch (err: any) {
    await logSync(`${req.method} ${path}`, null, 500);
    return errorResp(500, "INTERNAL_ERROR", err.message || "Erro interno", req, startMs);
  }
});
