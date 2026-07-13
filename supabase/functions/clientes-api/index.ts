// clientes-api
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { validateAnyAuth, callerHasModuleAccess } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { enqueueWebhookEvent } from "../_shared/webhook-enqueue.ts";
import { z, validateBody, ValidationError } from "../_shared/validate.ts";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCallerEmpresaScope, applyEmpresaFilter, isEmptyScope, type EmpresaScope } from "../_shared/empresa-scope.ts";

// === Zod Schemas ===
const IncluirClienteSchema = z.object({
  codigo_cliente_integracao: z.string().min(1).max(100),
  razao_social: z.string().min(1).max(255),
  cnpj_cpf: z.string().max(20).optional(),
  nome_fantasia: z.string().max(255).optional(),
  endereco: z.string().max(500).optional(),
  endereco_numero: z.string().max(20).optional(),
  complemento: z.string().max(100).optional(),
  bairro: z.string().max(100).optional(),
  cidade: z.string().max(100).optional(),
  estado: z.string().max(2).optional(),
  cep: z.string().max(10).optional(),
  telefone1_numero: z.string().max(20).optional(),
  email: z.string().email().max(255).optional().or(z.literal("")),
  inscricao_estadual: z.string().max(20).optional(),
  inscricao_municipal: z.string().max(20).optional(),
  pessoa_fisica: z.string().max(1).optional(),
  contribuinte: z.string().max(1).optional(),
  observacao: z.string().max(2000).optional(),
  inativo: z.string().max(1).optional(),
}).strict();

const AlterarClienteSchema = z.object({
  codigo_cliente_integracao: z.string().max(100).optional(),
  codigo_cliente_huggs: z.string().max(100).optional(),
  razao_social: z.string().max(255).optional(),
  nome_fantasia: z.string().max(255).optional(),
  cnpj_cpf: z.string().max(20).optional(),
  endereco: z.string().max(500).optional(),
  endereco_numero: z.string().max(20).optional(),
  complemento: z.string().max(100).optional(),
  bairro: z.string().max(100).optional(),
  cidade: z.string().max(100).optional(),
  estado: z.string().max(2).optional(),
  cep: z.string().max(10).optional(),
  telefone1_numero: z.string().max(20).optional(),
  celular: z.string().max(20).optional(),
  email: z.string().email().max(255).optional().or(z.literal("")),
  inscricao_estadual: z.string().max(20).optional(),
  inscricao_municipal: z.string().max(20).optional(),
  pessoa_fisica: z.string().max(1).optional(),
  contribuinte: z.string().max(1).optional(),
  observacao: z.string().max(2000).optional(),
  valor_limite_credito: z.number().optional(),
  contato: z.string().max(120).optional(),
  fax_numero: z.string().max(20).optional(),
  inativo: z.string().max(1).optional(),
}).strict().refine(d => d.codigo_cliente_integracao || d.codigo_cliente_huggs, {
  message: "codigo_cliente_integracao ou codigo_cliente_huggs obrigatório",
});

// ── Mapping helpers ──────────────────────────────────────────────

function isPessoaFisica(cnpj: string | null): string {
  if (!cnpj) return "";
  const digits = cnpj.replace(/\D/g, "");
  return digits.length <= 11 ? "S" : "N";
}

function mapRowToApi(row: Record<string, unknown>): Record<string, unknown> {
  return {
    codigo_cliente_huggs: row.id || "",
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

function mapApiToDb(body: Record<string, unknown>): Record<string, unknown> {
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
    codigo_cliente_huggs: id,
    codigo_cliente_integracao: codigo,
    codigo_status: status,
    descricao_status: msg,
  };
}

// ── Main handler ─────────────────────────────────────────────────

Deno.serve(secureHandler({ auth: "none", rateLimit: 60, rateLimitPrefix: "clientes-api" }, async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startMs = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/clientes-api\/?/, "/").replace(/\/+$/, "") || "/";

  try {
    // Auth
    const auth = await validateAnyAuth(req);
    await checkRateLimit({ prefix: "clientes", limit: 60, req, userId: auth.userId });

    // Health check
    if (req.method === "GET" && path === "/status") {
      return jsonResponse({
        status: "ok",
        function: "clientes-api",
        routes: ["/incluir", "/alterar", "/consultar", "/excluir", "/listar", "/listar-resumido", "/upsert", "/upsert-cpfcnpj", "/upsert-lote", "/sync", "/sync-ingest", "/bulk-sync", "/sync-status", "/associar", "/caract/incluir", "/caract/alterar", "/caract/consultar", "/caract/excluir", "/caract/excluir-todas", "/tags/incluir", "/tags/listar", "/tags/excluir", "/tags/excluir-todas", "/status"],
      }, 200, req, { startMs });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Portal financial APIs: JWT callers must have financeiro module access;
    // API-key callers are already scoped by empresa upstream.
    if (!(await callerHasModuleAccess(auth.source as any, auth.userId, "financeiro"))) {
      return errorResponse(403, "FORBIDDEN", "Acesso negado: módulo financeiro necessário", req, startMs);
    }

    // Multi-tenant scope: API-key ⇒ single empresa; JWT ⇒ user_empresas ∪ admin bypass.
    // Non-admin JWT users with no empresa vinculada ⇒ 403 (previously any signed-in
    // user could read/edit clientes from every company via /consultar, /listar, etc.).
    const scope: EmpresaScope = await getCallerEmpresaScope(auth);
    if (isEmptyScope(scope)) {
      return errorResponse(403, "SCOPE_FORBIDDEN", "Usuário não possui empresa vinculada", req, startMs);
    }
    // Helper to scope any `clientes` query by empresa_id.
    const scopeClientes = <Q extends { in: (col: string, vals: any[]) => Q }>(q: Q): Q =>
      applyEmpresaFilter(q, scope, "empresa_id");
    // Non-admin API-key/JWT writes must stamp the empresa_id when creating a row.
    const empresaIdForWrite: number | null = scope.isAdmin
      ? null
      : (scope.empresaIds[0] ? Number(scope.empresaIds[0]) : null);

    // ── POST /incluir ────────────────────────────────────────────
    if (req.method === "POST" && path === "/incluir") {
      const body = validateBody(await req.json(), IncluirClienteSchema);

      const dbData = mapApiToDb(body);
      dbData.updated_at = new Date().toISOString();
      // Stamp empresa_id from caller's scope when not admin — prevents caller from
      // silently creating rows in another company by omission.
      if (empresaIdForWrite != null && dbData.empresa_id == null) dbData.empresa_id = empresaIdForWrite;

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

      enqueueWebhookEvent("cliente.criado", { id: data.id, codigo: data.codigo, ...body }, auth.empresaId ? parseInt(auth.empresaId) : undefined);
      return jsonResponse(statusResponse(data.id, data.codigo, "0", "Cliente incluído com sucesso!"), 201, req, { startMs });
    }

    // ── POST /alterar ────────────────────────────────────────────
    if (req.method === "POST" && path === "/alterar") {
      const body = validateBody(await req.json(), AlterarClienteSchema);
      const { codigo_cliente_integracao, codigo_cliente_huggs } = body;

      const dbData = mapApiToDb(body);
      delete dbData.codigo; // Don't update the key
      dbData.updated_at = new Date().toISOString();

      let query = supabase.from("clientes").update(dbData);
      query = scopeClientes(query);
      if (codigo_cliente_integracao) query = query.eq("codigo", codigo_cliente_integracao);
      else query = query.eq("id", codigo_cliente_huggs);

      const { data, error } = await query.select("id, codigo").single();

      if (error) return errorResponse(error.code === "PGRST116" ? 404 : 500, error.code === "PGRST116" ? "NOT_FOUND" : "DB_ERROR", error.code === "PGRST116" ? "Cliente não encontrado" : error.message, req, startMs);

      enqueueWebhookEvent("cliente.alterado", { id: data.id, codigo: data.codigo }, auth.empresaId ? parseInt(auth.empresaId) : undefined);
      return jsonResponse(statusResponse(data.id, data.codigo, "0", "Cliente alterado com sucesso!"), 200, req, { startMs });
    }

    // ── POST /consultar ──────────────────────────────────────────
    if (req.method === "POST" && path === "/consultar") {
      const body = await req.json().catch(() => ({}));
      const { codigo_cliente_integracao, codigo_cliente_huggs } = body;
      if (!codigo_cliente_integracao && !codigo_cliente_huggs) {
        return errorResponse(400, "VALIDATION_ERROR", "codigo_cliente_integracao ou codigo_cliente_huggs obrigatório", req, startMs);
      }

      let query = supabase.from("clientes").select("*");
      query = scopeClientes(query);
      if (codigo_cliente_integracao) query = query.eq("codigo", codigo_cliente_integracao);
      else query = query.eq("id", codigo_cliente_huggs);

      const { data, error } = await query.single();
      if (error) return errorResponse(error.code === "PGRST116" ? 404 : 500, error.code === "PGRST116" ? "NOT_FOUND" : "DB_ERROR", error.code === "PGRST116" ? "Cliente não encontrado" : error.message, req, startMs);

      return jsonResponse({ clientes_cadastro: mapRowToApi(data) }, 200, req, { startMs });
    }

    // ── POST /excluir ────────────────────────────────────────────
    if (req.method === "POST" && path === "/excluir") {
      const body = await req.json().catch(() => ({}));
      const { codigo_cliente_integracao, codigo_cliente_huggs } = body;
      if (!codigo_cliente_integracao && !codigo_cliente_huggs) {
        return errorResponse(400, "VALIDATION_ERROR", "codigo_cliente_integracao ou codigo_cliente_huggs obrigatório", req, startMs);
      }

      let query = supabase.from("clientes").update({ status_bloqueio: "INATIVO", updated_at: new Date().toISOString() });
      query = scopeClientes(query);
      if (codigo_cliente_integracao) query = query.eq("codigo", codigo_cliente_integracao);
      else query = query.eq("id", codigo_cliente_huggs);

      const { data, error } = await query.select("id, codigo").single();
      if (error) return errorResponse(error.code === "PGRST116" ? 404 : 500, error.code === "PGRST116" ? "NOT_FOUND" : "DB_ERROR", error.code === "PGRST116" ? "Cliente não encontrado" : error.message, req, startMs);

      enqueueWebhookEvent("cliente.excluido", { id: data.id, codigo: data.codigo }, auth.empresaId ? parseInt(auth.empresaId) : undefined);
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
      query = scopeClientes(query);

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
        clientes_cadastro: (data || []).map(mapRowToApi),
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
      query = scopeClientes(query);

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

      const dbData = mapApiToDb(body);
      dbData.updated_at = new Date().toISOString();
      if (empresaIdForWrite != null && dbData.empresa_id == null) dbData.empresa_id = empresaIdForWrite;

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

      const dbData = mapApiToDb(body);
      dbData.updated_at = new Date().toISOString();
      if (empresaIdForWrite != null && dbData.empresa_id == null) dbData.empresa_id = empresaIdForWrite;

      // Check if exists by cnpj — scoped to caller's empresa(s).
      let existingQuery = supabase
        .from("clientes")
        .select("id, codigo")
        .eq("cnpj", body.cnpj_cpf);
      existingQuery = scopeClientes(existingQuery);
      const { data: existing } = await existingQuery.maybeSingle();

      let result;
      if (existing) {
        let updQuery = supabase
          .from("clientes")
          .update(dbData)
          .eq("id", existing.id);
        updQuery = scopeClientes(updQuery);
        const { data, error } = await updQuery.select("id, codigo").single();
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
      if (!body.codigo_cliente_huggs || body.codigo_cliente_integracao === undefined) {
        return errorResponse(400, "VALIDATION_ERROR", "codigo_cliente_huggs e codigo_cliente_integracao são obrigatórios", req, startMs);
      }

      let assocQuery = supabase
        .from("clientes")
        .update({ codigo: body.codigo_cliente_integracao, updated_at: new Date().toISOString() })
        .eq("id", body.codigo_cliente_huggs);
      assocQuery = scopeClientes(assocQuery);
      const { data, error } = await assocQuery
        .select("id, codigo")
        .single();

      if (error) return errorResponse(error.code === "PGRST116" ? 404 : 500, error.code === "PGRST116" ? "NOT_FOUND" : "DB_ERROR", error.code === "PGRST116" ? "Cliente não encontrado" : error.message, req, startMs);

      return jsonResponse(statusResponse(data.id, data.codigo, "0", "Código de integração associado com sucesso!"), 200, req, { startMs });
    }

    // ── POST /upsert-lote ────────────────────────────────────────
    if (req.method === "POST" && path === "/upsert-lote") {
      const raw = await req.json();
      const UpsertLoteSchema = z.object({
        lote: z.number().optional().default(1),
        clientes_cadastro: z.array(IncluirClienteSchema).min(1).max(500),
      });
      const body = validateBody(raw, UpsertLoteSchema);

      let processados = 0;
      let erros = 0;
      const detalhesErros: string[] = [];

      for (const cliente of body.clientes_cadastro) {
        try {
          const dbData = mapApiToDb(cliente);
          dbData.updated_at = new Date().toISOString();
          if (empresaIdForWrite != null && dbData.empresa_id == null) dbData.empresa_id = empresaIdForWrite;

          const { error } = await supabase
            .from("clientes")
            .upsert(dbData, { onConflict: "codigo" });

          if (error) {
            erros++;
            detalhesErros.push(`${cliente.codigo_cliente_integracao}: ${error.message}`);
          } else {
            processados++;
          }
        } catch (e: unknown) {
          erros++;
          detalhesErros.push(`${cliente.codigo_cliente_integracao}: ${(e as Error).message}`);
        }
      }

      return jsonResponse({
        lote: body.lote,
        codigo_status: erros === body.clientes_cadastro.length ? "1" : "0",
        descricao_status: `${processados} processado(s), ${erros} erro(s)`,
        processados,
        erros,
        detalhes_erros: detalhesErros.length > 0 ? detalhesErros : undefined,
      }, erros === body.clientes_cadastro.length ? 400 : 200, req, { startMs });
    }

    // ── POST /sync-ingest ────────────────────────────────────────
    // Ingest em massa (substitui pipeline N8N). Limita 5.000/chamada.
    // Reaproveita as utils compartilhadas em _shared/clientes/utils.ts.
    if (req.method === "POST" && (path === "/sync-ingest" || path === "/bulk-sync")) {
      const { processRecordsWithRetry, MINI_BATCH_SIZE, INTER_BATCH_DELAY_MS } =
        await import("../_shared/clientes/utils.ts");
      const raw = await req.json().catch(() => ({}));
      const records: Record<string, unknown>[] =
        Array.isArray(raw) ? raw :
        Array.isArray((raw as any)?.records) ? (raw as any).records :
        Array.isArray((raw as any)?.data) ? (raw as any).data :
        Array.isArray((raw as any)?.clientes) ? (raw as any).clientes :
        [];

      const MAX_PER_CALL = path === "/sync-ingest" ? 5000 : 50000;
      if (records.length > MAX_PER_CALL) {
        return errorResponse(413, "PAYLOAD_TOO_LARGE",
          `Máximo de ${MAX_PER_CALL} registros por chamada. Recebido: ${records.length}.`,
          req, startMs);
      }

      let inserted = 0, updated = 0, skipped = 0, processed = 0, errors = 0;
      const batchErrors: string[] = [];
      for (let i = 0; i < records.length; i += MINI_BATCH_SIZE) {
        const batch = records.slice(i, i + MINI_BATCH_SIZE);
        try {
          const r = await processRecordsWithRetry(supabase, batch, `clientes-api-sync-batch-${i}`);
          inserted += r.inserted; updated += r.updated; skipped += r.skipped; processed += r.total;
        } catch (e) {
          errors += batch.length;
          batchErrors.push(e instanceof Error ? e.message : String(e));
        }
        if (i + MINI_BATCH_SIZE < records.length) {
          await new Promise((r) => setTimeout(r, INTER_BATCH_DELAY_MS));
        }
      }

      return jsonResponse({
        success: errors === 0,
        received: records.length,
        processed, inserted, updated, skipped, errors,
        ...(batchErrors.length > 0 ? { batch_errors: batchErrors.slice(0, 5) } : {}),
      }, errors === 0 ? 200 : 207, req, { startMs });
    }

    // ── GET /sync-status ─────────────────────────────────────────
    if (req.method === "GET" && path === "/sync-status") {
      const { data } = await supabase
        .from("clientes")
        .select("sincronizado_em")
        .order("sincronizado_em", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      return jsonResponse({
        last_sync: data?.sincronizado_em || null,
        status: "ok",
      }, 200, req, { startMs });
    }

    // ── POST /sync ───────────────────────────────────────────────
    if (req.method === "POST" && path === "/sync") {
      const raw = await req.json().catch(() => ({}));
      const SyncSchema = z.object({
        atualizado_desde: z.string().optional(),
        pagina: z.number().optional().default(1),
        registros_por_pagina: z.number().optional().default(100),
      });
      const body = validateBody(raw, SyncSchema);

      const pagina = Math.max(1, body.pagina);
      const regPorPag = Math.min(500, Math.max(1, body.registros_por_pagina));
      const from = (pagina - 1) * regPorPag;
      const to = from + regPorPag - 1;

      let query = supabase
        .from("clientes")
        .select("*", { count: "exact" })
        .order("updated_at", { ascending: false })
        .range(from, to);
      query = scopeClientes(query);

      if (body.atualizado_desde) {
        query = query.gte("updated_at", body.atualizado_desde);
      }

      const { data, error, count } = await query;
      if (error) return errorResponse(500, "DB_ERROR", error.message, req, startMs);

      const total = count || 0;
      return jsonResponse({
        pagina,
        total_de_paginas: Math.ceil(total / regPorPag),
        registros: data?.length || 0,
        total_de_registros: total,
        atualizado_desde: body.atualizado_desde || null,
        clientes_cadastro: (data || []).map(mapRowToApi),
      }, 200, req, { startMs });
    }

    // ── Helper: resolve cliente by huggs/integracao code ─────────
    // Scoped to caller's empresa(s) so cliente_caracteristicas / cliente_tags
    // operations cannot enumerate rows from other empresas.
    async function resolveCliente(body: Record<string, unknown>): Promise<{ id: string; codigo: string } | null> {
      const { codigo_cliente_integracao, codigo_cliente_huggs } = body;
      if (!codigo_cliente_integracao && !codigo_cliente_huggs) return null;
      let q = supabase.from("clientes").select("id, codigo");
      q = scopeClientes(q);
      if (codigo_cliente_integracao) q = q.eq("codigo", codigo_cliente_integracao);
      else q = q.eq("id", codigo_cliente_huggs);
      const { data } = await q.maybeSingle();
      return data;
    }

    // ── POST /caract/incluir ─────────────────────────────────────
    if (req.method === "POST" && path === "/caract/incluir") {
      const body = await req.json();
      if (!body.campo) return errorResponse(400, "VALIDATION_ERROR", "campo é obrigatório", req, startMs);
      const cliente = await resolveCliente(body);
      if (!cliente) return errorResponse(404, "NOT_FOUND", "Cliente não encontrado", req, startMs);

      const { error } = await supabase
        .from("cliente_caracteristicas")
        .upsert({ cliente_id: cliente.id, campo: body.campo, conteudo: body.conteudo || "", updated_at: new Date().toISOString() }, { onConflict: "cliente_id,campo" });

      if (error) return errorResponse(500, "DB_ERROR", error.message, req, startMs);
      return jsonResponse(statusResponse(cliente.id, cliente.codigo, "0", "Característica incluída com sucesso!"), 201, req, { startMs });
    }

    // ── POST /caract/alterar ─────────────────────────────────────
    if (req.method === "POST" && path === "/caract/alterar") {
      const body = await req.json();
      if (!body.campo) return errorResponse(400, "VALIDATION_ERROR", "campo é obrigatório", req, startMs);
      const cliente = await resolveCliente(body);
      if (!cliente) return errorResponse(404, "NOT_FOUND", "Cliente não encontrado", req, startMs);

      const { error } = await supabase
        .from("cliente_caracteristicas")
        .update({ conteudo: body.conteudo || "", updated_at: new Date().toISOString() })
        .eq("cliente_id", cliente.id)
        .eq("campo", body.campo);

      if (error) return errorResponse(500, "DB_ERROR", error.message, req, startMs);
      return jsonResponse(statusResponse(cliente.id, cliente.codigo, "0", "Característica alterada com sucesso!"), 200, req, { startMs });
    }

    // ── POST /caract/consultar ───────────────────────────────────
    if (req.method === "POST" && path === "/caract/consultar") {
      const body = await req.json().catch(() => ({}));
      const cliente = await resolveCliente(body);
      if (!cliente) return errorResponse(404, "NOT_FOUND", "Cliente não encontrado", req, startMs);

      const { data, error } = await supabase
        .from("cliente_caracteristicas")
        .select("campo, conteudo")
        .eq("cliente_id", cliente.id)
        .order("campo");

      if (error) return errorResponse(500, "DB_ERROR", error.message, req, startMs);
      return jsonResponse({
        codigo_cliente_huggs: cliente.id,
        codigo_cliente_integracao: cliente.codigo,
        caracteristicas: data || [],
      }, 200, req, { startMs });
    }

    // ── POST /caract/excluir ─────────────────────────────────────
    if (req.method === "POST" && path === "/caract/excluir") {
      const body = await req.json();
      if (!body.campo) return errorResponse(400, "VALIDATION_ERROR", "campo é obrigatório", req, startMs);
      const cliente = await resolveCliente(body);
      if (!cliente) return errorResponse(404, "NOT_FOUND", "Cliente não encontrado", req, startMs);

      const { error } = await supabase
        .from("cliente_caracteristicas")
        .delete()
        .eq("cliente_id", cliente.id)
        .eq("campo", body.campo);

      if (error) return errorResponse(500, "DB_ERROR", error.message, req, startMs);
      return jsonResponse(statusResponse(cliente.id, cliente.codigo, "0", "Característica excluída com sucesso!"), 200, req, { startMs });
    }

    // ── POST /caract/excluir-todas ───────────────────────────────
    if (req.method === "POST" && path === "/caract/excluir-todas") {
      const body = await req.json().catch(() => ({}));
      const cliente = await resolveCliente(body);
      if (!cliente) return errorResponse(404, "NOT_FOUND", "Cliente não encontrado", req, startMs);

      const { error } = await supabase
        .from("cliente_caracteristicas")
        .delete()
        .eq("cliente_id", cliente.id);

      if (error) return errorResponse(500, "DB_ERROR", error.message, req, startMs);
      return jsonResponse(statusResponse(cliente.id, cliente.codigo, "0", "Todas as características excluídas com sucesso!"), 200, req, { startMs });
    }

    // ── POST /tags/incluir ───────────────────────────────────────
    if (req.method === "POST" && path === "/tags/incluir") {
      const body = await req.json();
      if (!body.tags || !Array.isArray(body.tags) || body.tags.length === 0) {
        return errorResponse(400, "VALIDATION_ERROR", "tags (array) é obrigatório", req, startMs);
      }
      const cliente = await resolveCliente({ codigo_cliente_integracao: body.cCodIntCliente, codigo_cliente_huggs: body.nCodCliente });
      if (!cliente) return errorResponse(404, "NOT_FOUND", "Cliente não encontrado", req, startMs);

      const rows = body.tags.map((t: { tag: string }) => ({ cliente_id: cliente.id, tag: t.tag }));
      const { error } = await supabase.from("cliente_tags").upsert(rows, { onConflict: "cliente_id,tag", ignoreDuplicates: true });
      if (error) return errorResponse(500, "DB_ERROR", error.message, req, startMs);

      return jsonResponse({
        nCodCliente: cliente.id,
        cCodIntCliente: cliente.codigo,
        cCodStatus: "0",
        cDesStatus: "Tags incluídas com sucesso!",
      }, 201, req, { startMs });
    }

    // ── POST /tags/listar ────────────────────────────────────────
    if (req.method === "POST" && path === "/tags/listar") {
      const body = await req.json().catch(() => ({}));
      const cliente = await resolveCliente({ codigo_cliente_integracao: body.cCodIntCliente, codigo_cliente_huggs: body.nCodCliente });
      if (!cliente) return errorResponse(404, "NOT_FOUND", "Cliente não encontrado", req, startMs);

      const { data, error } = await supabase
        .from("cliente_tags")
        .select("tag")
        .eq("cliente_id", cliente.id)
        .order("tag");

      if (error) return errorResponse(500, "DB_ERROR", error.message, req, startMs);
      return jsonResponse({
        nCodCliente: cliente.id,
        cCodIntCliente: cliente.codigo,
        tagsLista: (data || []).map((r: { tag: string }, i: number) => ({ tag: r.tag, nCodTag: i + 1 })),
      }, 200, req, { startMs });
    }

    // ── POST /tags/excluir ───────────────────────────────────────
    if (req.method === "POST" && path === "/tags/excluir") {
      const body = await req.json();
      if (!body.tags || !Array.isArray(body.tags) || body.tags.length === 0) {
        return errorResponse(400, "VALIDATION_ERROR", "tags (array) é obrigatório", req, startMs);
      }
      const cliente = await resolveCliente({ codigo_cliente_integracao: body.cCodIntCliente, codigo_cliente_huggs: body.nCodCliente });
      if (!cliente) return errorResponse(404, "NOT_FOUND", "Cliente não encontrado", req, startMs);

      const tagValues = body.tags.map((t: { tag: string }) => t.tag);
      const { error } = await supabase
        .from("cliente_tags")
        .delete()
        .eq("cliente_id", cliente.id)
        .in("tag", tagValues);

      if (error) return errorResponse(500, "DB_ERROR", error.message, req, startMs);
      return jsonResponse({
        nCodCliente: cliente.id,
        cCodIntCliente: cliente.codigo,
        cCodStatus: "0",
        cDesStatus: "Tags excluídas com sucesso!",
      }, 200, req, { startMs });
    }

    // ── POST /tags/excluir-todas ─────────────────────────────────
    if (req.method === "POST" && path === "/tags/excluir-todas") {
      const body = await req.json().catch(() => ({}));
      const cliente = await resolveCliente({ codigo_cliente_integracao: body.cCodIntCliente, codigo_cliente_huggs: body.nCodCliente });
      if (!cliente) return errorResponse(404, "NOT_FOUND", "Cliente não encontrado", req, startMs);

      const { error } = await supabase
        .from("cliente_tags")
        .delete()
        .eq("cliente_id", cliente.id);

      if (error) return errorResponse(500, "DB_ERROR", error.message, req, startMs);
      return jsonResponse({
        nCodCliente: cliente.id,
        cCodIntCliente: cliente.codigo,
        cCodStatus: "0",
        cDesStatus: "Todas as tags excluídas com sucesso!",
      }, 200, req, { startMs });
    }

    return errorResponse(404, "NOT_FOUND", `Rota não encontrada: ${req.method} ${path}`, req, startMs);
  } catch (err: unknown) {
    if (err instanceof ValidationError) {
      return errorResponse(400, "VALIDATION_ERROR", err.message, req, startMs);
    }
    const e = err as { status?: number; message?: string; name?: string };
    if (e.name === "RateLimitError" || (e as any) instanceof RateLimitError) {
      return errorResponse(429, "RATE_LIMIT", e.message || "Rate limit excedido", req, startMs);
    }
    if (e.status === 401 || e.status === 403) {
      return errorResponse(e.status, "AUTH_ERROR", e.message || "Não autorizado", req, startMs);
    }
    logger.error("❌ clientes-api error:", e);
    return errorResponse(500, "INTERNAL_ERROR", e.message || "Erro interno", req, startMs);
  }
}));
