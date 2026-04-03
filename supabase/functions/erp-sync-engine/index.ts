// erp-sync-engine — Direct SQL Server ERP integration (replaces N8N)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";

// ─── SQL Server connection via tedious ───
import { Connection, Request as TdsRequest } from "npm:tedious@19.0.0";

interface SqlRow {
  [key: string]: unknown;
}

// ─── Config ───
const UPSERT_BATCH_SIZE = 100;

function connectToSqlServer(): Promise<Connection> {
  return new Promise((resolve, reject) => {
    const config = {
      server: Deno.env.get("ERP_SQL_HOST") || "",
      authentication: {
        type: "default" as const,
        options: {
          userName: Deno.env.get("ERP_SQL_USER") || "",
          password: Deno.env.get("ERP_SQL_PASSWORD") || "",
        },
      },
      options: {
        database: Deno.env.get("ERP_SQL_DATABASE") || "",
        port: parseInt(Deno.env.get("ERP_SQL_PORT") || "1433"),
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 15000,
        requestTimeout: 120000,
        rowCollectionOnDone: true,
        rowCollectionOnRequestCompletion: true,
      },
    };

    const connection = new Connection(config);
    connection.on("connect", (err: Error | undefined) => {
      if (err) reject(new Error(`SQL Server connection failed: ${err.message}`));
      else resolve(connection);
    });
    connection.on("error", (err: Error) => {
      reject(new Error(`SQL Server error: ${err.message}`));
    });
    connection.connect();
  });
}

function executeSqlQuery(connection: Connection, query: string): Promise<SqlRow[]> {
  return new Promise((resolve, reject) => {
    const rows: SqlRow[] = [];
    const request = new TdsRequest(query, (err: Error | undefined) => {
      if (err) reject(new Error(`SQL query failed: ${err.message}`));
      else resolve(rows);
    });
    request.on("row", (columns: Array<{ metadata: { colName: string }; value: unknown }>) => {
      const row: SqlRow = {};
      for (const col of columns) {
        row[col.metadata.colName] = col.value;
      }
      rows.push(row);
    });
    connection.execSql(request);
  });
}

// ─── Helpers ───

function parseDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().split("T")[0];
  if (typeof value === "string") {
    try {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
    } catch { return null; }
  }
  return null;
}

function parseAmount(value: unknown): number {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const s = String(value).replace(/\./g, "").replace(",", ".");
  return parseFloat(s) || 0;
}

function deriveStatus(valorAberto: number, valorPago: number): string {
  if (valorAberto === 0 && valorPago > 0) return "pago";
  if (valorPago > 0 && valorAberto > 0) return "parcial";
  return "aberto";
}

// ─── Transformers ───

function transformContasReceber(row: SqlRow) {
  const valorAberto = parseAmount(row["Valor em Aberto"]);
  const valorPago = parseAmount(row["Valor Pago"]);
  const empresaId = row["ID Empresa"] || 1;
  const tipo = row["Tipo"] || "";
  const nota = row["Nota"] || "";
  const seq = row["Seq"] || 1;
  const erpId = `${empresaId}-${tipo}-${nota}-${seq}`.replace(/\s+/g, "");

  return {
    erp_id: erpId,
    empresa_id: empresaId,
    empresa_nome: row["Empresa"] || null,
    tipo_documento: String(row["Tipo"] || ""),
    numero_documento: String(row["Nota"] || ""),
    parcela: parseInt(String(row["Seq"])) || 1,
    cliente_codigo: String(row["Código"] || row["Codigo"] || ""),
    cliente_nome: row["Cliente"] || null,
    valor_original: parseAmount(row["Valor_Trc"]),
    valor_aberto: valorAberto,
    valor_recebido: valorPago,
    valor_juros: parseAmount(row["Valor Juros"]),
    valor_desconto: parseAmount(row["Valor Desconto"]),
    valor_ajustes: parseAmount(row["Valor Ajustes"]),
    data_emissao: parseDate(row["Emissão"] || row["Emissao"]),
    data_vencimento: parseDate(row["Vencimento"]),
    data_recebimento: parseDate(row["Data Pgto"]),
    status: deriveStatus(valorAberto, valorPago),
    portador: row["Nome Portador"] || null,
    portador_id: row["ID Portador"] ? String(row["ID Portador"]) : null,
    vendedor: row["Vendedor"] || null,
    vendedor_nome: row["Vendedor"] || null,
    tabela: row["Tabela"] || null,
    conta: row["Conta"] || null,
    sincronizado_em: new Date().toISOString(),
  };
}

function transformContasPagar(row: SqlRow) {
  const valorAberto = parseAmount(row["Valor em Aberto"]);
  const valorPago = parseAmount(row["Valor Pago"]);
  const empresaId = row["ID Empresa"] || 1;
  const tipo = row["Tipo"] || "";
  const nota = row["Nota"] || "";
  const seq = row["Seq"] || 1;
  const erpId = `CP-${empresaId}-${tipo}-${nota}-${seq}`.replace(/\s+/g, "");

  return {
    erp_id: erpId,
    empresa_id: empresaId,
    empresa_nome: row["Empresa"] || null,
    tipo_documento: String(tipo),
    numero_documento: String(nota),
    parcela: parseInt(String(seq)) || 1,
    fornecedor_codigo: String(row["Código"] || row["Codigo"] || ""),
    fornecedor_nome: row["Cliente"] || null,
    valor_original: parseAmount(row["Valor_Trc"]),
    valor_aberto: valorAberto,
    valor_pago: valorPago,
    valor_juros: parseAmount(row["Valor Juros"]),
    valor_desconto: parseAmount(row["Valor Desconto"]),
    valor_ajustes: parseAmount(row["Valor Ajustes"]),
    data_emissao: parseDate(row["Emissão"]),
    data_vencimento: parseDate(row["Vencimento"]),
    data_pagamento: parseDate(row["Data Pgto"]),
    categoria_nome: row["Historico"] || null,
    portador: row["Portador"] || null,
    conta: row["Conta"] || null,
    status: deriveStatus(valorAberto, valorPago),
    sincronizado_em: new Date().toISOString(),
  };
}

// ─── Batch upsert ───

async function batchUpsert(
  supabase: ReturnType<typeof createClient>,
  table: string,
  records: Record<string, unknown>[],
  conflictColumn: string
): Promise<{ inserted: number; errors: string[] }> {
  let inserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < records.length; i += UPSERT_BATCH_SIZE) {
    const batch = records.slice(i, i + UPSERT_BATCH_SIZE);
    const { error } = await supabase
      .from(table)
      .upsert(batch as any, { onConflict: conflictColumn, ignoreDuplicates: false });

    if (error) {
      errors.push(`Batch ${Math.floor(i / UPSERT_BATCH_SIZE)}: ${error.message}`);
      console.error(`❌ Upsert error batch ${i}: ${error.message}`);
    } else {
      inserted += batch.length;
    }
    // Small delay between batches
    if (i + UPSERT_BATCH_SIZE < records.length) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  return { inserted, errors };
}

// ─── Record sync in sync_control ───

async function recordSync(
  supabase: ReturnType<typeof createClient>,
  entidade: string,
  data: {
    status: string;
    totalRegistros: number;
    registrosInseridos: number;
    duracaoMs: number;
    erroMensagem?: string;
    empresaId?: number;
  }
) {
  await supabase.from("sync_control").insert({
    entidade,
    empresa_id: data.empresaId || 1,
    ultima_sync: new Date().toISOString(),
    total_registros: data.totalRegistros,
    registros_inseridos: data.registrosInseridos,
    registros_atualizados: 0,
    registros_ignorados: 0,
    duracao_ms: data.duracaoMs,
    status: data.status,
    erro_mensagem: data.erroMensagem || null,
  });
}

// ─── Route handlers ───

async function handleTestConnection(req: Request, startMs: number) {
  let connection: Connection | null = null;
  try {
    connection = await connectToSqlServer();
    const rows = await executeSqlQuery(connection, "SELECT TOP 5 * FROM ConsultaPowerBIReceber");
    return jsonResponse(
      { success: true, message: "Conexão com SQL Server OK", rowCount: rows.length, sampleData: rows },
      200, req, { startMs }
    );
  } catch (error) {
    return errorResponse(500, "connection_failed", error instanceof Error ? error.message : "Erro", req, startMs);
  } finally {
    if (connection) try { connection.close(); } catch (_) {}
  }
}

async function handleListTables(req: Request, startMs: number) {
  let connection: Connection | null = null;
  try {
    connection = await connectToSqlServer();
    const rows = await executeSqlQuery(
      connection,
      `SELECT TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_NAME LIKE '%PowerBI%'
          OR TABLE_NAME LIKE '%Pagar%'
          OR TABLE_NAME LIKE '%Receber%'
          OR TABLE_NAME LIKE '%Vendedor%'
          OR TABLE_NAME LIKE '%Vnd%'
          OR TABLE_NAME LIKE '%Consulta%'
       ORDER BY TABLE_NAME`
    );
    return jsonResponse({ success: true, tables: rows, count: rows.length }, 200, req, { startMs });
  } catch (error) {
    return errorResponse(500, "query_failed", error instanceof Error ? error.message : "Erro", req, startMs);
  } finally {
    if (connection) try { connection.close(); } catch (_) {}
  }
}

async function handlePreviewTable(req: Request, startMs: number) {
  const body = await req.json();
  const tableName = body.table;
  if (!tableName || !/^[a-zA-Z0-9_]+$/.test(tableName)) {
    return errorResponse(400, "invalid_table", "Nome de tabela inválido", req, startMs);
  }

  let connection: Connection | null = null;
  try {
    connection = await connectToSqlServer();
    const rows = await executeSqlQuery(connection, `SELECT TOP 10 * FROM [${tableName}]`);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return jsonResponse({ success: true, table: tableName, columns, rowCount: rows.length, sampleData: rows }, 200, req, { startMs });
  } catch (error) {
    return errorResponse(500, "query_failed", error instanceof Error ? error.message : "Erro", req, startMs);
  } finally {
    if (connection) try { connection.close(); } catch (_) {}
  }
}

async function handleSyncContasReceber(req: Request, startMs: number) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let connection: Connection | null = null;
  try {
    connection = await connectToSqlServer();
    console.log("📥 Fetching ConsultaPowerBIReceber...");
    const rows = await executeSqlQuery(connection, "SELECT * FROM ConsultaPowerBIReceber");
    console.log(`📊 Got ${rows.length} rows from SQL Server`);

    const transformed = rows.map(transformContasReceber);
    const { inserted, errors } = await batchUpsert(supabase, "contas_receber", transformed, "erp_id");
    const duration = Date.now() - startMs;

    await recordSync(supabase, "contas_receber", {
      status: errors.length > 0 ? "partial" : "success",
      totalRegistros: rows.length,
      registrosInseridos: inserted,
      duracaoMs: duration,
      erroMensagem: errors.length > 0 ? errors.join("; ") : undefined,
    });

    return jsonResponse({
      success: true,
      entity: "contas_receber",
      source: "ConsultaPowerBIReceber",
      totalRows: rows.length,
      upserted: inserted,
      errors: errors.length > 0 ? errors : undefined,
    }, 200, req, { startMs });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro";
    await recordSync(supabase, "contas_receber", { status: "error", totalRegistros: 0, registrosInseridos: 0, duracaoMs: Date.now() - startMs, erroMensagem: msg });
    return errorResponse(500, "sync_failed", msg, req, startMs);
  } finally {
    if (connection) try { connection.close(); } catch (_) {}
  }
}

async function handleSyncContasPagar(req: Request, startMs: number) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let connection: Connection | null = null;
  try {
    connection = await connectToSqlServer();
    console.log("📥 Fetching ConsultaPowerBIPagar...");
    const rows = await executeSqlQuery(connection, "SELECT * FROM ConsultaPowerBIPagar");
    console.log(`📊 Got ${rows.length} rows from SQL Server`);

    const transformed = rows.map(transformContasPagar);
    const { inserted, errors } = await batchUpsert(supabase, "contas_pagar", transformed, "erp_id");
    const duration = Date.now() - startMs;

    await recordSync(supabase, "contas_pagar", {
      status: errors.length > 0 ? "partial" : "success",
      totalRegistros: rows.length,
      registrosInseridos: inserted,
      duracaoMs: duration,
      erroMensagem: errors.length > 0 ? errors.join("; ") : undefined,
    });

    return jsonResponse({
      success: true,
      entity: "contas_pagar",
      source: "ConsultaPowerBIPagar",
      totalRows: rows.length,
      upserted: inserted,
      errors: errors.length > 0 ? errors : undefined,
    }, 200, req, { startMs });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro";
    await recordSync(supabase, "contas_pagar", { status: "error", totalRegistros: 0, registrosInseridos: 0, duracaoMs: Date.now() - startMs, erroMensagem: msg });
    return errorResponse(500, "sync_failed", msg, req, startMs);
  } finally {
    if (connection) try { connection.close(); } catch (_) {}
  }
}

async function handleSyncAll(req: Request, startMs: number) {
  const results: Record<string, unknown> = {};

  // Sync contas_receber
  try {
    const crResponse = await handleSyncContasReceber(req.clone(), startMs);
    results.contas_receber = await crResponse.json();
  } catch (e) {
    results.contas_receber = { success: false, error: e instanceof Error ? e.message : "Erro" };
  }

  // Sync contas_pagar
  try {
    const cpResponse = await handleSyncContasPagar(req.clone(), startMs);
    results.contas_pagar = await cpResponse.json();
  } catch (e) {
    results.contas_pagar = { success: false, error: e instanceof Error ? e.message : "Erro" };
  }

  return jsonResponse({ success: true, results }, 200, req, { startMs });
}

async function handleStatus(req: Request, startMs: number) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Last sync per entity
  const { data: lastCR } = await supabase
    .from("sync_control").select("ultima_sync, status, total_registros, duracao_ms")
    .eq("entidade", "contas_receber").order("ultima_sync", { ascending: false }).limit(1).maybeSingle();

  const { data: lastCP } = await supabase
    .from("sync_control").select("ultima_sync, status, total_registros, duracao_ms")
    .eq("entidade", "contas_pagar").order("ultima_sync", { ascending: false }).limit(1).maybeSingle();

  // Quick SQL Server check
  let sqlOk = false;
  let sqlError = "";
  let connection: Connection | null = null;
  try {
    connection = await connectToSqlServer();
    await executeSqlQuery(connection, "SELECT 1 AS test");
    sqlOk = true;
  } catch (e) {
    sqlError = e instanceof Error ? e.message : "Erro";
  } finally {
    if (connection) try { connection.close(); } catch (_) {}
  }

  return jsonResponse({
    success: true,
    sqlServerConnected: sqlOk,
    sqlServerError: sqlError || undefined,
    lastSync: {
      contas_receber: lastCR || null,
      contas_pagar: lastCP || null,
    },
    connectionInfo: {
      host: Deno.env.get("ERP_SQL_HOST"),
      port: Deno.env.get("ERP_SQL_PORT"),
      database: Deno.env.get("ERP_SQL_DATABASE"),
    },
  }, 200, req, { startMs });
}

// ─── Main handler ───

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const startMs = Date.now();

  try {
    const url = new URL(req.url);
    let path = url.pathname.replace(/^\/erp-sync-engine\/?/, "").replace(/^\//, "");

    if (!path && req.method === "POST") {
      try {
        const body = await req.clone().json();
        path = body.path?.replace(/^\//, "") || "";
      } catch (_) {}
    }

    switch (path) {
      case "test-connection":
        return await handleTestConnection(req, startMs);
      case "list-tables":
        return await handleListTables(req, startMs);
      case "preview-table":
        return await handlePreviewTable(req, startMs);
      case "sync-contas-receber":
        return await handleSyncContasReceber(req, startMs);
      case "sync-contas-pagar":
        return await handleSyncContasPagar(req, startMs);
      case "sync-all":
        return await handleSyncAll(req, startMs);
      case "status":
        return await handleStatus(req, startMs);
      default:
        return jsonResponse({
          success: true,
          message: "ERP Sync Engine — Pipeline Direto SQL Server",
          availableRoutes: [
            "POST /test-connection — Testa conexão SQL Server",
            "POST /list-tables — Lista tabelas/views disponíveis",
            "POST /preview-table — Preview de 10 rows de uma tabela (body: { table })",
            "POST /sync-contas-receber — Sync ConsultaPowerBIReceber → contas_receber",
            "POST /sync-contas-pagar — Sync ConsultaPowerBIPagar → contas_pagar",
            "POST /sync-all — Sync de todas as entidades",
            "POST /status — Status da conexão e última sync por entidade",
          ],
        }, 200, req, { startMs });
    }
  } catch (error) {
    return errorResponse(500, "internal_error", error instanceof Error ? error.message : "Erro interno", req, startMs);
  }
});
