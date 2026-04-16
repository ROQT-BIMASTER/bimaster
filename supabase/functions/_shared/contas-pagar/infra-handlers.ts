// _shared/contas-pagar/infra-handlers.ts — Status, stats, last-sync, trigger-n8n, debug-payload (Profissionalizado)
import { timingSafeEqual } from "../timing-safe.ts";
import { getKeyPreview, logApiAccess } from "../auth.ts";
import type { HandlerContext } from "./types.ts";
import {
  API_VERSION, withRetry, logSuccess, logError, apiResponse, jsonRes,
  getActiveSlotCount, generateErpId, transformErpData,
} from "./utils.ts";

export async function handleStatus(ctx: HandlerContext): Promise<Response> {
  const activeSlots = await getActiveSlotCount(ctx.supabase);

  // Enriched health check (Fase 4B): DB latency ping
  const dbStart = Date.now();
  let dbLatencyMs = -1;
  try {
    await ctx.supabase.from('contas_pagar').select('id', { count: 'exact', head: true }).limit(0);
    dbLatencyMs = Date.now() - dbStart;
  } catch {
    dbLatencyMs = -1;
  }

  return apiResponse({
    status: 'online',
    version: API_VERSION,
    timestamp: new Date().toISOString(),
    service: 'contas-pagar-api',
    health: {
      db_latency_ms: dbLatencyMs,
      db_connected: dbLatencyMs >= 0,
      active_sync_slots: activeSlots,
    },
  }, 200, ctx.corsHeaders, ctx.startTime);
}

export async function handleStats(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return apiResponse({ error: 'Unauthorized' }, 401, ctx.corsHeaders, ctx.startTime);

  const { data, error } = await ctx.supabase.from('sync_control').select('*').eq('entidade', 'contas_pagar').order('created_at', { ascending: false }).limit(10);
  if (error) throw error;

  return apiResponse({ data }, 200, ctx.corsHeaders, ctx.startTime);
}

export async function handleLastSync(ctx: HandlerContext): Promise<Response> {
  const apiKey = ctx.req.headers.get('x-api-key');
  const expectedKey = Deno.env.get('N8N_API_KEY');
  const apiKeyValid = apiKey && expectedKey && timingSafeEqual(apiKey, expectedKey);
  if (!apiKeyValid && !await ctx.validateAuth()) return apiResponse({ error: 'Unauthorized' }, 401, ctx.corsHeaders, ctx.startTime);

  const { data: lastSync, error } = await ctx.supabase
    .from('sync_control').select('ultima_sync, total_registros, registros_inseridos, registros_atualizados')
    .eq('entidade', 'contas_pagar').eq('status', 'success').order('ultima_sync', { ascending: false }).limit(1).single();

  if (error && error.code !== 'PGRST116') throw error;

  const defaultDate = new Date(); defaultDate.setDate(defaultDate.getDate() - 7);
  const lastSyncDate = lastSync?.ultima_sync ? new Date(lastSync.ultima_sync).toISOString().split('T')[0] : defaultDate.toISOString().split('T')[0];

  return apiResponse({
    lastSyncDate, lastSync: lastSync || null,
    message: lastSync ? `Última sync: ${lastSync.total_registros} registros` : 'Nenhuma sync anterior encontrada, usando 7 dias como padrão'
  }, 200, ctx.corsHeaders, ctx.startTime);
}

export async function handleTriggerN8n(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return apiResponse({ error: 'Unauthorized' }, 401, ctx.corsHeaders, ctx.startTime);

  const n8nWebhookUrl = Deno.env.get('N8N_CONTAS_PAGAR_WEBHOOK');
  if (!n8nWebhookUrl) {
    return apiResponse({ error: 'N8N webhook não configurado', message: 'Configure o secret N8N_CONTAS_PAGAR_WEBHOOK no backend' }, 400, ctx.corsHeaders, ctx.startTime);
  }

  const { data: lastSync } = await ctx.supabase
    .from('sync_control').select('ultima_sync').eq('entidade', 'contas_pagar').eq('status', 'success').order('ultima_sync', { ascending: false }).limit(1).single();

  const defaultDate = new Date(); defaultDate.setDate(defaultDate.getDate() - 7);
  const lastSyncDate = lastSync?.ultima_sync ? new Date(lastSync.ultima_sync).toISOString().split('T')[0] : defaultDate.toISOString().split('T')[0];

  try {
    const response = await withRetry(
      async () => {
        const resp = await fetch(n8nWebhookUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trigger: 'manual', lastSyncDate, timestamp: new Date().toISOString() })
        });
        if (!resp.ok) throw new Error(`N8N retornou status ${resp.status}`);
        return resp;
      },
      { operationName: 'trigger-n8n', maxRetries: 2 }
    );

    logSuccess('trigger-n8n', { lastSyncDate, status: response.status });

    return apiResponse({ success: true, message: 'Sincronização disparada via N8N', lastSyncDate, n8n_status: response.status }, 200, ctx.corsHeaders, ctx.startTime);
  } catch (n8nError) {
    logError('trigger-n8n', n8nError);
    return apiResponse({
      success: false, error: n8nError instanceof Error ? n8nError.message : 'Erro ao disparar N8N',
      message: 'Verifique se o workflow N8N está ativo'
    }, 500, ctx.corsHeaders, ctx.startTime);
  }
}

export async function handleDebugPayload(ctx: HandlerContext): Promise<Response> {
  // Admin-only JWT
  const authHeader = ctx.req.headers.get('Authorization');
  if (!authHeader) return apiResponse({ error: 'Unauthorized - JWT admin required' }, 401, ctx.corsHeaders, ctx.startTime);

  const token = authHeader.replace('Bearer ', '');
  const { data: { user: debugUser }, error: debugAuthErr } = await ctx.supabase.auth.getUser(token);
  if (debugAuthErr || !debugUser) return apiResponse({ error: 'Unauthorized' }, 401, ctx.corsHeaders, ctx.startTime);

  const { data: debugRole } = await ctx.supabase.from('user_roles').select('role').eq('user_id', debugUser.id).eq('role', 'admin').maybeSingle();
  if (!debugRole) {
    logError('debug-payload', 'Forbidden - admin JWT required');
    return apiResponse({ error: 'Forbidden - admin only' }, 403, ctx.corsHeaders, ctx.startTime);
  }

  const body = await ctx.req.json();
  const contas = body.contas || body.data || body;

  if (!Array.isArray(contas)) return apiResponse({ error: 'Invalid payload - array expected' }, 400, ctx.corsHeaders, ctx.startTime);

  const targetErpIds = ['8-2-1-1-4006', '8-2-12-1-2630'];

  const analysis = {
    total_received: contas.length,
    sample_raw: contas.slice(0, 3).map((c: Record<string, unknown>) => ({
      raw: { 'ID Empresa': c['ID Empresa'], 'Tipo': c['Tipo'], 'Nota': c['Nota'], 'Seq': c['Seq'], 'Código': c['Código'], 'Valor_Trc': c['Valor_Trc'], 'Valor em Aberto': c['Valor em Aberto'], 'Valor Pago': c['Valor Pago'], 'Data Pgto': c['Data Pgto'], 'Cliente': c['Cliente'] },
      generated_erp_id: generateErpId(c),
      transformed: transformErpData(c)
    })),
    target_records: [] as Array<{ erp_id: string; found: boolean; raw?: Record<string, unknown>; transformed?: Record<string, unknown> }>,
    campos_disponiveis: contas.length > 0 ? Object.keys(contas[0]) : []
  };

  for (const targetId of targetErpIds) {
    const found = contas.find((c: Record<string, unknown>) => generateErpId(c) === targetId);
    if (found) {
      analysis.target_records.push({
        erp_id: targetId, found: true,
        raw: { 'Valor_Trc': found['Valor_Trc'], 'Valor em Aberto': found['Valor em Aberto'], 'Valor Pago': found['Valor Pago'], 'Data Pgto': found['Data Pgto'], 'Cliente': found['Cliente'] },
        transformed: transformErpData(found)
      });
    } else {
      analysis.target_records.push({ erp_id: targetId, found: false });
    }
  }

  const { data: dbRecords } = await ctx.supabase.from('contas_pagar').select('erp_id, valor_aberto, valor_pago, data_pagamento, data_hash, status').in('erp_id', targetErpIds);

  logSuccess('debug-payload', { total: contas.length, targets_found: analysis.target_records.filter(r => r.found).length });

  return apiResponse({
    success: true, analysis, database_records: dbRecords || [],
    message: 'Use esses dados para comparar o que o N8N envia vs o que está no banco'
  }, 200, ctx.corsHeaders, ctx.startTime);
}
