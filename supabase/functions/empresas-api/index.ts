// empresas-api — CRUD completo + Zod + audit log
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { validateAnyAuth } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { enqueueWebhookEvent } from "../_shared/webhook-enqueue.ts";
import { z, validateBody, ValidationError } from "../_shared/validate.ts";

// === Zod Schemas (.strict()) ===
const IncluirEmpresaSchema = z.object({
  razao_social: z.string().min(1, "Campo 'razao_social' é obrigatório").max(255),
  nome_fantasia: z.string().max(255).optional(),
  cnpj: z.string().max(20).optional(),
  codigo_empresa_integracao: z.string().max(100).optional(),
  codigo_erp: z.string().max(60).optional(),
  logradouro: z.string().max(255).optional(),
  endereco: z.string().max(500).optional(),
  endereco_numero: z.string().max(20).optional(),
  complemento: z.string().max(120).optional(),
  bairro: z.string().max(100).optional(),
  cidade: z.string().max(100).optional(),
  estado: z.string().max(2).optional(),
  cep: z.string().max(10).optional(),
  codigo_pais: z.string().max(10).optional(),
  telefone1_ddd: z.string().max(5).optional(),
  telefone1_numero: z.string().max(20).optional(),
  telefone2_ddd: z.string().max(5).optional(),
  telefone2_numero: z.string().max(20).optional(),
  fax_ddd: z.string().max(5).optional(),
  fax_numero: z.string().max(20).optional(),
  email: z.string().email().max(255).optional().or(z.literal("")),
  website: z.string().max(255).optional(),
  cnae: z.string().max(20).optional(),
  cnae_municipal: z.string().max(20).optional(),
  inscricao_estadual: z.string().max(20).optional(),
  inscricao_municipal: z.string().max(20).optional(),
  inscricao_suframa: z.string().max(20).optional(),
  regime_tributario: z.string().max(40).optional(),
  regime_apuracao: z.enum(["Competência", "Caixa"]).optional(),
  tipo_empresa: z.enum(["Matriz", "Filial", "Coligada"]).optional(),
  natureza_juridica: z.string().max(40).optional(),
  porte: z.enum(["ME", "EPP", "Demais"]).optional(),
  capital_social: z.number().nonnegative().optional(),
  data_abertura: z.string().max(10).optional(),
  codigo_ibge_municipio: z.number().int().optional(),
  responsavel_nome: z.string().max(120).optional(),
  responsavel_cpf: z.string().max(14).optional(),
  optante_simples_nacional: z.string().max(1).optional(),
  contato: z.string().max(120).optional(),
}).strict();

const AlterarEmpresaSchema = z.object({
  codigo_empresa: z.union([z.string(), z.number()]),
}).strict().passthrough().and(
  z.record(z.unknown())
);

// More flexible: accept codigo_empresa + any subset of fields
const AlterarEmpresaBodySchema = z.object({
  codigo_empresa: z.union([z.string(), z.number()]),
  razao_social: z.string().max(255).optional(),
  nome_fantasia: z.string().max(255).optional(),
  cnpj: z.string().max(20).optional(),
  codigo_empresa_integracao: z.string().max(100).optional(),
  codigo_erp: z.string().max(60).optional(),
  logradouro: z.string().max(255).optional(),
  endereco: z.string().max(500).optional(),
  endereco_numero: z.string().max(20).optional(),
  complemento: z.string().max(120).optional(),
  bairro: z.string().max(100).optional(),
  cidade: z.string().max(100).optional(),
  estado: z.string().max(2).optional(),
  cep: z.string().max(10).optional(),
  codigo_pais: z.string().max(10).optional(),
  telefone1_ddd: z.string().max(5).optional(),
  telefone1_numero: z.string().max(20).optional(),
  telefone2_ddd: z.string().max(5).optional(),
  telefone2_numero: z.string().max(20).optional(),
  fax_ddd: z.string().max(5).optional(),
  fax_numero: z.string().max(20).optional(),
  email: z.string().email().max(255).optional().or(z.literal("")),
  website: z.string().max(255).optional(),
  cnae: z.string().max(20).optional(),
  cnae_municipal: z.string().max(20).optional(),
  inscricao_estadual: z.string().max(20).optional(),
  inscricao_municipal: z.string().max(20).optional(),
  inscricao_suframa: z.string().max(20).optional(),
  regime_tributario: z.string().max(40).optional(),
  regime_apuracao: z.enum(["Competência", "Caixa"]).optional(),
  tipo_empresa: z.enum(["Matriz", "Filial", "Coligada"]).optional(),
  natureza_juridica: z.string().max(40).optional(),
  porte: z.enum(["ME", "EPP", "Demais"]).optional(),
  capital_social: z.number().nonnegative().optional(),
  data_abertura: z.string().max(10).optional(),
  codigo_ibge_municipio: z.number().int().optional(),
  responsavel_nome: z.string().max(120).optional(),
  responsavel_cpf: z.string().max(14).optional(),
  optante_simples_nacional: z.string().max(1).optional(),
  contato: z.string().max(120).optional(),
  inativa: z.enum(["S", "N"]).optional(),
}).strict();

const ConsultarSchema = z.object({
  codigo_empresa: z.union([z.string(), z.number()]),
}).strict();

const ListarSchema = z.object({
  pagina: z.union([z.string(), z.number()]).optional(),
  registros_por_pagina: z.union([z.string(), z.number()]).optional(),
}).strict();

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function mapCadastro(row: Record<string, unknown>): Record<string, unknown> {
  const createdAt = row.created_at as string | null;
  const updatedAt = row.updated_at as string | null;
  const ativa = row.ativa as boolean;

  return {
    codigo_empresa: row.id,
    codigo_empresa_integracao: row.codigo_empresa_integracao || "",
    codigo_erp: row.codigo_erp || "",
    cnpj: row.cnpj || "",
    razao_social: row.nome || "",
    nome_fantasia: row.nome_fantasia || row.nome || "",
    logradouro: row.logradouro || "",
    endereco: row.endereco || "",
    endereco_numero: row.endereco_numero || "",
    complemento: row.complemento || "",
    bairro: row.bairro || "",
    cidade: row.cidade || "",
    estado: row.uf || "",
    cep: row.cep || "",
    codigo_pais: row.codigo_pais || "1058",
    telefone1_ddd: row.telefone1_ddd || "",
    telefone1_numero: row.telefone1_numero || "",
    telefone2_ddd: row.telefone2_ddd || "",
    telefone2_numero: row.telefone2_numero || "",
    fax_ddd: row.fax_ddd || "",
    fax_numero: row.fax_numero || "",
    email: row.email || "",
    website: row.website || "",
    cnae: row.cnae || "",
    cnae_municipal: row.cnae_municipal || "",
    inscricao_estadual: row.inscricao_estadual || "",
    inscricao_municipal: row.inscricao_municipal || "",
    inscricao_suframa: row.inscricao_suframa || "",
    regime_tributario: row.regime_tributario || "",
    regime_apuracao: row.regime_apuracao || "",
    tipo_empresa: row.tipo_empresa || "",
    natureza_juridica: row.natureza_juridica || "",
    porte: row.porte || "",
    capital_social: row.capital_social ?? 0,
    data_abertura: row.data_abertura || "",
    codigo_ibge_municipio: row.codigo_ibge_municipio ?? 0,
    responsavel_nome: row.responsavel_nome || "",
    responsavel_cpf: row.responsavel_cpf || "",
    inativa: ativa ? "N" : "S",
    optante_simples_nacional: row.optante_simples_nacional || "",
    contato: row.contato || "",
    inclusao_data: formatDate(createdAt),
    inclusao_hora: formatTime(createdAt),
    alteracao_data: formatDate(updatedAt),
    alteracao_hora: formatTime(updatedAt),
    importado_api: row.importado_api ? "S" : "N",
    bloqueado: row.bloqueado ? "S" : "N",
  };
}

function mapApiToDb(body: Record<string, unknown>): Record<string, unknown> {
  const db: Record<string, unknown> = {};
  if (body.razao_social !== undefined) db.nome = body.razao_social;
  if (body.nome_fantasia !== undefined) db.nome_fantasia = body.nome_fantasia;
  if (body.cnpj !== undefined) db.cnpj = body.cnpj;
  if (body.codigo_empresa_integracao !== undefined) db.codigo_empresa_integracao = body.codigo_empresa_integracao;
  if (body.codigo_erp !== undefined) db.codigo_erp = body.codigo_erp;
  if (body.logradouro !== undefined) db.logradouro = body.logradouro;
  if (body.endereco !== undefined) db.endereco = body.endereco;
  if (body.endereco_numero !== undefined) db.endereco_numero = body.endereco_numero;
  if (body.complemento !== undefined) db.complemento = body.complemento;
  if (body.bairro !== undefined) db.bairro = body.bairro;
  if (body.cidade !== undefined) db.cidade = body.cidade;
  if (body.estado !== undefined) db.uf = body.estado;
  if (body.cep !== undefined) db.cep = body.cep;
  if (body.codigo_pais !== undefined) db.codigo_pais = body.codigo_pais;
  if (body.telefone1_ddd !== undefined) db.telefone1_ddd = body.telefone1_ddd;
  if (body.telefone1_numero !== undefined) db.telefone1_numero = body.telefone1_numero;
  if (body.telefone2_ddd !== undefined) db.telefone2_ddd = body.telefone2_ddd;
  if (body.telefone2_numero !== undefined) db.telefone2_numero = body.telefone2_numero;
  if (body.fax_ddd !== undefined) db.fax_ddd = body.fax_ddd;
  if (body.fax_numero !== undefined) db.fax_numero = body.fax_numero;
  if (body.email !== undefined) db.email = body.email;
  if (body.website !== undefined) db.website = body.website;
  if (body.cnae !== undefined) db.cnae = body.cnae;
  if (body.cnae_municipal !== undefined) db.cnae_municipal = body.cnae_municipal;
  if (body.inscricao_estadual !== undefined) db.inscricao_estadual = body.inscricao_estadual;
  if (body.inscricao_municipal !== undefined) db.inscricao_municipal = body.inscricao_municipal;
  if (body.inscricao_suframa !== undefined) db.inscricao_suframa = body.inscricao_suframa;
  if (body.regime_tributario !== undefined) db.regime_tributario = body.regime_tributario;
  if (body.regime_apuracao !== undefined) db.regime_apuracao = body.regime_apuracao;
  if (body.tipo_empresa !== undefined) db.tipo_empresa = body.tipo_empresa;
  if (body.natureza_juridica !== undefined) db.natureza_juridica = body.natureza_juridica;
  if (body.porte !== undefined) db.porte = body.porte;
  if (body.capital_social !== undefined) db.capital_social = body.capital_social;
  if (body.data_abertura !== undefined) db.data_abertura = body.data_abertura;
  if (body.codigo_ibge_municipio !== undefined) db.codigo_ibge_municipio = body.codigo_ibge_municipio;
  if (body.responsavel_nome !== undefined) db.responsavel_nome = body.responsavel_nome;
  if (body.responsavel_cpf !== undefined) db.responsavel_cpf = body.responsavel_cpf;
  if (body.optante_simples_nacional !== undefined) db.optante_simples_nacional = body.optante_simples_nacional;
  if (body.contato !== undefined) db.contato = body.contato;
  if (body.inativa !== undefined) db.ativa = body.inativa !== "S";
  return db;
}

async function logAudit(
  supabase: ReturnType<typeof createClient>,
  action: string,
  entityId: string | number,
  userId: string | null,
  req: Request,
  oldData?: unknown,
  newData?: unknown
) {
  try {
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: `EMPRESA:${action}`,
      entity_type: "empresa",
      entity_id: String(entityId),
      old_data: oldData || null,
      new_data: newData || null,
      user_agent: req.headers.get("user-agent") || null,
    });
  } catch (_) { /* fire and forget */ }
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startMs = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/empresas-api\/?/, "/").replace(/\/+$/, "") || "/";

  try {
    // Health check
    if (req.method === "GET" && path === "/status") {
      return jsonResponse(
        { status: "ok", function: "empresas-api", routes: ["/incluir", "/alterar", "/consultar", "/listar", "/status"] },
        200, req, { startMs }
      );
    }

    if (req.method !== "POST") {
      return errorResponse(405, "METHOD_NOT_ALLOWED", "Use POST para esta rota", req, startMs);
    }

    // Auth
    const auth = await validateAnyAuth(req);
    await checkRateLimit({ prefix: "empresas", limit: 60, req, userId: auth.userId });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const rawBody = await req.json().catch(() => ({}));

    // ==================== POST /incluir ====================
    if (path === "/incluir") {
      const body = validateBody(rawBody, IncluirEmpresaSchema);
      const dbData = mapApiToDb(body);
      dbData.updated_at = new Date().toISOString();
      dbData.importado_api = true;

      const { data, error } = await supabase
        .from("empresas")
        .insert(dbData)
        .select("id, nome, codigo_empresa_integracao")
        .single();

      if (error) {
        if (error.code === "23505") {
          return errorResponse(409, "DUPLICATE", "Empresa com este CNPJ ou código já existe", req, startMs);
        }
        return errorResponse(500, "DB_ERROR", error.message, req, startMs);
      }

      await logAudit(supabase, "incluir", data.id, auth.userId, req, null, body);
      enqueueWebhookEvent("empresa.criado", { id: data.id, razao_social: data.nome });

      return jsonResponse({
        codigo_empresa: data.id,
        codigo_empresa_integracao: data.codigo_empresa_integracao || "",
        codigo_status: "0",
        descricao_status: "Empresa incluída com sucesso!",
      }, 201, req, { startMs });
    }

    // ==================== POST /alterar ====================
    if (path === "/alterar") {
      const body = validateBody(rawBody, AlterarEmpresaBodySchema);
      const codigoEmpresa = body.codigo_empresa;

      // Fetch current for audit
      const { data: current } = await supabase
        .from("empresas")
        .select("*")
        .eq("id", codigoEmpresa)
        .maybeSingle();

      if (!current) return errorResponse(404, "NOT_FOUND", `Empresa com código '${codigoEmpresa}' não encontrada`, req, startMs);

      const dbData = mapApiToDb(body);
      dbData.updated_at = new Date().toISOString();

      if (Object.keys(dbData).length <= 1) {
        return errorResponse(400, "VALIDATION", "Nenhum campo para alterar", req, startMs);
      }

      const { data, error } = await supabase
        .from("empresas")
        .update(dbData)
        .eq("id", codigoEmpresa)
        .select("id, nome, codigo_empresa_integracao")
        .single();

      if (error) return errorResponse(500, "DB_ERROR", error.message, req, startMs);

      await logAudit(supabase, "alterar", data.id, auth.userId, req, current, body);
      enqueueWebhookEvent("empresa.alterado", { id: data.id, razao_social: data.nome });

      return jsonResponse({
        codigo_empresa: data.id,
        codigo_empresa_integracao: data.codigo_empresa_integracao || "",
        codigo_status: "0",
        descricao_status: "Empresa alterada com sucesso!",
      }, 200, req, { startMs });
    }

    // ==================== POST /consultar ====================
    if (path === "/consultar") {
      const body = validateBody(rawBody, ConsultarSchema);
      const codigoEmpresa = body.codigo_empresa;

      const { data, error } = await supabase
        .from("empresas")
        .select("*")
        .eq("id", codigoEmpresa)
        .maybeSingle();

      if (error) return errorResponse(500, "DB_ERROR", error.message, req, startMs);
      if (!data) return errorResponse(404, "NOT_FOUND", `Empresa com código '${codigoEmpresa}' não encontrada`, req, startMs);

      await logAudit(supabase, "consultar", codigoEmpresa, auth.userId, req);
      return jsonResponse({ empresas_cadastro: mapCadastro(data) }, 200, req, { startMs });
    }

    // ==================== POST /listar ====================
    if (path === "/listar") {
      const body = validateBody(rawBody, ListarSchema);
      const pagina = Math.max(1, parseInt(String(body.pagina || "1")));
      const regPorPagina = Math.min(500, Math.max(1, parseInt(String(body.registros_por_pagina || "100"))));

      const from = (pagina - 1) * regPorPagina;
      const to = from + regPorPagina - 1;

      const { data, error, count } = await supabase
        .from("empresas")
        .select("*", { count: "exact" })
        .order("id", { ascending: true })
        .range(from, to);

      if (error) return errorResponse(500, "DB_ERROR", error.message, req, startMs);

      const totalRegistros = count || 0;
      const totalPaginas = Math.ceil(totalRegistros / regPorPagina);

      return jsonResponse({
        pagina,
        total_de_paginas: totalPaginas,
        registros: data?.length || 0,
        total_de_registros: totalRegistros,
        empresas_cadastro: (data || []).map(mapCadastro),
      }, 200, req, { startMs });
    }

    return errorResponse(404, "NOT_FOUND", `Rota não encontrada: ${req.method} ${path}`, req, startMs);
  } catch (err: unknown) {
    if (err instanceof ValidationError) {
      return errorResponse(400, "VALIDATION", err.message, req, startMs);
    }
    const e = err as { status?: number; message?: string; name?: string };
    if (e.name === "RateLimitError" || (e as any) instanceof RateLimitError) {
      return errorResponse(429, "RATE_LIMIT", e.message || "Rate limit excedido", req, startMs);
    }
    if (e.status === 401 || e.status === 403) {
      return errorResponse(e.status, "AUTH_ERROR", e.message || "Não autorizado", req, startMs);
    }
    console.error("❌ empresas-api error:", e);
    return errorResponse(500, "INTERNAL_ERROR", e.message || "Erro interno", req, startMs);
  }
});
