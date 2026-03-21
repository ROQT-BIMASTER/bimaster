// supabase/functions/clientes-api/index.ts — CRUD Clientes (Omie)
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { validateApiKey } from "../_shared/auth.ts";

// ── Mapping helpers ──────────────────────────────────────────────

function isPessoaFisica(cnpj: string | null): string {
  if (!cnpj) return "";
  const digits = cnpj.replace(/\D/g, "");
  return digits.length <= 11 ? "S" : "N";
}

function mapRowToOmie(row: Record<string, unknown>): Record<string, unknown> {
  return {
    codigo_cliente_omie: row.id || "",
    codigo_cliente_integracao: row.codigo || "",
    razao_social: row.nome || "",
    nome_fantasia: row.nome_abreviado || "",
    cnpj_cpf: row.cnpj || "",
    email: row.email || "",
    telefone1_ddd: "",
    telefone1_numero: row.telefone || "",
    celular: row.celular || "",
    contato: row.comprador || "",
    endereco: row.endereco || "",
    endereco_numero: "",
    bairro: row.bairro || "",
    complemento: "",
    estado: row.uf || "",
    cidade: row.cidade || "",
    cep: row.cep || "",
    codigo_pais: "",
    telefone2_ddd: "",
    telefone2_numero: "",
    fax_ddd: "",
    fax_numero: row.fax || "",
    homepage: "",
    inscricao_estadual: row.inscricao_estadual || "",
    inscricao_municipal: "",
    inscricao_suframa: "",
    optante_simples_nacional: "",
    tipo_atividade: "",
    cnae: "",
    produtor_rural: "",
    contribuinte: "",
    observacao: row.observacoes || "",
    pessoa_fisica: isPessoaFisica(row.cnpj as string | null),
    inativo: row.status_bloqueio === "INATIVO" ? "S" : "N",
    bloquear_faturamento: row.status_bloqueio === "BLOQUEADO" ? "S" : "N",
    valor_limite_credito: row.limite_credito ?? 0,
    importado_api: "S",
    tags: [],
    recomendacoes: {},
    enderecoEntrega: {},
    dadosBancarios: {},
    informacoes: {
      dInc: row.created_at ? String(row.created_at).substring(0, 10) : "",
      hInc: row.created_at ? String(row.created_at).substring(11, 19) : "",
      dAlt: row.updated_at ? String(row.updated_at).substring(0, 10) : "",
      hAlt: row.updated_at ? String(row.updated_at).substring(11, 19) : "",
      cImpAPI: "S",
    },
  };
}

function mapRowToResumido(row: Record<string, unknown>): Record<string, unknown> {
  return {
    codigo_cliente: row.id || "",
    codigo_cliente_integracao: row.codigo || "",
    razao_social: row.nome || "",
    nome_fantasia: row.nome_abreviado || "",
    cnpj_cpf: row.cnpj || "",
  };
}

function mapOmieToDb(body: Record<string, unknown>): Record<string, unknown> {
  const db: Record<string, unknown> = {};
  if (body.razao_social !== undefined) db.nome = body.razao_social;
  if (body.nome_fantasia !== undefined) db.nome_abreviado = body.nome_fantasia;
  if (body.cnpj_cpf !== undefined) db.cnpj = body.cnpj_cpf;
  if (body.email !== undefined) db.email = body.email;
  if (body.telefone1_numero !== undefined) db.telefone = body.telefone1_numero;
  if (body.celular !== undefined) db.celular = body.celular;
  if (body.contato !== undefined) db.comprador = body.contato;
  if (body.endereco !== undefined) db.endereco = body.endereco;
  if (body.bairro !== undefined) db.bairro = body.bairro;
  if (body.cidade !== undefined) db.cidade = body.cidade;
  if (body.estado !== undefined) db.uf = body.estado;
  if (body.cep !== undefined) db.cep = body.cep;
  if (body.inscricao_estadual !== undefined) db.inscricao_estadual = body.inscricao_estadual;
  if (body.observacao !== undefined) db.observacoes = body.observacao;
  if (body.valor_limite_credito !== undefined) db.limite_credito = body.valor_limite_credito;
  if (body.fax_numero !== undefined) db.fax = body.fax_numero;
  if (body.codigo_cliente_integracao !== undefined) db.codigo = body.codigo_cliente_integracao;
  return db;
}

function statusResponse(id: string, codigo: string, status: string, msg: string) {
  return {
    codigo_cliente_omie: id,
    codigo_cliente_integracao: codigo,
    codigo_status: status,
    descricao_status: msg,
  };
}

// ── Main handler ─────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startMs = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/clientes-api\/?/, "/").replace(/\/+$/, "") || "/";

  try {
    // Health check
    if (req.method === "GET" && path === "/status") {
      return jsonResponse({
        status: "ok",
        function: "clientes-api",
        routes: ["/incluir", "/alterar", "/consultar", "/excluir", "/listar", "/listar-resumido", "/upsert", "/upsert-cpfcnpj", "/associar", "/status"],
      }, 200, req, { startMs });
    }

    // Auth
    await validateApiKey(req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── POST /incluir ────────────────────────────────────────────
    if (req.method === "POST" && path === "/incluir") {
      const body = await req.json();
      if (!body.codigo_cliente_integracao || !body.razao_social) {
        return errorResponse(400, "VALIDATION_ERROR", "codigo_cliente_integracao e razao_social são obrigatórios", req, startMs);
      }

      const dbData = mapOmieToDb(body);
      dbData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("clientes")
        .insert(dbData)
        .select("id, codigo")
        .single();

      if (error) {
        if (error.code === "23505") {
          return errorResponse(409, "DUPLICATE", `Cliente com código '${body.codigo_cliente_integracao}' já existe`, req, startMs);
        }
        return errorResponse(500, "DB_ERROR", error.message, req, startMs);
      }

      return jsonResponse(statusResponse(data.id, data.codigo, "0", "Cliente incluído com sucesso!"), 201, req, { startMs });
    }

    // ── POST /alterar ────────────────────────────────────────────
    if (req.method === "POST" && path === "/alterar") {
      const body = await req.json();
      const { codigo_cliente_integracao, codigo_cliente_omie } = body;
      if (!codigo_cliente_integracao && !codigo_cliente_omie) {
        return errorResponse(400, "VALIDATION_ERROR", "codigo_cliente_integracao ou codigo_cliente_omie obrigatório", req, startMs);
      }

      const dbData = mapOmieToDb(body);
      delete dbData.codigo; // Don't update the key
      dbData.updated_at = new Date().toISOString();

      let query = supabase.from("clientes").update(dbData);
      if (codigo_cliente_integracao) query = query.eq("codigo", codigo_cliente_integracao);
      else query = query.eq("id", codigo_cliente_omie);

      const { data, error } = await query.select("id, codigo").single();

      if (error) return errorResponse(error.code === "PGRST116" ? 404 : 500, error.code === "PGRST116" ? "NOT_FOUND" : "DB_ERROR", error.code === "PGRST116" ? "Cliente não encontrado" : error.message, req, startMs);

      return jsonResponse(statusResponse(data.id, data.codigo, "0", "Cliente alterado com sucesso!"), 200, req, { startMs });
    }

    // ── POST /consultar ──────────────────────────────────────────
    if (req.method === "POST" && path === "/consultar") {
      const body = await req.json().catch(() => ({}));
      const { codigo_cliente_integracao, codigo_cliente_omie } = body;
      if (!codigo_cliente_integracao && !codigo_cliente_omie) {
        return errorResponse(400, "VALIDATION_ERROR", "codigo_cliente_integracao ou codigo_cliente_omie obrigatório", req, startMs);
      }

      let query = supabase.from("clientes").select("*");
      if (codigo_cliente_integracao) query = query.eq("codigo", codigo_cliente_integracao);
      else query = query.eq("id", codigo_cliente_omie);

      const { data, error } = await query.single();
      if (error) return errorResponse(error.code === "PGRST116" ? 404 : 500, error.code === "PGRST116" ? "NOT_FOUND" : "DB_ERROR", error.code === "PGRST116" ? "Cliente não encontrado" : error.message, req, startMs);

      return jsonResponse({ clientes_cadastro: mapRowToOmie(data) }, 200, req, { startMs });
    }

    // ── POST /excluir ────────────────────────────────────────────
    if (req.method === "POST" && path === "/excluir") {
      const body = await req.json().catch(() => ({}));
      const { codigo_cliente_integracao, codigo_cliente_omie } = body;
      if (!codigo_cliente_integracao && !codigo_cliente_omie) {
        return errorResponse(400, "VALIDATION_ERROR", "codigo_cliente_integracao ou codigo_cliente_omie obrigatório", req, startMs);
      }

      let query = supabase.from("clientes").update({ status_bloqueio: "INATIVO", updated_at: new Date().toISOString() });
      if (codigo_cliente_integracao) query = query.eq("codigo", codigo_cliente_integracao);
      else query = query.eq("id", codigo_cliente_omie);

      const { data, error } = await query.select("id, codigo").single();
      if (error) return errorResponse(error.code === "PGRST116" ? 404 : 500, error.code === "PGRST116" ? "NOT_FOUND" : "DB_ERROR", error.code === "PGRST116" ? "Cliente não encontrado" : error.message, req, startMs);

      return jsonResponse(statusResponse(data.id, data.codigo, "0", "Cliente excluído com sucesso!"), 200, req, { startMs });
    }

    // ── POST /listar ─────────────────────────────────────────────
    if (req.method === "POST" && (path === "/listar" || path === "/")) {
      const body = await req.json().catch(() => ({}));
      const pagina = Math.max(1, parseInt(body.pagina || "1"));
      const regPorPag = Math.min(500, Math.max(1, parseInt(body.registros_por_pagina || "50")));
      const from = (pagina - 1) * regPorPag;
      const to = from + regPorPag - 1;

      let query = supabase.from("clientes").select("*", { count: "exact" }).order("nome", { ascending: true }).range(from, to);

      // Filters
      const filtro = body.clientesFiltro || {};
      if (filtro.cnpj_cpf) query = query.ilike("cnpj", `%${filtro.cnpj_cpf}%`);
      if (filtro.razao_social) query = query.ilike("nome", `%${filtro.razao_social}%`);
      if (filtro.nome_fantasia) query = query.ilike("nome_abreviado", `%${filtro.nome_fantasia}%`);
      if (filtro.cidade) query = query.ilike("cidade", `%${filtro.cidade}%`);
      if (filtro.estado) query = query.eq("uf", filtro.estado);
      if (filtro.email) query = query.ilike("email", `%${filtro.email}%`);
      if (filtro.inativo === "S") query = query.eq("status_bloqueio", "INATIVO");
      else if (filtro.inativo === "N") query = query.or("status_bloqueio.is.null,status_bloqueio.neq.INATIVO");

      if (body.filtrar_por_data_de) query = query.gte("updated_at", body.filtrar_por_data_de);
      if (body.filtrar_por_data_ate) query = query.lte("updated_at", body.filtrar_por_data_ate);

      const { data, error, count } = await query;
      if (error) return errorResponse(500, "DB_ERROR", error.message, req, startMs);

      const total = count || 0;
      return jsonResponse({
        pagina,
        total_de_paginas: Math.ceil(total / regPorPag),
        registros: data?.length || 0,
        total_de_registros: total,
        clientes_cadastro: (data || []).map(mapRowToOmie),
      }, 200, req, { startMs });
    }

    // ── POST /listar-resumido ────────────────────────────────────
    if (req.method === "POST" && path === "/listar-resumido") {
      const body = await req.json().catch(() => ({}));
      const pagina = Math.max(1, parseInt(body.pagina || "1"));
      const regPorPag = Math.min(500, Math.max(1, parseInt(body.registros_por_pagina || "50")));
      const from = (pagina - 1) * regPorPag;
      const to = from + regPorPag - 1;

      let query = supabase.from("clientes").select("id, codigo, nome, nome_abreviado, cnpj", { count: "exact" }).order("nome", { ascending: true }).range(from, to);

      const filtro = body.clientesFiltro || {};
      if (filtro.cnpj_cpf) query = query.ilike("cnpj", `%${filtro.cnpj_cpf}%`);
      if (filtro.razao_social) query = query.ilike("nome", `%${filtro.razao_social}%`);

      const { data, error, count } = await query;
      if (error) return errorResponse(500, "DB_ERROR", error.message, req, startMs);

      const total = count || 0;
      return jsonResponse({
        pagina,
        total_de_paginas: Math.ceil(total / regPorPag),
        registros: data?.length || 0,
        total_de_registros: total,
        clientes_cadastro_resumido: (data || []).map(mapRowToResumido),
      }, 200, req, { startMs });
    }

    // ── POST /upsert ─────────────────────────────────────────────
    if (req.method === "POST" && path === "/upsert") {
      const body = await req.json();
      if (!body.codigo_cliente_integracao || !body.razao_social) {
        return errorResponse(400, "VALIDATION_ERROR", "codigo_cliente_integracao e razao_social são obrigatórios", req, startMs);
      }

      const dbData = mapOmieToDb(body);
      dbData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("clientes")
        .upsert(dbData, { onConflict: "codigo" })
        .select("id, codigo")
        .single();

      if (error) return errorResponse(500, "DB_ERROR", error.message, req, startMs);

      return jsonResponse(statusResponse(data.id, data.codigo, "0", "Cliente processado com sucesso (upsert)!"), 200, req, { startMs });
    }

    // ── POST /upsert-cpfcnpj ─────────────────────────────────────
    if (req.method === "POST" && path === "/upsert-cpfcnpj") {
      const body = await req.json();
      if (!body.cnpj_cpf || !body.razao_social) {
        return errorResponse(400, "VALIDATION_ERROR", "cnpj_cpf e razao_social são obrigatórios", req, startMs);
      }

      const dbData = mapOmieToDb(body);
      dbData.updated_at = new Date().toISOString();

      // Check if exists by cnpj
      const { data: existing } = await supabase
        .from("clientes")
        .select("id, codigo")
        .eq("cnpj", body.cnpj_cpf)
        .maybeSingle();

      let result;
      if (existing) {
        const { data, error } = await supabase
          .from("clientes")
          .update(dbData)
          .eq("id", existing.id)
          .select("id, codigo")
          .single();
        if (error) return errorResponse(500, "DB_ERROR", error.message, req, startMs);
        result = data;
      } else {
        if (!dbData.codigo) dbData.codigo = body.cnpj_cpf.replace(/\D/g, "");
        const { data, error } = await supabase
          .from("clientes")
          .insert(dbData)
          .select("id, codigo")
          .single();
        if (error) return errorResponse(500, "DB_ERROR", error.message, req, startMs);
        result = data;
      }

      return jsonResponse(statusResponse(result.id, result.codigo, "0", "Cliente processado com sucesso (upsert por CPF/CNPJ)!"), 200, req, { startMs });
    }

    // ── POST /associar ───────────────────────────────────────────
    if (req.method === "POST" && path === "/associar") {
      const body = await req.json();
      if (!body.codigo_cliente_omie || body.codigo_cliente_integracao === undefined) {
        return errorResponse(400, "VALIDATION_ERROR", "codigo_cliente_omie e codigo_cliente_integracao são obrigatórios", req, startMs);
      }

      const { data, error } = await supabase
        .from("clientes")
        .update({ codigo: body.codigo_cliente_integracao, updated_at: new Date().toISOString() })
        .eq("id", body.codigo_cliente_omie)
        .select("id, codigo")
        .single();

      if (error) return errorResponse(error.code === "PGRST116" ? 404 : 500, error.code === "PGRST116" ? "NOT_FOUND" : "DB_ERROR", error.code === "PGRST116" ? "Cliente não encontrado" : error.message, req, startMs);

      return jsonResponse(statusResponse(data.id, data.codigo, "0", "Código de integração associado com sucesso!"), 200, req, { startMs });
    }

    return errorResponse(404, "NOT_FOUND", `Rota não encontrada: ${req.method} ${path}`, req, startMs);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e.status === 401 || e.status === 403) {
      return errorResponse(e.status, "AUTH_ERROR", e.message || "Não autorizado", req, startMs);
    }
    console.error("❌ clientes-api error:", e);
    return errorResponse(500, "INTERNAL_ERROR", e.message || "Erro interno", req, startMs);
  }
});
