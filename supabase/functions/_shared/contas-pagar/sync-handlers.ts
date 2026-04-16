// _shared/contas-pagar/sync-handlers.ts — Sync endpoints (bulk-sync, sync-incremental, sync-chunk, sync-complete, chunks-progress, sync)
import { getCorsHeaders } from "../cors.ts";
import type { HandlerContext } from "./types.ts";
import {
  MAX_PAYLOAD_SIZE, MAX_CONCURRENT_SYNCS, API_VERSION,
  processRecordsWithRetry, safeExecute, waitForSlot, releaseSlot,
  getActiveSlotCount, logSuccess, logError, jsonRes,
} from "./utils.ts";

export async function handleBulkSync(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateApiKey()) {
    logError('bulk-sync', 'Unauthorized - API Key inválida');
    return jsonRes({ error: 'Unauthorized' }, 401, ctx.corsHeaders);
  }

  const requestId = crypto.randomUUID();
  const body = await ctx.req.json();
  const contas = body.contas || body.data || body;
  const syncId = body.sync_id || requestId;
  const chunkNumber = body.chunk_number || 1;
  const totalChunks = body.total_chunks;
  const forceUpdate = ctx.url.searchParams.get('force_update') === 'true' || body.force_update === true;

  if (!Array.isArray(contas) || contas.length === 0) {
    logError('bulk-sync', 'Payload inválido - array esperado');
    return jsonRes({ error: 'Invalid payload - array expected' }, 400, ctx.corsHeaders);
  }

  if (contas.length > MAX_PAYLOAD_SIZE) {
    logError('bulk-sync', `Payload muito grande: ${contas.length}`);
    return jsonRes({ error: `Payload too large. Max: ${MAX_PAYLOAD_SIZE}, received: ${contas.length}` }, 413, ctx.corsHeaders);
  }

  console.log(`📦 [bulk-sync] Chunk ${chunkNumber}/${totalChunks || '?'}: ${contas.length} registros${forceUpdate ? ' (FORCE UPDATE)' : ''} - Aguardando slot...`);

  const { acquired, waitTime } = await waitForSlot(ctx.supabase, requestId);

  if (!acquired) {
    const activeCount = await getActiveSlotCount(ctx.supabase);
    logError('bulk-sync', `Rate limit excedido após ${waitTime}ms de espera`);
    return new Response(JSON.stringify({
      success: false,
      error: 'Rate limit exceeded - too many concurrent requests',
      retry_after_ms: 5000,
      queue_info: { max_concurrent: MAX_CONCURRENT_SYNCS, active_syncs: activeCount, wait_time_ms: waitTime }
    }), {
      status: 429,
      headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '5', 'X-RateLimit-Limit': MAX_CONCURRENT_SYNCS.toString(), 'X-RateLimit-Remaining': '0' }
    });
  }

  console.log(`✅ [bulk-sync] Slot adquirido após ${waitTime}ms - Processando...`);

  try {
    const processStartTime = Date.now();

    const { data: result, success: processSuccess, error: processError } = await safeExecute(
      () => processRecordsWithRetry(ctx.supabase, contas, 'bulk-sync', forceUpdate),
      { inserted: 0, updated: 0, skipped: contas.length, total: contas.length },
      'bulk-sync-process'
    );

    const processDuration = Date.now() - processStartTime;
    const totalDuration = Date.now() - ctx.startTime;

    try {
      await ctx.supabase.from('sync_chunks_tracking').insert({
        sync_id: syncId, entidade: 'contas_pagar', chunk_number: chunkNumber, total_chunks: totalChunks,
        records_in_chunk: contas.length, records_processed: result.total,
        records_inserted: result.inserted, records_updated: result.updated, records_skipped: result.skipped,
        status: processSuccess ? 'completed' : 'partial', error_message: processError || null,
        completed_at: new Date().toISOString(), duration_ms: processDuration
      });
    } catch (trackingErr) {
      console.warn('⚠️ Erro ao registrar chunk:', trackingErr);
    }

    if (processSuccess) {
      logSuccess('bulk-sync', { chunk: chunkNumber, total: contas.length, inserted: result.inserted, updated: result.updated, skipped: result.skipped, wait_time_ms: waitTime, process_duration_ms: processDuration, force_update: forceUpdate });
    } else {
      console.warn(`⚠️ [bulk-sync] Chunk ${chunkNumber} processado com erro parcial: ${processError}`);
    }

    const remainingSlots = Math.max(0, MAX_CONCURRENT_SYNCS - await getActiveSlotCount(ctx.supabase));

    return new Response(JSON.stringify({
      success: true, partial: !processSuccess, sync_id: syncId, chunk_number: chunkNumber, force_update: forceUpdate,
      statistics: { total_received: contas.length, inserted: result.inserted, updated: result.updated, skipped: result.skipped, errors: processSuccess ? 0 : 1 },
      duration_ms: totalDuration,
      rate_limit_info: { wait_time_ms: waitTime, process_time_ms: processDuration, slots_remaining: remainingSlots },
      performance: { records_per_second: processDuration > 0 ? Math.round(contas.length / (processDuration / 1000)) : 0 },
      warning: processError || undefined
    }), {
      headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json', 'X-RateLimit-Limit': MAX_CONCURRENT_SYNCS.toString(), 'X-RateLimit-Remaining': remainingSlots.toString(), 'X-Processing-Time-Ms': processDuration.toString(), 'X-Wait-Time-Ms': waitTime.toString() }
    });
  } finally {
    await releaseSlot(ctx.supabase, requestId);
  }
}

export async function handleSyncIncremental(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateApiKey()) {
    logError('sync-incremental', 'Unauthorized');
    return jsonRes({ error: 'Unauthorized' }, 401, ctx.corsHeaders);
  }

  const body = await ctx.req.json();
  const contas = body.contas || body.data || body;
  const forceUpdate = ctx.url.searchParams.get('force_update') === 'true' || body.force_update === true;

  if (!Array.isArray(contas) || contas.length === 0) {
    return jsonRes({ error: 'Invalid payload' }, 400, ctx.corsHeaders);
  }

  console.log(`🔄 [sync-incremental] Processando ${contas.length} registros${forceUpdate ? ' (FORCE UPDATE)' : ''}`);

  try {
    const result = await processRecordsWithRetry(ctx.supabase, contas, 'sync-incremental', forceUpdate);
    const duration = Date.now() - ctx.startTime;
    const empresaId = contas[0] ? (contas[0]['ID Empresa'] || contas[0].empresa_id) : null;

    if (result.inserted > 0 || result.updated > 0) {
      await ctx.supabase.from('sync_control').insert({
        entidade: 'contas_pagar', empresa_id: empresaId, ultima_sync: new Date().toISOString(),
        total_registros: contas.length, registros_inseridos: result.inserted, registros_atualizados: result.updated,
        registros_ignorados: result.skipped, duracao_ms: duration, status: 'success'
      });
    } else {
      console.log(`⏭️ [sync-incremental] Nenhuma alteração - sync_control ignorado (${result.skipped} skipped)`);
    }

    logSuccess('sync-incremental', { total: contas.length, duration_ms: duration, force_update: forceUpdate });

    return jsonRes({
      success: true, force_update: forceUpdate,
      statistics: { total_received: contas.length, inserted: result.inserted, updated: result.updated, skipped: result.skipped, errors: 0 },
      duration_ms: duration,
      message: forceUpdate ? `${result.updated} registros atualizados (force_update ativado)` : `${result.skipped} registros ignorados (sem alterações)`
    }, 200, ctx.corsHeaders);
  } catch (error) {
    logError('sync-incremental', error);
    return jsonRes({ error: error instanceof Error ? error.message : 'Unknown error' }, 500, ctx.corsHeaders);
  }
}

export async function handleSyncChunk(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateApiKey()) {
    return jsonRes({ error: 'Unauthorized' }, 401, ctx.corsHeaders);
  }

  const chunkBody = await ctx.req.json();
  const contas = chunkBody.contas || chunkBody.data || [];
  if (!Array.isArray(contas) || contas.length === 0) {
    return jsonRes({ success: true, statistics: { total_received: 0 }, message: 'Chunk vazio' }, 200, ctx.corsHeaders);
  }

  const forceUpdate = ctx.url.searchParams.get('force_update') === 'true' || chunkBody.force_update === true;
  const requestId = crypto.randomUUID();
  const { acquired, waitTime } = await waitForSlot(ctx.supabase, requestId);

  if (!acquired) {
    return jsonRes({ error: 'Rate limit - slots ocupados', wait_time_ms: waitTime }, 429, ctx.corsHeaders);
  }

  try {
    const result = await processRecordsWithRetry(ctx.supabase, contas, 'sync-chunk', forceUpdate);
    return jsonRes({ success: true, statistics: result, duration_ms: Date.now() - ctx.startTime }, 200, ctx.corsHeaders);
  } finally {
    await releaseSlot(ctx.supabase, requestId);
  }
}

export async function handleSyncComplete(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateApiKey()) {
    return jsonRes({ error: 'Unauthorized' }, 401, ctx.corsHeaders);
  }

  const { sync_id, empresa_id } = await ctx.req.json();
  if (!sync_id) {
    return jsonRes({ error: 'sync_id required' }, 400, ctx.corsHeaders);
  }

  const { data: progress } = await ctx.supabase
    .from('sync_chunks_progress').select('*').eq('sync_id', sync_id).single();

  await ctx.supabase.from('sync_control').insert({
    entidade: 'contas_pagar', empresa_id, ultima_sync: new Date().toISOString(),
    total_registros: progress?.total_processed || 0, registros_inseridos: progress?.total_inserted || 0,
    registros_atualizados: progress?.total_updated || 0, registros_ignorados: progress?.total_skipped || 0,
    duracao_ms: progress?.total_duration_ms || 0, status: progress?.overall_status === 'completed' ? 'success' : 'partial'
  });

  logSuccess('sync-complete', { sync_id });

  return jsonRes({ success: true, sync_id, summary: progress || { message: 'No chunks found for this sync_id' } }, 200, ctx.corsHeaders);
}

export async function handleChunksProgress(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) {
    return jsonRes({ error: 'Unauthorized' }, 401, ctx.corsHeaders);
  }

  const syncId = ctx.url.searchParams.get('sync_id');
  let query = ctx.supabase.from('sync_chunks_progress').select('*').eq('entidade', 'contas_pagar').order('started_at', { ascending: false }).limit(10);
  if (syncId) query = query.eq('sync_id', syncId);

  const { data, error } = await query;
  if (error) throw error;

  return jsonRes({ data }, 200, ctx.corsHeaders);
}

export async function handleSync(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateApiKey()) {
    logError('sync', 'Unauthorized');
    return jsonRes({ error: 'Unauthorized' }, 401, ctx.corsHeaders);
  }

  let contas: Record<string, unknown>[] = [];
  let bodyData: Record<string, unknown> = {};
  try {
    bodyData = await ctx.req.json();
    contas = (bodyData.contas || bodyData.data || bodyData) as Record<string, unknown>[];
    if (!Array.isArray(contas)) contas = [];
  } catch {
    console.warn('⚠️ [sync] Erro ao fazer parse do body, tentando como array direto');
    contas = [];
  }

  const forceUpdate = ctx.url.searchParams.get('force_update') === 'true' || bodyData.force_update === true;

  if (contas.length === 0) {
    return jsonRes({
      success: true, statistics: { total_received: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 },
      message: 'Nenhum registro recebido'
    }, 200, ctx.corsHeaders);
  }

  console.log(`📦 [sync-legado] Processando ${contas.length} registros${forceUpdate ? ' (FORCE UPDATE)' : ''}`);

  const { data: result, success: processSuccess, error: processError } = await safeExecute(
    () => processRecordsWithRetry(ctx.supabase, contas, 'sync-legado', forceUpdate),
    { inserted: 0, updated: 0, skipped: contas.length, total: contas.length },
    'sync-legado-process'
  );

  const duration = Date.now() - ctx.startTime;
  const empresaId = contas[0] ? (contas[0]['ID Empresa'] || contas[0].empresa_id) : null;

  try {
    await ctx.supabase.from('sync_control').insert({
      entidade: 'contas_pagar', empresa_id: empresaId, ultima_sync: new Date().toISOString(),
      total_registros: contas.length, registros_inseridos: result.inserted, registros_atualizados: result.updated,
      registros_ignorados: result.skipped, duracao_ms: duration, status: processSuccess ? 'success' : 'partial'
    });
  } catch (trackErr) {
    console.warn('⚠️ Erro ao registrar sync_control:', trackErr);
  }

  try {
    const { data: statusResult } = await ctx.supabase.rpc('recalculate_contas_pagar_status');
    if (statusResult) console.log(`🔄 [sync-legado] Status recalculados:`, JSON.stringify(statusResult));
  } catch (statusErr) {
    console.warn('⚠️ [sync-legado] Erro ao recalcular status:', statusErr);
  }

  if (processSuccess) {
    logSuccess('sync-legado', { total: contas.length, duration_ms: duration, force_update: forceUpdate });
  } else {
    console.warn(`⚠️ [sync-legado] Processado com erro parcial: ${processError}`);
  }

  return jsonRes({
    success: true, partial: !processSuccess, force_update: forceUpdate,
    statistics: { total_received: contas.length, inserted: result.inserted, updated: result.updated, skipped: result.skipped, errors: processSuccess ? 0 : 1 },
    duration_ms: duration,
    message: processSuccess
      ? (forceUpdate ? `${result.updated} registros atualizados (force_update)` : `${result.skipped} registros ignorados (sem alterações)`)
      : `Processado com erro parcial: ${processError}`,
    warning: processError || undefined
  }, 200, ctx.corsHeaders);
}
