import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";
import { validateAnyAuth, AuthError } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

function jsonResponse(data: unknown, status = 200, req?: Request) {
  const cors = req ? getCorsHeaders(req) : {};
  const headers = withSecurityHeaders(
    { ...cors, "Content-Type": "application/json" },
    status === 401 || status === 403
  );
  return new Response(JSON.stringify(data), { status, headers });
}

function formatDate(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("pt-BR");
}

interface DeptRow {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  codigo_huggs: string | null;
  estrutura: string | null;
  nivel_totalizador: string | null;
  created_at: string;
  updated_at: string | null;
}

function mapCadastro(row: DeptRow) {
  return {
    codigo: row.codigo_huggs || "",
    descricao: row.nome || "",
    estrutura: row.estrutura || "",
    inativo: row.ativo ? "N" : "S",
    nivel_totalizador: row.nivel_totalizador || "N",
    info: {
      dInc: formatDate(row.created_at),
      dAlt: formatDate(row.updated_at),
    },
  };
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const url = new URL(req.url);
  const path = url.pathname.split("/").filter(Boolean);
  const route = path[path.length - 1] || "";
  const start = Date.now();

  // Health check
  if (req.method === "GET" && route === "status") {
    return jsonResponse({
      status: "ok",
      service: "departamentos-api",
      timestamp: new Date().toISOString(),
    }, 200, req);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido" }, 405);
  }

  try {
    await validateApiKey(req);
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 401;
    return jsonResponse({ error: (e as Error).message }, status);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400);
  }

  try {
    switch (route) {
      case "incluir":
        return await handleIncluir(supabase, body, start);
      case "alterar":
        return await handleAlterar(supabase, body, start);
      case "consultar":
        return await handleConsultar(supabase, body, start);
      case "excluir":
        return await handleExcluir(supabase, body, start);
      case "listar":
        return await handleListar(supabase, body, start);
      default:
        return jsonResponse({ error: `Rota /${route} não encontrada` }, 404);
    }
  } catch (e) {
    console.error("departamentos-api error:", e);
    return jsonResponse({ error: "Erro interno", details: (e as Error).message }, 500);
  }
});

async function handleIncluir(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  start: number
) {
  const codigo = String(body.codigo || "").trim();
  const descricao = String(body.descricao || "").trim();

  if (!codigo) return jsonResponse({ error: "Campo 'codigo' é obrigatório" }, 400);
  if (!descricao) return jsonResponse({ error: "Campo 'descricao' é obrigatório" }, 400);

  // Check duplicate
  const { data: existing } = await supabase
    .from("departamentos")
    .select("id")
    .eq("codigo_huggs", codigo)
    .maybeSingle();

  if (existing) {
    return jsonResponse({
      codigo,
      descricao,
      cCodStatus: "1",
      cDesStatus: "Departamento já cadastrado com este código",
    }, 409);
  }

  const { error } = await supabase.from("departamentos").insert({
    nome: descricao,
    codigo_huggs: codigo,
    ativo: true,
  });

  if (error) throw error;

  return jsonResponse({
    codigo,
    descricao,
    cCodStatus: "0",
    cDesStatus: "Departamento incluído com sucesso",
    duration_ms: Date.now() - start,
  });
}

async function handleAlterar(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  start: number
) {
  const codigo = String(body.codigo || "").trim();
  if (!codigo) return jsonResponse({ error: "Campo 'codigo' é obrigatório" }, 400);

  const { data: row } = await supabase
    .from("departamentos")
    .select("id")
    .eq("codigo_huggs", codigo)
    .maybeSingle();

  if (!row) return jsonResponse({ error: "Departamento não encontrado" }, 404);

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.descricao !== undefined) updates.nome = String(body.descricao);
  if (body.estrutura !== undefined) updates.estrutura = String(body.estrutura);
  if (body.nivel_totalizador !== undefined) updates.nivel_totalizador = String(body.nivel_totalizador);

  const { error } = await supabase
    .from("departamentos")
    .update(updates)
    .eq("id", row.id);

  if (error) throw error;

  return jsonResponse({
    codigo,
    descricao: updates.nome || "",
    cCodStatus: "0",
    cDesStatus: "Departamento alterado com sucesso",
    duration_ms: Date.now() - start,
  });
}

async function handleConsultar(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  start: number
) {
  const codigo = String(body.codigo || "").trim();
  if (!codigo) return jsonResponse({ error: "Campo 'codigo' é obrigatório" }, 400);

  const { data: row, error } = await supabase
    .from("departamentos")
    .select("*")
    .eq("codigo_huggs", codigo)
    .maybeSingle();

  if (error) throw error;
  if (!row) return jsonResponse({ error: "Departamento não encontrado" }, 404);

  return jsonResponse({
    ...mapCadastro(row as DeptRow),
    duration_ms: Date.now() - start,
  });
}

async function handleExcluir(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  start: number
) {
  const codigo = String(body.codigo || "").trim();
  if (!codigo) return jsonResponse({ error: "Campo 'codigo' é obrigatório" }, 400);

  const { data: row } = await supabase
    .from("departamentos")
    .select("id, nome")
    .eq("codigo_huggs", codigo)
    .maybeSingle();

  if (!row) return jsonResponse({ error: "Departamento não encontrado" }, 404);

  // Soft delete
  const { error } = await supabase
    .from("departamentos")
    .update({ ativo: false, updated_at: new Date().toISOString() })
    .eq("id", row.id);

  if (error) throw error;

  return jsonResponse({
    codigo,
    descricao: row.nome,
    cCodStatus: "0",
    cDesStatus: "Departamento excluído com sucesso",
    duration_ms: Date.now() - start,
  });
}

async function handleListar(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  start: number
) {
  const pagina = Math.max(1, Number(body.pagina) || 1);
  const registros = Math.min(500, Math.max(1, Number(body.registros_por_pagina) || 50));
  const offset = (pagina - 1) * registros;

  // Count
  const { count } = await supabase
    .from("departamentos")
    .select("id", { count: "exact", head: true });

  const totalRegistros = count || 0;
  const totalPaginas = Math.ceil(totalRegistros / registros);

  const { data: rows, error } = await supabase
    .from("departamentos")
    .select("*")
    .order("nome")
    .range(offset, offset + registros - 1);

  if (error) throw error;

  return jsonResponse({
    pagina,
    total_de_paginas: totalPaginas,
    registros: (rows || []).length,
    total_de_registros: totalRegistros,
    departamentos: (rows || []).map((r: DeptRow) => mapCadastro(r)),
    duration_ms: Date.now() - start,
  });
}
