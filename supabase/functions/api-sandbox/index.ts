// api-sandbox — Dry-run proxy for testing API calls without affecting production data
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Mock data generators per API type
function generateMockResponse(path: string, method: string, body: unknown): { status: number; data: unknown } {
  const normalizedPath = path.replace(/^\/+/, "").replace(/\?.*$/, "");
  
  // Status endpoints - passthrough-like response
  if (normalizedPath.endsWith("/status")) {
    const fnName = normalizedPath.split("/")[0] || "unknown";
    return {
      status: 200,
      data: { status: "ok", function: fnName, sandbox: true, dry_run: true },
    };
  }

  // Write operations (incluir, upsert, cadastrar, gerar)
  if (/\/(incluir|upsert|cadastrar|gerar|associar)$/.test(normalizedPath)) {
    return {
      status: 200,
      data: {
        sucesso: true,
        mensagem: "[SANDBOX] Registro simulado com sucesso — nenhum dado foi gravado",
        codigo_lancamento_integracao: "SANDBOX-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
        sandbox: true,
        dry_run: true,
      },
    };
  }

  // Upsert lote
  if (/\/upsert-lote$/.test(normalizedPath)) {
    const loteBody = body as Record<string, unknown> | null;
    const items = Array.isArray(loteBody) ? loteBody.length : 1;
    return {
      status: 200,
      data: {
        sucesso: true,
        mensagem: `[SANDBOX] ${items} registro(s) simulado(s) — nenhum dado foi gravado`,
        resultados: [{ codigo_lancamento_integracao: "SANDBOX-LOTE-001", status: "simulado" }],
        sandbox: true,
        dry_run: true,
      },
    };
  }

  // Update operations (alterar, update)
  if (/\/(alterar|update)$/.test(normalizedPath)) {
    return {
      status: 200,
      data: {
        sucesso: true,
        mensagem: "[SANDBOX] Alteração simulada — nenhum dado foi modificado",
        sandbox: true,
        dry_run: true,
      },
    };
  }

  // Delete operations (excluir, cancelar)
  if (/\/(excluir|cancelar|estornar)$/.test(normalizedPath)) {
    return {
      status: 200,
      data: {
        sucesso: true,
        mensagem: "[SANDBOX] Exclusão/cancelamento simulado — nenhum dado foi removido",
        sandbox: true,
        dry_run: true,
      },
    };
  }

  // Payment operations
  if (/\/(lancar-pagamento|registrar-pagamento|lancar-recebimento|cancelar-pagamento|cancelar-recebimento|conciliar)$/.test(normalizedPath)) {
    return {
      status: 200,
      data: {
        sucesso: true,
        mensagem: "[SANDBOX] Operação financeira simulada — nenhuma movimentação real",
        codigo_baixa: "SANDBOX-BAIXA-" + crypto.randomUUID().slice(0, 6).toUpperCase(),
        sandbox: true,
        dry_run: true,
      },
    };
  }

  // Read operations (listar, consultar, query, resumo, pesquisar, extrato)
  if (/\/(listar|consultar|query|resumo|pesquisar|extrato|listar-resumido|pending|paid|cancelled|history|stats|reconciliation|export-summary|eventos)/.test(normalizedPath)) {
    return {
      status: 200,
      data: {
        nPagina: 1,
        nTotPaginas: 1,
        nRegistros: 2,
        nTotRegistros: 2,
        registros: [
          {
            id: "sandbox-001",
            descricao: "[SANDBOX] Registro de exemplo 1",
            valor: 1500.00,
            data_vencimento: "2026-04-15",
            status: "aberto",
          },
          {
            id: "sandbox-002",
            descricao: "[SANDBOX] Registro de exemplo 2",
            valor: 2300.50,
            data_vencimento: "2026-05-01",
            status: "pago",
          },
        ],
        sandbox: true,
        dry_run: true,
      },
    };
  }

  // Sync operations
  if (/\/(sync|sync-bidirecional|cadastrar-todas|process|retry-dead|retry-failed|export-batch|confirm)$/.test(normalizedPath)) {
    return {
      status: 200,
      data: {
        sucesso: true,
        mensagem: "[SANDBOX] Sincronização/processamento simulado — nenhuma ação real executada",
        processados: 0,
        erros: 0,
        sandbox: true,
        dry_run: true,
      },
    };
  }

  // Default fallback
  return {
    status: 200,
    data: {
      sucesso: true,
      mensagem: "[SANDBOX] Operação simulada com sucesso",
      endpoint: normalizedPath,
      method,
      sandbox: true,
      dry_run: true,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "METHOD_NOT_ALLOWED", message: "Apenas POST é permitido", sandbox: true }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const startMs = Date.now();

  try {
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "UNAUTHORIZED", message: "Token de autorização ausente", sandbox: true }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "UNAUTHORIZED", message: "Token inválido ou expirado", sandbox: true }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;

    // Parse request
    const { path, method, body: reqBody } = await req.json();

    if (!path || !method) {
      return new Response(
        JSON.stringify({ error: "VALIDATION_ERROR", message: "path e method são obrigatórios", sandbox: true }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate mock response
    const mock = generateMockResponse(path, method, reqBody);
    const durationMs = Date.now() - startMs;

    // Log to sandbox_requests
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await adminClient.from("sandbox_requests").insert({
      user_id: userId,
      endpoint: path,
      method: method.toUpperCase(),
      request_body: reqBody || null,
      response_body: mock.data,
      response_status: mock.status,
      duration_ms: durationMs,
    });

    return new Response(
      JSON.stringify({
        ...mock.data as Record<string, unknown>,
        meta: {
          processed_at: new Date().toISOString(),
          duration_ms: durationMs,
          environment: "sandbox",
        },
      }),
      {
        status: mock.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("❌ api-sandbox error:", e);
    return new Response(
      JSON.stringify({
        error: "SANDBOX_ERROR",
        message: e.message || "Erro interno do sandbox",
        sandbox: true,
        meta: { processed_at: new Date().toISOString(), duration_ms: Date.now() - startMs },
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
