// _shared/contas-pagar/anexo-handlers.ts — Anexos de Contas a Pagar (PR-14 / Onda 3)
// PR-24 (Production Hardening): GET /anexos agora retorna meta_relacionados do título pai
//   (empresa/fornecedor/categoria/departamento) — paridade DX com /consultar e /query.
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

  const { data, error } = await ctx.supabase.from('cp_anexos').select('*').eq('conta_pagar_id', contaPagarId).order('created_at', { ascending: false });
  if (error) throw error;

  // PR-24: enriquecer com meta_relacionados do título pai.
  let meta_relacionados: Record<string, unknown> | null = null;
  if (data && data.length >= 0) {
    const { data: titulo } = await ctx.supabase
      .from('contas_pagar')
      .select('empresa_id, empresa_nome, fornecedor_codigo, fornecedor_nome, categoria_codigo, categoria_nome, departamento_id, departamento_nome')
      .eq('id', contaPagarId)
      .maybeSingle();
    if (titulo) {
      meta_relacionados = {
        empresa: titulo.empresa_id ? { id: titulo.empresa_id, nome: titulo.empresa_nome || null } : null,
        fornecedor: titulo.fornecedor_codigo ? { codigo: titulo.fornecedor_codigo, nome: titulo.fornecedor_nome || null } : null,
        categoria: titulo.categoria_codigo ? { codigo: titulo.categoria_codigo, nome: titulo.categoria_nome || null } : null,
        departamento: titulo.departamento_id ? { id: titulo.departamento_id, nome: titulo.departamento_nome || null } : null,
      };
    }
  }

  return jsonRes({
    data: data || [],
    meta_relacionados,
    meta: { duration_ms: Date.now() - ctx.startTime, processed_at: new Date().toISOString() },
  }, 200, ctx.corsHeaders);
}
