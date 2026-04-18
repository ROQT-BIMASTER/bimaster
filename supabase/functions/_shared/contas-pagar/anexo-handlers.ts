// _shared/contas-pagar/anexo-handlers.ts — Anexos de Contas a Pagar (PR-14 / Onda 3)
// Tabela: cp_anexos (criada em PR-14). Anteriormente apontava para payment_attachments
// (inexistente) → toda chamada retornava 500. Mantido contrato externo (campos PT-BR).
import type { HandlerContext } from "./types.ts";
import { jsonRes, UUID_REGEX } from "./utils.ts";

export async function handlePostAnexos(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return jsonRes({ error: 'Unauthorized' }, 401, ctx.corsHeaders);

  const body = await ctx.req.json();
  const { conta_pagar_id, nome_arquivo, tipo, url: fileUrl, observacao } = body;

  if (!conta_pagar_id || !nome_arquivo) {
    return jsonRes({ error: 'campo_obrigatorio', message: 'Campos "conta_pagar_id" e "nome_arquivo" são obrigatórios' }, 400, ctx.corsHeaders);
  }

  if (!UUID_REGEX.test(conta_pagar_id)) {
    return jsonRes({ error: 'VALIDATION_ERROR', message: 'conta_pagar_id deve ser um UUID válido' }, 400, ctx.corsHeaders);
  }

  const { data: titulo } = await ctx.supabase.from('contas_pagar').select('id').eq('id', conta_pagar_id).maybeSingle();
  if (!titulo) return jsonRes({ error: 'nao_encontrado', message: `Título ${conta_pagar_id} não encontrado` }, 404, ctx.corsHeaders);

  const { data: anexo, error } = await ctx.supabase.from('cp_anexos').insert({
    conta_pagar_id,
    nome_arquivo,
    tipo: tipo || null,
    url: fileUrl || null,
    observacao: observacao || null,
    source: 'api',
  }).select().single();

  if (error) throw error;

  return jsonRes({ success: true, anexo, meta: { duration_ms: Date.now() - ctx.startTime, processed_at: new Date().toISOString() } }, 201, ctx.corsHeaders);
}

export async function handleGetAnexos(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return jsonRes({ error: 'Unauthorized' }, 401, ctx.corsHeaders);

  const contaPagarId = ctx.url.searchParams.get('conta_pagar_id');
  if (!contaPagarId) return jsonRes({ error: 'campo_obrigatorio', message: 'Query param "conta_pagar_id" é obrigatório' }, 400, ctx.corsHeaders);

  if (!UUID_REGEX.test(contaPagarId)) {
    return jsonRes({ error: 'VALIDATION_ERROR', message: 'conta_pagar_id deve ser um UUID válido', meta: { duration_ms: Date.now() - ctx.startTime, processed_at: new Date().toISOString() } }, 400, ctx.corsHeaders);
  }

  // Paridade com /parcelas: título inexistente devolve array vazio (não 404).
  const { data, error } = await ctx.supabase.from('cp_anexos').select('*').eq('conta_pagar_id', contaPagarId).order('created_at', { ascending: false });
  if (error) throw error;

  return jsonRes({ data: data || [], meta: { duration_ms: Date.now() - ctx.startTime, processed_at: new Date().toISOString() } }, 200, ctx.corsHeaders);
}
