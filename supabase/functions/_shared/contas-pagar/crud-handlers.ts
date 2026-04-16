// _shared/contas-pagar/crud-handlers.ts — CRUD endpoints (Profissionalizado)
import type { HandlerContext } from "./types.ts";
import { IncluirSchema, AlterarSchema, UpsertSchema, ListarParamsSchema, QueryParamsSchema, ConsultarParamsSchema } from "./types.ts";
import { enqueueWebhookEvent } from "../webhook-enqueue.ts";
import { logAuditEvent, logSuccess, logError, parseDate, apiResponse, jsonRes, UUID_REGEX, checkIdempotency, saveIdempotency } from "./utils.ts";

export async function handleConsultar(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return apiResponse({ error: 'Unauthorized' }, 401, ctx.corsHeaders, ctx.startTime);

  const params = ConsultarParamsSchema.safeParse({
    id: ctx.url.searchParams.get('id') || undefined,
    codigo_lancamento_integracao: ctx.url.searchParams.get('codigo_lancamento_integracao') || undefined,
    codigo_lancamento_huggs: ctx.url.searchParams.get('codigo_lancamento_huggs') || undefined,
  });
  if (!params.success) {
    return apiResponse({ error: 'VALIDATION_ERROR', message: params.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }, 400, ctx.corsHeaders, ctx.startTime);
  }

  const { id, codigo_lancamento_integracao: codIntegracao, codigo_lancamento_huggs: codHuggs } = params.data;

  if (!id && !codIntegracao && !codHuggs) {
    return apiResponse({ error: 'campo_obrigatorio', message: 'Informe id, codigo_lancamento_integracao ou codigo_lancamento_huggs' }, 400, ctx.corsHeaders, ctx.startTime);
  }

  let query = ctx.supabase.from('contas_pagar').select('*');
  if (id) query = query.eq('id', id);
  else if (codIntegracao) query = query.eq('codigo_lancamento_integracao', codIntegracao);
  else if (codHuggs) query = query.eq('codigo_lancamento_huggs', codHuggs);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return apiResponse({ error: 'nao_encontrado', message: 'Título não encontrado' }, 404, ctx.corsHeaders, ctx.startTime);

  return apiResponse({ conta_pagar_cadastro: data }, 200, ctx.corsHeaders, ctx.startTime);
}

export async function handleListar(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return apiResponse({ error: 'Unauthorized' }, 401, ctx.corsHeaders, ctx.startTime);

  const params = ListarParamsSchema.safeParse({
    pagina: ctx.url.searchParams.get('pagina') || undefined,
    registros_por_pagina: ctx.url.searchParams.get('registros_por_pagina') || undefined,
    filtrar_por_status: ctx.url.searchParams.get('filtrar_por_status') || undefined,
    filtrar_por_data_de: ctx.url.searchParams.get('filtrar_por_data_de') || undefined,
    filtrar_por_data_ate: ctx.url.searchParams.get('filtrar_por_data_ate') || undefined,
    filtrar_por_emissao_de: ctx.url.searchParams.get('filtrar_por_emissao_de') || undefined,
    filtrar_por_emissao_ate: ctx.url.searchParams.get('filtrar_por_emissao_ate') || undefined,
    filtrar_conta_corrente: ctx.url.searchParams.get('filtrar_conta_corrente') || undefined,
    filtrar_cliente: ctx.url.searchParams.get('filtrar_cliente') || undefined,
    filtrar_por_cpf_cnpj: ctx.url.searchParams.get('filtrar_por_cpf_cnpj') || undefined,
    filtrar_por_projeto: ctx.url.searchParams.get('filtrar_por_projeto') || undefined,
    filtrar_por_vendedor: ctx.url.searchParams.get('filtrar_por_vendedor') || undefined,
    ordenar_por: ctx.url.searchParams.get('ordenar_por') || undefined,
    ordem_descrescente: ctx.url.searchParams.get('ordem_descrescente') || undefined,
    apenas_importado_api: ctx.url.searchParams.get('apenas_importado_api') || undefined,
    exibir_obs: ctx.url.searchParams.get('exibir_obs') || undefined,
  });

  if (!params.success) {
    return apiResponse({ error: 'VALIDATION_ERROR', message: params.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }, 400, ctx.corsHeaders, ctx.startTime);
  }

  const p = params.data;
  const offset = (p.pagina - 1) * p.registros_por_pagina;

  let query = ctx.supabase.from('contas_pagar').select('*', { count: 'exact' });

  if (p.apenas_importado_api === 'S') query = query.eq('importado_api', true);
  if (p.filtrar_por_status) { const statusList = p.filtrar_por_status.split(',').map(s => s.trim()); query = query.in('status', statusList); }
  if (p.filtrar_por_data_de) query = query.gte('data_vencimento', p.filtrar_por_data_de);
  if (p.filtrar_por_data_ate) query = query.lte('data_vencimento', p.filtrar_por_data_ate);
  if (p.filtrar_por_emissao_de) query = query.gte('data_emissao', p.filtrar_por_emissao_de);
  if (p.filtrar_por_emissao_ate) query = query.lte('data_emissao', p.filtrar_por_emissao_ate);
  if (p.filtrar_conta_corrente) query = query.eq('id_conta_corrente', p.filtrar_conta_corrente);
  if (p.filtrar_cliente) query = query.eq('codigo_cliente_fornecedor', p.filtrar_cliente);
  if (p.filtrar_por_projeto) query = query.eq('codigo_projeto', p.filtrar_por_projeto);
  if (p.filtrar_por_vendedor) query = query.eq('codigo_vendedor', p.filtrar_por_vendedor);

  const columnMap: Record<string, string> = { 'CODIGO': 'id', 'DATA_VENCIMENTO': 'data_vencimento', 'DATA_EMISSAO': 'data_emissao', 'VALOR': 'valor_original', 'FORNECEDOR': 'fornecedor_nome' };
  const orderColumn = columnMap[p.ordenar_por.toUpperCase()] || p.ordenar_por;

  query = query.order(orderColumn, { ascending: p.ordem_descrescente !== 'S' }).range(offset, offset + p.registros_por_pagina - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  const totalRegistros = count || 0;
  const totalPaginas = Math.ceil(totalRegistros / p.registros_por_pagina);

  const resultData = p.exibir_obs !== 'S' && data ? data.map((r: Record<string, unknown>) => { const { observacao, ...rest } = r; return rest; }) : data;

  return apiResponse({
    pagina: p.pagina, total_de_paginas: totalPaginas, registros: resultData?.length || 0, total_de_registros: totalRegistros,
    conta_pagar_cadastro: resultData || [],
  }, 200, ctx.corsHeaders, ctx.startTime);
}

export async function handleQuery(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return apiResponse({ error: 'Unauthorized' }, 401, ctx.corsHeaders, ctx.startTime);

  const params = QueryParamsSchema.safeParse({
    empresa_id: ctx.url.searchParams.get('empresa_id') || undefined,
    fornecedor_codigo: ctx.url.searchParams.get('fornecedor_codigo') || undefined,
    status: ctx.url.searchParams.get('status') || undefined,
    vencimento_de: ctx.url.searchParams.get('vencimento_de') || undefined,
    vencimento_ate: ctx.url.searchParams.get('vencimento_ate') || undefined,
    emissao_de: ctx.url.searchParams.get('emissao_de') || undefined,
    emissao_ate: ctx.url.searchParams.get('emissao_ate') || undefined,
    limit: ctx.url.searchParams.get('limit') || undefined,
    offset: ctx.url.searchParams.get('offset') || undefined,
    order_by: ctx.url.searchParams.get('order_by') || undefined,
    order_dir: ctx.url.searchParams.get('order_dir') || undefined,
    cursor: ctx.url.searchParams.get('cursor') || undefined,
  });

  if (!params.success) {
    return apiResponse({ error: 'VALIDATION_ERROR', message: params.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }, 400, ctx.corsHeaders, ctx.startTime);
  }

  const p = params.data;

  let query = ctx.supabase.from('contas_pagar').select('*', { count: 'exact' });

  if (p.empresa_id) query = query.eq('empresa_id', p.empresa_id);
  if (p.fornecedor_codigo) query = query.eq('fornecedor_codigo', p.fornecedor_codigo);
  if (p.status) { const statusList = p.status.split(',').map(s => s.trim()); query = query.in('status', statusList); }
  if (p.vencimento_de) query = query.gte('data_vencimento', p.vencimento_de);
  if (p.vencimento_ate) query = query.lte('data_vencimento', p.vencimento_ate);
  if (p.emissao_de) query = query.gte('data_emissao', p.emissao_de);
  if (p.emissao_ate) query = query.lte('data_emissao', p.emissao_ate);

  // Cursor-based pagination (Fase 3C)
  if (p.cursor) {
    query = query.gt('id', p.cursor).order('id', { ascending: true }).limit(p.limit);
  } else {
    query = query.order(p.order_by, { ascending: p.order_dir === 'asc' }).range(p.offset!, p.offset! + p.limit - 1);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const nextCursor = p.cursor && data && data.length === p.limit ? data[data.length - 1].id : undefined;

  logSuccess('query', { filters: { empresa_id: p.empresa_id, status: p.status, limit: p.limit }, results: data?.length, total: count });

  return apiResponse({
    data,
    pagination: {
      total: count, limit: p.limit,
      offset: p.cursor ? undefined : p.offset,
      cursor: nextCursor,
      has_more: p.cursor ? data?.length === p.limit : (count || 0) > (p.offset || 0) + p.limit,
    },
  }, 200, ctx.corsHeaders, ctx.startTime);
}

export async function handleGetRoot(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return apiResponse({ error: 'Unauthorized' }, 401, ctx.corsHeaders, ctx.startTime);

  const { data, error } = await ctx.supabase.from('contas_pagar').select('*').order('data_vencimento', { ascending: false }).limit(100);
  if (error) throw error;

  return apiResponse({ data }, 200, ctx.corsHeaders, ctx.startTime);
}

export async function handleUpdate(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return apiResponse({ error: 'Unauthorized' }, 401, ctx.corsHeaders, ctx.startTime);

  const body = await ctx.req.json();
  const { id, ...updates } = body;

  if (!id) return apiResponse({ error: 'campo_obrigatorio', message: 'Campo "id" é obrigatório' }, 400, ctx.corsHeaders, ctx.startTime);

  const allowedFields = [
    'valor_original', 'valor_aberto', 'valor_pago', 'valor_juros', 'valor_desconto', 'valor_ajustes',
    'data_vencimento', 'data_pagamento', 'portador', 'conta', 'categoria_codigo', 'categoria_nome',
    'status', 'observacao', 'numero_documento', 'tipo_documento'
  ];

  const sanitizedUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) sanitizedUpdates[key] = value;
  }

  if (Object.keys(sanitizedUpdates).length === 0) return apiResponse({ error: 'sem_alteracoes', message: 'Nenhum campo válido para atualização' }, 400, ctx.corsHeaders, ctx.startTime);

  sanitizedUpdates.updated_at = new Date().toISOString();

  const { data, error } = await ctx.supabase.from('contas_pagar').update(sanitizedUpdates).eq('id', id).select().single();

  if (error) {
    if (error.code === 'PGRST116') return apiResponse({ error: 'nao_encontrado', message: `Título ${id} não encontrado` }, 404, ctx.corsHeaders, ctx.startTime);
    throw error;
  }

  logSuccess('update', { id, fields: Object.keys(sanitizedUpdates) });

  return apiResponse({ success: true, data }, 200, ctx.corsHeaders, ctx.startTime);
}

export async function handleCancelar(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return apiResponse({ error: 'Unauthorized' }, 401, ctx.corsHeaders, ctx.startTime);

  const body = await ctx.req.json();
  const { id, ids, motivo } = body;

  const targetIds = ids || (id ? [id] : []);
  if (targetIds.length === 0) return apiResponse({ error: 'campo_obrigatorio', message: 'Campo "id" ou "ids" é obrigatório' }, 400, ctx.corsHeaders, ctx.startTime);
  if (!motivo) return apiResponse({ error: 'campo_obrigatorio', message: 'Campo "motivo" é obrigatório' }, 400, ctx.corsHeaders, ctx.startTime);

  const { data, error } = await ctx.supabase.from('contas_pagar')
    .update({ status: 'cancelado', observacao: motivo, updated_at: new Date().toISOString() })
    .in('id', targetIds).not('status', 'eq', 'pago').select('id, status, empresa_id');

  if (error) throw error;

  for (const d of (data || [])) {
    enqueueWebhookEvent('conta_pagar.cancelado', { id: d.id, motivo }, d.empresa_id).catch(() => {});
  }

  logSuccess('cancelar', { ids: targetIds, cancelados: data?.length });

  return apiResponse({
    success: true, cancelados: data?.length || 0, ids: data?.map((d: any) => d.id) || [],
  }, 200, ctx.corsHeaders, ctx.startTime);
}

export async function handleIncluir(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return apiResponse({ error: 'Unauthorized' }, 401, ctx.corsHeaders, ctx.startTime);

  const idempotencyKey = ctx.req.headers.get('X-Idempotency-Key');
  const idem = await checkIdempotency(ctx.supabase, idempotencyKey, 'incluir', ctx.corsHeaders);
  if (idem.found && idem.response) return idem.response;

  const body = await ctx.req.json();
  const parsed = IncluirSchema.safeParse(body);
  if (!parsed.success) {
    return apiResponse({
      codigo_lancamento_integracao: body.codigo_lancamento_integracao || null,
      codigo_status: '1',
      descricao_status: 'Payload inválido: ' + parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    }, 400, ctx.corsHeaders, ctx.startTime);
  }

  if (parsed.data.empresa_id) {
    const { data: emp } = await ctx.supabase.from('empresas').select('id').eq('id', parsed.data.empresa_id).maybeSingle();
    if (!emp) {
      return apiResponse({ codigo_lancamento_integracao: parsed.data.codigo_lancamento_integracao, codigo_status: '1', descricao_status: `Empresa não encontrada: empresa_id '${parsed.data.empresa_id}' não existe no cadastro` }, 400, ctx.corsHeaders, ctx.startTime);
    }
  }

  const { codigo_lancamento_integracao, codigo_cliente_fornecedor, data_vencimento, valor_documento, codigo_categoria, data_previsao, id_conta_corrente, descricao: _desc, observacao: _obs, ...validRest } = parsed.data;

  const erp_id = `API-${codigo_lancamento_integracao}-${Date.now()}`;

  const insertData: Record<string, unknown> = {
    erp_id, codigo_lancamento_integracao, codigo_cliente_fornecedor,
    data_vencimento: parseDate(data_vencimento), valor_original: valor_documento, valor_aberto: valor_documento,
    valor_pago: 0, categoria_codigo: codigo_categoria, data_previsao: parseDate(data_previsao),
    id_conta_corrente, status: 'pendente', importado_api: true, empresa_id: parsed.data.empresa_id || 5,
    ...validRest
  };

  const { data, error } = await ctx.supabase.from('contas_pagar').insert(insertData).select('id, codigo_lancamento_huggs, codigo_lancamento_integracao').single();
  if (error) {
    if (error.code === '23505') return apiResponse({ codigo_lancamento_integracao, codigo_status: '2', descricao_status: 'Registro já existe com este código de integração. Use /upsert ou /alterar.' }, 409, ctx.corsHeaders, ctx.startTime);
    if (error.code === '23503') return apiResponse({ codigo_lancamento_integracao, codigo_status: '1', descricao_status: `Referência inválida: ${error.details || 'fornecedor, categoria ou conta corrente não encontrados no cadastro'}` }, 400, ctx.corsHeaders, ctx.startTime);
    if (error.code === '23502') return apiResponse({ codigo_lancamento_integracao, codigo_status: '1', descricao_status: `Campo obrigatório ausente: ${error.message}` }, 400, ctx.corsHeaders, ctx.startTime);
    if (error.code === '22P02') return apiResponse({ codigo_lancamento_integracao, codigo_status: '1', descricao_status: `Formato inválido: verifique que campos numéricos são números, não strings. Detalhe: ${error.message}` }, 400, ctx.corsHeaders, ctx.startTime);
    throw error;
  }

  await logAuditEvent(ctx.supabase, 'api_incluir', { id: data.id, codigo_lancamento_integracao }, ctx.req);
  enqueueWebhookEvent('conta_pagar.criado', { id: data.id, codigo_lancamento_integracao, valor_documento }, parsed.data.empresa_id).catch(() => {});

  const responseBody = {
    codigo_lancamento_huggs: data.codigo_lancamento_huggs, codigo_lancamento_integracao: data.codigo_lancamento_integracao,
    codigo_status: '0', descricao_status: 'Cadastro incluído com sucesso!',
  };

  await saveIdempotency(ctx.supabase, idempotencyKey, 'incluir', responseBody, 201);

  return apiResponse(responseBody, 201, ctx.corsHeaders, ctx.startTime);
}

export async function handleAlterar(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return apiResponse({ error: 'Unauthorized' }, 401, ctx.corsHeaders, ctx.startTime);

  const body = await ctx.req.json();
  const parsed = AlterarSchema.safeParse(body);
  if (!parsed.success) {
    return apiResponse({ codigo_status: '1', descricao_status: 'Payload inválido: ' + parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }, 400, ctx.corsHeaders, ctx.startTime);
  }

  const { codigo_lancamento_integracao, codigo_lancamento_huggs, ...updates } = parsed.data;

  if (!codigo_lancamento_integracao && !codigo_lancamento_huggs) {
    return apiResponse({ codigo_status: '1', descricao_status: 'Informe codigo_lancamento_integracao ou codigo_lancamento_huggs' }, 400, ctx.corsHeaders, ctx.startTime);
  }

  // Governance: check status
  let govQuery = ctx.supabase.from('contas_pagar').select('id, status, empresa_id');
  if (codigo_lancamento_integracao) govQuery = govQuery.eq('codigo_lancamento_integracao', codigo_lancamento_integracao);
  else govQuery = govQuery.eq('codigo_lancamento_huggs', codigo_lancamento_huggs);
  const { data: tituloGov } = await govQuery.maybeSingle();

  if (tituloGov && (tituloGov.status === 'pago' || tituloGov.status === 'cancelado')) {
    return apiResponse({ codigo_status: '3', descricao_status: `Alteração não permitida para títulos com status "${tituloGov.status}". Use /estornar para títulos pagos.` }, 400, ctx.corsHeaders, ctx.startTime);
  }

  const updateData: Record<string, unknown> = { ...updates };
  if (updateData.valor_documento !== undefined) { updateData.valor_original = updateData.valor_documento; delete updateData.valor_documento; }
  if (updateData.data_vencimento) updateData.data_vencimento = parseDate(updateData.data_vencimento as string);
  if (updateData.data_previsao) updateData.data_previsao = parseDate(updateData.data_previsao as string);
  if (updateData.data_emissao) updateData.data_emissao = parseDate(updateData.data_emissao as string);
  if (updateData.data_entrada) updateData.data_entrada = parseDate(updateData.data_entrada as string);
  updateData.updated_at = new Date().toISOString();

  let query = ctx.supabase.from('contas_pagar').update(updateData);
  if (codigo_lancamento_integracao) query = query.eq('codigo_lancamento_integracao', codigo_lancamento_integracao);
  else query = query.eq('codigo_lancamento_huggs', codigo_lancamento_huggs);

  const { data, error } = await query.select('id, codigo_lancamento_huggs, codigo_lancamento_integracao').maybeSingle();
  if (error) throw error;
  if (!data) return apiResponse({ codigo_lancamento_integracao, codigo_status: '5', descricao_status: 'Registro não encontrado' }, 404, ctx.corsHeaders, ctx.startTime);

  await logAuditEvent(ctx.supabase, 'api_alterar', { id: data.id, codigo_lancamento_integracao }, ctx.req);
  enqueueWebhookEvent('conta_pagar.alterado', { id: data.id, codigo_lancamento_integracao }, tituloGov?.empresa_id).catch(() => {});

  return apiResponse({
    codigo_lancamento_huggs: data.codigo_lancamento_huggs, codigo_lancamento_integracao: data.codigo_lancamento_integracao,
    codigo_status: '0', descricao_status: 'Cadastro alterado com sucesso!',
  }, 200, ctx.corsHeaders, ctx.startTime);
}

export async function handleExcluir(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return apiResponse({ error: 'Unauthorized' }, 401, ctx.corsHeaders, ctx.startTime);

  const codIntegracao = ctx.url.searchParams.get('codigo_lancamento_integracao');
  const codHuggs = ctx.url.searchParams.get('codigo_lancamento_huggs');
  const id = ctx.url.searchParams.get('id');

  if (!codIntegracao && !codHuggs && !id) {
    return apiResponse({ codigo_status: '1', descricao_status: 'Informe id, codigo_lancamento_integracao ou codigo_lancamento_huggs' }, 400, ctx.corsHeaders, ctx.startTime);
  }

  // Governance
  let excGovQuery = ctx.supabase.from('contas_pagar').select('id, status');
  if (id) excGovQuery = excGovQuery.eq('id', id);
  else if (codIntegracao) excGovQuery = excGovQuery.eq('codigo_lancamento_integracao', codIntegracao);
  else excGovQuery = excGovQuery.eq('codigo_lancamento_huggs', codHuggs);
  const { data: excTitulo } = await excGovQuery.maybeSingle();

  if (excTitulo && excTitulo.status === 'pago') {
    return apiResponse({ codigo_status: '3', descricao_status: 'Exclusão não permitida para títulos pagos. Use /estornar primeiro.' }, 400, ctx.corsHeaders, ctx.startTime);
  }

  let query = ctx.supabase.from('contas_pagar').update({ status: 'cancelado', updated_at: new Date().toISOString() });
  if (id) query = query.eq('id', id);
  else if (codIntegracao) query = query.eq('codigo_lancamento_integracao', codIntegracao);
  else query = query.eq('codigo_lancamento_huggs', codHuggs);

  const { data, error } = await query.select('id, codigo_lancamento_huggs, codigo_lancamento_integracao').maybeSingle();
  if (error) throw error;
  if (!data) return apiResponse({ codigo_status: '5', descricao_status: 'Registro não encontrado' }, 404, ctx.corsHeaders, ctx.startTime);

  await logAuditEvent(ctx.supabase, 'api_excluir', { id: data.id, codigo_lancamento_integracao: data.codigo_lancamento_integracao }, ctx.req);

  return apiResponse({
    codigo_lancamento_huggs: data.codigo_lancamento_huggs, codigo_lancamento_integracao: data.codigo_lancamento_integracao,
    codigo_status: '0', descricao_status: 'Registro excluído com sucesso!',
  }, 200, ctx.corsHeaders, ctx.startTime);
}

export async function handleUpsert(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return apiResponse({ error: 'Unauthorized' }, 401, ctx.corsHeaders, ctx.startTime);

  const idempotencyKey = ctx.req.headers.get('X-Idempotency-Key');
  const idem = await checkIdempotency(ctx.supabase, idempotencyKey, 'upsert', ctx.corsHeaders);
  if (idem.found && idem.response) return idem.response;

  const body = await ctx.req.json();
  const parsed = UpsertSchema.safeParse(body);
  if (!parsed.success) {
    return apiResponse({ codigo_status: '1', descricao_status: 'Payload inválido: ' + parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }, 400, ctx.corsHeaders, ctx.startTime);
  }

  if (parsed.data.empresa_id) {
    const { data: emp } = await ctx.supabase.from('empresas').select('id').eq('id', parsed.data.empresa_id).maybeSingle();
    if (!emp) {
      return apiResponse({ codigo_lancamento_integracao: parsed.data.codigo_lancamento_integracao, codigo_status: '1', descricao_status: `Empresa não encontrada: empresa_id '${parsed.data.empresa_id}' não existe no cadastro` }, 400, ctx.corsHeaders, ctx.startTime);
    }
  }

  const { codigo_lancamento_integracao } = parsed.data;
  const upsertData: Record<string, unknown> = { ...parsed.data };
  if (upsertData.valor_documento !== undefined) {
    upsertData.valor_original = upsertData.valor_documento;
    upsertData.valor_aberto = upsertData.valor_aberto ?? upsertData.valor_documento;
    delete upsertData.valor_documento;
  }
  if (upsertData.data_vencimento) upsertData.data_vencimento = parseDate(upsertData.data_vencimento as string);
  if (upsertData.data_previsao) upsertData.data_previsao = parseDate(upsertData.data_previsao as string);
  if (upsertData.data_emissao) upsertData.data_emissao = parseDate(upsertData.data_emissao as string);
  upsertData.importado_api = true;
  upsertData.updated_at = new Date().toISOString();

  const { data, error } = await ctx.supabase.from('contas_pagar')
    .upsert(upsertData, { onConflict: 'empresa_id,codigo_lancamento_integracao' })
    .select('id, codigo_lancamento_huggs, codigo_lancamento_integracao').single();

  if (error) throw error;

  await logAuditEvent(ctx.supabase, 'api_upsert', { id: data.id, codigo_lancamento_integracao }, ctx.req);

  const responseBody = {
    codigo_lancamento_huggs: data.codigo_lancamento_huggs, codigo_lancamento_integracao: data.codigo_lancamento_integracao,
    codigo_status: '0', descricao_status: 'Upsert realizado com sucesso!',
  };

  await saveIdempotency(ctx.supabase, idempotencyKey, 'upsert', responseBody, 200);

  return apiResponse(responseBody, 200, ctx.corsHeaders, ctx.startTime);
}

export async function handleUpsertLote(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return apiResponse({ error: 'Unauthorized' }, 401, ctx.corsHeaders, ctx.startTime);

  const idempotencyKey = ctx.req.headers.get('X-Idempotency-Key');
  const idem = await checkIdempotency(ctx.supabase, idempotencyKey, 'upsert-lote', ctx.corsHeaders);
  if (idem.found && idem.response) return idem.response;

  const body = await ctx.req.json();
  const lote = body.lote || 1;
  const registros = body.conta_pagar_cadastro || body.registros || [];

  if (!Array.isArray(registros) || registros.length === 0) {
    return apiResponse({ lote, codigo_status: '1', descricao_status: 'Array conta_pagar_cadastro vazio ou inválido' }, 400, ctx.corsHeaders, ctx.startTime);
  }

  if (registros.length > 500) {
    return apiResponse({ lote, codigo_status: '1', descricao_status: 'Máximo 500 registros por lote' }, 413, ctx.corsHeaders, ctx.startTime);
  }

  let processados = 0;
  let erros = 0;

  for (const reg of registros) {
    try {
      const regParsed = UpsertSchema.safeParse(reg);
      if (!regParsed.success) { erros++; continue; }
      if (regParsed.data.empresa_id) {
        const { data: emp } = await ctx.supabase.from('empresas').select('id').eq('id', regParsed.data.empresa_id).maybeSingle();
        if (!emp) { erros++; continue; }
      }
      const upsertData: Record<string, unknown> = { ...regParsed.data };
      if (upsertData.valor_documento !== undefined) {
        upsertData.valor_original = upsertData.valor_documento;
        upsertData.valor_aberto = upsertData.valor_aberto ?? upsertData.valor_documento;
        delete upsertData.valor_documento;
      }
      if (upsertData.data_vencimento) upsertData.data_vencimento = parseDate(upsertData.data_vencimento as string);
      if (upsertData.data_previsao) upsertData.data_previsao = parseDate(upsertData.data_previsao as string);
      if (upsertData.data_emissao) upsertData.data_emissao = parseDate(upsertData.data_emissao as string);
      upsertData.importado_api = true;
      upsertData.updated_at = new Date().toISOString();

      const { error } = await ctx.supabase.from('contas_pagar').upsert(upsertData, { onConflict: 'empresa_id,codigo_lancamento_integracao' });
      if (error) throw error;
      processados++;
    } catch { erros++; }
  }

  const responseBody = {
    lote, codigo_status: erros === 0 ? '0' : '1',
    descricao_status: `${processados} processado(s), ${erros} erro(s)`,
  };

  await saveIdempotency(ctx.supabase, idempotencyKey, 'upsert-lote', responseBody, 200);

  return apiResponse(responseBody, 200, ctx.corsHeaders, ctx.startTime);
}
