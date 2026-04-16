// _shared/contas-pagar/anexo-handlers.ts — Attachment endpoints
import type { HandlerContext } from "./types.ts";
import { jsonRes, UUID_REGEX } from "./utils.ts";

export async function handlePostAnexos(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return jsonRes({ error: 'Unauthorized' }, 401, ctx.corsHeaders);

  const body = await ctx.req.json();
  const { conta_pagar_id, nome_arquivo, tipo, url: fileUrl, observacao } = body;

  if (!conta_pagar_id || !nome_arquivo) {
    return jsonRes({ error: 'campo_obrigatorio', message: 'Campos "conta_pagar_id" e "nome_arquivo" são obrigatórios' }, 400, ctx.corsHeaders);
  }

  const { data: titulo } = await ctx.supabase.from('contas_pagar').select('id').eq('id', conta_pagar_id).single();
  if (!titulo) return jsonRes({ error: 'nao_encontrado', message: `Título ${conta_pagar_id} não encontrado` }, 404, ctx.corsHeaders);

  const { data: anexo, error } = await ctx.supabase.from('payment_attachments').insert({
    payment_id: conta_pagar_id, file_name: nome_arquivo, file_type: tipo || 'application/pdf',
    file_url: fileUrl || null, notes: observacao || null, source: 'api'
  }).select().single();

  if (error) throw error;

  return jsonRes({ success: true, anexo, meta: { duration_ms: Date.now() - ctx.startTime, processed_at: new Date().toISOString() } }, 200, ctx.corsHeaders);
}

export async function handleGetAnexos(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return jsonRes({ error: 'Unauthorized' }, 401, ctx.corsHeaders);

  const contaPagarId = ctx.url.searchParams.get('conta_pagar_id');
  if (!contaPagarId) return jsonRes({ error: 'campo_obrigatorio', message: 'Query param "conta_pagar_id" é obrigatório' }, 400, ctx.corsHeaders);

  if (!UUID_REGEX.test(contaPagarId)) {
    return jsonRes({ error: 'VALIDATION_ERROR', message: 'conta_pagar_id deve ser um UUID válido', meta: { duration_ms: Date.now() - ctx.startTime, processed_at: new Date().toISOString() } }, 400, ctx.corsHeaders);
  }

  const { data, error } = await ctx.supabase.from('payment_attachments').select('*').eq('payment_id', contaPagarId).order('created_at', { ascending: false });
  if (error) throw error;

  return jsonRes({ data, meta: { duration_ms: Date.now() - ctx.startTime, processed_at: new Date().toISOString() } }, 200, ctx.corsHeaders);
}
