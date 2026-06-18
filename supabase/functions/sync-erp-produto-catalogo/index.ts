// sync-erp-produto-catalogo
// Sincroniza Cust_EstruturaProdutosSP (RP/SQL Server) -> erp_produto_catalogo_raw
// e aplica no estoque_produtos_master via RPC aplicar_catalogo_rp_no_master.
//
// Endpoints (POST):
//   /describe  -> retorna mapeamento INFORMATION_SCHEMA.COLUMNS da view RP
//   /sync      -> { mode: "full"|"incremental", limit? } executa sincronização
//
// Auth: JWT obrigatório; exige admin OU supervisor.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { connectToSqlServer, executeSqlQuery, closeConnectionSafe } from "../_shared/erp-mssql.ts";

const VIEW_NAME = "Cust_EstruturaProdutosSP";
const PAGE_SIZE = 1000;
const UPSERT_BATCH = 500;

const SyncBody = z.object({
  mode: z.enum(["full", "incremental"]).default("full"),
  limit: z.number().int().positive().max(50000).optional(),
}).strict();

function getNum(row: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = row[k];
    if (v === null || v === undefined || v === "") continue;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

function getStr(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s.length > 0) return s;
  }
  return null;
}

function getBool(row: Record<string, unknown>, ...keys: string[]): boolean | null {
  for (const k of keys) {
    const v = row[k];
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "boolean") return v;
    const s = String(v).trim().toUpperCase();
    if (["1", "S", "SIM", "TRUE", "ATIVO", "Y", "YES"].includes(s)) return true;
    if (["0", "N", "NAO", "NÃO", "FALSE", "INATIVO"].includes(s)) return false;
  }
  return null;
}

function normalizeRow(row: Record<string, unknown>) {
  // Mapeamento real (confirmado via /describe em Cust_EstruturaProdutosSP):
  //   Cod.Atrio | Descricao Produto | Ean | UNIDADE | NCM | Peso | Altura | Largura | Comprimento | Marca | Forncedor | Registro Anvisa | Cest | CSTPIS | PREÇO VENDA | Origem
  // Não há EAN unitário e EAN caixa separados — discrimina por UNIDADE (UN x CX).
  const codigo = getStr(row, "Cod.Atrio", "codigo", "Codigo", "cod_produto");
  if (!codigo) return null;
  const unidade = getStr(row, "UNIDADE", "unidade", "Unidade");
  const ean = getStr(row, "Ean", "EAN", "ean");
  const isCaixa = (unidade ?? "").toUpperCase().startsWith("CX");
  return {
    codigo_rp: codigo,
    descricao: getStr(row, "Descricao Produto", "descricao", "Descricao"),
    ean_unitario: !isCaixa ? ean : null,
    ean_caixa: isCaixa ? ean : null,
    unidade,
    peso_liquido_kg: getNum(row, "Peso", "peso_liquido", "Peso_Liquido"),
    peso_bruto_kg: getNum(row, "Peso_Bruto", "peso_bruto"), // RP não devolve hoje
    altura_cm: getNum(row, "Altura", "altura"),
    largura_cm: getNum(row, "Largura", "largura"),
    profundidade_cm: getNum(row, "Comprimento", "profundidade"),
    ncm: getStr(row, "NCM", "ncm"),
    categoria: getStr(row, "Marca", "categoria", "Categoria"),
    ativo: getBool(row, "ativo", "Ativo"),
    raw: row,
  };
}

async function userHasRequiredRole(supabase: ReturnType<typeof createClient>, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
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
    let connection = null;
    try {
      connection = await connectToSqlServer();
      const cols = await executeSqlQuery(
        connection,
        `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
           FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = '${VIEW_NAME}'
          ORDER BY ORDINAL_POSITION`,
      );
      const sample = await executeSqlQuery(connection, `SELECT TOP 3 * FROM [${VIEW_NAME}]`);
      return new Response(JSON.stringify({ view: VIEW_NAME, columns: cols, sample }),
        { headers: { ...cors, "Content-Type": "application/json" } });
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
    const { mode, limit } = parsed.data;

    const startedAt = new Date();
    let connection = null;
    let totalLidos = 0;
    let totalUpserts = 0;
    const errors: string[] = [];

    try {
      connection = await connectToSqlServer();

      // Carga em página única — view RP tem volumetria baixa o suficiente.
      // OFFSET/FETCH com [Cod.Atrio] estava falhando silenciosamente neste view.
      const topClause = limit ? `TOP ${limit} ` : "";
      const rows = await executeSqlQuery(
        connection,
        `SELECT ${topClause}* FROM [${VIEW_NAME}]`,
      );
      totalLidos = rows.length;

      const normalized = rows
        .map((r) => normalizeRow(r as Record<string, unknown>))
        .filter((x): x is NonNullable<typeof x> => x !== null);

      // upsert em lotes (evita payloads gigantes pro PostgREST)
      for (let i = 0; i < normalized.length; i += UPSERT_BATCH) {
        const chunk = normalized.slice(i, i + UPSERT_BATCH).map((n) => ({
          ...n,
          sincronizado_em: new Date().toISOString(),
        }));
        const { error: upErr } = await supabase
          .from("erp_produto_catalogo_raw")
          .upsert(chunk, { onConflict: "codigo_rp" });
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
      const { data, error } = await supabase.rpc("aplicar_catalogo_rp_no_master");
      if (error) errors.push(`rpc: ${error.message}`);
      else aplicado = data;
    } catch (err) {
      errors.push(`rpc_throw: ${err instanceof Error ? err.message : String(err)}`);
    }

    // log opcional em erp_sync_log
    try {
      await supabase.from("erp_sync_log").insert({
        sync_type: "erp_produto_catalogo",
        status: errors.length === 0 ? "success" : "partial",
        started_at: startedAt.toISOString(),
        completed_at: new Date().toISOString(),
        records_processed: totalLidos,
        records_inserted: totalUpserts,
        error_message: errors.length ? errors.slice(0, 5).join(" | ") : null,
        metadata: { mode, aplicado },
      });
    } catch { /* tabela pode não aceitar este shape — ignora */ }

    return new Response(JSON.stringify({
      ok: errors.length === 0,
      mode,
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
  { auth: "jwt", rateLimit: 6, rateLimitPrefix: "sync-erp-produto-catalogo" },
  handler,
));
