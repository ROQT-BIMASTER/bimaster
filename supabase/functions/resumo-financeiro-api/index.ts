// resumo-financeiro-api — ObterResumoFinancas, ObterListaEmAberto, ObterListaFinancas, ObterDetalhesLancamento
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { validateJWT, validateApiKey, AuthError } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";

const supabaseAdmin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

async function validateAnyAuth(req: Request) {
  try {
    const jwt = await validateJWT(req);
    return { empresaId: "all", source: "jwt", userId: jwt.userId };
  } catch {
    try {
      const apiKey = await validateApiKey(req);
      return { empresaId: apiKey.empresaId, source: "api_key", userId: undefined };
    } catch {
      throw new AuthError("Autenticação inválida", 401);
    }
  }
}

function formatDateBr(d: string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

function parseDate(d: string | undefined): string | null {
  if (!d) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
    const [dd, mm, yyyy] = d.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return null;
}

function diffDays(vencimento: string, ref: Date): number {
  const v = new Date(vencimento);
  if (isNaN(v.getTime())) return 0;
  return Math.floor((ref.getTime() - v.getTime()) / 86400000);
}

// ─── /resumo ───
async function handleResumo(req: Request, startMs: number) {
  const body = await req.json().catch(() => ({}));
  const dDia = body.dDia || formatDateBr(new Date().toISOString());
  const lApenasResumo = body.lApenasResumo ?? false;
  const lExibirCategoria = body.lExibirCategoria ?? false;

  const db = supabaseAdmin();
  const today = new Date();

  // Saldos contas bancárias
  const { data: contas } = await db.from("contas_bancarias").select("saldo_atual, limite_credito");
  const vTotalCC = (contas || []).reduce((s, c) => s + (c.saldo_atual || 0), 0);
  const vLimiteCredito = (contas || []).reduce((s, c) => s + (c.saldo_atual || 0) + (c.limite_credito || 0), 0);

  // CP pendentes
  const { data: cpPend } = await db.from("contas_pagar").select("id, valor_aberto, data_vencimento, codigo_categoria, categoria_nome, fornecedor_nome, fornecedor_codigo").in("status", ["pendente", "vencido"]);
  const cpList = cpPend || [];
  const cpTotal = cpList.length;
  const cpValor = cpList.reduce((s, t) => s + (t.valor_aberto || 0), 0);
  const cpAtrasados = cpList.filter(t => t.data_vencimento && new Date(t.data_vencimento) < today);
  const cpAtrasoVal = cpAtrasados.reduce((s, t) => s + (t.valor_aberto || 0), 0);

  // CR pendentes
  const { data: crPend } = await db.from("contas_receber").select("id, valor_aberto, data_vencimento, codigo_categoria, categoria_nome, cliente_nome, codigo_cliente_fornecedor").in("status", ["pendente", "vencido"]);
  const crList = crPend || [];
  const crTotal = crList.length;
  const crValor = crList.reduce((s, t) => s + (t.valor_aberto || 0), 0);
  const crAtrasados = crList.filter(t => t.data_vencimento && new Date(t.data_vencimento) < today);
  const crAtrasoVal = crAtrasados.reduce((s, t) => s + (t.valor_aberto || 0), 0);

  const result: Record<string, unknown> = {
    dDia,
    contaCorrente: { vTotal: vTotalCC, vLimiteCredito, cIcone: "🏦", cCor: "#3B82F6" },
    contaPagar: { nTotal: cpTotal, vTotal: cpValor, vAtraso: cpAtrasoVal, cIcone: "📤", cCor: "#EF4444" },
    contaReceber: { nTotal: crTotal, vTotal: crValor, vAtraso: crAtrasoVal, cIcone: "📥", cCor: "#22C55E" },
    fluxoCaixa: { dDia, vPagar: cpValor, vReceber: crValor, vSaldo: vTotalCC },
  };

  if (!lApenasResumo) {
    // Títulos atrasados
    result.contaPagarAtraso = cpAtrasados.slice(0, 50).map(t => ({
      nIdTitulo: t.id, nIdCliente: t.fornecedor_codigo || 0, cNomeCliente: t.fornecedor_nome || "",
      vDoc: t.valor_aberto || 0, dVencimento: formatDateBr(t.data_vencimento), dEmissao: "",
      cCodCateg: t.codigo_categoria || "", cDescCateg: t.categoria_nome || "",
      nDiasAtraso: diffDays(t.data_vencimento, today), cIcone: "⚠️", cCor: "#EF4444", cUrlLogoBanco: "",
    }));
    result.contaReceberAtraso = crAtrasados.slice(0, 50).map(t => ({
      nIdTitulo: t.id, nIdCliente: t.codigo_cliente_fornecedor || 0, cNomeCliente: t.cliente_nome || "",
      vDoc: t.valor_aberto || 0, dVencimento: formatDateBr(t.data_vencimento), dEmissao: "",
      cCodCateg: t.codigo_categoria || "", cDescCateg: t.categoria_nome || "",
      nDiasAtraso: diffDays(t.data_vencimento, today), cIcone: "⚠️", cCor: "#F59E0B", cUrlLogoBanco: "",
    }));
  }

  if (lExibirCategoria) {
    const cpByCat = new Map<string, { vTotal: number; nTotal: number; cDescCateg: string }>();
    for (const t of cpList) {
      const key = t.codigo_categoria || "SEM_CATEGORIA";
      const cur = cpByCat.get(key) || { vTotal: 0, nTotal: 0, cDescCateg: t.categoria_nome || key };
      cur.vTotal += t.valor_aberto || 0; cur.nTotal++; cpByCat.set(key, cur);
    }
    result.contaPagarCategoria = [...cpByCat.entries()].map(([k, v]) => ({
      cCodCateg: k, cDescCateg: v.cDescCateg, vTotal: v.vTotal, nTotal: v.nTotal, cIcone: "📁", cCor: "#EF4444",
    }));

    const crByCat = new Map<string, { vTotal: number; nTotal: number; cDescCateg: string }>();
    for (const t of crList) {
      const key = t.codigo_categoria || "SEM_CATEGORIA";
      const cur = crByCat.get(key) || { vTotal: 0, nTotal: 0, cDescCateg: t.categoria_nome || key };
      cur.vTotal += t.valor_aberto || 0; cur.nTotal++; crByCat.set(key, cur);
    }
    result.contaReceberCategoria = [...crByCat.entries()].map(([k, v]) => ({
      cCodCateg: k, cDescCateg: v.cDescCateg, vTotal: v.vTotal, nTotal: v.nTotal, cIcone: "📁", cCor: "#22C55E",
    }));
  }

  return jsonResponse(result, 200, req, { startMs });
}

// ─── /em-aberto ───
async function handleEmAberto(req: Request, startMs: number) {
  const body = await req.json().catch(() => ({}));
  const cTipo = (body.cTipo || "P").toUpperCase();
  const nPagina = Math.max(1, body.nPagina || 1);
  const nRegPorPagina = Math.min(500, Math.max(1, body.nRegPorPagina || 50));
  const nCodCliente = body.nCodCliente;
  const cNomeCliente = body.cNomeCliente;
  const today = new Date();

  const db = supabaseAdmin();
  const table = cTipo === "R" ? "contas_receber" : "contas_pagar";
  const nameField = cTipo === "R" ? "cliente_nome" : "fornecedor_nome";
  const codeField = cTipo === "R" ? "codigo_cliente_fornecedor" : "fornecedor_codigo";

  let query = db.from(table).select("*", { count: "exact" }).in("status", ["pendente", "vencido"]).gt("valor_aberto", 0);

  if (nCodCliente) query = query.eq(codeField, nCodCliente);
  if (cNomeCliente) query = query.ilike(nameField, `%${cNomeCliente}%`);

  query = query.order("data_vencimento", { ascending: true })
    .range((nPagina - 1) * nRegPorPagina, nPagina * nRegPorPagina - 1);

  const { data, count } = await query;
  const total = count || 0;

  const ListaEmEberto = (data || []).map(t => ({
    nIdTitulo: t.id,
    nIdCliente: t[codeField] || 0,
    cNomeCliente: t[nameField] || "",
    vDoc: t.valor_aberto || 0,
    dVencimento: formatDateBr(t.data_vencimento),
    dEmissao: formatDateBr(t.data_emissao),
    cCodCateg: t.codigo_categoria || "",
    cDescCateg: t.categoria_nome || "",
    nDiasAtraso: t.data_vencimento ? Math.max(0, diffDays(t.data_vencimento, today)) : 0,
    nQtdeAnexos: 0,
    cIcone: cTipo === "R" ? "📥" : "📤",
    cCor: cTipo === "R" ? "#22C55E" : "#EF4444",
    cUrlLogoBanco: "",
    cBolGerado: t.boleto_gerado ? "S" : "N",
    cBolPodeGerar: "N",
    cPixGerado: "N",
    cPixPodeGerar: "N",
  }));

  return jsonResponse({
    ListaEmEberto,
    nRegistros: ListaEmEberto.length,
    nPagina,
    nTotPaginas: Math.ceil(total / nRegPorPagina),
    nTotRegistros: total,
  }, 200, req, { startMs });
}

// ─── /lista-financas ───
async function handleListaFinancas(req: Request, startMs: number) {
  const body = await req.json().catch(() => ({}));
  const cTipo = (body.cTipo || "P").toUpperCase();
  const cCodCateg = body.cCodCateg;
  const dDia = body.dDia;

  const db = supabaseAdmin();
  const table = cTipo === "R" ? "contas_receber" : "contas_pagar";
  const nameField = cTipo === "R" ? "cliente_nome" : "fornecedor_nome";
  const codeField = cTipo === "R" ? "codigo_cliente_fornecedor" : "fornecedor_codigo";

  let query = db.from(table).select("*").in("status", ["pendente", "vencido", "pago"]).limit(500);

  if (cCodCateg) query = query.eq("codigo_categoria", cCodCateg);
  if (dDia) {
    const parsed = parseDate(dDia);
    if (parsed) query = query.lte("data_vencimento", parsed);
  }

  const { data } = await query;

  const listaDetalhesFinancas = (data || []).map(t => ({
    nIdTitulo: t.id,
    nIdCliente: t[codeField] || 0,
    cNomeCliente: t[nameField] || "",
    vDoc: t.valor_aberto || t.valor_original || 0,
    dVencimento: formatDateBr(t.data_vencimento),
    dEmissao: formatDateBr(t.data_emissao),
    dPrevisao: formatDateBr(t.data_previsao),
    nIdConta: t.id_conta_corrente || 0,
    cNomeConta: "",
    cNumDocumentoFiscal: t.numero_documento_fiscal || "",
    cNumDocumento: t.numero_documento || t.titulo_numero || "",
  }));

  return jsonResponse({ listaDetalhesFinancas }, 200, req, { startMs });
}

// ─── /detalhes ───
async function handleDetalhes(req: Request, startMs: number) {
  const body = await req.json().catch(() => ({}));
  const nIdTitulo = body.nIdTitulo;
  if (!nIdTitulo) return errorResponse(400, "MISSING_PARAM", "nIdTitulo obrigatório", req, startMs);

  const db = supabaseAdmin();
  const today = new Date();

  // Try CR first, then CP
  let titulo: Record<string, unknown> | null = null;
  let cTipoLanc = "";

  const { data: cr } = await db.from("contas_receber").select("*").eq("id", nIdTitulo).maybeSingle();
  if (cr) { titulo = cr; cTipoLanc = "R"; }
  else {
    const { data: cp } = await db.from("contas_pagar").select("*").eq("id", nIdTitulo).maybeSingle();
    if (cp) { titulo = cp; cTipoLanc = "P"; }
  }

  if (!titulo) return errorResponse(404, "NOT_FOUND", "Título não encontrado", req, startMs);

  const nameField = cTipoLanc === "R" ? "cliente_nome" : "fornecedor_nome";
  const codeField = cTipoLanc === "R" ? "codigo_cliente_fornecedor" : "fornecedor_codigo";

  // Boleto info
  let boletoInfo = null;
  if (cTipoLanc === "R") {
    const { data: boleto } = await db.from("boletos").select("*").eq("conta_receber_id", nIdTitulo).maybeSingle();
    if (boleto) {
      boletoInfo = {
        cNumBoleto: boleto.numero_boleto || "",
        cNumBancario: boleto.numero_bancario || "",
        cCodBarras: boleto.codigo_barras || "",
        cLinkBoleto: boleto.link_boleto || "",
        dEmissao: formatDateBr(boleto.data_emissao),
        dVencimento: formatDateBr(boleto.data_vencimento),
        nPerJuros: boleto.per_juros || 0,
        nPerMulta: boleto.per_multa || 0,
      };
    }
  }

  // Anexos
  const { data: anexos } = await db.from("anexos").select("*").eq("tabela", cTipoLanc === "R" ? "contas_receber" : "contas_pagar").eq("registro_id", nIdTitulo).limit(50);

  const listaAnexos = (anexos || []).map(a => ({
    nIdAnexo: a.id,
    cCodIntAnexo: a.codigo_integracao || "",
    cNomeArquivo: a.nome_arquivo || "",
    cTipoArquivo: a.tipo_arquivo || "",
    cTabela: a.tabela || "",
  }));

  const diasAtraso = titulo.data_vencimento ? Math.max(0, diffDays(titulo.data_vencimento as string, today)) : 0;

  const situacao = (titulo.status as string) === "pago" ? "Liquidado"
    : diasAtraso > 0 ? "Vencido" : "A vencer";

  return jsonResponse({
    cTipoLanc,
    nIdTitulo: titulo.id,
    nIdCliente: titulo[codeField] || 0,
    cNomeCliente: titulo[nameField] || "",
    cCodCateg: titulo.codigo_categoria || "",
    cDescCateg: titulo.categoria_nome || "",
    cDescCtaCorr: "",
    dEmissao: formatDateBr(titulo.data_emissao as string),
    dVencimento: formatDateBr(titulo.data_vencimento as string),
    dPrevisao: formatDateBr(titulo.data_previsao as string),
    nDiasAtraso: diasAtraso,
    vDoc: titulo.valor_aberto || titulo.valor_original || titulo.valor_documento || 0,
    cUrlLogoBanco: "",
    cSituacao: situacao,
    cCor: situacao === "Liquidado" ? "#22C55E" : situacao === "Vencido" ? "#EF4444" : "#3B82F6",
    cIcone: cTipoLanc === "R" ? "📥" : "📤",
    nQtdeAnexos: listaAnexos.length,
    listaAnexos,
    cBolGerado: boletoInfo ? "S" : "N",
    cBolPodeGerar: "N",
    boletoInfo,
    cPixGerado: "N",
    cPixPodeGerar: "N",
    pixInfo: null,
  }, 200, req, { startMs });
}

// ─── Main ───
Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startMs = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/resumo-financeiro-api\/?/, "/").replace(/\/+$/, "") || "/";

  try {
    const auth = await validateAnyAuth(req);
    await checkRateLimit({ prefix: "resumo-fin", limit: 60, req, userId: auth.userId });

    if (req.method === "GET" && (path === "/status" || path === "/")) {
      return jsonResponse({ status: "online", service: "resumo-financeiro-api" }, 200, req, { startMs });
    }

    if (req.method === "POST") {
      if (path === "/resumo") return await handleResumo(req, startMs);
      if (path === "/em-aberto") return await handleEmAberto(req, startMs);
      if (path === "/lista-financas") return await handleListaFinancas(req, startMs);
      if (path === "/detalhes") return await handleDetalhes(req, startMs);
    }

    return errorResponse(404, "NOT_FOUND", `Rota ${req.method} ${path} não encontrada`, req, startMs);
  } catch (err) {
    if (err instanceof AuthError) return errorResponse(err.status, "AUTH_ERROR", err.message, req, startMs);
    if (err instanceof RateLimitError) return errorResponse(429, "RATE_LIMIT", err.message, req, startMs);
    console.error("resumo-financeiro-api error:", err);
    return errorResponse(500, "INTERNAL_ERROR", "Erro interno do servidor", req, startMs);
  }
});
