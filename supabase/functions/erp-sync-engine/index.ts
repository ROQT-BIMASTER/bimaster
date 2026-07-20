import { logger } from "../_shared/logger.ts";
// erp-sync-engine — Direct SQL Server ERP integration (replaces N8N)
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { secureHandler } from "../_shared/secure-handler.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { validateAnyAuth, AuthError } from "../_shared/auth.ts";
import { timingSafeEqual } from "../_shared/timing-safe.ts";
import { getAtrioToken, atrioHeaders } from "../_shared/atrio-auth.ts";

// ─── SQL Server connection via tedious ───
import { Connection, Request as TdsRequest } from "npm:tedious@19.0.0";

interface SqlRow {
  [key: string]: unknown;
}

// ─── Config ───
const UPSERT_BATCH_SIZE = 500;
const SQL_PAGE_SIZE = 3000;
const DEADLOCK_MAX_RETRIES = 2;
const DEADLOCK_INITIAL_DELAY_MS = 500;

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
        encrypt: false, // SQL Server does not support SSL — internal DDNS network
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

function executeSqlQueryOnce(connection: Connection, query: string): Promise<SqlRow[]> {
  return new Promise((resolve, reject) => {
    const rows: SqlRow[] = [];
    const request = new TdsRequest(query, (err: any) => {
      if (err) {
        const inner = Array.isArray(err?.errors)
          ? err.errors.map((e: any) => `${e?.message ?? e}`).join(" ; ")
          : "";
        const detail = [
          err?.message,
          err?.number ? `number=${err.number}` : null,
          err?.state ? `state=${err.state}` : null,
          err?.code ? `code=${err.code}` : null,
          err?.procName ? `proc=${err.procName}` : null,
          err?.lineNumber ? `line=${err.lineNumber}` : null,
          inner ? `inner=[${inner}]` : null,
        ].filter(Boolean).join(" | ");
        reject(new Error(`SQL query failed: ${detail || String(err)}`));
      } else resolve(rows);
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



// Transient SQL Server errors (tempdb full, deadlock, log backup, timeout) — retry with backoff
function isTransientSqlError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("tempdb") ||
    m.includes("transaction log") ||
    m.includes("log for database") ||
    m.includes("deadlock") ||
    m.includes("timeout") ||
    m.includes("could not allocate space")
  );
}

async function executeSqlQuery(connection: Connection, query: string): Promise<SqlRow[]> {
  const delays = [2000, 5000, 10000];
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await executeSqlQueryOnce(connection, query);
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt === delays.length || !isTransientSqlError(lastErr.message)) throw lastErr;
      logger.log(`⚠️ Transient SQL error (attempt ${attempt + 1}): ${lastErr.message.slice(0, 160)} — retrying in ${delays[attempt]}ms`);
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
  throw lastErr ?? new Error("SQL query failed");
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

function getBrazilToday(): Date {
  const brNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return new Date(brNow.getFullYear(), brNow.getMonth(), brNow.getDate());
}

function deriveStatus(valorAberto: number, valorPago: number, dataVencimento: string | null): string {
  if (valorAberto === 0 && valorPago > 0) return "recebido";
  if (valorPago > 0 && valorAberto > 0) return "parcial";
  if (valorAberto > 0 && dataVencimento) {
    const venc = new Date(dataVencimento + 'T00:00:00');
    const hoje = getBrazilToday();
    if (venc < hoje) return "vencido";
  }
  return "pendente";
}

function isDeadlockError(error: unknown): boolean {
  if (!error) return false;
  const msg = (error as any)?.message?.toLowerCase() || "";
  return msg.includes("deadlock") || msg.includes("lock request time out") || msg.includes("could not serialize");
}

// ─── Transformers ───

function transformContasReceber(row: SqlRow) {
  const valorAberto = parseAmount(row["Valor em Aberto"]);
  let valorPago = parseAmount(row["Valor Pago"]);
  const valorOriginal = parseAmount(row["Valor_Trc"]);
  const dataVencimento = parseDate(row["Vencimento"]);
  const empresaId = row["ID Empresa"] || 1;
  const tipo = row["Tipo"] || "";
  const nota = row["Nota"] || "";
  const seq = row["Seq"] || 1;
  const codigo = row["Código"] || row["Codigo"] || "";
  const erpId = `${empresaId}-${tipo}-${nota}-${seq}-${codigo}`.replace(/\s+/g, "");

  // Fallback: se valorPago=0 mas valorAberto=0 e valorOriginal>0, o título foi quitado por ajustes
  if (valorPago === 0 && valorAberto === 0 && valorOriginal > 0) {
    valorPago = valorOriginal;
  }

  return {
    erp_id: erpId,
    empresa_id: empresaId,
    empresa_nome: row["Empresa"] || null,
    tipo_documento: String(row["Tipo"] || ""),
    numero_documento: String(row["Nota"] || ""),
    parcela: parseInt(String(row["Seq"])) || 1,
    cliente_codigo: String(row["Código"] || row["Codigo"] || ""),
    cliente_nome: row["Cliente"] || null,
    valor_original: valorOriginal,
    valor_aberto: valorAberto,
    valor_recebido: valorPago,
    valor_juros: parseAmount(row["Valor Juros"]),
    valor_desconto: parseAmount(row["Valor Desconto"]),
    valor_ajustes: parseAmount(row["Valor Ajustes"]),
    data_emissao: parseDate(row["Emissão"] || row["Emissao"]),
    data_vencimento: dataVencimento,
    data_recebimento: parseDate(row["Data Pgto"]),
    status: deriveStatus(valorAberto, valorPago, dataVencimento),
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
  let valorPago = parseAmount(row["Valor Pago"]);
  const valorOriginal = parseAmount(row["Valor_Trc"]);
  const dataVencimento = parseDate(row["Vencimento"]);
  const empresaId = row["ID Empresa"] || 1;
  const tipo = row["Tipo"] || "";
  const nota = row["Nota"] || "";
  const seq = row["Seq"] || 1;
  const codigo = row["Código"] || row["Codigo"] || "";
  const erpId = `${empresaId}-${tipo}-${nota}-${seq}-${codigo}`.replace(/\s+/g, "");

  // Fallback para títulos quitados por ajustes
  if (valorPago === 0 && valorAberto === 0 && valorOriginal > 0) {
    valorPago = valorOriginal;
  }

  return {
    erp_id: erpId,
    empresa_id: empresaId,
    empresa_nome: row["Empresa"] || null,
    tipo_documento: String(tipo),
    numero_documento: String(nota),
    parcela: parseInt(String(seq)) || 1,
    fornecedor_codigo: String(row["Código"] || row["Codigo"] || ""),
    fornecedor_nome: row["Cliente"] || null,
    valor_original: valorOriginal,
    valor_aberto: valorAberto,
    valor_pago: valorPago,
    valor_juros: parseAmount(row["Valor Juros"]),
    valor_desconto: parseAmount(row["Valor Desconto"]),
    valor_ajustes: parseAmount(row["Valor Ajustes"]),
    data_emissao: parseDate(row["Emissão"]),
    data_vencimento: dataVencimento,
    data_pagamento: parseDate(row["Data Pgto"]),
    categoria_nome: row["Historico"] || null,
    portador: row["Portador"] || null,
    conta: row["Conta"] || null,
    status: deriveStatus(valorAberto, valorPago, dataVencimento),
    sincronizado_em: new Date().toISOString(),
  };
}

// ─── Vendas (ConsultaPowerBI → public."Union") ───

function parseInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = parseInt(String(value));
  return isNaN(n) ? null : n;
}

function parseTimestamp(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    try { return new Date(value).toISOString(); } catch { return null; }
  }
  return null;
}

function transformVendas(row: SqlRow) {
  const idEmpresa = parseInteger(row["ID Empresa"]) ?? 0;
  const nota = parseInteger(row["Nota"]) ?? 0;
  const pedido = parseInteger(row["Pedido"]) ?? 0;
  const codProduto = parseInteger(row["Cod.Produto"] ?? row["Cod Produto"]) ?? 0;
  const erpId = `${idEmpresa}-${nota}-${pedido}-${codProduto}`;

  const quantidade = parseAmount(row["Quantidade"]);
  const precoVenda = parseAmount(row["Preço"] ?? row["Preco"] ?? row["Preco Venda"]);
  const vlDesconto = parseAmount(row["Vl.Desconto"] ?? row["Vl Desconto"]);
  // A view ConsultaPowerBI já entrega [Venda] calculado — preferimos esse valor.
  const vendaView = parseAmount(row["Venda"]);
  const venda = vendaView !== 0 ? vendaView : (quantidade * precoVenda - vlDesconto);

  return {
    erp_id: erpId,
    id_empresa: idEmpresa,
    empresa: row["Empresa"] ?? null,
    pedido,
    data: parseTimestamp(row["Data"]),
    nota,
    operacao: row["Operação"] ?? row["Operacao"] ?? null,
    cod_cliente: parseInteger(row["Cod.Cliente"] ?? row["Cod Cliente"]),
    cliente: row["Cliente"] ?? null,
    id_ramo: parseInteger(row["IDRAMO"] ?? row["ID Ramo"]),
    ramo: row["Ramo"] ?? null,
    cidade: row["Cidade"] ?? null,
    uf: row["UF"] ?? null,
    tp_venda: row["TP VENDA"] ?? row["Tp Venda"] ?? null,
    tp_nfe: row["TP NFE"] ?? row["Tp NFe"] ?? null,
    cod_produto: codProduto,
    descricao: row["Descrição"] ?? row["Descricao"] ?? null,
    marca: row["Marca"] ?? null,
    quantidade,
    preco_venda: precoVenda,
    vl_desconto: vlDesconto,
    vl_icm_subst: parseAmount(row["Vl.Icm Subst."] ?? row["Vl ICM Subst"]),
    vl_cmv: parseAmount(row["Vl.CMV"] ?? row["Vl CMV"]),
    vl_outros_custos: parseAmount(row["Vl.Outros custos"] ?? row["Vl Outros Custos"]),
    tabela: row["Tabela"] ?? null,
    cod_vend: parseInteger(row["Cod.Vend"] ?? row["Cod Vend"]),
    vendedor: row["Vendedor"] ?? null,
    cod_equipe: parseInteger(row["Cod.Equipe"] ?? row["Cod Equipe"]),
    nome_equipe: row["Nome Equipe"] ?? null,
    supervisor: row["Supervisor"] ?? null,
    nome_linha: row["NomeLinha"] ?? row["Nome Linha"] ?? null,
    venda,
    sincronizado_em: new Date().toISOString(),
  };
}

async function batchUpsert(
  supabase: any,
  table: string,
  records: Record<string, unknown>[],
  conflictColumn: string
): Promise<{ inserted: number; errors: string[]; deadlockRetries: number }> {
  let inserted = 0;
  const errors: string[] = [];
  let deadlockRetries = 0;

  // Deduplicate by conflict column (keep last occurrence)
  const deduped = new Map<string, Record<string, unknown>>();
  for (const r of records) {
    deduped.set(String(r[conflictColumn] ?? ""), r);
  }
  const uniqueRecords = Array.from(deduped.values());

  for (let i = 0; i < uniqueRecords.length; i += UPSERT_BATCH_SIZE) {
    const batch = uniqueRecords.slice(i, i + UPSERT_BATCH_SIZE);
    let success = false;

    for (let attempt = 0; attempt <= DEADLOCK_MAX_RETRIES; attempt++) {
      const { error } = await supabase
        .from(table)
        .upsert(batch as any, { onConflict: conflictColumn, ignoreDuplicates: false });

      if (!error) {
        inserted += batch.length;
        success = true;
        if (attempt > 0) {
          logger.log(`🔄 Batch ${Math.floor(i / UPSERT_BATCH_SIZE)} succeeded after ${attempt} retries`);
        }
        break;
      }

      if (isDeadlockError(error) && attempt < DEADLOCK_MAX_RETRIES) {
        deadlockRetries++;
        const delay = DEADLOCK_INITIAL_DELAY_MS * Math.pow(2, attempt);
        logger.warn(`🔒 Deadlock on batch ${Math.floor(i / UPSERT_BATCH_SIZE)}, retry ${attempt + 1}/${DEADLOCK_MAX_RETRIES} in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      errors.push(`Batch ${Math.floor(i / UPSERT_BATCH_SIZE)}: ${error.message}`);
      logger.error(`❌ Upsert error batch ${i}: ${error.message}`);
      break;
    }

    // Small delay between batches
    if (i + UPSERT_BATCH_SIZE < uniqueRecords.length) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  return { inserted, errors, deadlockRetries };
}

// ─── Record sync in sync_control + sync_metrics ───

async function recordSync(
  supabase: any,
  entidade: string,
  data: {
    status: string;
    totalRegistros: number;
    registrosInseridos: number;
    duracaoMs: number;
    erroMensagem?: string;
    empresaId?: number;
    pagesProcessed?: number;
    deadlockRetries?: number;
  }
) {
  // Record in sync_control
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

  // Record in sync_metrics for observability
  try {
    const rowsPerSecond = data.duracaoMs > 0 ? Math.round((data.totalRegistros / data.duracaoMs) * 1000) : 0;
    const { error: metricsError } = await supabase.from("sync_metrics" as any).insert({
      entity: entidade,
      empresa_id: data.empresaId || 1,
      pages: data.pagesProcessed || 0,
      rows: data.totalRegistros,
      rows_inserted: data.registrosInseridos,
      duration_ms: data.duracaoMs,
      errors: data.erroMensagem ? 1 : 0,
      deadlock_retries: data.deadlockRetries || 0,
      rows_per_second: rowsPerSecond,
      status: data.status,
    });
    if (metricsError) {
      logger.error(`⚠️ sync_metrics insert failed: ${metricsError.message}`, metricsError);
    } else {
      logger.log(`📊 sync_metrics recorded: ${entidade} | ${data.totalRegistros} rows | ${rowsPerSecond} r/s`);
    }
  } catch (metricsErr) {
    logger.error(`⚠️ sync_metrics exception:`, metricsErr);
  }

  // ─── Alert check: consecutive failures/partials ───
  if (data.status === "error" || data.status === "partial") {
    try {
      await checkAndSendSyncAlert(supabase, entidade, data);
    } catch (alertErr) {
      logger.error(`⚠️ sync alert check failed:`, alertErr);
    }
  }
}

// ─── Check consecutive failures and send email alert ───
const ALERT_THRESHOLD = 2; // Send alert after 2+ consecutive non-success cycles

async function checkAndSendSyncAlert(
  supabase: any,
  entidade: string,
  data: { status: string; duracaoMs: number; erroMensagem?: string; empresaId?: number }
) {
  // Get last N sync_control entries for this entity (most recent first)
  const { data: recentSyncs } = await supabase
    .from("sync_control")
    .select("status, erro_mensagem, created_at")
    .eq("entidade", entidade)
    .order("created_at", { ascending: false })
    .limit(ALERT_THRESHOLD + 1);

  if (!recentSyncs || recentSyncs.length < ALERT_THRESHOLD) return;

  // Count consecutive non-success from the top
  let consecutiveCount = 0;
  for (const sync of recentSyncs) {
    if (sync.status === "error" || sync.status === "partial") {
      consecutiveCount++;
    } else {
      break;
    }
  }

  if (consecutiveCount < ALERT_THRESHOLD) return;

  // Check if we already sent an alert recently (within 2 hours) to avoid spam
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: recentAlerts } = await supabase
    .from("email_send_log")
    .select("id")
    .eq("template_name", "sync-alert")
    .gte("created_at", twoHoursAgo)
    .limit(1);

  if (recentAlerts && recentAlerts.length > 0) {
    logger.log(`📧 Sync alert already sent within 2h, skipping`);
    return;
  }

  // Get admin emails
  const { data: admins } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");

  if (!admins || admins.length === 0) return;

  const adminIds = admins.map((a: any) => a.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("email")
    .in("id", adminIds);

  if (!profiles || profiles.length === 0) return;

  const durationStr = data.duracaoMs > 1000
    ? `${(data.duracaoMs / 1000).toFixed(1)}s`
    : `${data.duracaoMs}ms`;

  // Send alert to each admin
  for (const profile of profiles) {
    if (!profile.email) continue;
    try {
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "sync-alert",
          recipientEmail: profile.email,
          idempotencyKey: `sync-alert-${entidade}-${data.empresaId || 0}-${new Date().toISOString().slice(0, 13)}`,
          templateData: {
            alertType: data.status,
            entity: entidade,
            empresaId: data.empresaId,
            consecutiveCount,
            lastError: data.erroMensagem || undefined,
            lastDuration: durationStr,
            timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
          },
        },
      });
      logger.log(`📧 Sync alert sent to ${profile.email.slice(0, 3)}***`);
    } catch (emailErr) {
      logger.error(`📧 Failed to send sync alert:`, emailErr);
    }
  }
}

// ─── Get last successful sync timestamp ───

async function getLastSyncTimestamp(
  supabase: any,
  entidade: string
): Promise<string | null> {
  const { data } = await supabase
    .from("sync_control")
    .select("ultima_sync")
    .eq("entidade", entidade)
    .eq("status", "success")
    .order("ultima_sync", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.ultima_sync || null;
}

// ─── Route handlers ───

async function handleTestConnection(req: Request, startMs: number) {
  let connection: Connection | null = null;
  try {
    connection = await connectToSqlServer();
    const rows = await executeSqlQuery(connection, "SELECT TOP 5 * FROM ConsultaPowerBIReceber");
    return jsonResponse(
      { success: true, message: "Conexão com SQL Server OK (SSL)", rowCount: rows.length, sampleData: rows },
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

async function handleSyncPaginated(
  req: Request,
  startMs: number,
  viewName: string,
  tableName: string,
  entityName: string,
  transformFn: (row: SqlRow) => Record<string, unknown>,
  conflictCol: string,
  options?: { whereClause?: string; empresaId?: number; startPage?: number; maxPages?: number; orderBy?: string; pageSize?: number; hardSync?: { empresaCol: string; empresaValue: number }; fromExpr?: string }
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Captura ANTES da 1ª página — usado para hard-sync (remoção de linhas stale).
  const runStart = new Date().toISOString();

  let totalRows = 0;
  let totalUpserted = 0;
  const allErrors: string[] = [];
  let page = options?.startPage || 0;
  const startPage = options?.startPage || 0;
  const maxPages = options?.maxPages || 999;
  const pageSize = options?.pageSize || SQL_PAGE_SIZE;
  const TIME_LIMIT_MS = 110_000; // 110s — leaves 40s margin for upsert + response
  const whereFilter = options?.whereClause ? `WHERE ${options.whereClause}` : "";
  let stoppedByTimeGuard = false;
  let pagesProcessed = 0;
  let totalDeadlockRetries = 0;
  let terminatedNaturally = false;
  let hitMaxPages = false;

  // Single connection for ALL pages — eliminates 5-10s overhead per page
  let connection: Connection | null = null;
  try {
    connection = await connectToSqlServer();
    logger.log(`🔗 SQL connection opened (SSL, single for all pages)`);

    while (true) {
      if (Date.now() - startMs > TIME_LIMIT_MS) {
        logger.log(`⏱️ Time guard: stopping after ${pagesProcessed} pages (${totalRows} rows) — ${Date.now() - startMs}ms elapsed`);
        stoppedByTimeGuard = true;
        break;
      }

      if (pagesProcessed >= maxPages) {
        logger.log(`📄 Max pages reached: ${pagesProcessed}/${maxPages}`);
        hitMaxPages = true;
        break;
      }

      const offset = page * pageSize;
      const orderByClause = options?.orderBy || "[ID Empresa], [Nota], [Seq]";
      const fromClause = options?.fromExpr ? options.fromExpr : `[${viewName}]`;
      const query = `
        SELECT * FROM (
          SELECT *, ROW_NUMBER() OVER (ORDER BY ${orderByClause}) AS _rn
          FROM ${fromClause}
          ${whereFilter}
        ) AS _paged
        WHERE _rn > ${offset} AND _rn <= ${offset + pageSize}
      `;
      logger.log(`📥 ${entityName} page ${page + 1} (offset ${offset}, size ${pageSize})${options?.empresaId ? ` empresa=${options.empresaId}` : ""}...`);
      if (entityName === "estoque" && page === 0) {
        logger.log(`🔎 estoque SQL (first 900 chars): ${query.slice(0, 900)}`);
      }
      const rows = await executeSqlQuery(connection, query);
      logger.log(`📊 Got ${rows.length} rows`);


      if (rows.length === 0) { terminatedNaturally = true; break; }

      totalRows += rows.length;
      const transformed = rows.map(transformFn);
      const { inserted, errors, deadlockRetries } = await batchUpsert(supabase, tableName, transformed, conflictCol);
      totalUpserted += inserted;
      totalDeadlockRetries += deadlockRetries;
      if (errors.length > 0) allErrors.push(...errors);

      if (rows.length < pageSize) { terminatedNaturally = true; break; }
      page++;
      pagesProcessed++;

      await new Promise((r) => setTimeout(r, 50));
    }

    // ─── Hard-sync: só remove linhas stale se a execução foi completa e sem erros ───
    // Escopo mínimo (empresaCol = empresaValue) + timestamp < runStart.
    let deletedStale = 0;
    const fullCycleOk =
      !!options?.hardSync &&
      startPage === 0 &&
      terminatedNaturally &&
      !stoppedByTimeGuard &&
      !hitMaxPages &&
      allErrors.length === 0;

    if (options?.hardSync && !fullCycleOk) {
      logger.log(`⚠️  hard-sync SKIPPED (partial run): startPage=${startPage} terminatedNaturally=${terminatedNaturally} stoppedByTimeGuard=${stoppedByTimeGuard} hitMaxPages=${hitMaxPages} errors=${allErrors.length}`);
    }

    if (fullCycleOk && options?.hardSync) {
      const { empresaCol, empresaValue } = options.hardSync;
      const { count, error: delErr } = await supabase
        .from(tableName)
        .delete({ count: "exact" })
        .eq(empresaCol, empresaValue)
        .lt("sincronizado_em", runStart);
      if (delErr) {
        logger.error(`❌ hard-sync delete failed: ${delErr.message}`);
        allErrors.push(`hard-sync delete: ${delErr.message}`);
      } else {
        deletedStale = count ?? 0;
        logger.log(`🧹 hard-sync: deleted ${deletedStale} stale rows from ${tableName} where ${empresaCol}=${empresaValue}`);
      }
    }

    const duration = Date.now() - startMs;
    const status = stoppedByTimeGuard ? "partial" : (allErrors.length > 0 ? "partial" : "success");
    await recordSync(supabase, entityName, {
      status,
      totalRegistros: totalRows,
      registrosInseridos: totalUpserted,
      duracaoMs: duration,
      erroMensagem: stoppedByTimeGuard ? `Time guard: stopped at page ${page + 1}, processed ${totalRows} rows` : (allErrors.length > 0 ? allErrors.slice(0, 5).join("; ") : undefined),
      empresaId: options?.empresaId,
      pagesProcessed: pagesProcessed + 1,
      deadlockRetries: totalDeadlockRetries,
    });

    return jsonResponse({
      success: true,
      entity: entityName,
      source: viewName,
      empresaId: options?.empresaId,
      totalRows,
      upserted: totalUpserted,
      deletedStale: options?.hardSync ? deletedStale : undefined,
      hardSyncApplied: options?.hardSync ? fullCycleOk : undefined,
      pages: pagesProcessed + 1,
      stoppedByTimeGuard,
      lastPage: page,
      deadlockRetries: totalDeadlockRetries > 0 ? totalDeadlockRetries : undefined,
      errors: allErrors.length > 0 ? allErrors.slice(0, 5) : undefined,
    }, 200, req, { startMs });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro";
    const supabase2 = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await recordSync(supabase2, entityName, { status: "error", totalRegistros: totalRows, registrosInseridos: totalUpserted, duracaoMs: Date.now() - startMs, erroMensagem: msg, empresaId: options?.empresaId });
    return errorResponse(500, "sync_failed", msg, req, startMs);
  } finally {
    if (connection) try { connection.close(); logger.log(`🔗 SQL connection closed`); } catch (_) {}
  }
}

// ─── Contas a Receber via API Atrio REST ───
//
// Substituição completa do acesso SQL Server (tedious/ConsultaPowerBIReceber).
// Migração para REST: novos registros usam erp_id "rest-{e}-{t}-{n}-{s}";
// registros legados (atrio_numero IS NULL) permanecem como histórico.
// Não há hard-sync (deletar) porque a API só retorna títulos com saldo > 0.

const AR_TOKEN_EMPRESA_ID = 1; // token Atrio é global — usamos empresa_id=1 como chave de cache
const AR_EMPRESAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // base única SIGED, IDs 1–11

function parseAtrioDate(value: unknown): string | null {
  if (!value) return null;
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  return parseDate(value);
}

function transformContasReceberAtrio(titulo: any, syncStamp: string): Record<string, unknown> {
  const empresa = Number(titulo.empresa ?? titulo.empresaId ?? 1);
  const tipo = Number(titulo.tipo ?? 0);
  const numero = Number(titulo.numero ?? 0);
  const sequencia = Number(titulo.sequencia ?? titulo.seq ?? 1);

  const valorOriginal = Number(titulo.valorTitulo ?? titulo.valorOriginal ?? titulo.valor ?? 0);
  const saldoRaw = Number(titulo.saldo ?? titulo.valorAberto ?? titulo.saldoDevedor ?? 0);
  const saldo = Math.abs(saldoRaw) < 0.01 ? 0 : saldoRaw;
  const valorPago = Math.max(0, valorOriginal - saldo);
  const dataVencimento = parseAtrioDate(titulo.dataVencimento ?? titulo.vencimento);

  // Mapeamento de status: situacao (estilo AP) ou incluirBaixados (UPPERCASE)
  const situacao = String(titulo.situacao ?? titulo.incluirBaixados ?? "").toUpperCase();
  let status: string;
  if (situacao === "BAIXADO" || situacao === "TOTAL") {
    status = "recebido";
  } else if (situacao === "PARCIAL" || (saldo > 0 && valorPago > 0)) {
    status = "parcial";
  } else {
    status = deriveStatus(saldo, valorPago, dataVencimento);
  }

  return {
    erp_id: `rest-${empresa}-${tipo}-${numero}-${sequencia}`,
    empresa_id: empresa,
    atrio_tipo: tipo,
    atrio_numero: numero,
    atrio_sequencia: sequencia,
    atrio_cliente_id: titulo.clienteId != null ? Number(titulo.clienteId) : null,
    empresa_nome: titulo.nomeEmpresa ?? null,
    tipo_documento: String(tipo),
    numero_documento: String(numero),
    parcela: sequencia,
    cliente_codigo: titulo.codigoCliente != null ? String(titulo.codigoCliente) : null,
    cliente_nome: titulo.nomeCliente ?? titulo.cliente ?? titulo.sacado ?? null,
    valor_original: valorOriginal,
    valor_aberto: saldo,
    valor_recebido: valorPago,
    valor_juros: Number(titulo.valorJuros ?? 0),
    valor_desconto: Number(titulo.valorDesconto ?? 0),
    valor_ajustes: 0,
    data_emissao: parseAtrioDate(titulo.dataEmissao ?? titulo.emissao),
    data_vencimento: dataVencimento,
    data_recebimento: parseAtrioDate(titulo.dataPagamento ?? titulo.dataBaixa),
    status,
    portador: titulo.nomePortador ?? null,
    portador_id: titulo.portadorId != null ? String(titulo.portadorId) : null,
    vendedor: titulo.vendedor ?? null,
    vendedor_nome: titulo.nomeVendedor ?? titulo.vendedor ?? null,
    tabela: null,
    conta: titulo.nomeConta ?? null,
    sincronizado_em: syncStamp,
    atrio_sincronizado_em: syncStamp,
  };
}

async function fetchAtrioTitulosReceber(
  baseUrl: string,
  token: string,
  empresaId: number,
  dataInicio: string,
  dataFim: string
): Promise<any[]> {
  const url = `${baseUrl}/contas-receber?empresa=${empresaId}&dataEmissaoInicio=${dataInicio}&dataEmissaoFim=${dataFim}`;
  const res = await fetch(url, { headers: atrioHeaders(token) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GET /contas-receber HTTP ${res.status} empresa=${empresaId}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  // Resposta confirmada: { "titulos": [...] } — Postman 24/06/2026
  return Array.isArray(data) ? data : (data?.titulos ?? data?.data ?? []);
}

// ─── Sync por empresa (REST Atrio) ───

async function handleSyncContasReceberPorEmpresa(req: Request, startMs: number) {
  const body = await req.clone().json();
  const empresaId = Number(body.empresa_id);
  if (!empresaId || isNaN(empresaId) || empresaId < 1 || empresaId > 11) {
    return errorResponse(400, "invalid_empresa", "empresa_id deve ser de 1 a 11", req, startMs);
  }

  const hoje = new Date();
  const defaultFim = hoje.toISOString().substring(0, 10);
  const defaultInicio = new Date(hoje.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
  const dataInicio = String(body.data_inicio || defaultInicio);
  const dataFim = String(body.data_fim || defaultFim);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { token, baseUrl } = await getAtrioToken(supabase, AR_TOKEN_EMPRESA_ID);
    const titulos = await fetchAtrioTitulosReceber(baseUrl, token, empresaId, dataInicio, dataFim);

    logger.log(`📥 CR Atrio empresa=${empresaId}: ${titulos.length} títulos (${dataInicio} → ${dataFim})`);

    const syncStamp = new Date().toISOString();
    const transformed = titulos.map((t: any) => transformContasReceberAtrio(t, syncStamp));
    const { inserted, errors, deadlockRetries } = await batchUpsert(supabase, "contas_receber", transformed, "erp_id");

    await recordSync(supabase, "contas_receber", {
      status: errors.length > 0 ? "partial" : "success",
      totalRegistros: titulos.length,
      registrosInseridos: inserted,
      duracaoMs: Date.now() - startMs,
      erroMensagem: errors.length > 0 ? errors.slice(0, 5).join("; ") : undefined,
      empresaId,
    });

    return jsonResponse({
      success: true,
      entity: "contas_receber",
      source: "atrio_rest",
      empresaId,
      totalRows: titulos.length,
      upserted: inserted,
      dateRange: { dataInicio, dataFim },
      deadlockRetries: deadlockRetries > 0 ? deadlockRetries : undefined,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
    }, 200, req, { startMs });
  } catch (e: any) {
    const msg = e.message ?? "Erro";
    await recordSync(createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!), "contas_receber", {
      status: "error", totalRegistros: 0, registrosInseridos: 0, duracaoMs: Date.now() - startMs, erroMensagem: msg, empresaId,
    });
    return errorResponse(502, "atrio_sync_failed", msg, req, startMs);
  }
}

// ─── Sync full — todas as empresas (1–11) ───

async function handleSyncContasReceberFull(req: Request, startMs: number) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const hoje = new Date();
  const dataFim = hoje.toISOString().substring(0, 10);
  const dataInicio = new Date(hoje.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);

  logger.log(`🏢 CR Atrio Full sync: ${AR_EMPRESAS.length} empresas (${dataInicio} → ${dataFim})`);

  const results: Record<string, unknown> = {};
  let totalAll = 0;
  let upsertedAll = 0;

  // Serial: token Atrio é global — serial evita cache stampede entre invocações paralelas
  for (const empId of AR_EMPRESAS) {
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/erp-sync-engine`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
        body: JSON.stringify({ path: "sync-contas-receber-por-empresa", empresa_id: empId, data_inicio: dataInicio, data_fim: dataFim }),
      });
      const data = await resp.json();
      results[`empresa_${empId}`] = { success: data.success, totalRows: data.totalRows, upserted: data.upserted, status: resp.status };
      totalAll += data.totalRows || 0;
      upsertedAll += data.upserted || 0;
      logger.log(`✅ CR Empresa ${empId}: ${data.totalRows || 0} rows, ${data.upserted || 0} upserted`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      results[`empresa_${empId}`] = { success: false, error: msg };
      logger.error(`❌ CR Empresa ${empId} failed: ${msg}`);
    }
  }

  return jsonResponse({
    success: true,
    entity: "contas_receber_full",
    source: "atrio_rest",
    empresas: AR_EMPRESAS.length,
    totalRows: totalAll,
    upserted: upsertedAll,
    results,
  }, 200, req, { startMs });
}

// ─── Sync incremental (janela baseada na última sync bem-sucedida) ───

async function handleSyncContasReceberIncremental(req: Request, startMs: number) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const lastSync = await getLastSyncTimestamp(supabase, "contas_receber_incremental");

  const hoje = new Date();
  const dataFim = hoje.toISOString().substring(0, 10);
  let dataInicio: string;

  if (lastSync) {
    const d = new Date(lastSync);
    d.setUTCDate(d.getUTCDate() - 7); // recua 7 dias para cobrir emissões retroativas
    dataInicio = d.toISOString().substring(0, 10);
    logger.log(`📅 CR Incremental (Atrio): desde ${dataInicio} (lastSync - 7 dias)`);
  } else {
    dataInicio = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
    logger.log(`📅 CR Incremental (Atrio): fallback últimos 30 dias`);
  }

  const results: Record<string, unknown> = {};
  let totalAll = 0;
  let upsertedAll = 0;

  for (const empId of AR_EMPRESAS) {
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/erp-sync-engine`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
        body: JSON.stringify({ path: "sync-contas-receber-por-empresa", empresa_id: empId, data_inicio: dataInicio, data_fim: dataFim }),
      });
      const data = await resp.json();
      results[`empresa_${empId}`] = { success: data.success, totalRows: data.totalRows, upserted: data.upserted };
      totalAll += data.totalRows || 0;
      upsertedAll += data.upserted || 0;
    } catch (e) {
      results[`empresa_${empId}`] = { success: false, error: e instanceof Error ? e.message : "Erro" };
    }
  }

  const failedEmpresas = Object.values(results).filter((r: any) => !r.success);
  const syncStatus = failedEmpresas.length > 0 ? "partial" : "success";

  await recordSync(createClient(supabaseUrl, serviceKey), "contas_receber_incremental", {
    status: syncStatus,
    totalRegistros: totalAll,
    registrosInseridos: upsertedAll,
    duracaoMs: Date.now() - startMs,
    ...(failedEmpresas.length > 0
      ? { erroMensagem: `${failedEmpresas.length} de ${AR_EMPRESAS.length} empresa(s) com falha` }
      : {}),
  });

  return jsonResponse({
    success: syncStatus !== "error",
    entity: "contas_receber_incremental",
    source: "atrio_rest",
    empresas: AR_EMPRESAS.length,
    totalRows: totalAll,
    upserted: upsertedAll,
    dateRange: { dataInicio, dataFim },
    results,
  }, 200, req, { startMs });
}

async function handleSyncContasReceber(req: Request, startMs: number) {
  // Alias legado — delega ao full (180 dias × 11 empresas)
  return handleSyncContasReceberFull(req, startMs);
}

async function handleSyncContasPagar(req: Request, startMs: number) {
  // APOSENTADO: Contas a Pagar migrou para o ELT autoritativo (connector-contas-pagar -> base dbo.ContasPagar).
  // Neutralizado aqui (não só nas rotas) para cobrir também a chamada interna do handleSyncAll. Vendas/estoque/
  // receber/composição seguem ativos. Handler original preservado no histórico abaixo (comentado) se precisar reverter.
  return jsonResponse({
    success: false,
    disabled: true,
    message: "Sync de Contas a Pagar aposentado — fonte agora é o ELT (connector-contas-pagar, tabela-base do Result). Nada foi sincronizado.",
  }, 200, req, { startMs });
  // return handleSyncPaginated(req, startMs, "ConsultaPowerBIPagar", "contas_pagar", "contas_pagar", transformContasPagar, "erp_id");
}

// ─── CP por empresa (segmentado) ───

async function handleSyncContasPagarPorEmpresa(req: Request, startMs: number) {
  const body = await req.clone().json();
  const empresaId = body.empresa_id;
  const startPage = body.start_page || 0;
  const maxPages = body.max_pages || 999;
  if (!empresaId || isNaN(Number(empresaId))) {
    return errorResponse(400, "invalid_empresa", "empresa_id é obrigatório (numérico)", req, startMs);
  }
  return handleSyncPaginated(
    req, startMs,
    "ConsultaPowerBIPagar", "contas_pagar", "contas_pagar",
    transformContasPagar, "erp_id",
    { whereClause: `[ID Empresa] = ${Number(empresaId)}`, empresaId: Number(empresaId), startPage: Number(startPage), maxPages: Number(maxPages) }
  );
}

// ─── CP full orquestrando por empresa ───

async function handleSyncContasPagarFull(req: Request, startMs: number) {
  let connection: Connection | null = null;
  let empresaIds: number[] = [];
  try {
    connection = await connectToSqlServer();
    const rows = await executeSqlQuery(connection, "SELECT DISTINCT [ID Empresa] FROM [ConsultaPowerBIPagar]");
    empresaIds = rows.map((r) => Number(r["ID Empresa"])).filter((id) => !isNaN(id)).sort((a, b) => a - b);
  } finally {
    if (connection) try { connection.close(); } catch (_) {}
  }

  if (empresaIds.length === 0) {
    return errorResponse(500, "no_empresas", "Nenhuma empresa encontrada na view", req, startMs);
  }

  logger.log(`🏢 CP Full sync: ${empresaIds.length} empresas: ${empresaIds.join(", ")}`);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const results: Record<string, unknown> = {};
  let totalAll = 0;
  let upsertedAll = 0;

  const CONCURRENCY = 2;
  for (let i = 0; i < empresaIds.length; i += CONCURRENCY) {
    const batch = empresaIds.slice(i, i + CONCURRENCY);
    const promises = batch.map(async (empId) => {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/erp-sync-engine`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
          body: JSON.stringify({ path: "sync-contas-pagar-por-empresa", empresa_id: empId }),
        });
        const data = await resp.json();
        results[`empresa_${empId}`] = { success: data.success, totalRows: data.totalRows, upserted: data.upserted, status: resp.status };
        totalAll += data.totalRows || 0;
        upsertedAll += data.upserted || 0;
        logger.log(`✅ CP Empresa ${empId}: ${data.totalRows || 0} rows, ${data.upserted || 0} upserted`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro";
        results[`empresa_${empId}`] = { success: false, error: msg };
        logger.error(`❌ CP Empresa ${empId} failed: ${msg}`);
      }
    });
    await Promise.all(promises);
  }

  return jsonResponse({
    success: true,
    entity: "contas_pagar_full",
    empresas: empresaIds.length,
    totalRows: totalAll,
    upserted: upsertedAll,
    results,
  }, 200, req, { startMs });
}

// ─── CP incremental (state-based) ───

async function handleSyncContasPagarIncremental(req: Request, startMs: number) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const lastSync = await getLastSyncTimestamp(supabase, "contas_pagar_incremental");

  let whereClause: string;
  if (lastSync) {
    const syncDate = new Date(lastSync);
    const sqlDate = syncDate.toISOString().replace("T", " ").substring(0, 19);
    // Captura pagamentos recentes E títulos na janela de vencimento ±7 dias com saldo aberto
    whereClause = `(([Data Pgto] IS NOT NULL AND [Data Pgto] >= '${sqlDate}' AND [Data Pgto] <= GETDATE()) OR ([Vencimento] >= DATEADD(DAY, -7, GETDATE()) AND [Vencimento] <= DATEADD(DAY, 7, GETDATE()) AND [Valor em Aberto] > 0))`;
    logger.log(`📅 CP Incremental: pagamentos desde ${sqlDate} + vencimentos ±7 dias com saldo aberto`);
  } else {
    whereClause = `(([Data Pgto] IS NOT NULL AND [Data Pgto] >= DATEADD(HOUR, -2, GETDATE()) AND [Data Pgto] <= GETDATE()) OR ([Vencimento] >= DATEADD(DAY, -7, GETDATE()) AND [Vencimento] <= DATEADD(DAY, 7, GETDATE()) AND [Valor em Aberto] > 0))`;
    logger.log(`📅 CP Incremental: fallback last 2h + vencimentos ±7 dias com saldo aberto`);
  }

  return handleSyncPaginated(
    req, startMs,
    "ConsultaPowerBIPagar", "contas_pagar", "contas_pagar_incremental",
    transformContasPagar, "erp_id",
    { whereClause, maxPages: 5 }
  );
}

// ─── Vendas (ConsultaPowerBI → public."Union") — janela inicial ≥ 2025 ───

const VENDAS_VIEW = "ConsultaPowerBI";
const VENDAS_TABLE = "Union";
const VENDAS_BASE_FILTER = "[Data] >= '2025-01-01'";
const VENDAS_ORDER_BY = "[ID Empresa], [Data], [Nota], [Cod.Produto]";

async function handleSyncVendasPorEmpresa(req: Request, startMs: number) {
  const body = await req.clone().json();
  const empresaId = body.empresa_id;
  const startPage = body.start_page || 0;
  const maxPages = body.max_pages || 999;
  if (!empresaId || isNaN(Number(empresaId))) {
    return errorResponse(400, "invalid_empresa", "empresa_id é obrigatório (numérico)", req, startMs);
  }
  return handleSyncPaginated(
    req, startMs,
    VENDAS_VIEW, VENDAS_TABLE, "vendas",
    transformVendas, "erp_id",
    {
      whereClause: `[ID Empresa] = ${Number(empresaId)} AND ${VENDAS_BASE_FILTER}`,
      empresaId: Number(empresaId),
      startPage: Number(startPage),
      maxPages: Number(maxPages),
      orderBy: VENDAS_ORDER_BY,
    }
  );
}

async function handleSyncVendasFull(req: Request, startMs: number) {
  let connection: Connection | null = null;
  let empresaIds: number[] = [];
  try {
    connection = await connectToSqlServer();
    const rows = await executeSqlQuery(
      connection,
      `SELECT DISTINCT [ID Empresa] FROM [${VENDAS_VIEW}] WHERE ${VENDAS_BASE_FILTER}`
    );
    empresaIds = rows.map((r) => Number(r["ID Empresa"])).filter((id) => !isNaN(id)).sort((a, b) => a - b);
  } finally {
    if (connection) try { connection.close(); } catch (_) {}
  }

  if (empresaIds.length === 0) {
    return errorResponse(500, "no_empresas", "Nenhuma empresa encontrada na view de vendas", req, startMs);
  }

  logger.log(`🏢 Vendas Full sync (≥2025): ${empresaIds.length} empresas: ${empresaIds.join(", ")}`);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const results: Record<string, unknown> = {};
  let totalAll = 0;
  let upsertedAll = 0;

  const CONCURRENCY = 2;
  for (let i = 0; i < empresaIds.length; i += CONCURRENCY) {
    const batch = empresaIds.slice(i, i + CONCURRENCY);
    const promises = batch.map(async (empId) => {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/erp-sync-engine`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
          body: JSON.stringify({ path: "sync-vendas-por-empresa", empresa_id: empId }),
        });
        const data = await resp.json();
        results[`empresa_${empId}`] = { success: data.success, totalRows: data.totalRows, upserted: data.upserted, status: resp.status };
        totalAll += data.totalRows || 0;
        upsertedAll += data.upserted || 0;
        logger.log(`✅ Vendas Empresa ${empId}: ${data.totalRows || 0} rows, ${data.upserted || 0} upserted`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro";
        results[`empresa_${empId}`] = { success: false, error: msg };
        logger.error(`❌ Vendas Empresa ${empId} failed: ${msg}`);
      }
    });
    await Promise.all(promises);
  }

  return jsonResponse({
    success: true,
    entity: "vendas_full",
    empresas: empresaIds.length,
    totalRows: totalAll,
    upserted: upsertedAll,
    results,
  }, 200, req, { startMs });
}

async function handleSyncVendasIncremental(req: Request, startMs: number) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const lastSync = await getLastSyncTimestamp(supabase, "vendas_incremental");

  let whereClause: string;
  if (lastSync) {
    // Janela: últimaSync − 2 dias (cobre lançamentos retroativos / fuso horário)
    const syncDate = new Date(lastSync);
    syncDate.setUTCDate(syncDate.getUTCDate() - 2);
    const sqlDate = syncDate.toISOString().replace("T", " ").substring(0, 19);
    whereClause = `[Data] >= '${sqlDate}'`;
    logger.log(`📅 Vendas Incremental: faturamentos desde ${sqlDate}`);
  } else {
    whereClause = `[Data] >= DATEADD(DAY, -7, GETDATE())`;
    logger.log(`📅 Vendas Incremental: fallback últimos 7 dias`);
  }

  return handleSyncPaginated(
    req, startMs,
    VENDAS_VIEW, VENDAS_TABLE, "vendas_incremental",
    transformVendas, "erp_id",
    { whereClause, maxPages: 10, orderBy: VENDAS_ORDER_BY }
  );
}

// ─── Estoque (InformacoesProdutos + Produtos → erp_estoque_distribuidora) ───
//
// Fonte antiga (Cust_EstoqueDistribuidora) era um subconjunto filtrado: só 6
// filiais e algumas linhas escondidas (insumos trade e certas caixas reais).
// Fonte nova: dbo.InformacoesProdutos (tabela que o próprio ERP usa) —
// superconjunto consistente com a antiga. Cust_EstoqueDistribuidora vira
// LEFT JOIN de enriquecimento (curva, bloqueio, endereço, pedido pendente,
// nome_linha) — quando não existir (ex.: MG=3), esses campos vêm nulos.
//
// Cutover validado em 13/07/2026: paridade por SKU nas 6 filiais em comum;
// filiais 3/MG entram com ~1.4k SKUs (~239k un); insumos de trade (linha 27)
// e caixas antes escondidas passam a aparecer — filtro fica na UI, não no sync.

const ESTOQUE_VIEW = "InformacoesProdutos"; // apenas rótulo/logs
const ESTOQUE_TABLE = "erp_estoque_distribuidora";
const ESTOQUE_ORDER_BY = "[Empresa_Par], [Cod Produto]";

// Empresas alimentadas pelo sync completo de estoque. Config por env
// ESTOQUE_EMPRESAS (CSV) — segue o mesmo padrão do IPAPER_EMPRESAS.
// Default: 3 (MG), 4 (PR), 6 (Glass), 8 (PE), 9 (New Cosmic), 10 (Midday),
// 11 (A Gente). 1/2/5/7 ficam fora até revisão.
const ESTOQUE_EMPRESAS_DEFAULT = [3, 4, 6, 8, 9, 10, 11];
function estoqueEmpresas(): number[] {
  const env = Deno.env.get("ESTOQUE_EMPRESAS");
  if (env) {
    const ids = env.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n) && n > 0);
    if (ids.length > 0) return ids;
  }
  return ESTOQUE_EMPRESAS_DEFAULT;
}

/**
 * Subquery que projeta InformacoesProdutos + Produtos + enriquecimento da
 * Cust_EstoqueDistribuidora com os MESMOS nomes de coluna que o
 * transformEstoque já sabe ler. Mantém compatibilidade total com o resto do
 * pipeline (views, cache, telas).
 */
function estoqueFromExpr(empresasCsv: string): string {
  // Enriquecimento parcial: só campos SEM acento (compatíveis com todos os
  // collations do SQL Server do ERP). Campos com "Endereço"/"Localização"
  // ficam de fora até que sejam confirmados na estrutura da view antiga.
  return `(
    SELECT
      i.Empresa_InfPro                                            AS [Empresa_Par],
      i.Produto_InfPro                                            AS [Cod Produto],
      CAST(i.Estoque_InfPro AS float)                             AS [Estoque Produto],
      CAST(COALESCE(
             NULLIF(i.pcultimocusto_InfPro, 0),
             NULLIF(i.CustoNota_InfPro,     0),
             NULLIF(i.CustoMedio_InfPro,    0),
             NULLIF(c1.max_pcultimo,        0),
             NULLIF(c2.max_custonota,       0),
             NULLIF(c3.max_customedio,      0),
             0) AS float)                                         AS [Custo Unitario],
      CAST(CAST(i.Estoque_InfPro AS float)
           * CAST(COALESCE(
                    NULLIF(i.pcultimocusto_InfPro, 0),
                    NULLIF(i.CustoNota_InfPro,     0),
                    NULLIF(i.CustoMedio_InfPro,    0),
                    NULLIF(c1.max_pcultimo,        0),
                    NULLIF(c2.max_custonota,       0),
                    NULLIF(c3.max_customedio,      0),
                    0) AS float)
           AS float)                                              AS [Custo Total],

      i.DtUltimaCompra_InfPro                                     AS [DataUltimaCompra],
      i.pcvenda_infpro                                            AS [Valor Venda],
      LTRIM(RTRIM(p.Descricao_Pro))                               AS [NomeProd],
      LTRIM(RTRIM(p.codfor_pro))                                  AS [Cod Fabricante],
      e.[Abrev_Par]                                               AS [Abrev_Par],
      e.[NomeLinha]                                               AS [NomeLinha],
      e.[Estoque Bloqueado Produto]                               AS [Estoque Bloqueado Produto],
      e.[Pedido Pendente]                                         AS [Pedido Pendente],
      e.[CurvaFisica]                                             AS [CurvaFisica],
      e.[CurvaMonetaria]                                          AS [CurvaMonetaria]
    FROM dbo.InformacoesProdutos i
    JOIN dbo.Produtos p ON p.Id_Pro = i.Produto_InfPro
    LEFT JOIN dbo.Cust_EstoqueDistribuidora e
      ON e.[Empresa_Par] = i.Empresa_InfPro
     AND e.[Cod Produto] = i.Produto_InfPro
    LEFT JOIN (SELECT Produto_InfPro, MAX(pcultimocusto_InfPro) AS max_pcultimo
                 FROM dbo.InformacoesProdutos
                WHERE pcultimocusto_InfPro > 0
                GROUP BY Produto_InfPro) c1 ON c1.Produto_InfPro = i.Produto_InfPro
    LEFT JOIN (SELECT Produto_InfPro, MAX(CustoNota_InfPro) AS max_custonota
                 FROM dbo.InformacoesProdutos
                WHERE CustoNota_InfPro > 0
                GROUP BY Produto_InfPro) c2 ON c2.Produto_InfPro = i.Produto_InfPro
    LEFT JOIN (SELECT Produto_InfPro, MAX(CustoMedio_InfPro) AS max_customedio
                 FROM dbo.InformacoesProdutos
                WHERE CustoMedio_InfPro > 0
                GROUP BY Produto_InfPro) c3 ON c3.Produto_InfPro = i.Produto_InfPro
    WHERE i.Empresa_InfPro IN (${empresasCsv})
  ) AS src`;


}

function transformEstoque(row: SqlRow) {
  const empresaPar = parseInteger(row["Empresa_Par"] ?? row["Empresa Par"]) ?? 0;
  const codProduto = parseInteger(row["Cod Produto"] ?? row["Cod.Produto"] ?? row["CodProduto"]) ?? 0;
  const lote = (row["Lote"] ?? "") as string;
  const erpId = `${empresaPar}-${codProduto}${lote ? `-${String(lote).trim()}` : ""}`;

  // Saldo físico do produto (Cust_EstoqueDistribuidora retorna "Estoque Produto").
  const saldo = parseAmount(
    row["Estoque Produto"] ?? row["EstoqueProduto"] ?? row["Saldo"] ?? row["Estoque"] ?? row["Qtde"] ?? row["Quantidade"]
  );
  const custoUnit = parseAmount(
    row["Custo Unitario"] ?? row["CustoUnitario"] ?? row["Custo Unit"] ?? row["Custo"]
  );
  // custo_total não vem na view — calcular saldo × custo unitário.
  // parseAmount retorna 0 quando ausente, então usamos > 0 ao invés de ??.
  const custoTotalSrc = parseAmount(row["Custo Total"] ?? row["CustoTotal"] ?? row["Vl Custo"]);
  const custoTotal = custoTotalSrc > 0 ? custoTotalSrc : (saldo * custoUnit);

  const unidadeMedida = row["UnidadeMedida"] ?? row["Unidade Medida"] ?? row["Unidade"];

  return {
    erp_id: erpId,
    empresa_par: empresaPar,
    abrev_par: row["Abrev_Par"] ?? row["Abrev Par"] ?? null,
    cod_produto: codProduto,
    nome_prod: row["NomeProd"] ?? row["Nome Prod"] ?? row["Nome Produto"] ?? null,
    saldo,
    custo_unitario: custoUnit,
    custo_total: custoTotal,
    valor_venda: parseAmount(row["Valor Venda"] ?? row["ValorVenda"] ?? row["Vl Venda"] ?? row["Preco Venda"]),
    validade: parseDate(row["Validade"] ?? row["Data Validade"]),
    lote: lote ? String(lote).trim() : null,
    localizacao: row["Localizacao"] ?? row["Localização"] ?? row["Local"] ?? null,
    // Campos novos provenientes da view ERP
    estoque_endereco: parseAmount(row["Estoque Endereço"] ?? row["Estoque Endereco"] ?? row["EstoqueEndereco"]),
    estoque_bloqueado_produto: parseAmount(row["Estoque Bloqueado Produto"] ?? row["EstoqueBloqueadoProduto"]),
    estoque_bloqueado_endereco: parseAmount(row["EstqBloqueado Endereço"] ?? row["EstqBloqueado Endereco"] ?? row["EstqBloqueadoEndereco"]),
    saldo_endereco: parseAmount(row["Saldo Endereço"] ?? row["Saldo Endereco"] ?? row["SaldoEndereco"]),
    pedido_pendente: parseAmount(row["Pedido Pendente"] ?? row["PedidoPendente"]),
    cod_fabricante: row["Cod Fabricante"] ?? row["CodFabricante"] ?? null,
    nome_linha: row["NomeLinha"] ?? row["Nome Linha"] ?? null,
    unidade_medida: unidadeMedida != null ? String(unidadeMedida) : null,
    curva_fisica: row["CurvaFisica"] ?? row["Curva Fisica"] ?? null,
    curva_monetaria: row["CurvaMonetaria"] ?? row["Curva Monetaria"] ?? null,
    data_ultima_compra: parseDate(row["DataUltimaCompra"] ?? row["Data Ultima Compra"]),
    raw: row,
    sincronizado_em: new Date().toISOString(),
  };
}

async function handleSyncEstoquePorEmpresa(req: Request, startMs: number) {
  const body = await req.clone().json();
  const empresaId = body.empresa_id;
  const startPage = body.start_page || 0;
  const maxPages = body.max_pages || 999;
  if (!empresaId || isNaN(Number(empresaId))) {
    return errorResponse(400, "invalid_empresa", "empresa_id é obrigatório (numérico)", req, startMs);
  }
  const empId = Number(empresaId);
  return handleSyncPaginated(
    req, startMs,
    ESTOQUE_VIEW, ESTOQUE_TABLE, "estoque",
    transformEstoque, "erp_id",
    {
      // Filtro já embutido dentro do subquery (WHERE i.Empresa_InfPro IN (...)),
      // mas mantemos o predicate externo por segurança (idempotente).
      whereClause: `[Empresa_Par] = ${empId}`,
      empresaId: empId,
      startPage: Number(startPage),
      maxPages: Number(maxPages),
      orderBy: ESTOQUE_ORDER_BY,
      fromExpr: estoqueFromExpr(String(empId)),
      // Hard-sync: remove linhas stale (SKUs que sumiram do ERP) após full ok.
      hardSync: { empresaCol: "empresa_par", empresaValue: empId },
    }
  );
}

async function handleSyncEstoqueFull(req: Request, startMs: number) {
  // Empresas alimentadas: whitelist configurável por env (ESTOQUE_EMPRESAS).
  // Antes usávamos SELECT DISTINCT [Empresa_Par] FROM Cust_EstoqueDistribuidora,
  // que expunha só 6 filiais. Com a fonte nova (InformacoesProdutos), a lista
  // vem do próprio código para não puxar filiais inativas (1/2/5/7) por engano.
  const empresaIds = estoqueEmpresas();

  if (empresaIds.length === 0) {
    return errorResponse(500, "no_empresas", "Nenhuma empresa configurada para o sync de estoque (env ESTOQUE_EMPRESAS)", req, startMs);
  }

  logger.log(`🏢 Estoque Full sync: ${empresaIds.length} empresas: ${empresaIds.join(", ")}`);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const results: Record<string, unknown> = {};
  let totalAll = 0;
  let upsertedAll = 0;
  let deletedStaleAll = 0;

  const CONCURRENCY = 2;
  for (let i = 0; i < empresaIds.length; i += CONCURRENCY) {
    const batch = empresaIds.slice(i, i + CONCURRENCY);
    const promises = batch.map(async (empId) => {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/erp-sync-engine`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
          body: JSON.stringify({ path: "sync-estoque-por-empresa", empresa_id: empId }),
        });
        const data = await resp.json();
        results[`empresa_${empId}`] = { success: data.success, totalRows: data.totalRows, upserted: data.upserted, deletedStale: data.deletedStale, hardSyncApplied: data.hardSyncApplied, status: resp.status };
        totalAll += data.totalRows || 0;
        upsertedAll += data.upserted || 0;
        deletedStaleAll += data.deletedStale || 0;
        logger.log(`✅ Estoque Empresa ${empId}: ${data.totalRows || 0} rows, ${data.upserted || 0} upserted, ${data.deletedStale || 0} stale removed`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro";
        results[`empresa_${empId}`] = { success: false, error: msg };
        logger.error(`❌ Estoque Empresa ${empId} failed: ${msg}`);
      }
    });
    await Promise.all(promises);
  }

  // Atualiza também o saldo disponível do força de vendas (fonte do feed iPaper),
  // para o botão "Sincronizar ERP" e o cron cobrirem as duas visões numa tacada.
  try {
    const live = await syncEstoqueLiveCore(startMs);
    results.estoque_live = { success: true, totalRows: live.totalRows, upserted: live.upserted, removed: live.removed };
  } catch (e) {
    results.estoque_live = { success: false, error: e instanceof Error ? e.message : "Erro" };
  }

  return jsonResponse({
    success: true,
    entity: "estoque_full",
    empresas: empresaIds.length,
    totalRows: totalAll,
    upserted: upsertedAll,
    deletedStale: deletedStaleAll,
    results,
  }, 200, req, { startMs });
}

async function handleSyncEstoqueIncremental(req: Request, startMs: number) {
  // A view de estoque normalmente não tem timestamp — incremental = full rápido.
  return handleSyncEstoqueFull(req, startMs);
}

// ─── Estoque Live (disponível por filial → erp_estoque_live) ───
// Saldo DISPONÍVEL no modelo do força de vendas (Estoque − Bloqueado − reserva),
// calculado POR FILIAL para permitir limitar quais empresas alimentam o catálogo
// iPaper. Fórmula validada contra Live_function_EstoqueProdutos em 08/07/2026:
// 96% dos produtos a ≤5 unidades; diferenças = efeito do filtro de filial.
// Preço: pcvenda_infpro (99,5% idêntico ao catálogo, praticamente igual nas filiais).

const ESTOQUE_LIVE_TABLE = "erp_estoque_live";
const ESTOQUE_LIVE_EMPRESAS_DEFAULT = [6, 9, 10, 11]; // GLASS, NEW COSMIC, MIDDAY, A GENTE

function estoqueLiveEmpresas(): number[] {
  const env = Deno.env.get("IPAPER_EMPRESAS");
  if (env) {
    const ids = env.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n) && n > 0);
    if (ids.length > 0) return ids;
  }
  return ESTOQUE_LIVE_EMPRESAS_DEFAULT;
}

function estoqueLiveQuery(empresas: number[]): string {
  return `
  SELECT i.Empresa_InfPro AS empresa,
         i.Produto_InfPro AS cod_produto,
         CAST(i.Estoque_InfPro - COALESCE(b.bloq, 0) - COALESCE(i.reserva_Infpro, 0) AS float) AS estoque_disponivel,
         i.pcvenda_infpro AS preco_venda,
         LTRIM(RTRIM(p.codfor_pro)) AS cod_fabricante,
         LTRIM(RTRIM(p.descricao_pro)) AS nome_prod
  FROM dbo.InformacoesProdutos i
  JOIN dbo.Produtos p ON p.Id_Pro = i.Produto_InfPro
  LEFT JOIN (
    SELECT [Empresa_Par] AS e, [Cod Produto] AS c, MAX([Estoque Bloqueado Produto]) AS bloq
    FROM dbo.Cust_EstoqueDistribuidora
    GROUP BY [Empresa_Par], [Cod Produto]
  ) b ON b.e = i.Empresa_InfPro AND b.c = i.Produto_InfPro
  WHERE i.Empresa_InfPro IN (${empresas.join(", ")})
    AND (i.Estoque_InfPro <> 0 OR COALESCE(i.reserva_Infpro, 0) <> 0 OR COALESCE(b.bloq, 0) <> 0)
`;
}

async function syncEstoqueLiveCore(startMs: number) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const empresas = estoqueLiveEmpresas();
  let connection: Connection | null = null;
  let rows: SqlRow[];
  try {
    connection = await connectToSqlServer();
    rows = await executeSqlQuery(connection, estoqueLiveQuery(empresas));
  } finally {
    if (connection) try { connection.close(); } catch (_) {}
  }

  const syncStamp = new Date().toISOString();
  const transformed = rows.map((row) => {
    const empresa = parseInteger(row["empresa"]) ?? 0;
    const codProduto = parseInteger(row["cod_produto"]) ?? 0;
    return {
      erp_id: `${empresa}-${codProduto}`,
      empresa,
      cod_produto: codProduto,
      // disponível nunca negativo — filial com bloqueio/reserva acima do físico não desconta das outras
      estoque_disponivel: Math.max(0, parseAmount(row["estoque_disponivel"])),
      preco_venda: row["preco_venda"] == null ? null : parseAmount(row["preco_venda"]),
      cod_fabricante: row["cod_fabricante"] ? String(row["cod_fabricante"]).toUpperCase() : null,
      nome_prod: row["nome_prod"] ?? null,
      sincronizado_em: syncStamp,
    };
  }).filter((r) => r.cod_produto > 0 && r.empresa > 0);

  const { inserted, errors, deadlockRetries } = await batchUpsert(
    supabase, ESTOQUE_LIVE_TABLE, transformed, "erp_id",
  );

  // Produto que saiu da função Live (descontinuado/zerado no app) some do feed também.
  const { count } = await supabase
    .from(ESTOQUE_LIVE_TABLE)
    .delete({ count: "exact" })
    .lt("sincronizado_em", syncStamp);
  const removed = count ?? 0;

  await recordSync(supabase, "estoque_live", {
    status: errors.length > 0 ? "partial" : "success",
    totalRegistros: rows.length,
    registrosInseridos: inserted,
    duracaoMs: Date.now() - startMs,
    erroMensagem: errors.length > 0 ? errors.slice(0, 5).join("; ") : undefined,
    deadlockRetries,
  });

  return { totalRows: rows.length, upserted: inserted, removed, errors };
}

async function handleSyncEstoqueLive(req: Request, startMs: number) {
  try {
    const r = await syncEstoqueLiveCore(startMs);
    return jsonResponse({
      success: true,
      entity: "estoque_live",
      source: "InformacoesProdutos por filial (modelo força de vendas)",
      empresas: estoqueLiveEmpresas(),
      totalRows: r.totalRows,
      upserted: r.upserted,
      removed: r.removed,
      errors: r.errors.length > 0 ? r.errors.slice(0, 5) : undefined,
    }, 200, req, { startMs });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro";
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await recordSync(supabase, "estoque_live", { status: "error", totalRegistros: 0, registrosInseridos: 0, duracaoMs: Date.now() - startMs, erroMensagem: msg });
    return errorResponse(500, "sync_failed", msg, req, startMs);
  }
}

// ─── Composição (ComposicaoProduto → erp_composicao_produto) ───

const COMPOSICAO_VIEW = "ComposicaoProduto";
const COMPOSICAO_TABLE = "erp_composicao_produto";
const COMPOSICAO_ORDER_BY = "[Empresa_Compo], [Produto_Compo], [Materia_Compo]";

function transformComposicao(row: SqlRow) {
  const empresa = parseInteger(row["Empresa_Compo"] ?? row["Empresa Compo"]) ?? 0;
  const produto = parseInteger(row["Produto_Compo"] ?? row["Produto Compo"]) ?? 0;
  const materia = parseInteger(row["Materia_Compo"] ?? row["Materia Compo"]) ?? 0;
  const quantidade = parseAmount(row["Quantidade_Compo"] ?? row["Quantidade Compo"]);
  const erpId = `${empresa}-${produto}-${materia}`;
  return {
    erp_id: erpId,
    empresa_compo: empresa,
    produto_compo: produto,
    materia_compo: materia,
    quantidade_compo: quantidade,
    raw: row,
    sincronizado_em: new Date().toISOString(),
  };
}

async function handleSyncComposicaoPorEmpresa(req: Request, startMs: number) {
  const body = await req.clone().json();
  const empresaId = body.empresa_id;
  const startPage = body.start_page || 0;
  const maxPages = body.max_pages || 999;
  if (!empresaId || isNaN(Number(empresaId))) {
    return errorResponse(400, "invalid_empresa", "empresa_id é obrigatório (numérico)", req, startMs);
  }
  return handleSyncPaginated(
    req, startMs,
    COMPOSICAO_VIEW, COMPOSICAO_TABLE, "composicao",
    transformComposicao, "erp_id",
    {
      whereClause: `[Empresa_Compo] = ${Number(empresaId)}`,
      empresaId: Number(empresaId),
      startPage: Number(startPage),
      maxPages: Number(maxPages),
      orderBy: COMPOSICAO_ORDER_BY,
      // Hard-sync: após ciclo completo bem-sucedido, remove linhas com
      // sincronizado_em < runStart nesta empresa (elimina arestas fantasma
      // de composições recompostas/apagadas no ERP). Ver AGENTS/mem.
      hardSync: { empresaCol: "empresa_compo", empresaValue: Number(empresaId) },
    }
  );
}

async function handleSyncComposicaoFull(req: Request, startMs: number) {
  let connection: Connection | null = null;
  let empresaIds: number[] = [];
  try {
    connection = await connectToSqlServer();
    const rows = await executeSqlQuery(connection, `SELECT DISTINCT [Empresa_Compo] FROM [${COMPOSICAO_VIEW}]`);
    empresaIds = rows.map((r) => Number(r["Empresa_Compo"])).filter((id) => !isNaN(id)).sort((a, b) => a - b);
  } finally {
    if (connection) try { connection.close(); } catch (_) {}
  }

  if (empresaIds.length === 0) {
    return errorResponse(500, "no_empresas", "Nenhuma empresa encontrada na view de composição", req, startMs);
  }

  logger.log(`🧪 Composição Full sync: ${empresaIds.length} empresas: ${empresaIds.join(", ")}`);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const results: Record<string, unknown> = {};
  let totalAll = 0;
  let upsertedAll = 0;

  let deletedStaleAll = 0;
  const CONCURRENCY = 2;
  for (let i = 0; i < empresaIds.length; i += CONCURRENCY) {
    const batch = empresaIds.slice(i, i + CONCURRENCY);
    const promises = batch.map(async (empId) => {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/erp-sync-engine`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
          body: JSON.stringify({ path: "sync-composicao-por-empresa", empresa_id: empId }),
        });
        const data = await resp.json();
        results[`empresa_${empId}`] = { success: data.success, totalRows: data.totalRows, upserted: data.upserted, deletedStale: data.deletedStale, hardSyncApplied: data.hardSyncApplied, status: resp.status };
        totalAll += data.totalRows || 0;
        upsertedAll += data.upserted || 0;
        deletedStaleAll += data.deletedStale || 0;
        logger.log(`✅ Composição Empresa ${empId}: ${data.totalRows || 0} rows, ${data.upserted || 0} upserted, ${data.deletedStale || 0} stale removed`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro";
        results[`empresa_${empId}`] = { success: false, error: msg };
        logger.error(`❌ Composição Empresa ${empId} failed: ${msg}`);
      }
    });
    await Promise.all(promises);
  }

  return jsonResponse({
    success: true,
    entity: "composicao_full",
    empresas: empresaIds.length,
    totalRows: totalAll,
    upserted: upsertedAll,
    deletedStale: deletedStaleAll,
    results,
  }, 200, req, { startMs });
}

async function handleSyncComposicaoIncremental(req: Request, startMs: number) {
  return handleSyncComposicaoFull(req, startMs);
}

async function handleSyncAll(req: Request, startMs: number) {
  const results: Record<string, unknown> = {};

  try {
    const crResponse = await handleSyncContasReceber(req.clone(), startMs);
    results.contas_receber = await crResponse.json();
  } catch (e) {
    results.contas_receber = { success: false, error: e instanceof Error ? e.message : "Erro" };
  }

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

  const { data: lastCR } = await supabase
    .from("sync_control").select("ultima_sync, status, total_registros, duracao_ms")
    .eq("entidade", "contas_receber").order("ultima_sync", { ascending: false }).limit(1).maybeSingle();

  const { data: lastCP } = await supabase
    .from("sync_control").select("ultima_sync, status, total_registros, duracao_ms")
    .eq("entidade", "contas_pagar").order("ultima_sync", { ascending: false }).limit(1).maybeSingle();

  // SQL Server: ainda usado por vendas, estoque e composição
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

  // Atrio REST: usado por contas_receber (CR) e erp-export-payment (AP export)
  let atrioOk = false;
  let atrioError = "";
  try {
    await getAtrioToken(supabase, AR_TOKEN_EMPRESA_ID);
    atrioOk = true;
  } catch (e) {
    atrioError = e instanceof Error ? e.message : "Erro";
  }

  return jsonResponse({
    success: true,
    sqlServerConnected: sqlOk,
    sqlServerError: sqlError || undefined,
    sslEnabled: false,
    atrioConnected: atrioOk,
    atrioError: atrioError || undefined,
    lastSync: {
      contas_receber: lastCR || null,
      contas_pagar: lastCP || null,
    },
    connectionInfo: {
      hostConfigured: !!Deno.env.get("ERP_SQL_HOST"),
      portConfigured: !!Deno.env.get("ERP_SQL_PORT"),
      databaseConfigured: !!Deno.env.get("ERP_SQL_DATABASE"),
      atrioClientConfigured: !!Deno.env.get("ATRIO_CLIENT_ID"),
    },
  }, 200, req, { startMs });
}

// ─── Main handler ───
//
// auth: "none" é INTENCIONAL — esta função aceita três tipos de caller simultâneos:
//   1. Cron jobs (CRON_SECRET via x-cron-secret ou service-role bearer) — sem JWT
//   2. Admin users logados (JWT via validateAnyAuth abaixo)
//   3. Self-invoke: dispatch por empresa dentro do próprio handler (service-role)
//
// secureHandler não suporta multi-auth nativo; a auth gate manual (validateAnyAuth
// + timingSafeEqual) abaixo equivale — rate limit e CORS do secureHandler ainda aplicam.
// Futuro: separar em erp-sync-engine-cron (auth: "service_role") e erp-sync-admin (auth: "jwt").

Deno.serve(secureHandler({
  auth: "none",
  rateLimit: 30,
  rateLimitPrefix: "erp-sync-engine",
}, async (req: Request, _ctx) => {

  const startMs = Date.now();
  const cors = getCorsHeaders(req);

  // ─── Cron bypass: x-cron-secret OR service-role bearer ───
  const cronSecret = req.headers.get("x-cron-secret");
  const expectedCronSecret = Deno.env.get("CRON_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const bearer = req.headers.get("Authorization")?.startsWith("Bearer ")
    ? req.headers.get("Authorization")!.replace("Bearer ", "")
    : "";
  const isCron =
    (!!cronSecret && !!expectedCronSecret && timingSafeEqual(cronSecret, expectedCronSecret)) ||
    (!!bearer && !!serviceRoleKey && timingSafeEqual(bearer, serviceRoleKey));

  let authUserId: string | undefined;
  if (!isCron) {
    // ─── Auth gate: require authenticated admin user ───
    try {
      const auth = await validateAnyAuth(req);
      authUserId = auth.userId;
      if (!authUserId) {
        return new Response(
          JSON.stringify({ error: "Autenticação de usuário obrigatória" }),
          { status: 401, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
    } catch (err) {
      const status = err instanceof AuthError ? err.status : 401;
      const message = err instanceof Error ? err.message : "Não autorizado";
      return new Response(
        JSON.stringify({ error: message }),
        { status, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Authorization: require admin role
    try {
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: roleRow, error: roleErr } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", authUserId)
        .eq("role", "admin")
        .maybeSingle();
      if (roleErr || !roleRow) {
        return new Response(
          JSON.stringify({ error: "Acesso restrito a administradores" }),
          { status: 403, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
    } catch (_e) {
      return new Response(
        JSON.stringify({ error: "Acesso restrito a administradores" }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }
  }


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
      case "sync-contas-receber-por-empresa":
        return await handleSyncContasReceberPorEmpresa(req, startMs);
      case "sync-contas-receber-full":
        return await handleSyncContasReceberFull(req, startMs);
      case "sync-contas-receber-incremental":
        return await handleSyncContasReceberIncremental(req, startMs);
      // APOSENTADO: Contas a Pagar migrou para o ELT autoritativo (connector-contas-pagar -> tabela-base
      // dbo.ContasPagar). O sync via view lossy ConsultaPowerBIPagar foi desligado para não reescrever a
      // carga correta (natureza provisão×dívida, centro de custo, plano de contas). Vendas/estoque/receber/
      // composição seguem ativos. Os handlers ficam no arquivo (não removidos), só as rotas foram guardadas.
      case "sync-contas-pagar":
      case "sync-contas-pagar-por-empresa":
      case "sync-contas-pagar-full":
      case "sync-contas-pagar-incremental":
        return jsonResponse({
          success: false,
          disabled: true,
          message: "Rota de Contas a Pagar aposentada — a fonte agora é o ELT (connector-contas-pagar, tabela-base do Result). Nada foi sincronizado.",
        }, 200, req, { startMs });
      case "sync-vendas-por-empresa":
        return await handleSyncVendasPorEmpresa(req, startMs);
      case "sync-vendas-full":
        return await handleSyncVendasFull(req, startMs);
      case "sync-vendas-incremental":
        return await handleSyncVendasIncremental(req, startMs);
      case "sync-estoque-por-empresa":
        return await handleSyncEstoquePorEmpresa(req, startMs);
      case "sync-estoque-full":
        return await handleSyncEstoqueFull(req, startMs);
      case "sync-estoque-incremental":
        return await handleSyncEstoqueIncremental(req, startMs);
      case "sync-estoque-live":
        return await handleSyncEstoqueLive(req, startMs);
      case "sync-composicao-por-empresa":
        return await handleSyncComposicaoPorEmpresa(req, startMs);
      case "sync-composicao-full":
        return await handleSyncComposicaoFull(req, startMs);
      case "sync-composicao-incremental":
        return await handleSyncComposicaoIncremental(req, startMs);
      case "sync-all":
        return await handleSyncAll(req, startMs);
      case "status":
        return await handleStatus(req, startMs);
      default:
        return jsonResponse({
          success: true,
          message: "ERP Sync Engine — CR: API Atrio REST | Vendas/Estoque/Composição: SQL Server",
          availableRoutes: [
            "POST /test-connection — Testa conexão SQL Server (vendas/estoque/composição)",
            "POST /list-tables — Lista tabelas/views disponíveis no SQL Server",
            "POST /preview-table — Preview de 10 rows de uma tabela (body: { table })",
            "POST /sync-contas-receber — Sync CR via Atrio REST (180 dias × 11 empresas)",
            "POST /sync-contas-receber-por-empresa — Sync CR por empresa via Atrio REST (body: { empresa_id, data_inicio?, data_fim? })",
            "POST /sync-contas-receber-full — Sync CR completo 180 dias × 11 empresas via Atrio REST",
            "POST /sync-contas-receber-incremental — Sync CR incremental (janela desde lastSync - 7d) via Atrio REST",
            "POST /sync-contas-pagar — [APOSENTADO] Fonte agora é ELT connector-contas-pagar",
            "POST /sync-vendas-por-empresa — Sync de vendas filtrado por empresa (≥2025; body: { empresa_id })",
            "POST /sync-vendas-full — Sync completo de vendas segmentado por empresa (≥2025)",
            "POST /sync-vendas-incremental — Sync incremental de vendas (janela ±2 dias da última sync)",
            "POST /sync-estoque-live — Sync do saldo disponível do força de vendas → erp_estoque_live",
            "POST /sync-all — Sync de todas as entidades",
            "POST /status — Status: SQL Server (vendas/estoque) + Atrio REST (CR/CP) + última sync",
          ],
        }, 200, req, { startMs });
    }
  } catch (error) {
    return errorResponse(500, "internal_error", error instanceof Error ? error.message : "Erro interno", req, startMs);
  }
}));
