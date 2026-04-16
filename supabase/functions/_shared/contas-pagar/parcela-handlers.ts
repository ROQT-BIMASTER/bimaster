// _shared/contas-pagar/parcela-handlers.ts — Parcelas endpoints (Profissionalizado)
import type { HandlerContext } from "./types.ts";
import { logSuccess, apiResponse, jsonRes, UUID_REGEX } from "./utils.ts";

export async function handleGetParcelas(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return apiResponse({ error: 'Unauthorized' }, 401, ctx.corsHeaders, ctx.startTime);

  const contaPagarId = ctx.url.searchParams.get('conta_pagar_id');
  const limit = Math.min(parseInt(ctx.url.searchParams.get('limit') || '100'), 500);
  const offset = parseInt(ctx.url.searchParams.get('offset') || '0');

  if (contaPagarId && !UUID_REGEX.test(contaPagarId)) {
    return apiResponse({ error: 'VALIDATION_ERROR', message: 'conta_pagar_id deve ser um UUID válido' }, 400, ctx.corsHeaders, ctx.startTime);
  }

  let query = ctx.supabase.from('parcelas').select('*', { count: 'exact' });
  if (contaPagarId) query = query.eq('conta_pagar_id', contaPagarId);
  query = query.order('numero_parcela', { ascending: true }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return apiResponse({ data, pagination: { total: count, limit, offset } }, 200, ctx.corsHeaders, ctx.startTime);
}

export async function handleSyncParcelas(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateApiKey()) return apiResponse({ error: 'Unauthorized' }, 401, ctx.corsHeaders, ctx.startTime);

  const body = await ctx.req.json();
  const parcelas = body.parcelas || body.data || body;

  if (!Array.isArray(parcelas) || parcelas.length === 0) {
    return apiResponse({ error: 'payload_invalido', message: 'Array de parcelas esperado' }, 400, ctx.corsHeaders, ctx.startTime);
  }

  if (parcelas.length > 5000) {
    return apiResponse({ error: 'payload_excedido', message: 'Máximo 5000 parcelas por request' }, 413, ctx.corsHeaders, ctx.startTime);
  }

  const { data, error } = await ctx.supabase.from('parcelas').upsert(parcelas, { onConflict: 'id' }).select('id');
  if (error) throw error;

  logSuccess('parcelas/sync', { total: parcelas.length, processados: data?.length });

  return apiResponse({ success: true, processados: data?.length || 0 }, 200, ctx.corsHeaders, ctx.startTime);
}
