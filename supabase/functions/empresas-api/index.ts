// empresas-api
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { validateAnyAuth } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";

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
        { status: "ok", function: "empresas-api", routes: ["/consultar", "/listar", "/status"] },
        200, req, { startMs }
      );
    }

    if (req.method !== "POST") {
      return errorResponse(405, "METHOD_NOT_ALLOWED", "Use POST para esta rota", req, startMs);
    }

    // Auth
    await validateApiKey(req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));

    // POST /consultar
    if (path === "/consultar") {
      const codigoEmpresa = body.codigo_empresa;
      if (!codigoEmpresa && codigoEmpresa !== 0) {
        return errorResponse(400, "MISSING_PARAM", "Campo 'codigo_empresa' é obrigatório", req, startMs);
      }

      const { data, error } = await supabase
        .from("empresas")
        .select("*")
        .eq("id", codigoEmpresa)
        .maybeSingle();

      if (error) return errorResponse(500, "DB_ERROR", error.message, req, startMs);
      if (!data) return errorResponse(404, "NOT_FOUND", `Empresa com código '${codigoEmpresa}' não encontrada`, req, startMs);

      return jsonResponse(mapCadastro(data), 200, req, { startMs });
    }

    // POST /listar
    if (path === "/listar") {
      const pagina = Math.max(1, parseInt(body.pagina || "1"));
      const regPorPagina = Math.min(500, Math.max(1, parseInt(body.registros_por_pagina || "100")));

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
    const e = err as { status?: number; message?: string };
    if (e.status === 401 || e.status === 403) {
      return errorResponse(e.status, "AUTH_ERROR", e.message || "Não autorizado", req, startMs);
    }
    console.error("❌ empresas-api error:", e);
    return errorResponse(500, "INTERNAL_ERROR", e.message || "Erro interno", req, startMs);
  }
});
