// contas-pagar-n8n-sync — Função isolada para sincronização N8N → Contas a Pagar
// Replica o contrato antigo do N8N (formato $items()) que estava em produção.
// SEM secureHandler, SEM IA, SEM WAF — apenas auth manual + upsert via shared utils.
// Reusa transformErpData / generateErpId / processRecordsWithRetry da API nova
// para garantir paridade total de dados (mesmo erp_id, mesmo hash, mesmo upsert).

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import {
  processRecordsWithRetry,
  MAX_PAYLOAD_SIZE,
  MINI_BATCH_SIZE,
  INTER_BATCH_DELAY_MS,
  logRequest,
  logSuccess,
  logError,
} from "../_shared/contas-pagar/utils.ts";

const API_VERSION = "n8n-cp-1.0.0";

// =====================================================
// PAYLOAD UNWRAP — aceita os 3 formatos legados do N8N
// =====================================================
function unwrapPayload(body: unknown): Record<string, unknown>[] {
  // Formato 1: array bruto $items() do N8N — [ { json: {...} }, ... ]
  if (Array.isArray(body)) {
    return body.map((item) => {
      if (item && typeof item === "object" && "json" in item) {
        return (item as { json: Record<string, unknown> }).json;
      }
      return item as Record<string, unknown>;
    });
  }

  // Formato 2: wrapper { contas: [...] } ou { data: [...] } ou { transacoes: [...] }
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    const candidates = ["contas", "data", "transacoes", "items", "records"];
    for (const key of candidates) {
      if (Array.isArray(obj[key])) {
        return (obj[key] as unknown[]).map((item) => {
          if (item && typeof item === "object" && "json" in item) {
            return (item as { json: Record<string, unknown> }).json;
          }
          return item as Record<string, unknown>;
        });
      }
    }
  }

  return [];
}

// =====================================================
// HANDLER
// =====================================================
Deno.serve(async (req) => {
  const startTime = Date.now();
  const corsHeaders = getCorsHeaders(req);

  // CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Health check (GET)
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        service: "contas-pagar-n8n-sync",
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

  // =====================================================
  // AUTH — x-api-key obrigatório (mesma chave do legacy)
  // =====================================================
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("N8N_API_KEY");

  if (!expectedKey) {
    logError("auth", "N8N_API_KEY não configurado no ambiente");
    return new Response(
      JSON.stringify({ success: false, error: "Server misconfigured: missing N8N_API_KEY" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!apiKey || apiKey !== expectedKey) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized: invalid x-api-key" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // =====================================================
  // PARSE PAYLOAD
  // =====================================================
  let body: unknown;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid JSON body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const records = unwrapPayload(body);
  const received = records.length;

  logRequest("POST", "/contas-pagar-n8n-sync", { received });

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

  // =====================================================
  // SUPABASE CLIENT (service role — N8N é server-to-server)
  // =====================================================
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // =====================================================
  // PROCESS — mini-batches de 100, retry exponencial
  // =====================================================
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalProcessed = 0;
  let totalErrors = 0;
  const batchErrors: string[] = [];

  const totalBatches = Math.ceil(received / MINI_BATCH_SIZE);
  console.log(`📦 [n8n-cp-sync] Processando ${received} registros em ${totalBatches} mini-batches de ${MINI_BATCH_SIZE}`);

  for (let i = 0; i < received; i += MINI_BATCH_SIZE) {
    const batch = records.slice(i, i + MINI_BATCH_SIZE);
    const batchNum = Math.floor(i / MINI_BATCH_SIZE) + 1;
    try {
      const result = await processRecordsWithRetry(
        supabase,
        batch,
        `n8n-cp-sync-batch-${batchNum}/${totalBatches}`,
        false,
      );
      totalInserted += result.inserted || 0;
      totalUpdated += result.updated || 0;
      totalSkipped += result.skipped || 0;
      totalProcessed += result.total || batch.length;
    } catch (e) {
      totalErrors += batch.length;
      const msg = e instanceof Error ? e.message : String(e);
      batchErrors.push(`Batch ${batchNum}: ${msg}`);
      logError(`n8n-cp-sync-batch-${batchNum}`, e, { batch_size: batch.length });
    }

    // Pequeno delay entre batches para evitar saturar o pool
    if (i + MINI_BATCH_SIZE < received) {
      await new Promise((r) => setTimeout(r, INTER_BATCH_DELAY_MS));
    }
  }

  // =====================================================
  // RECALCULA STATUS (mesmo passo do /sync legado)
  // =====================================================
  try {
    await supabase.rpc("recalculate_contas_pagar_status");
  } catch (e) {
    console.warn("⚠️ [n8n-cp-sync] recalculate_contas_pagar_status falhou (não crítico):", e);
  }

  // =====================================================
  // LOG EM sync_control
  // =====================================================
  const durationMs = Date.now() - startTime;
  const ratePerSecond = durationMs > 0 ? Math.round((totalProcessed / durationMs) * 1000) : 0;

  try {
    await supabase.from("sync_control").insert({
      entidade: "contas_pagar",
      origem: "n8n",
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
    console.warn("⚠️ [n8n-cp-sync] Falha ao gravar sync_control (não crítico):", e);
  }

  logSuccess("n8n-cp-sync", {
    received,
    processed: totalProcessed,
    inserted: totalInserted,
    updated: totalUpdated,
    skipped: totalSkipped,
    errors: totalErrors,
    duration_ms: durationMs,
  });

  // =====================================================
  // RESPOSTA NO SHAPE ESPERADO PELO N8N
  // =====================================================
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
});
