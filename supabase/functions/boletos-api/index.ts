// boletos-api/index.ts — API de Boletos (Cobrança Bancária) padrão Huggs
import { createClient } from "npm:@supabase/supabase-js@2";
import { validateAnyAuth, AuthError } from "../_shared/auth.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { handleCors } from "../_shared/cors.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { z, validateBody, ValidationError } from "../_shared/validate.ts";
import { wafCheck, wafBlockResponse } from "../_shared/waf.ts";

// === Zod Schemas ===
const GerarSchema = z.object({
  nCodTitulo: z.number().optional(),
  cCodIntTitulo: z.string().max(100).optional(),
  codigo_barras: z.string().max(60).optional(),
  numero_bancario: z.string().max(30).optional(),
  nPerJuros: z.number().min(0).max(100).optional(),
  nPerMulta: z.number().min(0).max(100).optional(),
  dDescontoCond1: z.string().max(10).optional(),
  vDescontoCond1: z.number().min(0).optional(),
  dDescontoCond2: z.string().max(10).optional(),
  vDescontoCond2: z.number().min(0).optional(),
  dDescontoCond3: z.string().max(10).optional(),
  vDescontoCond3: z.number().min(0).optional(),
}).refine(d => d.nCodTitulo || d.cCodIntTitulo, { message: "nCodTitulo ou cCodIntTitulo obrigatório" });

const CancelarSchema = z.object({
  nCodTitulo: z.number().optional(),
  cCodIntTitulo: z.string().max(100).optional(),
}).refine(d => d.nCodTitulo || d.cCodIntTitulo, { message: "nCodTitulo ou cCodIntTitulo obrigatório" });

const ProrrogarSchema = z.object({
  nCodTitulo: z.number().optional(),
  cCodIntTitulo: z.string().max(100).optional(),
  dDtVenc: z.string().min(1, "dDtVenc obrigatório").max(10),
}).refine(d => d.nCodTitulo || d.cCodIntTitulo, { message: "nCodTitulo ou cCodIntTitulo obrigatório" });

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function authenticate(req: Request) {
  const auth = await validateAnyAuth(req);
  return { empresaId: auth.empresaId || null, userId: auth.userId, source: auth.source };
}

// === ROUTE HANDLERS ===

async function handleGerar(req: Request, auth: any): Promise<Response> {
  const startMs = Date.now();
  const rawBody = await req.json();
  const body = validateBody(rawBody, GerarSchema);

  const supabase = getSupabase();

  // Find the contas_receber record
  let query = supabase.from("contas_receber").select("id, empresa_id, valor_original, data_vencimento, codigo_lancamento_huggs, codigo_lancamento_integracao");
  if (nCodTitulo) query = query.eq("codigo_lancamento_huggs", nCodTitulo);
  else query = query.eq("codigo_lancamento_integracao", cCodIntTitulo);

  const { data: titulo, error: tituloError } = await query.maybeSingle();
  if (tituloError || !titulo) {
    return errorResponse(404, "NOT-001", "Título não encontrado", req, startMs);
  }

  // Generate boleto data
  const boletoData = {
    empresa_id: titulo.empresa_id || auth.empresaId || "0",
    conta_receber_id: titulo.id,
    n_cod_titulo: titulo.codigo_lancamento_huggs || nCodTitulo,
    c_cod_int_titulo: titulo.codigo_lancamento_integracao || cCodIntTitulo,
    data_emissao: new Date().toISOString().split("T")[0],
    numero_boleto: `BOL-${Date.now()}`,
    codigo_barras: body.codigo_barras || null,
    numero_bancario: body.numero_bancario || null,
    per_juros: body.nPerJuros || 0,
    per_multa: body.nPerMulta || 0,
    desconto_cond1_data: body.dDescontoCond1 || null,
    desconto_cond1_valor: body.vDescontoCond1 || null,
    desconto_cond2_data: body.dDescontoCond2 || null,
    desconto_cond2_valor: body.vDescontoCond2 || null,
    desconto_cond3_data: body.dDescontoCond3 || null,
    desconto_cond3_valor: body.vDescontoCond3 || null,
    status: "gerado",
    data_vencimento: titulo.data_vencimento,
    link_boleto: `https://boleto.exemplo.com/${Date.now()}`,
    importado_api: true,
  };

  const { data: boleto, error } = await supabase.from("boletos").insert(boletoData).select().single();
  if (error) {
    return errorResponse(500, "DB-001", `Erro ao gerar boleto: ${error.message}`, req, startMs);
  }

  // Update contas_receber boleto fields
  await supabase.from("contas_receber").update({
    boleto_gerado: true,
    boleto_data_emissao: boletoData.data_emissao,
    boleto_numero: boletoData.numero_boleto,
    boleto_numero_bancario: boletoData.numero_bancario,
    boleto_per_juros: boletoData.per_juros,
    boleto_per_multa: boletoData.per_multa,
  }).eq("id", titulo.id);

  return jsonResponse({
    cLinkBoleto: boleto.link_boleto,
    cCodStatus: "0",
    cDesStatus: "Boleto gerado com sucesso!",
    dDtEmBol: boleto.data_emissao,
    cNumBoleto: boleto.numero_boleto,
    cCodBarras: boleto.codigo_barras,
    nPerJuros: boleto.per_juros,
    nPerMulta: boleto.per_multa,
    cNumBancario: boleto.numero_bancario,
    dDescontoCond1: boleto.desconto_cond1_data,
    vDescontoCond1: boleto.desconto_cond1_valor,
    dDescontoCond2: boleto.desconto_cond2_data,
    vDescontoCond2: boleto.desconto_cond2_valor,
    dDescontoCond3: boleto.desconto_cond3_data,
    vDescontoCond3: boleto.desconto_cond3_valor,
  }, 201, req, { startMs });
}

async function handleObter(req: Request, _auth: any): Promise<Response> {
  const startMs = Date.now();
  const url = new URL(req.url);
  const nCodTitulo = url.searchParams.get("nCodTitulo");
  const cCodIntTitulo = url.searchParams.get("cCodIntTitulo");
  const id = url.searchParams.get("id");

  if (!nCodTitulo && !cCodIntTitulo && !id) {
    return errorResponse(400, "VAL-001", "nCodTitulo, cCodIntTitulo ou id obrigatório", req, startMs);
  }

  const supabase = getSupabase();
  let query = supabase.from("boletos").select("*").eq("status", "gerado").order("created_at", { ascending: false });
  if (id) query = query.eq("id", id);
  else if (nCodTitulo) query = query.eq("n_cod_titulo", parseInt(nCodTitulo));
  else query = query.eq("c_cod_int_titulo", cCodIntTitulo);

  const { data: boleto, error } = await query.maybeSingle();
  if (error || !boleto) {
    return errorResponse(404, "NOT-001", "Boleto não encontrado", req, startMs);
  }

  return jsonResponse({
    cLinkBoleto: boleto.link_boleto,
    cCodStatus: "0",
    cDesStatus: "Boleto localizado com sucesso!",
    dDtEmBol: boleto.data_emissao,
    cNumBoleto: boleto.numero_boleto,
    cCodBarras: boleto.codigo_barras,
    nPerJuros: boleto.per_juros,
    nPerMulta: boleto.per_multa,
    cNumBancario: boleto.numero_bancario,
    dDescontoCond1: boleto.desconto_cond1_data,
    vDescontoCond1: boleto.desconto_cond1_valor,
    dDescontoCond2: boleto.desconto_cond2_data,
    vDescontoCond2: boleto.desconto_cond2_valor,
    dDescontoCond3: boleto.desconto_cond3_data,
    vDescontoCond3: boleto.desconto_cond3_valor,
  }, 200, req, { startMs });
}

async function handleCancelar(req: Request, _auth: any): Promise<Response> {
  const startMs = Date.now();
  const rawBody = await req.json();
  const body = validateBody(rawBody, CancelarSchema);

  const supabase = getSupabase();
  let query = supabase.from("boletos").update({ status: "cancelado" }).eq("status", "gerado");
  if (nCodTitulo) query = query.eq("n_cod_titulo", nCodTitulo);
  else query = query.eq("c_cod_int_titulo", cCodIntTitulo);

  const { data, error } = await query.select().maybeSingle();
  if (error || !data) {
    return errorResponse(404, "NOT-001", "Boleto ativo não encontrado para cancelamento", req, startMs);
  }

  // Update contas_receber
  if (data.conta_receber_id) {
    await supabase.from("contas_receber").update({ boleto_gerado: false }).eq("id", data.conta_receber_id);
  }

  return jsonResponse({
    cCodStatus: "0",
    cDesStatus: "Boleto cancelado com sucesso!",
  }, 200, req, { startMs });
}

async function handleProrrogar(req: Request, _auth: any): Promise<Response> {
  const startMs = Date.now();
  const rawBody = await req.json();
  const body = validateBody(rawBody, ProrrogarSchema);
  const { nCodTitulo, cCodIntTitulo, dDtVenc } = body;

  // Parse date dd/mm/yyyy to yyyy-mm-dd
  let dataVenc = dDtVenc;
  if (dDtVenc.includes("/")) {
    const parts = dDtVenc.split("/");
    dataVenc = `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  const supabase = getSupabase();
  let query = supabase.from("boletos").update({ data_vencimento: dataVenc, status: "prorrogado" }).eq("status", "gerado");
  if (nCodTitulo) query = query.eq("n_cod_titulo", nCodTitulo);
  else query = query.eq("c_cod_int_titulo", cCodIntTitulo);

  const { data: boleto, error } = await query.select().maybeSingle();
  if (error || !boleto) {
    return errorResponse(404, "NOT-001", "Boleto ativo não encontrado para prorrogação", req, startMs);
  }

  return jsonResponse({
    cLinkBoleto: boleto.link_boleto,
    cCodStatus: "0",
    cDesStatus: "Boleto prorrogado com sucesso!",
    dDtEmBol: boleto.data_emissao,
    cNumBoleto: boleto.numero_boleto,
    cCodBarras: boleto.codigo_barras,
    nPerJuros: boleto.per_juros,
    nPerMulta: boleto.per_multa,
    cNumBancario: boleto.numero_bancario,
    dDescontoCond1: boleto.desconto_cond1_data,
    vDescontoCond1: boleto.desconto_cond1_valor,
    dDescontoCond2: boleto.desconto_cond2_data,
    vDescontoCond2: boleto.desconto_cond2_valor,
    dDescontoCond3: boleto.desconto_cond3_data,
    vDescontoCond3: boleto.desconto_cond3_valor,
  }, 200, req, { startMs });
}

async function handleListar(req: Request, auth: any): Promise<Response> {
  const startMs = Date.now();
  const url = new URL(req.url);
  const pagina = parseInt(url.searchParams.get("pagina") || "1");
  const registros = Math.min(parseInt(url.searchParams.get("registros_por_pagina") || "20"), 500);
  const status = url.searchParams.get("status");
  const offset = (pagina - 1) * registros;

  const supabase = getSupabase();
  let query = supabase.from("boletos").select("*", { count: "exact" });
  if (auth.empresaId) query = query.eq("empresa_id", auth.empresaId);
  if (status) query = query.eq("status", status);
  query = query.order("created_at", { ascending: false }).range(offset, offset + registros - 1);

  const { data, count, error } = await query;
  if (error) {
    return errorResponse(500, "DB-001", error.message, req, startMs);
  }

  const totalPaginas = Math.ceil((count || 0) / registros);

  return jsonResponse({
    pagina,
    total_de_paginas: totalPaginas,
    registros: data?.length || 0,
    total_de_registros: count || 0,
    boletos: data || [],
  }, 200, req, { startMs });
}

function handleStatus(req: Request): Response {
  return jsonResponse({
    status: "ok",
    service: "boletos-api",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  }, 200, req);
}

// === MAIN HANDLER ===

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  // WAF L7 check
  const waf = await wafCheck(req);
  if (!waf.allowed) return wafBlockResponse(waf, { "Access-Control-Allow-Origin": "*" });

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const route = pathParts[pathParts.length - 1] || "";

  // Health check without auth
  if (route === "status" && req.method === "GET") {
    return handleStatus(req);
  }

  try {
    const auth = await authenticate(req);
    await checkRateLimit({ prefix: "boletos", limit: 60, req, userId: auth.userId });

    switch (route) {
      case "gerar":
        if (req.method !== "POST") return errorResponse(405, "MTD-001", "Use POST", req);
        return await handleGerar(req, auth);

      case "obter":
        if (req.method !== "GET") return errorResponse(405, "MTD-001", "Use GET", req);
        return await handleObter(req, auth);

      case "cancelar":
        if (req.method !== "POST") return errorResponse(405, "MTD-001", "Use POST", req);
        return await handleCancelar(req, auth);

      case "prorrogar":
        if (req.method !== "POST") return errorResponse(405, "MTD-001", "Use POST", req);
        return await handleProrrogar(req, auth);

      case "listar":
        if (req.method !== "GET") return errorResponse(405, "MTD-001", "Use GET", req);
        return await handleListar(req, auth);

      default:
        return errorResponse(404, "NOT-001", `Rota não encontrada: /${route}. Rotas: /gerar, /obter, /cancelar, /prorrogar, /listar, /status`, req);
    }
  } catch (err) {
    if (err instanceof ValidationError) {
      return errorResponse(400, "VAL-001", err.message, req);
    }
    if (err instanceof RateLimitError) {
      return errorResponse(429, "RATE_LIMIT", err.message, req);
    }
    if (err instanceof AuthError) {
      return errorResponse(err.status, "AUTH-001", err.message, req);
    }
    console.error("❌ boletos-api error:", err);
    return errorResponse(500, "SRV-001", "Erro interno do servidor", req);
  }
});
