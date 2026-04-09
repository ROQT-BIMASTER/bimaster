// movimentos-financeiros-api — ListarMovimentos Huggs-style (unified financial movements)
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
  const path = url.pathname.replace(/^\/movimentos-financeiros-api\/?/, "/").replace(/\/+$/, "") || "/";

  try {
    const auth = await validateAnyAuth(req);
    await checkRateLimit({ prefix: "mov-fin", limit: 60, req, userId: auth.userId });

    if (req.method === "GET" && (path === "/status" || path === "/")) {
      return jsonResponse({ status: "online", service: "movimentos-financeiros-api", empresa_id: auth.empresaId }, 200, req, { startMs });
    }

    if (req.method === "POST" && path === "/listar") {
      return await handleListar(req, auth, startMs);
    }

    return errorResponse(404, "NOT_FOUND", `Rota ${req.method} ${path} não encontrada`, req, startMs);
  } catch (err) {
    if (err instanceof AuthError) return errorResponse(err.status, "AUTH_ERROR", err.message, req, startMs);
    if (err instanceof RateLimitError) return errorResponse(429, "RATE_LIMIT", err.message, req, startMs);
    console.error("movimentos-financeiros-api error:", err);
    return errorResponse(500, "INTERNAL_ERROR", "Erro interno do servidor", req, startMs);
  }
});

async function handleListar(req: Request, auth: { empresaId: string }, startMs: number) {
  const body = await req.json();
  const {
    nPagina = 1,
    nRegPorPagina = 20,
    cOrdenarPor,
    cOrdemDecrescente,
    lDadosCad,
    cTpLancamento,
    cExibirDepartamentos,
    nCodMovCC,
    // Title filters
    nCodTitulo, cCodIntTitulo, cNumTitulo,
    dDtEmisDe, dDtEmisAte,
    dDtVencDe, dDtVencAte,
    dDtPagtoDe, dDtPagtoAte,
    dDtPrevDe, dDtPrevAte,
    dDtRegDe, dDtRegAte,
    dDtIncDe, dDtIncAte,
    dDtAltDe, dDtAltAte,
    nCodCliente, cCPFCNPJCliente,
    nCodCC, cStatus, cNatureza,
    cTipo, cOperacao, cNumDocFiscal,
    cCodCateg, cCodigoBarras,
    nCodProjeto, nCodVendedor, nCodComprador,
    nCodCtr, cNumCtr, nCodOS, cNumOS,
  } = body;

  const page = Math.max(1, Number(nPagina));
  const perPage = Math.min(500, Math.max(1, Number(nRegPorPagina)));
  const offset = (page - 1) * perPage;
  const db = supabaseAdmin();

  const allMovimentos: any[] = [];

  // Determine which sources to query
  const queryCP = !cTpLancamento || cTpLancamento === "CP";
  const queryCR = !cTpLancamento || cTpLancamento === "CR";
  const queryCC = !cTpLancamento || cTpLancamento === "CC";

  // Helper to apply common filters
  function applyTitleFilters(query: any, table: string, nat: string) {
    if (auth.empresaId !== "all" && auth.empresaId !== "legacy") {
      query = query.eq("empresa_id", auth.empresaId);
    }
    if (nCodTitulo) query = query.eq(nat === "R" ? "codigo_lancamento_huggs" : "erp_titulo_id", nCodTitulo);
    if (cCodIntTitulo) query = query.eq("codigo_integracao", cCodIntTitulo);
    if (cNumTitulo) query = query.eq(nat === "R" ? "numero_titulo" : "titulo_numero", cNumTitulo);
    if (cStatus) {
      const statuses = String(cStatus).split(",").map((s: string) => s.trim());
      if (statuses.length === 1) query = query.eq("status", statuses[0]);
      else query = query.in("status", statuses);
    }
    if (cCodCateg) query = query.eq("codigo_categoria", cCodCateg);
    if (nCodCliente) query = query.eq("codigo_cliente_fornecedor", nCodCliente);
    if (cCPFCNPJCliente) query = query.eq(nat === "R" ? "cpf_cnpj_cliente" : "cpf_cnpj", cCPFCNPJCliente);
    if (nCodCC) query = query.eq("id_conta_corrente", nCodCC);
    if (cTipo) query = query.eq("tipo_documento", cTipo);
    if (cOperacao) query = query.eq("operacao", cOperacao);
    if (cNumDocFiscal) query = query.eq("numero_documento_fiscal", cNumDocFiscal);
    if (cCodigoBarras) query = query.eq("codigo_barras", cCodigoBarras);
    if (nCodProjeto) query = query.eq("codigo_projeto", nCodProjeto);
    if (nCodVendedor) query = query.eq("codigo_vendedor", nCodVendedor);
    if (nCodComprador) query = query.eq("codigo_comprador", nCodComprador);
    if (nCodCtr) query = query.eq("codigo_contrato", nCodCtr);
    if (cNumCtr) query = query.eq("numero_contrato", cNumCtr);
    if (nCodOS) query = query.eq("codigo_os", nCodOS);
    if (cNumOS) query = query.eq("numero_os", cNumOS);

    const dateFilters = [
      { field: "data_emissao", de: dDtEmisDe, ate: dDtEmisAte },
      { field: "data_vencimento", de: dDtVencDe, ate: dDtVencAte },
      { field: nat === "R" ? "data_recebimento" : "data_pagamento", de: dDtPagtoDe, ate: dDtPagtoAte },
      { field: "data_previsao", de: dDtPrevDe, ate: dDtPrevAte },
      { field: "data_registro", de: dDtRegDe, ate: dDtRegAte },
      { field: "created_at", de: dDtIncDe, ate: dDtIncAte },
      { field: "updated_at", de: dDtAltDe, ate: dDtAltAte },
    ];
    for (const df of dateFilters) {
      const from = parseDate(df.de);
      const to = parseDate(df.ate);
      if (from) query = query.gte(df.field, from);
      if (to) query = query.lte(df.field, to);
    }
    return query;
  }

  // ──── CP & CR: fetch titles then their pagamentos ────
  const titleSources: Array<{ table: string; nat: string; grupo: string }> = [];
  if (queryCP) titleSources.push({ table: "contas_pagar", nat: "P", grupo: "CP" });
  if (queryCR) titleSources.push({ table: "contas_receber", nat: "R", grupo: "CR" });

  for (const { table, nat, grupo } of titleSources) {
    let query = db.from(table).select("*");
    query = applyTitleFilters(query, table, nat);

    const { data: titles, error } = await query;
    if (error) { console.error(`Error querying ${table}:`, error); continue; }
    if (!titles || titles.length === 0) continue;

    // Fetch pagamentos for these titles
    const titleIds = titles.map((t: any) => t.id);
    const fkCol = nat === "P" ? "conta_pagar_id" : "conta_receber_id";

    // Batch query pagamentos (max 1000 per query)
    const pagamentosMap: Record<string, any[]> = {};
    for (let i = 0; i < titleIds.length; i += 500) {
      const batch = titleIds.slice(i, i + 500);
      const { data: pgs } = await db.from("pagamentos").select("*").in(fkCol, batch);
      for (const pg of pgs || []) {
        const key = pg[fkCol];
        if (!pagamentosMap[key]) pagamentosMap[key] = [];
        pagamentosMap[key].push(pg);
      }
    }

    // Each pagamento = 1 movement line
    for (const title of titles) {
      const pagamentos = pagamentosMap[title.id] || [];
      const valorTitulo = Number(title.valor_documento || title.valor_original || 0);

      if (pagamentos.length > 0) {
        for (const pg of pagamentos) {
          allMovimentos.push(buildMovimento(title, nat, grupo, valorTitulo, pg, lDadosCad, cExibirDepartamentos));
        }
      } else {
        // Title with no payments — still show as a movement
        allMovimentos.push(buildMovimento(title, nat, grupo, valorTitulo, null, lDadosCad, cExibirDepartamentos));
      }
    }
  }

  // ──── CC: lançamentos diretos ────
  if (queryCC) {
    let query = db.from("lancamentos_conta_corrente").select("*");
    if (auth.empresaId !== "all" && auth.empresaId !== "legacy") {
      query = query.eq("empresa_id", auth.empresaId);
    }
    if (nCodMovCC) query = query.eq("id", nCodMovCC);
    if (nCodCC) query = query.eq("conta_corrente_id", nCodCC);
    if (cCodCateg) query = query.eq("codigo_categoria", cCodCateg);

    const dateFiltersCC = [
      { field: "data_lancamento", de: dDtPagtoDe, ate: dDtPagtoAte },
      { field: "created_at", de: dDtIncDe, ate: dDtIncAte },
      { field: "updated_at", de: dDtAltDe, ate: dDtAltAte },
    ];
    for (const df of dateFiltersCC) {
      const from = parseDate(df.de);
      const to = parseDate(df.ate);
      if (from) query = query.gte(df.field, from);
      if (to) query = query.lte(df.field, to);
    }

    const { data: lancCC, error } = await query;
    if (error) console.error("Error querying lancamentos_conta_corrente:", error);

    for (const lcc of lancCC || []) {
      allMovimentos.push(buildMovimentoCC(lcc, lDadosCad, cExibirDepartamentos));
    }
  }

  // ──── Sort ────
  const orderField = mapOrderField(cOrdenarPor);
  const desc = cOrdemDecrescente === "S";
  allMovimentos.sort((a, b) => {
    const va = a._sortKey || "";
    const vb = b._sortKey || "";
    return desc ? String(vb).localeCompare(String(va)) : String(va).localeCompare(String(vb));
  });

  const totalRegistros = allMovimentos.length;
  const paged = allMovimentos.slice(offset, offset + perPage);

  // Clean internal keys
  const movimentos = paged.map(({ _sortKey, ...rest }) => rest);

  return jsonResponse(
    {
      nPagina: page,
      nTotPaginas: Math.ceil(totalRegistros / perPage),
      nRegistros: movimentos.length,
      nTotRegistros: totalRegistros,
      movimentos,
    },
    200,
    req,
    { startMs }
  );
}

function mapOrderField(cOrdenarPor: string | undefined): string {
  switch (cOrdenarPor) {
    case "data_emissao": return "data_emissao";
    case "data_pagamento": return "data_pagamento";
    case "valor": return "valor_documento";
    default: return "data_vencimento";
  }
}

function buildMovimento(
  title: any, nat: string, grupo: string, valorTitulo: number,
  pg: any | null, lDadosCad: boolean, cExibirDepartamentos: string
) {
  const pgValor = pg ? Number(pg.valor || pg.valor_pago || 0) : 0;
  const pgDesconto = pg ? Number(pg.desconto || pg.valor_desconto || 0) : 0;
  const pgJuros = pg ? Number(pg.juros || pg.valor_juros || 0) : 0;
  const pgMulta = pg ? Number(pg.multa || pg.valor_multa || 0) : 0;

  const totalPago = pg ? pgValor : Number(title.valor_baixado || title.valor_pago || 0);
  const valorAberto = Math.max(0, valorTitulo - totalPago);
  const liquidado = valorAberto <= 0 && totalPago > 0 ? "S" : "N";

  const detalhes: Record<string, any> = {
    nCodTitulo: title.codigo_lancamento_huggs || title.erp_titulo_id || null,
    cCodIntTitulo: title.codigo_integracao || "",
    cNumTitulo: title.numero_titulo || title.titulo_numero || "",
    dDtEmissao: formatDateBr(title.data_emissao),
    dDtVenc: formatDateBr(title.data_vencimento),
    dDtPrevisao: formatDateBr(title.data_previsao),
    dDtPagamento: pg ? formatDateBr(pg.data_pagamento || pg.data_baixa) : formatDateBr(nat === "R" ? title.data_recebimento : title.data_pagamento),
    nCodCliente: title.codigo_cliente_fornecedor || null,
    cCPFCNPJCliente: title.cpf_cnpj_cliente || title.cpf_cnpj || "",
    nCodCtr: title.codigo_contrato || null,
    cNumCtr: title.numero_contrato || "",
    nCodOS: title.codigo_os || null,
    cNumOS: title.numero_os || "",
    nCodCC: title.id_conta_corrente || null,
    cStatus: title.status || "",
    cNatureza: nat,
    cTipo: title.tipo_documento || "",
    cOperacao: title.operacao || "",
    cNumDocFiscal: title.numero_documento_fiscal || "",
    cCodCateg: title.codigo_categoria || "",
    cNumParcela: title.numero_parcela ? `${title.numero_parcela}/${title.total_parcelas || 1}` : "",
    nValorTitulo: valorTitulo,
    // Tax fields
    nValorPIS: Number(title.valor_pis || 0),
    cRetPIS: title.retem_pis ? "S" : "N",
    nValorCOFINS: Number(title.valor_cofins || 0),
    cRetCOFINS: title.retem_cofins ? "S" : "N",
    nValorCSLL: Number(title.valor_csll || 0),
    cRetCSLL: title.retem_csll ? "S" : "N",
    nValorIR: Number(title.valor_ir || 0),
    cRetIR: title.retem_ir ? "S" : "N",
    nValorISS: Number(title.valor_iss || 0),
    cRetISS: title.retem_iss ? "S" : "N",
    nValorINSS: Number(title.valor_inss || 0),
    cRetINSS: title.retem_inss ? "S" : "N",
    cCodProjeto: title.codigo_projeto || null,
    cCodVendedor: title.codigo_vendedor || null,
    nCodComprador: title.codigo_comprador || null,
    cCodigoBarras: title.codigo_barras || "",
    cNSU: title.nsu || "",
    nCodNF: title.codigo_nota_fiscal || null,
    dDtRegistro: formatDateBr(title.data_registro),
    cNumBoleto: title.boleto_numero || title.numero_boleto || "",
    cChaveNFe: title.chave_nfe || "",
    cOrigem: title.origem || "",
    nCodTitRepet: title.codigo_titulo_repetido || null,
    cGrupo: grupo,
    nCodMovCC: pg?.lancamento_cc_id || null,
    nValorMovCC: pg ? pgValor : 0,
    nCodMovCCRepet: null,
    nDesconto: pgDesconto,
    nJuros: pgJuros,
    nMulta: pgMulta,
    nCodBaixa: pg?.id || null,
    dDtCredito: pg ? formatDateBr(pg.data_credito) : "",
    dDtConcilia: pg ? formatDateBr(pg.data_conciliacao) : "",
    cHrConcilia: pg ? formatTimeBr(pg.data_conciliacao) : "",
    cUsConcilia: pg?.usuario_conciliacao || "",
  };

  if (lDadosCad) {
    detalhes.observacao = title.observacao || title.observacoes || "";
    detalhes.dDtInc = formatDateBr(title.created_at);
    detalhes.cHrInc = formatTimeBr(title.created_at);
    detalhes.cUsInc = title.criado_por || "";
    detalhes.dDtAlt = formatDateBr(title.updated_at);
    detalhes.cHrAlt = formatTimeBr(title.updated_at);
    detalhes.cUsAlt = title.alterado_por || "";
  }

  const resumo = {
    cLiquidado: liquidado,
    nValPago: round2(totalPago),
    nValAberto: round2(valorAberto),
    nDesconto: round2(pgDesconto),
    nJuros: round2(pgJuros),
    nMulta: round2(pgMulta),
    nValLiquido: round2(valorTitulo),
  };

  const mov: Record<string, any> = { detalhes, resumo, _sortKey: title.data_vencimento || title.created_at || "" };

  if (cExibirDepartamentos === "S") {
    mov.departamentos = title.rateio_departamentos || [];
  } else {
    mov.departamentos = [];
  }

  mov.categorias = title.rateio_categorias || [];

  return mov;
}

function buildMovimentoCC(lcc: any, lDadosCad: boolean, cExibirDepartamentos: string) {
  const valor = Number(lcc.valor || 0);
  const detalhes: Record<string, any> = {
    nCodTitulo: null,
    cCodIntTitulo: "",
    cNumTitulo: "",
    dDtEmissao: "",
    dDtVenc: "",
    dDtPrevisao: "",
    dDtPagamento: formatDateBr(lcc.data_lancamento),
    nCodCliente: lcc.codigo_cliente || null,
    cCPFCNPJCliente: "",
    nCodCtr: null,
    cNumCtr: "",
    nCodOS: null,
    cNumOS: "",
    nCodCC: lcc.conta_corrente_id || null,
    cStatus: lcc.status || "",
    cNatureza: lcc.natureza || "",
    cTipo: lcc.tipo_documento || "",
    cOperacao: "",
    cNumDocFiscal: lcc.numero_documento || "",
    cCodCateg: lcc.codigo_categoria || "",
    cNumParcela: "",
    nValorTitulo: valor,
    nValorPIS: 0, cRetPIS: "N",
    nValorCOFINS: 0, cRetCOFINS: "N",
    nValorCSLL: 0, cRetCSLL: "N",
    nValorIR: 0, cRetIR: "N",
    nValorISS: 0, cRetISS: "N",
    nValorINSS: 0, cRetINSS: "N",
    cCodProjeto: lcc.codigo_projeto || null,
    cCodVendedor: lcc.codigo_vendedor || null,
    nCodComprador: null,
    cCodigoBarras: "",
    cNSU: "",
    nCodNF: null,
    dDtRegistro: "",
    cNumBoleto: "",
    cChaveNFe: "",
    cOrigem: lcc.origem || "MANU",
    nCodTitRepet: null,
    cGrupo: "CC",
    nCodMovCC: lcc.codigo_lancamento_huggs || lcc.id,
    nValorMovCC: valor,
    nCodMovCCRepet: null,
    nDesconto: 0,
    nJuros: 0,
    nMulta: 0,
    nCodBaixa: null,
    dDtCredito: "",
    dDtConcilia: lcc.data_conciliacao ? formatDateBr(lcc.data_conciliacao) : "",
    cHrConcilia: lcc.hora_conciliacao || "",
    cUsConcilia: lcc.usuario_conciliacao || "",
  };

  if (lDadosCad) {
    detalhes.observacao = lcc.observacao || lcc.observacoes || "";
    detalhes.dDtInc = formatDateBr(lcc.created_at);
    detalhes.cHrInc = formatTimeBr(lcc.created_at);
    detalhes.cUsInc = lcc.criado_por || "";
    detalhes.dDtAlt = formatDateBr(lcc.updated_at);
    detalhes.cHrAlt = formatTimeBr(lcc.updated_at);
    detalhes.cUsAlt = lcc.alterado_por || "";
  }

  const resumo = {
    cLiquidado: "S",
    nValPago: round2(valor),
    nValAberto: 0,
    nDesconto: 0,
    nJuros: 0,
    nMulta: 0,
    nValLiquido: round2(valor),
  };

  const mov: Record<string, any> = {
    detalhes,
    resumo,
    _sortKey: lcc.data_lancamento || lcc.created_at || "",
  };

  if (cExibirDepartamentos === "S") {
    mov.departamentos = lcc.rateio_departamentos || [];
  } else {
    mov.departamentos = [];
  }

  mov.categorias = lcc.rateio_categorias || [];

  return mov;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
