// pesquisar-lancamentos-api — PesquisarLancamentos Huggs-style (v2 - complete fields)
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { validateAnyAuth, AuthError } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";

const supabaseAdmin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

function parseDate(d: string | undefined): string | null {
  if (!d) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
    const [dd, mm, yyyy] = d.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return null;
}

function formatDateBr(d: string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

function formatTimeBr(d: string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}:${String(date.getUTCSeconds()).padStart(2, "0")}`;
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startMs = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/pesquisar-lancamentos-api\/?/, "/").replace(/\/+$/, "") || "/";

  try {
    const auth = await validateAnyAuth(req);
    await checkRateLimit({ prefix: "pesquisar-lanc", limit: 60, req, userId: auth.userId });

    if (req.method === "GET" && (path === "/status" || path === "/")) {
      return jsonResponse({ status: "online", service: "pesquisar-lancamentos-api", empresa_id: auth.empresaId }, 200, req, { startMs });
    }

    if (req.method === "POST" && path === "/pesquisar") {
      return await handlePesquisar(req, auth, startMs);
    }

    return errorResponse(404, "NOT_FOUND", `Rota ${req.method} ${path} não encontrada`, req, startMs);
  } catch (err) {
    if (err instanceof AuthError) return errorResponse(err.status, "AUTH_ERROR", err.message, req, startMs);
    if (err instanceof RateLimitError) return errorResponse(429, "RATE_LIMIT", err.message, req, startMs);
    console.error("pesquisar-lancamentos-api error:", err);
    return errorResponse(500, "INTERNAL_ERROR", "Erro interno do servidor", req, startMs);
  }
});

async function handlePesquisar(req: Request, auth: { empresaId: string }, startMs: number) {
  const body = await req.json();
  const {
    nPagina = 1,
    nRegPorPagina = 20,
    cNatureza,
    cOrdenarPor,
    cOrdemDecrescente,
    nCodTitulo,
    cCodIntTitulo,
    cNumTitulo,
    dDtEmisDe, dDtEmisAte,
    dDtVencDe, dDtVencAte,
    dDtPagtoDe, dDtPagtoAte,
    dDtPrevDe, dDtPrevAte,
    dDtRegDe, dDtRegAte,
    dDtIncDe, dDtIncAte,
    dDtAltDe, dDtAltAte,
    dDtCancDe, dDtCancAte,
    nCodCliente,
    cCPFCNPJCliente,
    nCodCC,
    cStatus,
    cTipo,
    cOperacao,
    cNumDocFiscal,
    cCodCateg,
    cCodigoBarras,
    nCodProjeto,
    nCodVendedor,
    nCodComprador,
    cChaveNFe,
    lDadosCad,
    // New filters
    nCodCtr,
    cNumCtr,
    nCodOS,
    cNumOS,
  } = body;

  const page = Math.max(1, Number(nPagina));
  const perPage = Math.min(500, Math.max(1, Number(nRegPorPagina)));
  const offset = (page - 1) * perPage;

  const db = supabaseAdmin();

  // Determine which tables to query
  const naturezas: Array<{ table: string; nat: string }> = [];
  if (!cNatureza || cNatureza === "R") naturezas.push({ table: "contas_receber", nat: "R" });
  if (!cNatureza || cNatureza === "P") naturezas.push({ table: "contas_pagar", nat: "P" });

  const allTitulos: any[] = [];

  for (const { table, nat } of naturezas) {
    let query = db.from(table).select("*", { count: "exact" });

    // empresa filter
    if (auth.empresaId !== "all" && auth.empresaId !== "legacy") {
      query = query.eq("empresa_id", auth.empresaId);
    }

    // ID filters
    if (nCodTitulo) query = query.eq(nat === "R" ? "codigo_lancamento_huggs" : "erp_titulo_id", nCodTitulo);
    if (cCodIntTitulo) query = query.eq("codigo_integracao", cCodIntTitulo);
    if (cNumTitulo) query = query.eq(nat === "R" ? "numero_titulo" : "titulo_numero", cNumTitulo);

    // Status
    if (cStatus) {
      const statuses = String(cStatus).split(",").map((s: string) => s.trim());
      if (statuses.length === 1) query = query.eq("status", statuses[0]);
      else query = query.in("status", statuses);
    }

    // Category
    if (cCodCateg) query = query.eq("codigo_categoria", cCodCateg);

    // Client
    if (nCodCliente) query = query.eq("codigo_cliente_fornecedor", nCodCliente);
    if (cCPFCNPJCliente) {
      if (nat === "R") query = query.eq("cpf_cnpj_cliente", cCPFCNPJCliente);
      else query = query.eq("cpf_cnpj", cCPFCNPJCliente);
    }

    // Account
    if (nCodCC) query = query.eq("id_conta_corrente", nCodCC);

    // Type & Operation
    if (cTipo) query = query.eq("tipo_documento", cTipo);
    if (cOperacao) query = query.eq("operacao", cOperacao);

    // Doc fiscal / NF-e / Barras
    if (cNumDocFiscal) query = query.eq("numero_documento_fiscal", cNumDocFiscal);
    if (cChaveNFe) query = query.eq("chave_nfe", cChaveNFe);
    if (cCodigoBarras) query = query.eq("codigo_barras", cCodigoBarras);

    // Project / Vendedor / Comprador
    if (nCodProjeto) query = query.eq("codigo_projeto", nCodProjeto);
    if (nCodVendedor) query = query.eq("codigo_vendedor", nCodVendedor);
    if (nCodComprador) query = query.eq("codigo_comprador", nCodComprador);

    // Contract filters
    if (nCodCtr) query = query.eq("codigo_contrato", nCodCtr);
    if (cNumCtr) query = query.eq("numero_contrato", cNumCtr);

    // OS filters
    if (nCodOS) query = query.eq("codigo_os", nCodOS);
    if (cNumOS) query = query.eq("numero_os", cNumOS);

    // Date filters
    const dateFilters: Array<{ field: string; de?: string; ate?: string }> = [
      { field: "data_emissao", de: dDtEmisDe, ate: dDtEmisAte },
      { field: "data_vencimento", de: dDtVencDe, ate: dDtVencAte },
      { field: nat === "R" ? "data_recebimento" : "data_pagamento", de: dDtPagtoDe, ate: dDtPagtoAte },
      { field: "data_previsao", de: dDtPrevDe, ate: dDtPrevAte },
      { field: "data_registro", de: dDtRegDe, ate: dDtRegAte },
      { field: "created_at", de: dDtIncDe, ate: dDtIncAte },
      { field: "updated_at", de: dDtAltDe, ate: dDtAltAte },
      { field: "data_cancelamento", de: dDtCancDe, ate: dDtCancAte },
    ];

    for (const df of dateFilters) {
      const from = parseDate(df.de);
      const to = parseDate(df.ate);
      if (from) query = query.gte(df.field, from);
      if (to) query = query.lte(df.field, to);
    }

    // Order
    const orderField = cOrdenarPor || "data_vencimento";
    const orderAsc = cOrdemDecrescente !== "S";
    query = query.order(orderField, { ascending: orderAsc });

    const { data, error, count } = await query;
    if (error) {
      console.error(`Error querying ${table}:`, error);
      continue;
    }

    for (const row of data || []) {
      allTitulos.push({ ...row, _natureza: nat, _table: table, _totalCount: count || 0 });
    }
  }

  // Sort combined results
  const orderField = cOrdenarPor || "data_vencimento";
  const desc = cOrdemDecrescente === "S";
  allTitulos.sort((a, b) => {
    const va = a[orderField] || "";
    const vb = b[orderField] || "";
    return desc ? String(vb).localeCompare(String(va)) : String(va).localeCompare(String(vb));
  });

  const totalRegistros = allTitulos.length;
  const paged = allTitulos.slice(offset, offset + perPage);

  // Fetch real lancamentos (pagamentos) for paged titles
  const pagedIds = paged.map((r) => r.id).filter(Boolean);
  let pagamentosMap: Record<string, any[]> = {};

  if (pagedIds.length > 0) {
    // Query pagamentos for contas_pagar
    const cpIds = paged.filter((r) => r._natureza === "P").map((r) => r.id);
    const crIds = paged.filter((r) => r._natureza === "R").map((r) => r.id);

    if (cpIds.length > 0) {
      const { data: pgCP } = await db
        .from("pagamentos")
        .select("*")
        .in("conta_pagar_id", cpIds);
      for (const pg of pgCP || []) {
        const key = pg.conta_pagar_id;
        if (!pagamentosMap[key]) pagamentosMap[key] = [];
        pagamentosMap[key].push(pg);
      }
    }

    if (crIds.length > 0) {
      const { data: pgCR } = await db
        .from("pagamentos")
        .select("*")
        .in("conta_receber_id", crIds);
      for (const pg of pgCR || []) {
        const key = pg.conta_receber_id;
        if (!pagamentosMap[key]) pagamentosMap[key] = [];
        pagamentosMap[key].push(pg);
      }
    }
  }

  // Build response for each titulo
  const titulosEncontrados = paged.map((row) => {
    const nat = row._natureza;
    const valorTitulo = Number(row.valor_documento || row.valor_original || 0);

    // Get real lancamentos
    const pagamentos = pagamentosMap[row.id] || [];

    // Calculate totals from real payments
    let totalPago = 0;
    let totalDesconto = 0;
    let totalJuros = 0;
    let totalMulta = 0;
    for (const pg of pagamentos) {
      totalPago += Number(pg.valor || pg.valor_pago || 0);
      totalDesconto += Number(pg.desconto || pg.valor_desconto || 0);
      totalJuros += Number(pg.juros || pg.valor_juros || 0);
      totalMulta += Number(pg.multa || pg.valor_multa || 0);
    }

    // Fallback to row-level totals if no individual pagamentos found
    if (pagamentos.length === 0) {
      totalPago = Number(row.valor_baixado || row.valor_pago || 0);
    }

    const valorAberto = Math.max(0, valorTitulo - totalPago);
    const liquidado = valorAberto <= 0 && totalPago > 0 ? "S" : "N";

    const cabecTitulo: Record<string, any> = {
      nCodTitulo: row.codigo_lancamento_huggs || row.erp_titulo_id || null,
      cCodIntTitulo: row.codigo_integracao || "",
      cNumTitulo: row.numero_titulo || row.titulo_numero || "",
      dDtEmissao: formatDateBr(row.data_emissao),
      dDtVenc: formatDateBr(row.data_vencimento),
      dDtPrevisao: formatDateBr(row.data_previsao),
      dDtPagamento: formatDateBr(nat === "R" ? row.data_recebimento : row.data_pagamento),
      nCodCliente: row.codigo_cliente_fornecedor || null,
      cCPFCNPJCliente: row.cpf_cnpj_cliente || row.cpf_cnpj || "",
      nCodCtr: row.codigo_contrato || null,
      cNumCtr: row.numero_contrato || "",
      nCodOS: row.codigo_os || null,
      cNumOS: row.numero_os || "",
      nCodCC: row.id_conta_corrente || null,
      cStatus: row.status || "",
      cNatureza: nat,
      cTipo: row.tipo_documento || "",
      cOperacao: row.operacao || "",
      cNumDocFiscal: row.numero_documento_fiscal || "",
      cCodCateg: row.codigo_categoria || "",
      aCodCateg: row.rateio_categorias || [],
      cNumParcela: row.numero_parcela ? `${row.numero_parcela}/${row.total_parcelas || 1}` : "",
      nValorTitulo: valorTitulo,
      // Tax fields (both natures)
      nValorPIS: Number(row.valor_pis || 0),
      cRetPIS: row.retem_pis ? "S" : "N",
      nValorCOFINS: Number(row.valor_cofins || 0),
      cRetCOFINS: row.retem_cofins ? "S" : "N",
      nValorCSLL: Number(row.valor_csll || 0),
      cRetCSLL: row.retem_csll ? "S" : "N",
      nValorIR: Number(row.valor_ir || 0),
      cRetIR: row.retem_ir ? "S" : "N",
      nValorISS: Number(row.valor_iss || 0),
      cRetISS: row.retem_iss ? "S" : "N",
      nValorINSS: Number(row.valor_inss || 0),
      cRetINSS: row.retem_inss ? "S" : "N",
      observacao: row.observacao || row.observacoes || "",
      cCodProjeto: row.codigo_projeto || null,
      cCodVendedor: row.codigo_vendedor || null,
      nCodComprador: row.codigo_comprador || null,
      cCodigoBarras: row.codigo_barras || "",
      cNSU: row.nsu || "",
      nCodNF: row.codigo_nota_fiscal || null,
      dDtRegistro: formatDateBr(row.data_registro),
      cNumBoleto: row.boleto_numero || row.numero_boleto || "",
      cChaveNFe: row.chave_nfe || "",
      cOrigem: row.origem || "",
      nCodTitRepet: row.codigo_titulo_repetido || null,
      dDtCanc: formatDateBr(row.data_cancelamento),
      departamentos: row.rateio_departamentos || [],
    };

    // Info block
    if (lDadosCad) {
      cabecTitulo.info = {
        dInc: formatDateBr(row.created_at),
        hInc: formatTimeBr(row.created_at),
        uInc: row.criado_por || "",
        dAlt: formatDateBr(row.updated_at),
        hAlt: formatTimeBr(row.updated_at),
        uAlt: row.alterado_por || "",
        cImpAPI: row.importado_api ? "S" : "N",
      };
    }

    // Map real lancamentos
    const lancamentos = pagamentos.map((pg) => ({
      nCodLanc: pg.id || null,
      cCodIntLanc: pg.codigo_integracao || "",
      nIdLancCC: pg.lancamento_cc_id || null,
      dDtLanc: formatDateBr(pg.data_pagamento || pg.data_baixa || pg.created_at),
      nValLanc: Number(pg.valor || pg.valor_pago || 0),
      nMulta: Number(pg.multa || pg.valor_multa || 0),
      nJuros: Number(pg.juros || pg.valor_juros || 0),
      nDesconto: Number(pg.desconto || pg.valor_desconto || 0),
      nCodCC: pg.conta_corrente_id || null,
      cNatureza: nat === "R" ? "R" : "P",
      cObsLanc: pg.observacao || pg.observacoes || "",
    }));

    const resumo = {
      cLiquidado: liquidado,
      nValPago: Math.round(totalPago * 100) / 100,
      nValAberto: Math.round(valorAberto * 100) / 100,
      nDesconto: Math.round(totalDesconto * 100) / 100,
      nJuros: Math.round(totalJuros * 100) / 100,
      nMulta: Math.round(totalMulta * 100) / 100,
      nValLiquido: Math.round(valorTitulo * 100) / 100,
    };

    return {
      cabecTitulo,
      lancamentos,
      resumo,
    };
  });

  return jsonResponse(
    {
      nPagina: page,
      nTotPaginas: Math.ceil(totalRegistros / perPage),
      nRegistros: titulosEncontrados.length,
      nTotRegistros: totalRegistros,
      titulosEncontrados,
    },
    200,
    req,
    { startMs }
  );
}
