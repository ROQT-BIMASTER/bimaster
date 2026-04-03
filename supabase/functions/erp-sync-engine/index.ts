// erp-sync-engine — Direct SQL Server ERP integration (replaces N8N)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";

// ─── SQL Server connection via tedious ───
import { Connection, Request as TdsRequest } from "npm:tedious@19.0.0";

interface SqlRow {
  [key: string]: unknown;
}

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
        encrypt: false, // on-premise with DDNS — no TLS
        trustServerCertificate: true,
        connectTimeout: 15000,
        requestTimeout: 30000,
        rowCollectionOnDone: true,
        rowCollectionOnRequestCompletion: true,
      },
    };

    const connection = new Connection(config);

    connection.on("connect", (err: Error | undefined) => {
      if (err) {
        reject(new Error(`SQL Server connection failed: ${err.message}`));
      } else {
        resolve(connection);
      }
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
      if (err) {
        reject(new Error(`SQL query failed: ${err.message}`));
      } else {
        resolve(rows);
      }
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

// ─── Route handlers ───

async function handleTestConnection(req: Request, startMs: number) {
  let connection: Connection | null = null;
  try {
    connection = await connectToSqlServer();

    // Simple test query
    const rows = await executeSqlQuery(
      connection,
      "SELECT TOP 5 * FROM ConsultaPowerBIReceber"
    );

    return jsonResponse(
      {
        success: true,
        message: "Conexão com SQL Server estabelecida com sucesso",
        rowCount: rows.length,
        sampleData: rows,
        connectionInfo: {
          host: Deno.env.get("ERP_SQL_HOST"),
          port: Deno.env.get("ERP_SQL_PORT"),
          database: Deno.env.get("ERP_SQL_DATABASE"),
        },
      },
      200,
      req,
      { startMs }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return errorResponse(500, "connection_failed", message, req, startMs);
  } finally {
    if (connection) {
      try {
        connection.close();
      } catch (_) {
        // ignore close errors
      }
    }
  }
}

async function handleStatus(req: Request, startMs: number) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Check last sync from sync_control or contas_receber
  const { data: lastSync } = await supabase
    .from("contas_receber")
    .select("sincronizado_em")
    .order("sincronizado_em", { ascending: false })
    .limit(1)
    .single();

  // Test SQL Server connectivity (quick)
  let sqlServerOk = false;
  let sqlError = "";
  let connection: Connection | null = null;
  try {
    connection = await connectToSqlServer();
    await executeSqlQuery(connection, "SELECT 1 AS test");
    sqlServerOk = true;
  } catch (e) {
    sqlError = e instanceof Error ? e.message : "Erro desconhecido";
  } finally {
    if (connection) {
      try { connection.close(); } catch (_) {}
    }
  }

  return jsonResponse(
    {
      success: true,
      sqlServerConnected: sqlServerOk,
      sqlServerError: sqlError || undefined,
      lastSync: lastSync?.sincronizado_em || null,
      host: Deno.env.get("ERP_SQL_HOST"),
      port: Deno.env.get("ERP_SQL_PORT"),
      database: Deno.env.get("ERP_SQL_DATABASE"),
    },
    200,
    req,
    { startMs }
  );
}

// ─── Main handler ───

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const startMs = Date.now();

  try {
    // Parse path from URL or body
    const url = new URL(req.url);
    let path = url.pathname.replace(/^\/erp-sync-engine\/?/, "").replace(/^\//, "");

    // Also support path in body (standard pattern)
    if (!path && req.method === "POST") {
      try {
        const body = await req.clone().json();
        path = body.path?.replace(/^\//, "") || "";
      } catch (_) {
        // no body
      }
    }

    switch (path) {
      case "test-connection":
        return await handleTestConnection(req, startMs);
      case "status":
        return await handleStatus(req, startMs);
      default:
        return jsonResponse(
          {
            success: true,
            message: "ERP Sync Engine — Fase 1 (Teste de Conectividade)",
            availableRoutes: [
              "POST /test-connection — Testa conexão com SQL Server + query de exemplo",
              "POST /status — Status da conexão e última sync",
            ],
          },
          200,
          req,
          { startMs }
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return errorResponse(500, "internal_error", message, req, startMs);
  }
});
