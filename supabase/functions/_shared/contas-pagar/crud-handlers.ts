// _shared/contas-pagar/crud-handlers.ts — CRUD endpoints
import type { HandlerContext } from "./types.ts";
import { IncluirSchema, AlterarSchema, UpsertSchema } from "./types.ts";
import { enqueueWebhookEvent } from "../webhook-enqueue.ts";
import { logAuditEvent, logSuccess, logError, parseDate, jsonRes, UUID_REGEX } from "./utils.ts";

export async function handleConsultar(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return jsonRes({ error: 'Unauthorized' }, 401, ctx.corsHeaders);

  const id = ctx.url.searchParams.get('id');
  const codIntegracao = ctx.url.searchParams.get('codigo_lancamento_integracao');
  const codHuggs = ctx.url.searchParams.get('codigo_lancamento_huggs');

  if (!id && !codIntegracao && !codHuggs) {
    return jsonRes({ error: 'campo_obrigatorio', message: 'Informe id, codigo_lancamento_integracao ou codigo_lancamento_huggs' }, 400, ctx.corsHeaders);
  }

  let query = ctx.supabase.from('contas_pagar').select('*');
  if (id) query = query.eq('id', id);
  else if (codIntegracao) query = query.eq('codigo_lancamento_integracao', codIntegracao);
  else if (codHuggs) query = query.eq('codigo_lancamento_huggs', codHuggs);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return jsonRes({ error: 'nao_encontrado', message: 'Título não encontrado' }, 404, ctx.corsHeaders);

  return jsonRes({ conta_pagar_cadastro: data, meta: { duration_ms: Date.now() - ctx.startTime, processed_at: new Date().toISOString() } }, 200, ctx.corsHeaders);
}

export async function handleListar(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return jsonRes({ error: 'Unauthorized' }, 401, ctx.corsHeaders);

  const pagina = Math.max(1, parseInt(ctx.url.searchParams.get('pagina') || '1'));
  const registrosPorPagina = Math.min(Math.max(1, parseInt(ctx.url.searchParams.get('registros_por_pagina') || '20')), 500);
  const apenasImportadoApi = ctx.url.searchParams.get('apenas_importado_api');
  const ordenarPor = ctx.url.searchParams.get('ordenar_por') || 'data_vencimento';
  const ordemDescrescente = ctx.url.searchParams.get('ordem_descrescente') === 'S';
  const filtrarPorStatus = ctx.url.searchParams.get('filtrar_por_status');
  const filtrarPorDataDe = ctx.url.searchParams.get('filtrar_por_data_de');
  const filtrarPorDataAte = ctx.url.searchParams.get('filtrar_por_data_ate');
  const filtrarPorEmissaoDe = ctx.url.searchParams.get('filtrar_por_emissao_de');
  const filtrarPorEmissaoAte = ctx.url.searchParams.get('filtrar_por_emissao_ate');
  const filtrarContaCorrente = ctx.url.searchParams.get('filtrar_conta_corrente');
  const filtrarCliente = ctx.url.searchParams.get('filtrar_cliente');
  const filtrarPorCpfCnpj = ctx.url.searchParams.get('filtrar_por_cpf_cnpj');
  const filtrarPorProjeto = ctx.url.searchParams.get('filtrar_por_projeto');
  const filtrarPorVendedor = ctx.url.searchParams.get('filtrar_por_vendedor');
  const exibirObs = ctx.url.searchParams.get('exibir_obs') === 'S';

  const offset = (pagina - 1) * registrosPorPagina;

  let query = ctx.supabase.from('contas_pagar').select('*', { count: 'exact' });

  if (apenasImportadoApi === 'S') query = query.eq('importado_api', true);
  if (filtrarPorStatus) { const statusList = filtrarPorStatus.split(',').map(s => s.trim()); query = query.in('status', statusList); }
  if (filtrarPorDataDe) query = query.gte('data_vencimento', filtrarPorDataDe);
  if (filtrarPorDataAte) query = query.lte('data_vencimento', filtrarPorDataAte);
  if (filtrarPorEmissaoDe) query = query.gte('data_emissao', filtrarPorEmissaoDe);
  if (filtrarPorEmissaoAte) query = query.lte('data_emissao', filtrarPorEmissaoAte);
  if (filtrarContaCorrente) query = query.eq('id_conta_corrente', filtrarContaCorrente);
  if (filtrarCliente) query = query.eq('codigo_cliente_fornecedor', filtrarCliente);
  if (filtrarPorProjeto) query = query.eq('codigo_projeto', filtrarPorProjeto);
  if (filtrarPorVendedor) query = query.eq('codigo_vendedor', filtrarPorVendedor);

  const columnMap: Record<string, string> = { 'CODIGO': 'id', 'DATA_VENCIMENTO': 'data_vencimento', 'DATA_EMISSAO': 'data_emissao', 'VALOR': 'valor_original', 'FORNECEDOR': 'fornecedor_nome' };
  const orderColumn = columnMap[ordenarPor.toUpperCase()] || ordenarPor;

  query = query.order(orderColumn, { ascending: !ordemDescrescente }).range(offset, offset + registrosPorPagina - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  const totalRegistros = count || 0;
  const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina);

  const resultData = !exibirObs && data ? data.map((r: Record<string, unknown>) => { const { observacao, ...rest } = r; return rest; }) : data;

  return jsonRes({
    pagina, total_de_paginas: totalPaginas, registros: resultData?.length || 0, total_de_registros: totalRegistros,
    conta_pagar_cadastro: resultData || [],
    meta: { duration_ms: Date.now() - ctx.startTime, processed_at: new Date().toISOString() }
  }, 200, ctx.corsHeaders);
}

export async function handleQuery(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return jsonRes({ error: 'Unauthorized' }, 401, ctx.corsHeaders);

  const empresaId = ctx.url.searchParams.get('empresa_id');
  const fornecedorCodigo = ctx.url.searchParams.get('fornecedor_codigo');
  const status = ctx.url.searchParams.get('status');
  const vencimentoDe = ctx.url.searchParams.get('vencimento_de');
  const vencimentoAte = ctx.url.searchParams.get('vencimento_ate');
  const emissaoDe = ctx.url.searchParams.get('emissao_de');
  const emissaoAte = ctx.url.searchParams.get('emissao_ate');
  const limit = Math.min(parseInt(ctx.url.searchParams.get('limit') || '100'), 1000);
  const offset = parseInt(ctx.url.searchParams.get('offset') || '0');
  const orderBy = ctx.url.searchParams.get('order_by') || 'data_vencimento';
  const orderDir = ctx.url.searchParams.get('order_dir') === 'asc';

  let query = ctx.supabase.from('contas_pagar').select('*', { count: 'exact' });

  if (empresaId) query = query.eq('empresa_id', empresaId);
  if (fornecedorCodigo) query = query.eq('fornecedor_codigo', fornecedorCodigo);
  if (status) { const statusList = status.split(',').map(s => s.trim()); query = query.in('status', statusList); }
  if (vencimentoDe) query = query.gte('data_vencimento', vencimentoDe);
  if (vencimentoAte) query = query.lte('data_vencimento', vencimentoAte);
  if (emissaoDe) query = query.gte('data_emissao', emissaoDe);
  if (emissaoAte) query = query.lte('data_emissao', emissaoAte);

  query = query.order(orderBy, { ascending: orderDir }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  const duration = Date.now() - ctx.startTime;
  logSuccess('query', { filters: { empresaId, status, limit, offset }, results: data?.length, total: count });

  return jsonRes({
    data, pagination: { total: count, limit, offset, has_more: (count || 0) > offset + limit },
    meta: { duration_ms: duration, processed_at: new Date().toISOString() }
  }, 200, ctx.corsHeaders);
}

export async function handleGetRoot(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return jsonRes({ error: 'Unauthorized' }, 401, ctx.corsHeaders);

  const { data, error } = await ctx.supabase.from('contas_pagar').select('*').order('data_vencimento', { ascending: false }).limit(100);
  if (error) throw error;

  return jsonRes({ data }, 200, ctx.corsHeaders);
}

export async function handleUpdate(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return jsonRes({ error: 'Unauthorized' }, 401, ctx.corsHeaders);

  const body = await ctx.req.json();
  const { id, ...updates } = body;

  if (!id) return jsonRes({ error: 'campo_obrigatorio', message: 'Campo "id" é obrigatório' }, 400, ctx.corsHeaders);

  const allowedFields = [
    'valor_original', 'valor_aberto', 'valor_pago', 'valor_juros', 'valor_desconto', 'valor_ajustes',
    'data_vencimento', 'data_pagamento', 'portador', 'conta', 'categoria_codigo', 'categoria_nome',
    'status', 'observacao', 'numero_documento', 'tipo_documento'
  ];

  const sanitizedUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) sanitizedUpdates[key] = value;
  }

  if (Object.keys(sanitizedUpdates).length === 0) return jsonRes({ error: 'sem_alteracoes', message: 'Nenhum campo válido para atualização' }, 400, ctx.corsHeaders);

  sanitizedUpdates.updated_at = new Date().toISOString();

  const { data, error } = await ctx.supabase.from('contas_pagar').update(sanitizedUpdates).eq('id', id).select().single();

  if (error) {
    if (error.code === 'PGRST116') return jsonRes({ error: 'nao_encontrado', message: `Título ${id} não encontrado` }, 404, ctx.corsHeaders);
    throw error;
  }

  const duration = Date.now() - ctx.startTime;
  logSuccess('update', { id, fields: Object.keys(sanitizedUpdates), duration_ms: duration });

  return jsonRes({ success: true, data, meta: { duration_ms: duration, processed_at: new Date().toISOString() } }, 200, ctx.corsHeaders);
}

export async function handleCancelar(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return jsonRes({ error: 'Unauthorized' }, 401, ctx.corsHeaders);

  const body = await ctx.req.json();
  const { id, ids, motivo } = body;

  const targetIds = ids || (id ? [id] : []);
  if (targetIds.length === 0) return jsonRes({ error: 'campo_obrigatorio', message: 'Campo "id" ou "ids" é obrigatório' }, 400, ctx.corsHeaders);
  if (!motivo) return jsonRes({ error: 'campo_obrigatorio', message: 'Campo "motivo" é obrigatório' }, 400, ctx.corsHeaders);

  const { data, error } = await ctx.supabase.from('contas_pagar')
    .update({ status: 'cancelado', observacao: motivo, updated_at: new Date().toISOString() })
    .in('id', targetIds).not('status', 'eq', 'pago').select('id, status, empresa_id');

  if (error) throw error;

  for (const d of (data || [])) {
    enqueueWebhookEvent('conta_pagar.cancelado', { id: d.id, motivo }, d.empresa_id).catch(() => {});
  }

  const duration = Date.now() - ctx.startTime;
  logSuccess('cancelar', { ids: targetIds, cancelados: data?.length, duration_ms: duration });

  return jsonRes({
    success: true, cancelados: data?.length || 0, ids: data?.map((d: any) => d.id) || [],
    meta: { duration_ms: duration, processed_at: new Date().toISOString() }
  }, 200, ctx.corsHeaders);
}

export async function handleIncluir(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return jsonRes({ error: 'Unauthorized' }, 401, ctx.corsHeaders);

  const body = await ctx.req.json();
  const parsed = IncluirSchema.safeParse(body);
  if (!parsed.success) {
    return jsonRes({
      codigo_lancamento_integracao: body.codigo_lancamento_integracao || null,
      codigo_status: '1',
      descricao_status: 'Payload inválido: ' + parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    }, 400, ctx.corsHeaders);
  }

  if (parsed.data.empresa_id) {
    const { data: emp } = await ctx.supabase.from('empresas').select('id').eq('id', parsed.data.empresa_id).maybeSingle();
    if (!emp) {
      return jsonRes({ codigo_lancamento_integracao: parsed.data.codigo_lancamento_integracao, codigo_status: '1', descricao_status: `Empresa não encontrada: empresa_id '${parsed.data.empresa_id}' não existe no cadastro` }, 400, ctx.corsHeaders);
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
    if (error.code === '23505') return jsonRes({ codigo_lancamento_integracao, codigo_status: '2', descricao_status: 'Registro já existe com este código de integração. Use /upsert ou /alterar.' }, 409, ctx.corsHeaders);
    if (error.code === '23503') return jsonRes({ codigo_lancamento_integracao, codigo_status: '1', descricao_status: `Referência inválida: ${error.details || 'fornecedor, categoria ou conta corrente não encontrados no cadastro'}` }, 400, ctx.corsHeaders);
    if (error.code === '23502') return jsonRes({ codigo_lancamento_integracao, codigo_status: '1', descricao_status: `Campo obrigatório ausente: ${error.message}` }, 400, ctx.corsHeaders);
    if (error.code === '22P02') return jsonRes({ codigo_lancamento_integracao, codigo_status: '1', descricao_status: `Formato inválido: verifique que campos numéricos (codigo_cliente_fornecedor, id_conta_corrente, empresa_id) são números, não strings. Detalhe: ${error.message}` }, 400, ctx.corsHeaders);
    throw error;
  }

  await logAuditEvent(ctx.supabase, 'api_incluir', { id: data.id, codigo_lancamento_integracao }, ctx.req);
  enqueueWebhookEvent('conta_pagar.criado', { id: data.id, codigo_lancamento_integracao, valor_documento }, parsed.data.empresa_id).catch(() => {});

  return jsonRes({
    codigo_lancamento_huggs: data.codigo_lancamento_huggs, codigo_lancamento_integracao: data.codigo_lancamento_integracao,
    codigo_status: '0', descricao_status: 'Cadastro incluído com sucesso!', meta: { duration_ms: Date.now() - ctx.startTime }
  }, 201, ctx.corsHeaders);
}

export async function handleAlterar(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return jsonRes({ error: 'Unauthorized' }, 401, ctx.corsHeaders);

  const body = await ctx.req.json();
  const parsed = AlterarSchema.safeParse(body);
  if (!parsed.success) {
    return jsonRes({ codigo_status: '1', descricao_status: 'Payload inválido: ' + parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }, 400, ctx.corsHeaders);
  }

  const { codigo_lancamento_integracao, codigo_lancamento_huggs, ...updates } = parsed.data;

  if (!codigo_lancamento_integracao && !codigo_lancamento_huggs) {
    return jsonRes({ codigo_status: '1', descricao_status: 'Informe codigo_lancamento_integracao ou codigo_lancamento_huggs' }, 400, ctx.corsHeaders);
  }

  // Governance: check status
  let govQuery = ctx.supabase.from('contas_pagar').select('id, status, empresa_id');
  if (codigo_lancamento_integracao) govQuery = govQuery.eq('codigo_lancamento_integracao', codigo_lancamento_integracao);
  else govQuery = govQuery.eq('codigo_lancamento_huggs', codigo_lancamento_huggs);
  const { data: tituloGov } = await govQuery.maybeSingle();

  if (tituloGov && (tituloGov.status === 'pago' || tituloGov.status === 'cancelado')) {
    return jsonRes({ codigo_status: '3', descricao_status: `Alteração não permitida para títulos com status "${tituloGov.status}". Use /estornar para títulos pagos.` }, 400, ctx.corsHeaders);
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
  if (!data) return jsonRes({ codigo_lancamento_integracao, codigo_status: '5', descricao_status: 'Registro não encontrado' }, 404, ctx.corsHeaders);

  await logAuditEvent(ctx.supabase, 'api_alterar', { id: data.id, codigo_lancamento_integracao }, ctx.req);
  enqueueWebhookEvent('conta_pagar.alterado', { id: data.id, codigo_lancamento_integracao }, tituloGov?.empresa_id).catch(() => {});

  return jsonRes({
    codigo_lancamento_huggs: data.codigo_lancamento_huggs, codigo_lancamento_integracao: data.codigo_lancamento_integracao,
    codigo_status: '0', descricao_status: 'Cadastro alterado com sucesso!', meta: { duration_ms: Date.now() - ctx.startTime }
  }, 200, ctx.corsHeaders);
}

export async function handleExcluir(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return jsonRes({ error: 'Unauthorized' }, 401, ctx.corsHeaders);

  const codIntegracao = ctx.url.searchParams.get('codigo_lancamento_integracao');
  const codHuggs = ctx.url.searchParams.get('codigo_lancamento_huggs');
  const id = ctx.url.searchParams.get('id');

  if (!codIntegracao && !codHuggs && !id) {
    return jsonRes({ codigo_status: '1', descricao_status: 'Informe id, codigo_lancamento_integracao ou codigo_lancamento_huggs' }, 400, ctx.corsHeaders);
  }

  // Governance
  let excGovQuery = ctx.supabase.from('contas_pagar').select('id, status');
  if (id) excGovQuery = excGovQuery.eq('id', id);
  else if (codIntegracao) excGovQuery = excGovQuery.eq('codigo_lancamento_integracao', codIntegracao);
  else excGovQuery = excGovQuery.eq('codigo_lancamento_huggs', codHuggs);
  const { data: excTitulo } = await excGovQuery.maybeSingle();

  if (excTitulo && excTitulo.status === 'pago') {
    return jsonRes({ codigo_status: '3', descricao_status: 'Exclusão não permitida para títulos pagos. Use /estornar primeiro.' }, 400, ctx.corsHeaders);
  }

  let query = ctx.supabase.from('contas_pagar').update({ status: 'cancelado', updated_at: new Date().toISOString() });
  if (id) query = query.eq('id', id);
  else if (codIntegracao) query = query.eq('codigo_lancamento_integracao', codIntegracao);
  else query = query.eq('codigo_lancamento_huggs', codHuggs);

  const { data, error } = await query.select('id, codigo_lancamento_huggs, codigo_lancamento_integracao').maybeSingle();
  if (error) throw error;
  if (!data) return jsonRes({ codigo_status: '5', descricao_status: 'Registro não encontrado' }, 404, ctx.corsHeaders);

  await logAuditEvent(ctx.supabase, 'api_excluir', { id: data.id, codigo_lancamento_integracao: data.codigo_lancamento_integracao }, ctx.req);

  return jsonRes({
    codigo_lancamento_huggs: data.codigo_lancamento_huggs, codigo_lancamento_integracao: data.codigo_lancamento_integracao,
    codigo_status: '0', descricao_status: 'Registro excluído com sucesso!', meta: { duration_ms: Date.now() - ctx.startTime }
  }, 200, ctx.corsHeaders);
}

export async function handleUpsert(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return jsonRes({ error: 'Unauthorized' }, 401, ctx.corsHeaders);

  const body = await ctx.req.json();
  const parsed = UpsertSchema.safeParse(body);
  if (!parsed.success) {
    return jsonRes({ codigo_status: '1', descricao_status: 'Payload inválido: ' + parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }, 400, ctx.corsHeaders);
  }

  if (parsed.data.empresa_id) {
    const { data: emp } = await ctx.supabase.from('empresas').select('id').eq('id', parsed.data.empresa_id).maybeSingle();
    if (!emp) {
      return jsonRes({ codigo_lancamento_integracao: parsed.data.codigo_lancamento_integracao, codigo_status: '1', descricao_status: `Empresa não encontrada: empresa_id '${parsed.data.empresa_id}' não existe no cadastro` }, 400, ctx.corsHeaders);
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

  return jsonRes({
    codigo_lancamento_huggs: data.codigo_lancamento_huggs, codigo_lancamento_integracao: data.codigo_lancamento_integracao,
    codigo_status: '0', descricao_status: 'Upsert realizado com sucesso!', meta: { duration_ms: Date.now() - ctx.startTime }
  }, 200, ctx.corsHeaders);
}

export async function handleUpsertLote(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return jsonRes({ error: 'Unauthorized' }, 401, ctx.corsHeaders);

  const body = await ctx.req.json();
  const lote = body.lote || 1;
  const registros = body.conta_pagar_cadastro || body.registros || [];

  if (!Array.isArray(registros) || registros.length === 0) {
    return jsonRes({ lote, codigo_status: '1', descricao_status: 'Array conta_pagar_cadastro vazio ou inválido' }, 400, ctx.corsHeaders);
  }

  if (registros.length > 500) {
    return jsonRes({ lote, codigo_status: '1', descricao_status: 'Máximo 500 registros por lote' }, 413, ctx.corsHeaders);
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

  return jsonRes({
    lote, codigo_status: erros === 0 ? '0' : '1',
    descricao_status: `${processados} processado(s), ${erros} erro(s)`,
    meta: { duration_ms: Date.now() - ctx.startTime }
  }, 200, ctx.corsHeaders);
}
