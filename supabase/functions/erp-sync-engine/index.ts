import { logger } from "../_shared/logger.ts";
// erp-sync-engine — Direct SQL Server ERP integration (replaces N8N)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";
import { secureHandler } from "../_shared/secure-handler.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";

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
  options?: { whereClause?: string; empresaId?: number; startPage?: number; maxPages?: number; orderBy?: string; pageSize?: number }
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let totalRows = 0;
  let totalUpserted = 0;
  const allErrors: string[] = [];
  let page = options?.startPage || 0;
  const maxPages = options?.maxPages || 999;
  const pageSize = options?.pageSize || SQL_PAGE_SIZE;
  const TIME_LIMIT_MS = 110_000; // 110s — leaves 40s margin for upsert + response
  const whereFilter = options?.whereClause ? `WHERE ${options.whereClause}` : "";
  let stoppedByTimeGuard = false;
  let pagesProcessed = 0;
  let totalDeadlockRetries = 0;

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
        break;
      }

      const offset = page * pageSize;
      const orderByClause = options?.orderBy || "[ID Empresa], [Nota], [Seq]";
      const query = `
        SELECT * FROM (
          SELECT *, ROW_NUMBER() OVER (ORDER BY ${orderByClause}) AS _rn
          FROM [${viewName}]
          ${whereFilter}
        ) AS _paged
        WHERE _rn > ${offset} AND _rn <= ${offset + pageSize}
      `;
      logger.log(`📥 ${entityName} page ${page + 1} (offset ${offset}, size ${pageSize})${options?.empresaId ? ` empresa=${options.empresaId}` : ""}...`);
      const rows = await executeSqlQuery(connection, query);
      logger.log(`📊 Got ${rows.length} rows`);

      if (rows.length === 0) break;

      totalRows += rows.length;
      const transformed = rows.map(transformFn);
      const { inserted, errors, deadlockRetries } = await batchUpsert(supabase, tableName, transformed, conflictCol);
      totalUpserted += inserted;
      totalDeadlockRetries += deadlockRetries;
      if (errors.length > 0) allErrors.push(...errors);

      if (rows.length < pageSize) break;
      page++;
      pagesProcessed++;

      await new Promise((r) => setTimeout(r, 50));
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

// ─── Sync por empresa (segmentado) ───

async function handleSyncContasReceberPorEmpresa(req: Request, startMs: number) {
  const body = await req.clone().json();
  const empresaId = body.empresa_id;
  const startPage = body.start_page || 0;
  const maxPages = body.max_pages || 999;
  if (!empresaId || isNaN(Number(empresaId))) {
    return errorResponse(400, "invalid_empresa", "empresa_id é obrigatório (numérico)", req, startMs);
  }
  return handleSyncPaginated(
    req, startMs,
    "ConsultaPowerBIReceber", "contas_receber", "contas_receber",
    transformContasReceber, "erp_id",
    { whereClause: `[ID Empresa] = ${Number(empresaId)}`, empresaId: Number(empresaId), startPage: Number(startPage), maxPages: Number(maxPages) }
  );
}

// ─── Sync full orquestrando por empresa ───

async function handleSyncContasReceberFull(req: Request, startMs: number) {
  let connection: Connection | null = null;
  let empresaIds: number[] = [];
  try {
    connection = await connectToSqlServer();
    const rows = await executeSqlQuery(connection, "SELECT DISTINCT [ID Empresa] FROM [ConsultaPowerBIReceber]");
    empresaIds = rows.map((r) => Number(r["ID Empresa"])).filter((id) => !isNaN(id)).sort((a, b) => a - b);
  } finally {
    if (connection) try { connection.close(); } catch (_) {}
  }

  if (empresaIds.length === 0) {
    return errorResponse(500, "no_empresas", "Nenhuma empresa encontrada na view", req, startMs);
  }

  logger.log(`🏢 Full sync (external fetch): ${empresaIds.length} empresas: ${empresaIds.join(", ")}`);

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
        logger.log(`🚀 Dispatching external sync for empresa ${empId}...`);
        const resp = await fetch(`${supabaseUrl}/functions/v1/erp-sync-engine`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ path: "sync-contas-receber-por-empresa", empresa_id: empId }),
        });
        const data = await resp.json();
        results[`empresa_${empId}`] = { success: data.success, totalRows: data.totalRows, upserted: data.upserted, status: resp.status };
        totalAll += data.totalRows || 0;
        upsertedAll += data.upserted || 0;
        logger.log(`✅ Empresa ${empId}: ${data.totalRows || 0} rows, ${data.upserted || 0} upserted`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro";
        results[`empresa_${empId}`] = { success: false, error: msg };
        logger.error(`❌ Empresa ${empId} failed: ${msg}`);
      }
    });
    await Promise.all(promises);
  }

  return jsonResponse({
    success: true,
    entity: "contas_receber_full",
    empresas: empresaIds.length,
    totalRows: totalAll,
    upserted: upsertedAll,
    results,
  }, 200, req, { startMs });
}

// ─── Sync incremental (state-based — last successful sync timestamp) ───

async function handleSyncContasReceberIncremental(req: Request, startMs: number) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Get last successful sync timestamp
  const lastSync = await getLastSyncTimestamp(supabase, "contas_receber_incremental");
  
  let whereClause: string;
  if (lastSync) {
    const syncDate = new Date(lastSync);
    const sqlDate = syncDate.toISOString().replace("T", " ").substring(0, 19);
    // Captura pagamentos recentes E títulos na janela de vencimento ±7 dias com saldo aberto
    whereClause = `(([Data Pgto] IS NOT NULL AND [Data Pgto] >= '${sqlDate}' AND [Data Pgto] <= GETDATE()) OR ([Vencimento] >= DATEADD(DAY, -7, GETDATE()) AND [Vencimento] <= DATEADD(DAY, 7, GETDATE()) AND [Valor em Aberto] > 0))`;
    logger.log(`📅 Incremental: pagamentos desde ${sqlDate} + vencimentos ±7 dias com saldo aberto`);
  } else {
    whereClause = `(([Data Pgto] IS NOT NULL AND [Data Pgto] >= DATEADD(HOUR, -2, GETDATE()) AND [Data Pgto] <= GETDATE()) OR ([Vencimento] >= DATEADD(DAY, -7, GETDATE()) AND [Vencimento] <= DATEADD(DAY, 7, GETDATE()) AND [Valor em Aberto] > 0))`;
    logger.log(`📅 Incremental: fallback last 2h + vencimentos ±7 dias com saldo aberto`);
  }

  // maxPages=5 — expanded filter captures more records
  return handleSyncPaginated(
    req, startMs,
    "ConsultaPowerBIReceber", "contas_receber", "contas_receber_incremental",
    transformContasReceber, "erp_id",
    { whereClause, maxPages: 5 }
  );
}

async function handleSyncContasReceber(req: Request, startMs: number) {
  return handleSyncPaginated(req, startMs, "ConsultaPowerBIReceber", "contas_receber", "contas_receber", transformContasReceber, "erp_id");
}

async function handleSyncContasPagar(req: Request, startMs: number) {
  return handleSyncPaginated(req, startMs, "ConsultaPowerBIPagar", "contas_pagar", "contas_pagar", transformContasPagar, "erp_id");
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

// ─── Estoque (Cust_EstoqueDistribuidora → erp_estoque_distribuidora) ───

const ESTOQUE_VIEW = "Cust_EstoqueDistribuidora";
const ESTOQUE_TABLE = "erp_estoque_distribuidora";
const ESTOQUE_ORDER_BY = "[Empresa_Par], [Cod Produto]";

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
  return handleSyncPaginated(
    req, startMs,
    ESTOQUE_VIEW, ESTOQUE_TABLE, "estoque",
    transformEstoque, "erp_id",
    {
      whereClause: `[Empresa_Par] = ${Number(empresaId)}`,
      empresaId: Number(empresaId),
      startPage: Number(startPage),
      maxPages: Number(maxPages),
      orderBy: ESTOQUE_ORDER_BY,
    }
  );
}

async function handleSyncEstoqueFull(req: Request, startMs: number) {
  let connection: Connection | null = null;
  let empresaIds: number[] = [];
  try {
    connection = await connectToSqlServer();
    const rows = await executeSqlQuery(connection, `SELECT DISTINCT [Empresa_Par] FROM [${ESTOQUE_VIEW}]`);
    empresaIds = rows.map((r) => Number(r["Empresa_Par"])).filter((id) => !isNaN(id)).sort((a, b) => a - b);
  } finally {
    if (connection) try { connection.close(); } catch (_) {}
  }

  if (empresaIds.length === 0) {
    return errorResponse(500, "no_empresas", "Nenhuma empresa encontrada na view de estoque", req, startMs);
  }

  logger.log(`🏢 Estoque Full sync: ${empresaIds.length} empresas: ${empresaIds.join(", ")}`);

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
          body: JSON.stringify({ path: "sync-estoque-por-empresa", empresa_id: empId }),
        });
        const data = await resp.json();
        results[`empresa_${empId}`] = { success: data.success, totalRows: data.totalRows, upserted: data.upserted, status: resp.status };
        totalAll += data.totalRows || 0;
        upsertedAll += data.upserted || 0;
        logger.log(`✅ Estoque Empresa ${empId}: ${data.totalRows || 0} rows, ${data.upserted || 0} upserted`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro";
        results[`empresa_${empId}`] = { success: false, error: msg };
        logger.error(`❌ Estoque Empresa ${empId} failed: ${msg}`);
      }
    });
    await Promise.all(promises);
  }

  return jsonResponse({
    success: true,
    entity: "estoque_full",
    empresas: empresaIds.length,
    totalRows: totalAll,
    upserted: upsertedAll,
    results,
  }, 200, req, { startMs });
}

async function handleSyncEstoqueIncremental(req: Request, startMs: number) {
  // A view de estoque normalmente não tem timestamp — incremental = full rápido.
  return handleSyncEstoqueFull(req, startMs);
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
        results[`empresa_${empId}`] = { success: data.success, totalRows: data.totalRows, upserted: data.upserted, status: resp.status };
        totalAll += data.totalRows || 0;
        upsertedAll += data.upserted || 0;
        logger.log(`✅ Composição Empresa ${empId}: ${data.totalRows || 0} rows, ${data.upserted || 0} upserted`);
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
    sslEnabled: false,
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

Deno.serve(secureHandler({
  auth: "none",
  rateLimit: 30,
  rateLimitPrefix: "erp-sync-engine",
}, async (req: Request, _ctx) => {

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
      case "sync-contas-receber-por-empresa":
        return await handleSyncContasReceberPorEmpresa(req, startMs);
      case "sync-contas-receber-full":
        return await handleSyncContasReceberFull(req, startMs);
      case "sync-contas-receber-incremental":
        return await handleSyncContasReceberIncremental(req, startMs);
      case "sync-contas-pagar":
        return await handleSyncContasPagar(req, startMs);
      case "sync-contas-pagar-por-empresa":
        return await handleSyncContasPagarPorEmpresa(req, startMs);
      case "sync-contas-pagar-full":
        return await handleSyncContasPagarFull(req, startMs);
      case "sync-contas-pagar-incremental":
        return await handleSyncContasPagarIncremental(req, startMs);
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
          message: "ERP Sync Engine — Pipeline Direto SQL Server (SSL)",
          availableRoutes: [
            "POST /test-connection — Testa conexão SQL Server",
            "POST /list-tables — Lista tabelas/views disponíveis",
            "POST /preview-table — Preview de 10 rows de uma tabela (body: { table })",
            "POST /sync-contas-receber — Sync legado (sem filtro)",
            "POST /sync-contas-receber-por-empresa — Sync filtrado por empresa (body: { empresa_id })",
            "POST /sync-contas-receber-full — Sync completo segmentado por empresa (auto)",
            "POST /sync-contas-receber-incremental — Sync incremental baseado em estado",
            "POST /sync-contas-pagar — Sync ConsultaPowerBIPagar → contas_pagar (full sem filtro)",
            "POST /sync-contas-pagar-por-empresa — Sync filtrado por empresa (body: { empresa_id })",
            "POST /sync-contas-pagar-full — Sync completo segmentado por empresa (auto)",
            "POST /sync-contas-pagar-incremental — Sync incremental baseado em estado",
            "POST /sync-vendas-por-empresa — Sync de vendas filtrado por empresa (≥2025; body: { empresa_id })",
            "POST /sync-vendas-full — Sync completo de vendas segmentado por empresa (≥2025)",
            "POST /sync-vendas-incremental — Sync incremental de vendas (janela ±2 dias da última sync)",
            "POST /sync-all — Sync de todas as entidades",
            "POST /status — Status da conexão e última sync por entidade",
          ],
        }, 200, req, { startMs });
    }
  } catch (error) {
    return errorResponse(500, "internal_error", error instanceof Error ? error.message : "Erro interno", req, startMs);
  }
}));
