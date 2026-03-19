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
  const path = url.pathname.replace(/^\/erp-portadores-api\/?/, "/").replace(/\/+$/, "") || "/";

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

  if (configErr || !configRow?.empresa_id) {
    return errorResponse(401, "UNAUTHORIZED", "API key inválida ou sem empresa vinculada");
  }

  const empresaId: number = configRow.empresa_id;

  // --- Helper to log to erp_sync_log ---
  async function logSync(endpoint: string, payload: unknown, statusCode: number) {
    try {
      await supabase.from("erp_sync_log").insert({
        entity_type: "portadores",
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
        .from("portadores")
        .select("id, nome, banco_codigo, banco_nome, agencia, conta, tipo, codigo_erp")
        .eq("empresa_id", empresaId)
        .eq("ativo", true)
        .order("nome");

      if (error) {
        await logSync("GET /", null, 500);
        return errorResponse(500, "DB_ERROR", error.message);
      }

      await logSync("GET /", null, 200);
      return json({ data, total: data.length });
    }

    // ==================== POST /sync ====================
    if (req.method === "POST" && path === "/sync") {
      let body: any;
      try {
        body = await req.json();
      } catch {
        await logSync("POST /sync", null, 422);
        return errorResponse(422, "VALIDATION_ERROR", "Body JSON inválido");
      }

      if (!Array.isArray(body?.portadores) || body.portadores.length === 0) {
        await logSync("POST /sync", body, 422);
        return errorResponse(422, "VALIDATION_ERROR", "Campo 'portadores' deve ser um array não vazio");
      }

      const rows = body.portadores.map((p: any) => ({
        empresa_id: empresaId,
        codigo_erp: p.codigo_erp,
        nome: p.nome,
        banco_codigo: p.banco_codigo || null,
        banco_nome: p.banco_nome || null,
        agencia: p.agencia || null,
        conta: p.conta || null,
        tipo: p.tipo || null,
        ativo: true,
        updated_at: new Date().toISOString(),
      }));

      // Validate required fields
      for (const r of rows) {
        if (!r.codigo_erp || !r.nome) {
          await logSync("POST /sync", body, 422);
          return errorResponse(422, "VALIDATION_ERROR", "Cada portador deve ter 'codigo_erp' e 'nome'");
        }
      }

      // Upsert using empresa_id + codigo_erp as key
      const { data, error } = await supabase
        .from("portadores")
        .upsert(rows, { onConflict: "empresa_id,codigo_erp", ignoreDuplicates: false })
        .select("id");

      if (error) {
        await logSync("POST /sync", body, 500);
        return errorResponse(500, "DB_ERROR", error.message);
      }

      const result = { success: true, upserted: data?.length || 0 };
      await logSync("POST /sync", body, 200);
      return json(result);
    }

    // ==================== 404 ====================
    await logSync(`${req.method} ${path}`, null, 404);
    return errorResponse(404, "NOT_FOUND", `Rota ${req.method} ${path} não encontrada`);
  } catch (err: any) {
    await logSync(`${req.method} ${path}`, null, 500);
    return errorResponse(500, "DB_ERROR", err.message || "Erro interno");
  }
});
