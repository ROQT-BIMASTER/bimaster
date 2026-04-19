// _shared/contas-pagar/payment-handlers.ts — Unified payment processing (Profissionalizado)
// v4.0.0 (PR-7): handleRegistrarPagamento e handleCancelarPagamento removidos — use handleLancarPagamento e handleEstornar.
import type { HandlerContext } from "./types.ts";
import { LancarPagamentoSchema, EstornarSchema, PagamentosParamsSchema } from "./types.ts";
import { enqueueWebhookEvent } from "../webhook-enqueue.ts";
import { logAuditEvent, logSuccess, parseDate, apiResponse, jsonRes, checkIdempotency, saveIdempotency } from "./utils.ts";

// =====================================================
// Atomic payment processor via RPC
// =====================================================
interface PaymentInput {
  tituloId: string;
  valor: number;
  desconto?: number;
  juros?: number;
  multa?: number;
  dataPagamento?: string;
  observacao?: string;
  codigoBaixaIntegracao?: string;
  conciliarDocumento?: boolean;
  origem: 'internal' | 'huggs';
  // PR-23 (v4.4.0): forma_pagamento + codigo_pix + created_by (paridade com telas do ERP)
  formaPagamento?: string;
  codigoPix?: string;
  createdBy?: string;
}

async function processPayment(ctx: HandlerContext, input: PaymentInput) {
  const dataPgto = parseDate(input.dataPagamento) || new Date().toISOString().split('T')[0];

  const { data: result, error: rpcErr } = await ctx.supabase.rpc('process_payment_atomic', {
    p_titulo_id: input.tituloId,
    p_valor: input.valor,
    p_desconto: input.desconto || 0,
    p_juros: input.juros || 0,
    p_multa: input.multa || 0,
    p_data_pagamento: dataPgto,
    p_observacao: input.observacao || (input.origem === 'huggs' ? 'Baixa via API (Huggs-style)' : 'Pagamento registrado via API'),
    p_origem: input.origem,
    p_codigo_baixa_integracao: input.codigoBaixaIntegracao || null,
    p_conciliar_documento: input.conciliarDocumento || false,
    p_forma_pagamento: input.formaPagamento || 'API',
    p_codigo_pix: input.codigoPix || null,
    p_created_by: input.createdBy || null,
  });

  if (rpcErr) throw rpcErr;

  // RPC returns error inside jsonb
  if (result.error) {
    const codeMap: Record<string, { status: number; huggs: string }> = {
      not_found: { status: 404, huggs: '5' },
      cancelled: { status: 400, huggs: '3' },
      already_paid: { status: 400, huggs: '3' },
      overpayment: { status: 400, huggs: '4' },
    };
    const mapped = codeMap[result.code] || { status: 400, huggs: '1' };
    return {
      error: true,
      status: mapped.status,
      body: input.origem === 'huggs'
        ? { codigo_status: mapped.huggs, descricao_status: result.message }
        : { error: result.code, message: result.message }
    };
  }

  // Audit log
  await logAuditEvent(ctx.supabase, input.origem === 'huggs' ? 'api_lancar_pagamento' : 'api_registrar_pagamento', {
    titulo_id: result.titulo_id, pagamento_id: result.pagamento_id, valor: result.valor_liquido, liquidado: result.liquidado
  }, ctx.req);

  // Webhook
  enqueueWebhookEvent('conta_pagar.pago', {
    id: result.titulo_id, valor: result.valor_liquido, liquidado: result.liquidado,
    codigo_lancamento_integracao: result.codigo_lancamento_integracao
  }, result.empresa_id).catch(() => {});

  return {
    error: false,
    pagamento: { id: result.pagamento_id },
    titulo: {
      id: result.titulo_id,
      codigo_lancamento_huggs: result.codigo_lancamento_huggs,
      codigo_lancamento_integracao: result.codigo_lancamento_integracao,
    },
    novoValorPago: result.novo_valor_pago,
    novoValorAberto: result.novo_valor_aberto,
    novoStatus: result.novo_status,
    liquidado: result.liquidado,
    valorLiquido: result.valor_liquido,
  };
}

// handleRegistrarPagamento removido em v4.0.0 (PR-7) — use handleLancarPagamento.

// =====================================================
// POST /lancar-pagamento (Huggs-style, with idempotency)
// =====================================================
export async function handleLancarPagamento(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return apiResponse({ error: 'Unauthorized' }, 401, ctx.corsHeaders, ctx.startTime);

  const idempotencyKey = ctx.req.headers.get('X-Idempotency-Key');
  const idem = await checkIdempotency(ctx.supabase, idempotencyKey, 'lancar-pagamento', ctx.corsHeaders);
  if (idem.found && idem.response) return idem.response;

  const body = await ctx.req.json();
  const parsed = LancarPagamentoSchema.safeParse(body);
  if (!parsed.success) {
    return apiResponse({ codigo_status: '1', descricao_status: 'Payload inválido: ' + parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }, 400, ctx.corsHeaders, ctx.startTime);
  }

  const { codigo_lancamento, codigo_lancamento_integracao, codigo_baixa_integracao, valor, desconto, juros, multa, data: dataBaixa, observacao: obs, conciliar_documento: conciliar, forma_pagamento, codigo_pix } = parsed.data;

  if (!codigo_lancamento && !codigo_lancamento_integracao) {
    return apiResponse({ codigo_status: '1', descricao_status: 'Informe codigo_lancamento ou codigo_lancamento_integracao' }, 400, ctx.corsHeaders, ctx.startTime);
  }
  if (!valor) {
    return apiResponse({ codigo_status: '1', descricao_status: 'Campo valor é obrigatório' }, 400, ctx.corsHeaders, ctx.startTime);
  }

  // Lookup título
  let tituloQuery = ctx.supabase.from('contas_pagar').select('id');
  if (codigo_lancamento_integracao) tituloQuery = tituloQuery.eq('codigo_lancamento_integracao', codigo_lancamento_integracao);
  else tituloQuery = tituloQuery.eq('codigo_lancamento_huggs', codigo_lancamento);

  const { data: tituloLookup, error: lookupErr } = await tituloQuery.maybeSingle();
  if (lookupErr) throw lookupErr;
  if (!tituloLookup) {
    return apiResponse({ codigo_status: '5', descricao_status: 'Título não encontrado' }, 404, ctx.corsHeaders, ctx.startTime);
  }

  const result = await processPayment(ctx, {
    tituloId: tituloLookup.id, valor, desconto, juros, multa,
    dataPagamento: dataBaixa, observacao: obs,
    codigoBaixaIntegracao: codigo_baixa_integracao,
    conciliarDocumento: conciliar === 'S',
    origem: 'huggs',
    formaPagamento: forma_pagamento,
    codigoPix: codigo_pix,
  });

  if (result.error) return apiResponse(result.body, result.status, ctx.corsHeaders, ctx.startTime);

  const responseBody = {
    codigo_lancamento: result.titulo.codigo_lancamento_huggs,
    codigo_lancamento_integracao: result.titulo.codigo_lancamento_integracao,
    codigo_baixa: result.pagamento.id,
    codigo_baixa_integracao: codigo_baixa_integracao || null,
    liquidado: result.liquidado ? 'S' : 'N',
    valor_baixado: result.valorLiquido,
    codigo_status: '0', descricao_status: 'Pagamento registrado com sucesso!',
  };

  await saveIdempotency(ctx.supabase, idempotencyKey, 'lancar-pagamento', responseBody, 200);

  return apiResponse(responseBody, 200, ctx.corsHeaders, ctx.startTime);
}

// handleCancelarPagamento removido em v4.0.0 (PR-7) — use handleEstornar.

// =====================================================
// POST /estornar (with Zod validation)
// =====================================================
export async function handleEstornar(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return apiResponse({ error: 'Unauthorized' }, 401, ctx.corsHeaders, ctx.startTime);

  const body = await ctx.req.json();
  const parsed = EstornarSchema.safeParse(body);
  if (!parsed.success) {
    return apiResponse({
      error: 'VALIDATION_ERROR',
      message: 'Payload inválido: ' + parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    }, 400, ctx.corsHeaders, ctx.startTime);
  }

  const { id, motivo, valor_estorno } = parsed.data;

  const { data: titulo, error: tituloErr } = await ctx.supabase
    .from('contas_pagar').select('id, status, valor_original, valor_pago, valor_aberto, observacao').eq('id', id).single();

  if (tituloErr || !titulo) return apiResponse({ error: 'nao_encontrado', message: `Título ${id} não encontrado` }, 404, ctx.corsHeaders, ctx.startTime);

  if (titulo.status !== 'pago' && titulo.status !== 'parcial') {
    return apiResponse({ error: 'status_invalido', message: `Estorno só é permitido para títulos com status "pago" ou "parcial". Status atual: ${titulo.status}` }, 400, ctx.corsHeaders, ctx.startTime);
  }

  const valorEstorno = valor_estorno || titulo.valor_pago || 0;
  const novoValorPago = Math.max(0, (titulo.valor_pago || 0) - valorEstorno);
  const novoValorAberto = (titulo.valor_original || 0) - novoValorPago;
  const novoStatus = novoValorPago <= 0 ? 'pendente' : 'parcial';

  const { data: updated, error: updateErr } = await ctx.supabase.from('contas_pagar').update({
    valor_pago: novoValorPago, valor_aberto: novoValorAberto, status: novoStatus,
    data_pagamento: null, data_baixa: null,
    observacao: titulo.observacao ? `${titulo.observacao} | Estorno: ${motivo}` : `Estorno: ${motivo}`,
    updated_at: new Date().toISOString()
  }).eq('id', id).select().single();

  if (updateErr) throw updateErr;

  logSuccess('estornar', { id, valor_estorno: valorEstorno, novo_status: novoStatus });

  return apiResponse({
    success: true,
    estorno: { valor_estornado: valorEstorno, motivo },
    titulo_atualizado: { id, status: novoStatus, valor_pago: novoValorPago, valor_aberto: novoValorAberto },
  }, 200, ctx.corsHeaders, ctx.startTime);
}

// =====================================================
// GET /pagamentos (with Zod query param validation)
// =====================================================
export async function handleGetPagamentos(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return apiResponse({ error: 'Unauthorized' }, 401, ctx.corsHeaders, ctx.startTime);

  const params = PagamentosParamsSchema.safeParse({
    conta_pagar_id: ctx.url.searchParams.get('conta_pagar_id') || undefined,
    limit: ctx.url.searchParams.get('limit') || undefined,
    offset: ctx.url.searchParams.get('offset') || undefined,
    cursor: ctx.url.searchParams.get('cursor') || undefined,
  });

  if (!params.success) {
    return apiResponse({
      error: 'VALIDATION_ERROR',
      message: params.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    }, 400, ctx.corsHeaders, ctx.startTime);
  }

  const { conta_pagar_id, limit, offset, cursor } = params.data;

  // PR-23 (v4.4.0): JOIN com contas_bancarias (via conta_bancaria_id) e profiles (via created_by)
  // para retornar usuario_nome e nome da conta corrente.
  const enrichedPagSelect = `*,
    conta_corrente_rel:contas_bancarias!conta_bancaria_id(id, banco, agencia, conta),
    usuario_rel:profiles!created_by(id, full_name)`;
  let query = ctx.supabase.from('pagamentos').select(enrichedPagSelect, { count: 'exact' });
  if (conta_pagar_id) query = query.eq('conta_pagar_id', conta_pagar_id);

  // Cursor-based pagination
  if (cursor) {
    query = query.gt('id', cursor).order('id', { ascending: true }).limit(limit);
  } else {
    query = query.order('data_pagamento', { ascending: false }).range(offset, offset + limit - 1);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const nextCursor = cursor && data && data.length === limit ? data[data.length - 1].id : undefined;

  // PR-23: shape transform — agrupa conta_corrente + usuario.
  const enrichedData = (data || []).map((row: any) => {
    const { conta_corrente_rel, usuario_rel, ...rest } = row;
    return {
      ...rest,
      conta_corrente: conta_corrente_rel ? {
        id: conta_corrente_rel.id,
        nome: [conta_corrente_rel.banco, conta_corrente_rel.agencia, conta_corrente_rel.conta].filter(Boolean).join(' / ') || null,
        banco: conta_corrente_rel.banco || null,
      } : null,
      usuario_id: row.created_by || null,
      usuario_nome: usuario_rel?.full_name || null,
    };
  });

  return apiResponse({
    data: enrichedData,
    pagination: { total: count, limit, offset: cursor ? undefined : offset, cursor: nextCursor, has_more: cursor ? data?.length === limit : (count || 0) > offset + limit },
  }, 200, ctx.corsHeaders, ctx.startTime);
}
