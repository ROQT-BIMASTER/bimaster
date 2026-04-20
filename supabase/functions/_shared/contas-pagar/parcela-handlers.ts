// _shared/contas-pagar/parcela-handlers.ts — Parcelas endpoints (PR-14 / Onda 3)
// PR-24 (Production Hardening): GET /parcelas agora retorna meta_relacionados do título pai
//   (empresa/fornecedor/categoria/departamento) — paridade DX com /consultar e /query.
import type { HandlerContext } from "./types.ts";
import { logSuccess, apiResponse, UUID_REGEX } from "./utils.ts";

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

  // PR-24: enriquecer com meta_relacionados derivado do título pai (1 query agregada).
  let meta_relacionados: Record<string, unknown> | null = null;
  if (contaPagarId && data && data.length > 0) {
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

  return apiResponse({
    data: data || [],
    meta_relacionados,
    pagination: { total: count, limit, offset },
  }, 200, ctx.corsHeaders, ctx.startTime);
}

export async function handleSyncParcelas(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateApiKey()) return apiResponse({ error: 'Unauthorized' }, 401, ctx.corsHeaders, ctx.startTime);

  const body = await ctx.req.json();
  const parcelasInput = body.parcelas || body.data || body;

  if (!Array.isArray(parcelasInput) || parcelasInput.length === 0) {
    return apiResponse({ error: 'payload_invalido', message: 'Array de parcelas esperado' }, 400, ctx.corsHeaders, ctx.startTime);
  }

  if (parcelasInput.length > 5000) {
    return apiResponse({ error: 'payload_excedido', message: 'Máximo 5000 parcelas por request' }, 413, ctx.corsHeaders, ctx.startTime);
  }

  // PR-14: validação granular por item (paridade com upsert-lote). Aceita alias `numero`.
  const validas: Array<Record<string, unknown>> = [];
  const errosDetalhe: Array<{ index: number; item?: unknown; erro: string }> = [];

  // Coleta IDs únicos para pré-validar FK em uma query só.
  const idsParaValidar = new Set<string>();
  parcelasInput.forEach((p: Record<string, unknown>) => {
    const cpId = p.conta_pagar_id;
    if (typeof cpId === 'string' && UUID_REGEX.test(cpId)) idsParaValidar.add(cpId);
  });

  let titulosExistentes = new Set<string>();
  if (idsParaValidar.size > 0) {
    const { data: titulos } = await ctx.supabase
      .from('contas_pagar')
      .select('id')
      .in('id', Array.from(idsParaValidar));
    titulosExistentes = new Set((titulos || []).map((t: { id: string }) => t.id));
  }

  parcelasInput.forEach((raw: Record<string, unknown>, idx: number) => {
    const cpId = raw.conta_pagar_id as string | undefined;
    const numero = (raw.numero_parcela ?? raw.numero) as number | string | undefined;
    const valor = raw.valor;
    const dataVenc = raw.data_vencimento;

    if (!cpId || typeof cpId !== 'string' || !UUID_REGEX.test(cpId)) {
      errosDetalhe.push({ index: idx, item: raw, erro: 'conta_pagar_id ausente ou inválido (UUID esperado)' });
      return;
    }
    if (!titulosExistentes.has(cpId)) {
      errosDetalhe.push({ index: idx, item: raw, erro: `conta_pagar_id ${cpId} não existe em contas_pagar` });
      return;
    }
    if (numero === undefined || numero === null || isNaN(Number(numero))) {
      errosDetalhe.push({ index: idx, item: raw, erro: 'numero_parcela (ou numero) é obrigatório e numérico' });
      return;
    }
    if (valor === undefined || valor === null) {
      errosDetalhe.push({ index: idx, item: raw, erro: 'valor é obrigatório' });
      return;
    }
    if (!dataVenc) {
      errosDetalhe.push({ index: idx, item: raw, erro: 'data_vencimento é obrigatória' });
      return;
    }

    validas.push({
      conta_pagar_id: cpId,
      numero_parcela: Number(numero),
      valor: Number(valor),
      data_vencimento: dataVenc,
      ...(raw.status ? { status: raw.status } : {}),
    });
  });

  let processados = 0;
  if (validas.length > 0) {
    const { data, error } = await ctx.supabase
      .from('parcelas')
      .upsert(validas, { onConflict: 'conta_pagar_id,numero_parcela' })
      .select('id');
    if (error) {
      return apiResponse({
        error: 'db_error',
        message: error.message,
        code: (error as { code?: string }).code,
        details: (error as { details?: string }).details,
      }, 500, ctx.corsHeaders, ctx.startTime);
    }
    processados = data?.length || 0;
  }

  logSuccess('parcelas/sync', { total: parcelasInput.length, processados, erros: errosDetalhe.length });

  return apiResponse({
    success: errosDetalhe.length === 0,
    processados,
    erros: errosDetalhe.length,
    errosDetalhe,
  }, 200, ctx.corsHeaders, ctx.startTime);
}
