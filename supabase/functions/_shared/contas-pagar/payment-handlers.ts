// _shared/contas-pagar/payment-handlers.ts — Unified payment processing
import type { HandlerContext } from "./types.ts";
import { LancarPagamentoSchema, CancelarPagamentoSchema } from "./types.ts";
import { enqueueWebhookEvent } from "../webhook-enqueue.ts";
import { logAuditEvent, logSuccess, parseDate, jsonRes, UUID_REGEX } from "./utils.ts";

// =====================================================
// Unified payment processor
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
}

async function processPayment(ctx: HandlerContext, input: PaymentInput) {
  // 1. Fetch título
  const { data: titulo, error: tErr } = await ctx.supabase
    .from('contas_pagar')
    .select('id, status, valor_original, valor_pago, valor_aberto, codigo_lancamento_huggs, codigo_lancamento_integracao, empresa_id')
    .eq('id', input.tituloId)
    .single();

  if (tErr || !titulo) {
    return { error: true, status: 404, body: input.origem === 'huggs'
      ? { codigo_status: '5', descricao_status: 'Título não encontrado' }
      : { error: 'nao_encontrado', message: `Título ${input.tituloId} não encontrado` }
    };
  }

  // 2. Validate status
  if (titulo.status === 'cancelado') {
    return { error: true, status: 400, body: input.origem === 'huggs'
      ? { codigo_status: '3', descricao_status: 'Título cancelado, baixa não permitida' }
      : { error: 'titulo_cancelado', message: 'Não é possível registrar pagamento em título cancelado' }
    };
  }
  if (titulo.status === 'pago') {
    return { error: true, status: 400, body: input.origem === 'huggs'
      ? { codigo_status: '3', descricao_status: 'Título já liquidado. Use /estornar para reverter.' }
      : { error: 'titulo_pago', message: 'Título já está pago' }
    };
  }

  // 3. Calculate net value
  const valorLiquido = (input.valor || 0) - (input.desconto || 0) + (input.juros || 0) + (input.multa || 0);

  // 4. Overpayment check (105%)
  const limiteMaximo = (titulo.valor_original || 0) * 1.05;
  const totalAposPagamento = (titulo.valor_pago || 0) + valorLiquido;
  if (totalAposPagamento > limiteMaximo) {
    const msg = `Pagamento excede o valor do título. Valor original: ${titulo.valor_original}, já pago: ${titulo.valor_pago}, tentativa: ${valorLiquido}, limite (105%): ${limiteMaximo.toFixed(2)}`;
    return { error: true, status: 400, body: input.origem === 'huggs'
      ? { codigo_status: '4', descricao_status: msg }
      : { error: 'overpayment', message: msg }
    };
  }

  const dataPgto = parseDate(input.dataPagamento) || new Date().toISOString().split('T')[0];

  // 5. Insert payment
  const { data: pagamento, error: pErr } = await ctx.supabase.from('pagamentos').insert({
    conta_pagar_id: titulo.id,
    valor: valorLiquido,
    data_pagamento: dataPgto,
    metodo_pagamento: 'API',
    observacao: input.observacao || (input.origem === 'huggs' ? 'Baixa via API (Huggs-style)' : 'Pagamento registrado via API'),
    baixa_origem: 'api'
  }).select('id').single();
  if (pErr) throw pErr;

  // 6. Update título
  const novoValorPago = (titulo.valor_pago || 0) + valorLiquido;
  const novoValorAberto = Math.max(0, (titulo.valor_original || 0) - novoValorPago);
  const liquidado = novoValorAberto <= 0;
  const novoStatus = liquidado ? 'pago' : 'parcial';

  const updateData: Record<string, unknown> = {
    valor_pago: novoValorPago, valor_aberto: novoValorAberto, status: novoStatus,
    data_pagamento: liquidado ? dataPgto : null, data_baixa: liquidado ? new Date().toISOString() : null,
    baixa_origem: 'api', updated_at: new Date().toISOString()
  };

  if (input.origem === 'huggs') {
    updateData.valor_juros = input.juros || 0;
    updateData.valor_desconto = input.desconto || 0;
    updateData.codigo_baixa_integracao = input.codigoBaixaIntegracao || null;
    updateData.conciliar_documento = input.conciliarDocumento || false;
  }

  await ctx.supabase.from('contas_pagar').update(updateData).eq('id', titulo.id);

  // 7. Audit log
  await logAuditEvent(ctx.supabase, input.origem === 'huggs' ? 'api_lancar_pagamento' : 'api_registrar_pagamento', {
    titulo_id: titulo.id, pagamento_id: pagamento.id, valor: valorLiquido, liquidado
  }, ctx.req);

  // 8. Webhook
  enqueueWebhookEvent('conta_pagar.pago', {
    id: titulo.id, valor: valorLiquido, liquidado,
    codigo_lancamento_integracao: titulo.codigo_lancamento_integracao
  }, titulo.empresa_id).catch(() => {});

  return { error: false, pagamento, titulo, novoValorPago, novoValorAberto, novoStatus, liquidado, valorLiquido };
}

// =====================================================
// POST /registrar-pagamento
// =====================================================
export async function handleRegistrarPagamento(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return jsonRes({ error: 'Unauthorized' }, 401, ctx.corsHeaders);

  const body = await ctx.req.json();
  const { conta_pagar_id, valor_pago, data_pagamento, metodo_pagamento, observacao } = body;

  if (!conta_pagar_id || !valor_pago) {
    return jsonRes({ error: 'campo_obrigatorio', message: 'Campos "conta_pagar_id" e "valor_pago" são obrigatórios' }, 400, ctx.corsHeaders);
  }

  const result = await processPayment(ctx, {
    tituloId: conta_pagar_id, valor: valor_pago, dataPagamento: data_pagamento,
    observacao: observacao || 'Pagamento registrado via API', origem: 'internal'
  });

  if (result.error) return jsonRes(result.body, result.status, ctx.corsHeaders);

  const duration = Date.now() - ctx.startTime;
  logSuccess('registrar-pagamento', { conta_pagar_id, valor_pago, status: result.novoStatus, duration_ms: duration });

  return jsonRes({
    success: true,
    pagamento: result.pagamento,
    titulo_atualizado: { id: conta_pagar_id, status: result.novoStatus, valor_pago: result.novoValorPago, valor_aberto: result.novoValorAberto },
    meta: { duration_ms: duration, processed_at: new Date().toISOString() }
  }, 200, ctx.corsHeaders);
}

// =====================================================
// POST /lancar-pagamento (Huggs-style)
// =====================================================
export async function handleLancarPagamento(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return jsonRes({ error: 'Unauthorized' }, 401, ctx.corsHeaders);

  const body = await ctx.req.json();
  const parsed = LancarPagamentoSchema.safeParse(body);
  if (!parsed.success) {
    return jsonRes({ codigo_status: '1', descricao_status: 'Payload inválido: ' + parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }, 400, ctx.corsHeaders);
  }

  const { codigo_lancamento, codigo_lancamento_integracao, codigo_baixa_integracao, valor, desconto, juros, multa, data: dataBaixa, observacao: obs, conciliar_documento: conciliar } = parsed.data;

  if (!codigo_lancamento && !codigo_lancamento_integracao) {
    return jsonRes({ codigo_status: '1', descricao_status: 'Informe codigo_lancamento ou codigo_lancamento_integracao' }, 400, ctx.corsHeaders);
  }
  if (!valor) {
    return jsonRes({ codigo_status: '1', descricao_status: 'Campo valor é obrigatório' }, 400, ctx.corsHeaders);
  }

  // Lookup título
  let tituloQuery = ctx.supabase.from('contas_pagar').select('id');
  if (codigo_lancamento_integracao) tituloQuery = tituloQuery.eq('codigo_lancamento_integracao', codigo_lancamento_integracao);
  else tituloQuery = tituloQuery.eq('codigo_lancamento_huggs', codigo_lancamento);

  const { data: tituloLookup, error: lookupErr } = await tituloQuery.maybeSingle();
  if (lookupErr) throw lookupErr;
  if (!tituloLookup) {
    return jsonRes({ codigo_status: '5', descricao_status: 'Título não encontrado' }, 404, ctx.corsHeaders);
  }

  const result = await processPayment(ctx, {
    tituloId: tituloLookup.id, valor, desconto, juros, multa,
    dataPagamento: dataBaixa, observacao: obs,
    codigoBaixaIntegracao: codigo_baixa_integracao,
    conciliarDocumento: conciliar === 'S',
    origem: 'huggs'
  });

  if (result.error) return jsonRes(result.body, result.status, ctx.corsHeaders);

  return jsonRes({
    codigo_lancamento: result.titulo.codigo_lancamento_huggs,
    codigo_lancamento_integracao: result.titulo.codigo_lancamento_integracao,
    codigo_baixa: result.pagamento.id,
    codigo_baixa_integracao: codigo_baixa_integracao || null,
    liquidado: result.liquidado ? 'S' : 'N',
    valor_baixado: result.valorLiquido,
    codigo_status: '0', descricao_status: 'Pagamento registrado com sucesso!',
    meta: { duration_ms: Date.now() - ctx.startTime }
  }, 200, ctx.corsHeaders);
}

// =====================================================
// POST /cancelar-pagamento (Huggs-style)
// =====================================================
export async function handleCancelarPagamento(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return jsonRes({ error: 'Unauthorized' }, 401, ctx.corsHeaders);

  const body = await ctx.req.json();
  const parsed = CancelarPagamentoSchema.safeParse(body);
  if (!parsed.success) {
    return jsonRes({ codigo_status: '1', descricao_status: 'Payload inválido: ' + parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }, 400, ctx.corsHeaders);
  }
  const { codigo_baixa, codigo_baixa_integracao } = parsed.data;

  if (!codigo_baixa && !codigo_baixa_integracao) {
    return jsonRes({ codigo_status: '1', descricao_status: 'Informe codigo_baixa ou codigo_baixa_integracao' }, 400, ctx.corsHeaders);
  }

  let pQuery = ctx.supabase.from('pagamentos').select('id, conta_pagar_id, valor');
  if (codigo_baixa) pQuery = pQuery.eq('id', codigo_baixa);

  const { data: pagamento, error: pErr } = await pQuery.maybeSingle();
  if (pErr) throw pErr;
  if (!pagamento) return jsonRes({ codigo_status: '5', descricao_status: 'Pagamento não encontrado' }, 404, ctx.corsHeaders);

  await ctx.supabase.from('pagamentos').delete().eq('id', pagamento.id);

  const { data: titulo } = await ctx.supabase.from('contas_pagar').select('id, valor_original, valor_pago').eq('id', pagamento.conta_pagar_id).single();
  if (titulo) {
    const novoValorPago = Math.max(0, (titulo.valor_pago || 0) - (pagamento.valor || 0));
    const novoValorAberto = (titulo.valor_original || 0) - novoValorPago;
    const novoStatus = novoValorPago <= 0 ? 'pendente' : 'parcial';

    await ctx.supabase.from('contas_pagar').update({
      valor_pago: novoValorPago, valor_aberto: novoValorAberto, status: novoStatus,
      data_pagamento: null, data_baixa: null, updated_at: new Date().toISOString()
    }).eq('id', titulo.id);
  }

  await logAuditEvent(ctx.supabase, 'api_cancelar_pagamento', { pagamento_id: pagamento.id, titulo_id: pagamento.conta_pagar_id }, ctx.req);

  return jsonRes({
    codigo_baixa: pagamento.id, codigo_baixa_integracao: codigo_baixa_integracao || null,
    codigo_status: '0', descricao_status: 'Pagamento cancelado com sucesso!',
    meta: { duration_ms: Date.now() - ctx.startTime }
  }, 200, ctx.corsHeaders);
}

// =====================================================
// POST /estornar
// =====================================================
export async function handleEstornar(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return jsonRes({ error: 'Unauthorized' }, 401, ctx.corsHeaders);

  const body = await ctx.req.json();
  const { id, motivo, valor_estorno } = body;

  if (!id || !motivo) {
    return jsonRes({ error: 'campo_obrigatorio', message: 'Campos "id" (conta_pagar_id) e "motivo" são obrigatórios' }, 400, ctx.corsHeaders);
  }

  const { data: titulo, error: tituloErr } = await ctx.supabase
    .from('contas_pagar').select('id, status, valor_original, valor_pago, valor_aberto, observacao').eq('id', id).single();

  if (tituloErr || !titulo) return jsonRes({ error: 'nao_encontrado', message: `Título ${id} não encontrado` }, 404, ctx.corsHeaders);

  if (titulo.status !== 'pago' && titulo.status !== 'parcial') {
    return jsonRes({ error: 'status_invalido', message: `Estorno só é permitido para títulos com status "pago" ou "parcial". Status atual: ${titulo.status}` }, 400, ctx.corsHeaders);
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

  const duration = Date.now() - ctx.startTime;
  logSuccess('estornar', { id, valor_estorno: valorEstorno, novo_status: novoStatus, duration_ms: duration });

  return jsonRes({
    success: true,
    estorno: { valor_estornado: valorEstorno, motivo },
    titulo_atualizado: { id, status: novoStatus, valor_pago: novoValorPago, valor_aberto: novoValorAberto },
    meta: { duration_ms: duration, processed_at: new Date().toISOString() }
  }, 200, ctx.corsHeaders);
}

// =====================================================
// GET /pagamentos
// =====================================================
export async function handleGetPagamentos(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return jsonRes({ error: 'Unauthorized' }, 401, ctx.corsHeaders);

  const contaPagarId = ctx.url.searchParams.get('conta_pagar_id');
  const limit = Math.min(parseInt(ctx.url.searchParams.get('limit') || '100'), 500);
  const offset = parseInt(ctx.url.searchParams.get('offset') || '0');

  if (contaPagarId && !UUID_REGEX.test(contaPagarId)) {
    return jsonRes({ error: 'VALIDATION_ERROR', message: 'conta_pagar_id deve ser um UUID válido', meta: { duration_ms: Date.now() - ctx.startTime, processed_at: new Date().toISOString() } }, 400, ctx.corsHeaders);
  }

  let query = ctx.supabase.from('pagamentos').select('*', { count: 'exact' });
  if (contaPagarId) query = query.eq('conta_pagar_id', contaPagarId);
  query = query.order('data_pagamento', { ascending: false }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return jsonRes({ data, pagination: { total: count, limit, offset }, meta: { duration_ms: Date.now() - ctx.startTime, processed_at: new Date().toISOString() } }, 200, ctx.corsHeaders);
}
