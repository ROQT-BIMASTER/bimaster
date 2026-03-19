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
  const path = url.pathname.replace(/^\/erp-fornecedores-query\/?/, "/").replace(/\/+$/, "") || "/";

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

  async function logSync(endpoint: string, payload: unknown, statusCode: number) {
    try {
      await supabase.from("erp_sync_log").insert({
        entity_type: "fornecedores",
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
      const cnpjParam = url.searchParams.get("cnpj");

      let query = supabase
        .from("fabrica_fornecedores")
        .select("id, cnpj, razao_social, nome_fantasia, erp_code, erp_synced_at, email, telefone, ativo")
        .eq("ativo", true)
        .order("razao_social");

      if (cnpjParam) {
        // Strip non-digits for flexible matching
        const cnpjClean = cnpjParam.replace(/\D/g, "");
        if (cnpjClean.length >= 11) {
          query = query.ilike("cnpj", `%${cnpjClean}%`);
        } else {
          query = query.ilike("cnpj", `%${cnpjParam}%`);
        }
      }

      const { data, error } = await query;

      if (error) {
        await logSync("GET /", { cnpj: cnpjParam }, 500);
        return errorResponse(500, "DB_ERROR", error.message);
      }

      if (!data || data.length === 0) {
        await logSync("GET /", { cnpj: cnpjParam }, 404);
        return errorResponse(404, "NOT_FOUND", "Nenhum fornecedor encontrado");
      }

      await logSync("GET /", { cnpj: cnpjParam }, 200);
      return json({ fornecedores: data, total: data.length });
    }

    // ==================== 404 ====================
    await logSync(`${req.method} ${path}`, null, 404);
    return errorResponse(404, "NOT_FOUND", `Rota ${req.method} ${path} não encontrada`);
  } catch (err: any) {
    await logSync(`${req.method} ${path}`, null, 500);
    return errorResponse(500, "DB_ERROR", err.message || "Erro interno");
  }
});
