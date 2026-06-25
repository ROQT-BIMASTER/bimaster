// sync-erp-clientes
// Sincroniza view de clientes do RP/SQL Server -> erp_clientes_raw
// e aplica em public.clientes via RPC aplicar_clientes_rp_no_master.
//
// Endpoints (POST):
//   /describe?view=<name>   -> mapeia colunas + sample da view RP (busca Cust_*Cliente* se omitido)
//   /sync                   -> { mode: "full"|"incremental", limit?, view? } executa sincronização
//
// Auth: JWT obrigatório; exige admin OU supervisor.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { connectToSqlServer, executeSqlQuery, closeConnectionSafe } from "../_shared/erp-mssql.ts";

const DEFAULT_VIEW = Deno.env.get("ERP_CLIENTES_VIEW") || "Cust_ClientesSP";
const UPSERT_BATCH = 500;

const SyncBody = z.object({
  mode: z.enum(["full", "incremental"]).default("full"),
  limit: z.number().int().positive().max(100000).optional(),
  view: z.string().min(1).max(120).optional(),
}).strict();

function getStr(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s.length > 0) return s;
  }
  return null;
}
function getNum(row: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = row[k];
    if (v === null || v === undefined || v === "") continue;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    if (!Number.isNaN(n)) return n;
  }
  return null;
}
function getInt(row: Record<string, unknown>, ...keys: string[]): number | null {
  const n = getNum(row, ...keys);
  return n === null ? null : Math.trunc(n);
}
function getBool(row: Record<string, unknown>, ...keys: string[]): boolean | null {
  for (const k of keys) {
    const v = row[k];
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "boolean") return v;
    const s = String(v).trim().toUpperCase();
    if (["1", "S", "SIM", "TRUE", "Y", "YES", "INATIVO"].includes(s)) return true;
    if (["0", "N", "NAO", "NÃO", "FALSE", "ATIVO"].includes(s)) return false;
  }
  return null;
}
function getDate(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (v === null || v === undefined || v === "") continue;
    if (v instanceof Date) return v.toISOString();
    const d = new Date(String(v));
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function normalizeRow(row: Record<string, unknown>) {
  // Mapeamento tolerante — tenta vários nomes comuns do RP.
  const codigo = getStr(row,
    "Codigo", "codigo", "CodCliente", "Cod_Cliente", "Cod.Cliente",
    "CodigoCliente", "Cliente", "ID_Cliente", "IdCliente");
  if (!codigo) return null;
  return {
    codigo_erp: codigo,
    cnpj: getStr(row, "CNPJ", "cnpj", "Cnpj", "CGC", "CPF_CNPJ"),
    razao_social: getStr(row, "RazaoSocial", "Razao_Social", "Razao Social", "razao_social", "Nome", "nome", "NomeRazao"),
    nome_fantasia: getStr(row, "NomeFantasia", "Nome_Fantasia", "Nome Fantasia", "nome_fantasia", "Fantasia", "NomeAbreviado"),
    email: getStr(row, "Email", "email", "EMail", "E_Mail"),
    telefone: getStr(row, "Telefone", "telefone", "Fone", "Telefone1"),
    celular: getStr(row, "Celular", "celular"),
    endereco: getStr(row, "Endereco", "Endereço", "endereco"),
    bairro: getStr(row, "Bairro", "bairro"),
    cidade: getStr(row, "Cidade", "cidade", "Municipio", "Município"),
    uf: getStr(row, "UF", "uf", "Estado", "Sigla_UF"),
    cep: getStr(row, "CEP", "cep", "Cep"),
    ibge_codigo: getInt(row, "CodigoIBGE", "Codigo_IBGE", "IBGE", "Cod_IBGE", "CodIBGE", "MunicipioIBGE"),
    data_cadastro: getDate(row, "DataCadastro", "Data_Cadastro", "Data Cadastro", "DtCadastro"),
    data_ultima_compra: getDate(row, "DataUltimaCompra", "Data_Ultima_Compra", "UltimaCompra", "DtUltCompra"),
    valor_ultima_compra: getNum(row, "ValorUltimaCompra", "Valor_Ultima_Compra", "VlrUltCompra"),
    data_maior_compra: getDate(row, "DataMaiorCompra", "Data_Maior_Compra", "DtMaiorCompra"),
    valor_maior_compra: getNum(row, "ValorMaiorCompra", "Valor_Maior_Compra", "VlrMaiorCompra"),
    vendedor_codigo: getInt(row, "CodVendedor", "Cod_Vendedor", "CodigoVendedor", "Vendedor_Codigo"),
    vendedor_nome: getStr(row, "Vendedor", "NomeVendedor", "Nome_Vendedor"),
    equipe_codigo: getInt(row, "CodEquipe", "Cod_Equipe", "Equipe_Codigo"),
    equipe_nome: getStr(row, "Equipe", "NomeEquipe", "Nome_Equipe"),
    supervisor: getStr(row, "Supervisor", "NomeSupervisor"),
    classificacao: getInt(row, "Classificacao", "Classificação", "classificacao"),
    limite_credito: getNum(row, "LimiteCredito", "Limite_Credito", "Limite de Credito"),
    status_bloqueio: getBool(row, "Inativo", "inativo", "Bloqueado") ? "bloqueado" : "ativo",
    inativo: getBool(row, "Inativo", "inativo", "Bloqueado") ?? false,
    raw: row,
  };
}

async function userHasRequiredRole(supabase: ReturnType<typeof createClient>, userId: string): Promise<boolean> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error || !data) return false;
  return data.some((r: { role: string }) => r.role === "admin" || r.role === "supervisor");
}

async function handler(req: Request, ctx: { userId?: string }): Promise<Response> {
  const cors = getCorsHeaders(req);
  const url = new URL(req.url);
  const action = url.pathname.split("/").filter(Boolean).pop() ?? "";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  if (!ctx.userId || !(await userHasRequiredRole(supabase, ctx.userId))) {
    return new Response(JSON.stringify({ error: "forbidden", reason: "requires admin or supervisor" }),
      { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
  }

  // ───── /describe ─────
  if (action === "describe") {
    const requestedView = url.searchParams.get("view") || undefined;
    let connection = null;
    try {
      connection = await connectToSqlServer();

      if (requestedView) {
        const cols = await executeSqlQuery(
          connection,
          `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
             FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = '${requestedView.replace(/'/g, "''")}'
            ORDER BY ORDINAL_POSITION`,
        );
        const sample = await executeSqlQuery(connection, `SELECT TOP 3 * FROM [${requestedView}]`);
        return new Response(JSON.stringify({ view: requestedView, columns: cols, sample }),
          { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // Sem view informada: lista candidatos Cust_*Cliente* + Cust_*Client*
      const candidates = await executeSqlQuery(
        connection,
        `SELECT TABLE_NAME, TABLE_TYPE
           FROM INFORMATION_SCHEMA.TABLES
          WHERE (TABLE_NAME LIKE 'Cust_%Cliente%' OR TABLE_NAME LIKE 'Cust_%Client%')
          ORDER BY TABLE_NAME`,
      );
      return new Response(JSON.stringify({
        candidates,
        default_view: DEFAULT_VIEW,
        hint: "Reenvie /describe?view=<TABLE_NAME> para inspecionar colunas",
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: "describe_failed", message: msg }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    } finally {
      closeConnectionSafe(connection);
    }
  }

  // ───── /sync ─────
  if (action === "sync") {
    const bodyJson = await req.json().catch(() => ({}));
    const parsed = SyncBody.safeParse(bodyJson);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "invalid_body", details: parsed.error.flatten() }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const { mode, limit, view } = parsed.data;
    const viewName = view || DEFAULT_VIEW;

    const startedAt = new Date();
    let connection = null;
    let totalLidos = 0;
    let totalUpserts = 0;
    const errors: string[] = [];

    try {
      connection = await connectToSqlServer();
      const topClause = limit ? `TOP ${limit} ` : "";
      const rows = await executeSqlQuery(connection, `SELECT ${topClause}* FROM [${viewName}]`);
      totalLidos = rows.length;

      const normalized = rows
        .map((r) => normalizeRow(r as Record<string, unknown>))
        .filter((x): x is NonNullable<typeof x> => x !== null);

      for (let i = 0; i < normalized.length; i += UPSERT_BATCH) {
        const chunk = normalized.slice(i, i + UPSERT_BATCH).map((n) => ({
          ...n,
          sincronizado_em: new Date().toISOString(),
        }));
        const { error: upErr } = await supabase
          .from("erp_clientes_raw")
          .upsert(chunk, { onConflict: "codigo_erp" });
        if (upErr) errors.push(`upsert i=${i}: ${upErr.message}`);
        else totalUpserts += chunk.length;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`sql: ${msg}`);
    } finally {
      closeConnectionSafe(connection);
    }

    // aplica no master
    let aplicado: unknown = null;
    try {
      const { data, error } = await supabase.rpc("aplicar_clientes_rp_no_master");
      if (error) errors.push(`rpc: ${error.message}`);
      else aplicado = data;
    } catch (err) {
      errors.push(`rpc_throw: ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      await supabase.from("erp_sync_log").insert({
        sync_type: "erp_clientes",
        status: errors.length === 0 ? "success" : "partial",
        started_at: startedAt.toISOString(),
        completed_at: new Date().toISOString(),
        records_processed: totalLidos,
        records_inserted: totalUpserts,
        error_message: errors.length ? errors.slice(0, 5).join(" | ") : null,
        metadata: { mode, view: viewName, aplicado },
      });
    } catch { /* ignora se o shape não bater */ }

    return new Response(JSON.stringify({
      ok: errors.length === 0,
      mode, view: viewName,
      total_lidos: totalLidos,
      total_upserts: totalUpserts,
      aplicado,
      errors,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "not_found", hint: "use /describe or /sync" }),
    { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 6, rateLimitPrefix: "sync-erp-clientes" },
  handler,
));
