// Shared SQL Server (RP / Futura) helper — extraído de erp-sync-engine
// Mantém a mesma config (DDNS interno, SSL off, retries em erros transientes)
import { Connection, Request as TdsRequest } from "npm:tedious@19.0.0";

export interface SqlRow {
  [key: string]: unknown;
}

export function connectToSqlServer(): Promise<Connection> {
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

function executeSqlQueryOnce(connection: Connection, query: string): Promise<SqlRow[]> {
  return new Promise((resolve, reject) => {
    const rows: SqlRow[] = [];
    const request = new TdsRequest(query, (err: Error | undefined) => {
      if (err) reject(new Error(`SQL query failed: ${err.message}`));
      else resolve(rows);
    });
    request.on("row", (columns: Array<{ metadata: { colName: string }; value: unknown }>) => {
      const row: SqlRow = {};
      for (const col of columns) row[col.metadata.colName] = col.value;
      rows.push(row);
    });
    connection.execSql(request);
  });
}

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

export async function executeSqlQuery(connection: Connection, query: string): Promise<SqlRow[]> {
  const delays = [2000, 5000, 10000];
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await executeSqlQueryOnce(connection, query);
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt === delays.length || !isTransientSqlError(lastErr.message)) throw lastErr;
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
  throw lastErr ?? new Error("SQL query failed");
}

export function closeConnectionSafe(connection: Connection | null) {
  if (!connection) return;
  try { connection.close(); } catch { /* ignore */ }
}
