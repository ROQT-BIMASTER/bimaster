// clientes-sync — Sync direto ERP → tabela `clientes` (substitui o pipeline N8N).
// Padrão idêntico a `contas-pagar-n8n-sync`: auth manual via x-api-key (timing-safe),
// upsert em mini-lotes com retry exponencial, registro em `sync_control`.
//
// Aceita 3 formatos de payload (compatibilidade com N8N legado durante a transição):
//   1. Array bruto $items() do N8N: [{ json: {...} }, ...]
//   2. Wrapper: { clientes: [...] } / { data: [...] } / { records: [...] } / { items: [...] }
//   3. Array simples: [ {...}, {...} ]

import { createClient } from "npm:@supabase/supabase-js@2";
import { logger } from "../_shared/logger.ts";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { timingSafeEqual } from "../_shared/timing-safe.ts";
import {
  processRecordsWithRetry,
  MAX_PAYLOAD_SIZE,
  MINI_BATCH_SIZE,
  INTER_BATCH_DELAY_MS,
  API_VERSION,
  logRequest,
  logSuccess,
  logError,
} from "../_shared/clientes/utils.ts";

// =====================================================
// PAYLOAD UNWRAP
// =====================================================
function unwrapPayload(body: unknown): Record<string, unknown>[] {
  const unwrapItem = (item: unknown): Record<string, unknown> => {
    if (item && typeof item === "object" && "json" in item) {
      return (item as { json: Record<string, unknown> }).json;
    }
    return item as Record<string, unknown>;
  };

  if (Array.isArray(body)) return body.map(unwrapItem);

  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    for (const key of ["clientes", "data", "records", "items"]) {
      if (Array.isArray(obj[key])) {
        return (obj[key] as unknown[]).map(unwrapItem);
      }
    }
  }
  return [];
}

// =====================================================
// HANDLER
// =====================================================
Deno.serve(secureHandler(
  { auth: "none", rateLimit: 60, rateLimitPrefix: "clientes-sync" },
  async (req) => {
    const startTime = Date.now();
    const corsHeaders = getCorsHeaders(req);

    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    // Health check
    if (req.method === "GET") {
      return new Response(
        JSON.stringify({
          ok: true,
          service: "clientes-sync",
          api_version: API_VERSION,
          timestamp: new Date().toISOString(),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ===== AUTH (x-api-key timing-safe) =====
    const apiKey = req.headers.get("x-api-key");
    const expectedKey = Deno.env.get("N8N_API_KEY");

    if (!expectedKey) {
      logError("auth", "N8N_API_KEY não configurado no ambiente");
      return new Response(
        JSON.stringify({ success: false, error: "Server misconfigured: missing API key" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!apiKey || !timingSafeEqual(apiKey, expectedKey)) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: invalid x-api-key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ===== PARSE PAYLOAD =====
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const records = unwrapPayload(body);
    const received = records.length;

    logRequest("POST", "/clientes-sync", { received });

    if (received === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          received: 0,
          processed: 0,
          inserted: 0,
          updated: 0,
          skipped: 0,
          errors: 0,
          duration_ms: Date.now() - startTime,
          rate_per_second: 0,
          api_version: API_VERSION,
          message: "Empty payload — nothing to process",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (received > MAX_PAYLOAD_SIZE) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Payload too large: ${received} records (max: ${MAX_PAYLOAD_SIZE})`,
          received,
        }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ===== SUPABASE CLIENT (service role) =====
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // ===== PROCESS EM MINI-LOTES =====
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalProcessed = 0;
    let totalErrors = 0;
    const batchErrors: string[] = [];

    const totalBatches = Math.ceil(received / MINI_BATCH_SIZE);
    logger.log(`📦 [clientes-sync] Processando ${received} registros em ${totalBatches} mini-batches de ${MINI_BATCH_SIZE}`);

    for (let i = 0; i < received; i += MINI_BATCH_SIZE) {
      const batch = records.slice(i, i + MINI_BATCH_SIZE);
      const batchNum = Math.floor(i / MINI_BATCH_SIZE) + 1;
      try {
        const r = await processRecordsWithRetry(
          supabase,
          batch,
          `clientes-sync-batch-${batchNum}/${totalBatches}`,
        );
        totalInserted += r.inserted;
        totalUpdated += r.updated;
        totalSkipped += r.skipped;
        totalProcessed += r.total;
      } catch (e) {
        totalErrors += batch.length;
        const msg = e instanceof Error ? e.message : String(e);
        batchErrors.push(`Batch ${batchNum}: ${msg}`);
        logError(`clientes-sync-batch-${batchNum}`, e, { batch_size: batch.length });
      }

      if (i + MINI_BATCH_SIZE < received) {
        await new Promise((r) => setTimeout(r, INTER_BATCH_DELAY_MS));
      }
    }

    // ===== LOG EM sync_control =====
    const durationMs = Date.now() - startTime;
    const ratePerSecond = durationMs > 0 ? Math.round((totalProcessed / durationMs) * 1000) : 0;

    try {
      await supabase.from("sync_control").insert({
        entidade: "clientes",
        origem: "erp",
        status: totalErrors === 0 ? "success" : (totalProcessed > 0 ? "partial" : "error"),
        registros_recebidos: received,
        registros_processados: totalProcessed,
        registros_inseridos: totalInserted,
        registros_atualizados: totalUpdated,
        registros_ignorados: totalSkipped,
        registros_com_erro: totalErrors,
        duracao_ms: durationMs,
        detalhes: {
          api_version: API_VERSION,
          rate_per_second: ratePerSecond,
          batch_errors: batchErrors.slice(0, 10),
        },
      });
    } catch (e) {
      logger.warn("⚠️ [clientes-sync] Falha ao gravar sync_control (não crítico):", e);
    }

    logSuccess("clientes-sync", {
      received,
      processed: totalProcessed,
      inserted: totalInserted,
      updated: totalUpdated,
      skipped: totalSkipped,
      errors: totalErrors,
      duration_ms: durationMs,
    });

    return new Response(
      JSON.stringify({
        success: totalErrors === 0,
        received,
        processed: totalProcessed,
        inserted: totalInserted,
        updated: totalUpdated,
        skipped: totalSkipped,
        errors: totalErrors,
        duration_ms: durationMs,
        rate_per_second: ratePerSecond,
        api_version: API_VERSION,
        ...(batchErrors.length > 0 ? { batch_errors: batchErrors.slice(0, 5) } : {}),
      }),
      {
        status: totalErrors === 0 ? 200 : 207,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  },
));
