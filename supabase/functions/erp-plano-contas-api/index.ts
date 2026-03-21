import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(status: number, code: string, message: string) {
  return json({ error: code, message }, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startMs = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/erp-plano-contas-api\/?/, "/").replace(/\/+$/, "") || "/";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // --- Authenticate via x-api-key → erp_config ---
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return errorResponse(401, "UNAUTHORIZED", "Header x-api-key ausente");
  }

  const { data: configRow, error: configErr } = await supabase
    .from("erp_config")
    .select("empresa_id")
    .eq("config_key", "api_key")
    .eq("config_value", apiKey)
    .maybeSingle();

  let empresaId: string | number | null = configRow?.empresa_id ?? null;

  // Fallback: check erp_api_keys table
  if (!empresaId) {
    const { validateErpApiKey } = await import("../_shared/erp-key-validator.ts");
    const empresa = await validateErpApiKey(apiKey);
    if (empresa) {
      empresaId = empresa;
    }
  }

  if (!empresaId) {
    return errorResponse(401, "UNAUTHORIZED", "API key inválida ou sem empresa vinculada");
  }

  // --- Helper to log to erp_sync_log ---
  async function logSync(endpoint: string, payload: unknown, statusCode: number) {
    try {
      await supabase.from("erp_sync_log").insert({
        entity_type: "plano_contas",
        entity_id: crypto.randomUUID(),
        action: endpoint,
        direction: "inbound",
        request_payload: payload as any,
        response_status: statusCode,
        success: statusCode >= 200 && statusCode < 300,
        duration_ms: Date.now() - startMs,
        empresa_id: empresaId,
      });
    } catch (e) {
      console.error("Failed to log sync:", e);
    }
  }

  try {
    // ==================== GET / ====================
    if (req.method === "GET" && path === "/") {
      const { data, error } = await supabase
        .from("trade_chart_of_accounts")
        .select("id, code, name, erp_code, account_type, is_active")
        .eq("is_active", true)
        .order("code", { ascending: true });

      if (error) {
        await logSync("GET /", null, 500);
        return errorResponse(500, "DB_ERROR", error.message);
      }

      const planoContas = (data || []).map((row: any) => ({
        id: row.id,
        codigo: row.code,
        nome: row.name,
        erp_code: row.erp_code,
        tipo: row.account_type === "receita" || row.account_type === "R" ? "R" : "D",
        ativo: row.is_active,
      }));

      await logSync("GET /", null, 200);
      return json({ plano_contas: planoContas, total: planoContas.length });
    }

    // ==================== 404 ====================
    await logSync(`${req.method} ${path}`, null, 404);
    return errorResponse(404, "NOT_FOUND", `Rota ${req.method} ${path} não encontrada`);
  } catch (err: any) {
    await logSync(`${req.method} ${path}`, null, 500);
    return errorResponse(500, "DB_ERROR", err.message || "Erro interno");
  }
});
