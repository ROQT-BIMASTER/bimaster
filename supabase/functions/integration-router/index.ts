// integration-router — Roteador de integrações inbound/outbound
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { validateAnyAuth, AuthError } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { wafCheck, wafBlockResponse } from "../_shared/waf.ts";

// ── Helpers ──────────────────────────────────────────

interface FieldMapping {
  campo_origem: string;
  path_origem: string | null;
  campo_destino: string;
  tipo_transformacao: string;
  formato_origem: string | null;
  formato_destino: string | null;
  funcao_transformacao: string | null;
  valor_default: string | null;
  obrigatorio: boolean;
}

function getNestedValue(obj: any, path: string): any {
  if (!path) return obj;
  return path.split(".").reduce((acc, part) => acc?.[part], obj);
}

function parseDate(value: any): string | null {
  if (!value) return null;
  try {
    if (typeof value === "string" && value.includes("T")) return new Date(value).toISOString().split("T")[0];
    if (typeof value === "string" && value.includes("/")) {
      const [day, month, year] = value.split("/");
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    if (typeof value === "number") return new Date(value).toISOString().split("T")[0];
    return value;
  } catch { return null; }
}

function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") value = value.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

function transformData(sourceData: Record<string, any>, mappings: FieldMapping[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const mapping of mappings) {
    const sourceValue = mapping.path_origem ? getNestedValue(sourceData, mapping.path_origem) : sourceData[mapping.campo_origem];
    let transformed = sourceValue;
    switch (mapping.tipo_transformacao) {
      case "format_date": transformed = parseDate(sourceValue); break;
      case "parse_number": transformed = parseNumber(sourceValue); break;
      case "uppercase": transformed = typeof sourceValue === "string" ? sourceValue.toUpperCase() : sourceValue; break;
      case "lowercase": transformed = typeof sourceValue === "string" ? sourceValue.toLowerCase() : sourceValue; break;
      case "trim": transformed = typeof sourceValue === "string" ? sourceValue.trim() : sourceValue; break;
      case "boolean": transformed = sourceValue === true || sourceValue === "true" || sourceValue === "1" || sourceValue === 1; break;
    }
    if ((transformed === null || transformed === undefined) && mapping.valor_default) transformed = mapping.valor_default;
    result[mapping.campo_destino] = transformed;
  }
  return result;
}

async function calculateHash(data: any): Promise<string> {
  const str = JSON.stringify(data);
  const msgBuffer = new TextEncoder().encode(str);
  try {
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
  } catch {
    let hash = 0;
    for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash = hash & hash; }
    return Math.abs(hash).toString(16);
  }
}

async function logIntegration(supabase: any, configId: string | null, codigo: string, direcao: string, status: string, details: Record<string, unknown> = {}) {
  try {
    await supabase.from("integration_logs").insert({
      config_id: configId, codigo_integracao: codigo, direcao, status, ...details,
      finalizado_em: status !== "processing" ? new Date().toISOString() : null,
    });
  } catch (e) { console.error("Failed to log integration:", e); }
}

async function updateConfigStatus(supabase: any, configId: string, status: string, erro?: string) {
  try {
    await supabase.from("integration_configs").update({
      ultima_execucao: new Date().toISOString(), ultimo_status: status, ultimo_erro: erro || null,
    }).eq("id", configId);
  } catch (e) { console.error("Failed to update config status:", e); }
}

// ── Main ─────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  // WAF L7 check
  const waf = await wafCheck(req);
  if (!waf.allowed) return wafBlockResponse(waf, { "Access-Control-Allow-Origin": "*" });

  const startMs = Date.now();
  const requestId = crypto.randomUUID();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const action = pathParts[1]; // inbound, outbound, health, configs
    const sourceCode = pathParts[2];

    // Health check
    if (action === "health" || (!action && req.method === "GET")) {
      try {
        await validateAnyAuth(req);
      } catch (e) {
        if (e instanceof AuthError) return errorResponse(e.status, "UNAUTHORIZED", e.message, req, startMs);
        throw e;
      }
      return jsonResponse({ status: "healthy", timestamp: new Date().toISOString(), version: "1.1.0" }, 200, req, { startMs });
    }

    // List configs
    if (action === "configs" && req.method === "GET") {
      try {
        await validateAnyAuth(req);
        await checkRateLimit({ prefix: "integration-router", limit: 30, req });
      } catch (e) {
        if (e instanceof RateLimitError) return errorResponse(429, "RATE_LIMIT", e.message, req, startMs);
        if (e instanceof AuthError) return errorResponse(e.status, "UNAUTHORIZED", e.message, req, startMs);
        throw e;
      }

      const { data: configs, error } = await supabase
        .from("integration_configs")
        .select("id, codigo, nome, tipo, sistema_origem, entidade_destino, ativo, ultima_execucao, ultimo_status")
        .order("nome");
      if (error) return errorResponse(500, "DB_ERROR", error.message, req, startMs);
      return jsonResponse({ configs }, 200, req, { startMs });
    }

    // Inbound data sync
    if (action === "inbound" && req.method === "POST") {
      if (!sourceCode) return errorResponse(400, "VALIDATION", "Source code is required", req, startMs);

      // Auth
      try {
        await validateAnyAuth(req);
        await checkRateLimit({ prefix: "integration-router", limit: 30, req });
      } catch (e) {
        if (e instanceof RateLimitError) return errorResponse(429, "RATE_LIMIT", e.message, req, startMs);
        if (e instanceof AuthError) return errorResponse(e.status, "UNAUTHORIZED", e.message, req, startMs);
        throw e;
      }

      const { data: config, error: configError } = await supabase
        .from("integration_configs")
        .select("*")
        .eq("codigo", sourceCode)
        .eq("ativo", true)
        .single();

      if (configError || !config) {
        return errorResponse(404, "NOT_FOUND", `Integration config not found or inactive: ${sourceCode}`, req, startMs);
      }

      const body = await req.json();
      const records = Array.isArray(body) ? body : (body.data || body.records || body.contas || [body]);
      if (!records.length) return errorResponse(400, "VALIDATION", "No records to process", req, startMs);

      await logIntegration(supabase, config.id, sourceCode, "inbound", "processing", {
        request_id: requestId, registros_recebidos: records.length,
        payload_size_bytes: JSON.stringify(body).length, payload_preview: JSON.stringify(body).substring(0, 500),
      });

      const { data: mappings } = await supabase
        .from("integration_field_mappings")
        .select("*")
        .eq("config_id", config.id)
        .eq("ativo", true)
        .order("ordem");

      let processedCount = 0, successCount = 0, errorCount = 0;
      const errors: any[] = [];
      const batchSize = config.batch_size || 100;

      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const transformedBatch: any[] = [];

        for (const record of batch) {
          try {
            const transformed = mappings?.length ? transformData(record, mappings) : record;
            if (config.entidade_destino === "contas_receber" || config.entidade_destino === "contas_pagar") {
              transformed.data_hash = await calculateHash({ erp_id: transformed.erp_id, valor_original: transformed.valor_original, data_vencimento: transformed.data_vencimento });
            }
            transformedBatch.push(transformed);
            processedCount++;
          } catch (e: unknown) {
            errorCount++;
            errors.push({ record, error: e instanceof Error ? e.message : String(e) });
          }
        }

        if (transformedBatch.length > 0) {
          const { error: upsertError } = await supabase
            .from(config.entidade_destino)
            .upsert(transformedBatch, { onConflict: "erp_id", ignoreDuplicates: false });
          if (upsertError) { errorCount += transformedBatch.length; errors.push({ batch: i / batchSize, error: upsertError.message }); }
          else successCount += transformedBatch.length;
        }

        if (i + batchSize < records.length) await new Promise(r => setTimeout(r, 10));
      }

      const duration = Date.now() - startMs;
      const finalStatus = errorCount === 0 ? "success" : (successCount > 0 ? "partial" : "error");

      await logIntegration(supabase, config.id, sourceCode, "inbound", finalStatus, {
        request_id: requestId, registros_recebidos: records.length, registros_processados: processedCount,
        registros_sucesso: successCount, registros_erro: errorCount, duracao_ms: duration,
        erro_mensagem: errors.length > 0 ? JSON.stringify(errors.slice(0, 10)) : undefined,
      });
      await updateConfigStatus(supabase, config.id, finalStatus, errors[0]?.error);

      return jsonResponse({
        success: true, request_id: requestId, status: finalStatus,
        stats: { received: records.length, processed: processedCount, success: successCount, errors: errorCount, duration_ms: duration },
        errors: errors.slice(0, 10),
      }, 200, req, { startMs });
    }

    // Outbound
    if (action === "outbound" && req.method === "POST") {
      try {
        await validateAnyAuth(req);
      } catch (e) {
        if (e instanceof AuthError) return errorResponse(e.status, "UNAUTHORIZED", e.message, req, startMs);
        throw e;
      }

      const { data: config, error: configError } = await supabase
        .from("integration_configs")
        .select("*")
        .eq("codigo", sourceCode)
        .eq("ativo", true)
        .eq("tipo", "outbound")
        .single();

      if (configError || !config) return errorResponse(404, "NOT_FOUND", `Outbound integration config not found: ${sourceCode}`, req, startMs);

      return jsonResponse({ message: "Outbound sync not yet implemented", config: config.codigo }, 200, req, { startMs });
    }

    return errorResponse(404, "NOT_FOUND", "Rota não encontrada", req, startMs);
  } catch (err) {
    if (err instanceof RateLimitError) return errorResponse(429, "RATE_LIMIT", err.message, req, startMs);
    if (err instanceof AuthError) return errorResponse(err.status, "AUTH_ERROR", err.message, req, startMs);
    console.error("Integration router error:", err);
    return errorResponse(500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Erro interno", req, startMs);
  }
});
