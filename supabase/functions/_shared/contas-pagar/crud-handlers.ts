// _shared/contas-pagar/crud-handlers.ts — CRUD endpoints (Profissionalizado)
// v4.0.0 (PR-7): handleAlterar e handleListar removidos — use handleUpsert e handleQuery.
import type { HandlerContext } from "./types.ts";
import { IncluirSchema, UpsertSchema, QueryParamsSchema, ConsultarParamsSchema } from "./types.ts";
import { enqueueWebhookEvent } from "../webhook-enqueue.ts";
// PR-24 (Production Hardening): idempotência centralizada em withIdempotency (router) — checkIdempotency/saveIdempotency removidos dos handlers (eram dupla execução com race em retries simultâneos).
import { logAuditEvent, logSuccess, logError, parseDate, apiResponse, jsonRes, UUID_REGEX, validateReference } from "./utils.ts";

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

  // PR-23/PR-24 (v4.4.1): JOINs enriquecidos com fallback para lookups manuais.
  // `portador_id` tem FK válida → JOIN embedded. `fornecedor_codigo` e `codigo_projeto`
  // são apenas strings sem FK → 2 lookups separados (1 query cada) após o SELECT principal.
  const enrichedSelect = `*,
    portador_rel:portadores!portador_id(id, nome, codigo_erp)`;

  let query = ctx.supabase.from('contas_pagar').select(enrichedSelect);
  if (id) query = query.eq('id', id);
  else if (codIntegracao) query = query.eq('codigo_lancamento_integracao', codIntegracao);
  else if (codHuggs) query = query.eq('codigo_lancamento_huggs', codHuggs);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return apiResponse({ error: 'nao_encontrado', message: 'Título não encontrado' }, 404, ctx.corsHeaders, ctx.startTime);

  // Lookups manuais (fornecedor por codigo_externo, projeto por código).
  let fornecedor_rel: { codigo_externo: string; razao_social: string | null; cnpj: string | null } | null = null;
  if (data.fornecedor_codigo) {
    const { data: f } = await ctx.supabase
      .from('fornecedores')
      .select('codigo_externo, razao_social, cnpj')
      .eq('codigo_externo', String(data.fornecedor_codigo))
      .maybeSingle();
    if (f) fornecedor_rel = f;
  }
  let projeto_rel: { id: string; nome: string } | null = null;
  // codigo_projeto é opcional; só faz lookup se houver.
  if (data.codigo_projeto) {
    const { data: pr } = await ctx.supabase
      .from('projetos')
      .select('id, nome')
      .eq('codigo', String(data.codigo_projeto))
      .maybeSingle();
    if (pr) projeto_rel = pr;
  }
  // PR-25 (v3.2.2): fallback ao vivo para empresa/categoria quando cache denormalized está NULL.
  let empresaFallback: string | null = null;
  if (data.empresa_id && !data.empresa_nome) {
    const { data: e } = await ctx.supabase.from('empresas').select('nome').eq('id', data.empresa_id).maybeSingle();
    if (e?.nome) empresaFallback = e.nome;
  }
  let categoriaFallback: string | null = null;
  if (data.categoria_codigo && !data.categoria_nome) {
    const { data: c } = await ctx.supabase.from('trade_chart_of_accounts').select('name').eq('code', String(data.categoria_codigo)).maybeSingle();
    if (c?.name) categoriaFallback = c.name;
  }
  const enriched = shapeMetaRelacionados({
    ...data,
    empresa_nome: data.empresa_nome ?? empresaFallback,
    categoria_nome: data.categoria_nome ?? categoriaFallback,
    fornecedor_rel,
    projeto_rel,
  });

  return apiResponse({ conta_pagar_cadastro: enriched }, 200, ctx.corsHeaders, ctx.startTime);
}

// PR-25 (v3.2.2): backfill automático do cache denormalizado na escrita.
// Quando o cliente envia apenas IDs/códigos sem os nomes, busca em paralelo nas 3 dimensões
// e devolve payload enriquecido. Custo: até 3 queries paralelas (~30ms) ou 0 quando o
// cliente já mandou os nomes. Falhas silenciosas via .maybeSingle() — nunca bloqueia escrita.
async function enrichCachedNames(supabase: any, p: Record<string, any>): Promise<Record<string, any>> {
  const fornCode = p.codigo_cliente_fornecedor ?? p.fornecedor_codigo;
  const catCode = p.codigo_categoria ?? p.categoria_codigo;
  const [emp, cat, forn] = await Promise.all([
    p.empresa_id && !p.empresa_nome
      ? supabase.from('empresas').select('nome').eq('id', p.empresa_id).maybeSingle()
      : Promise.resolve(null),
    catCode && !p.categoria_nome
      ? supabase.from('trade_chart_of_accounts').select('name').eq('code', String(catCode)).maybeSingle()
      : Promise.resolve(null),
    fornCode && !p.fornecedor_nome
      ? supabase.from('fornecedores').select('razao_social').eq('codigo_externo', String(fornCode)).maybeSingle()
      : Promise.resolve(null),
  ]);
  return {
    ...p,
    ...(emp?.data?.nome && { empresa_nome: emp.data.nome }),
    ...(cat?.data?.name && { categoria_nome: cat.data.name }),
    ...(forn?.data?.razao_social && { fornecedor_nome: forn.data.razao_social }),
  };
}

// PR-23 (v4.4.0): shape transform — agrupa relacionados em meta_relacionados.
// Usa cache denormalized (empresa_nome/categoria_nome/departamento_nome) + JOINs (fornecedor_rel/portador_rel/projeto_rel).
function shapeMetaRelacionados(row: any) {
  if (!row) return row;
  const meta_relacionados = {
    empresa: row.empresa_id ? { id: row.empresa_id, nome: row.empresa_nome || null } : null,
    fornecedor: (row.fornecedor_codigo || row.fornecedor_rel) ? {
      codigo: row.fornecedor_codigo || row.fornecedor_rel?.codigo_externo || null,
      nome: row.fornecedor_rel?.razao_social || row.fornecedor_nome || null,
      cnpj: row.fornecedor_rel?.cnpj || null,
    } : null,
    categoria: row.categoria_codigo ? { codigo: row.categoria_codigo, nome: row.categoria_nome || null } : null,
    departamento: row.departamento_id ? { id: row.departamento_id, nome: row.departamento_nome || null } : null,
    portador: row.portador_rel ? {
      id: row.portador_rel.id,
      nome: row.portador_rel.nome,
      codigo: row.portador_rel.codigo_erp || null,
    } : (row.portador_id ? { id: row.portador_id, nome: row.portador || null, codigo: null } : null),
    projeto: row.projeto_rel ? { id: row.projeto_rel.id, nome: row.projeto_rel.nome } : null,
  };
  // Remove embedded raw para não duplicar payload — meta_relacionados é a forma canônica.
  const { fornecedor_rel: _f, portador_rel: _p, projeto_rel: _pr, ...rest } = row;
  return { ...rest, meta_relacionados };
}

// handleListar removido em v4.0.0 (PR-7) — use handleQuery.


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

  // PR-25 (v3.2.2): batch fallback para nomes ausentes no cache denormalized.
  // 0 a 3 queries extras por GET (paralelas, com Set para chaves únicas). Defesa em
  // profundidade contra cache stale; respeita o cache existente quando presente.
  const rows = (data || []) as any[];
  const empresaIdsFaltando = [...new Set(rows.filter(r => r.empresa_id && !r.empresa_nome).map(r => r.empresa_id))];
  const catCodesFaltando   = [...new Set(rows.filter(r => r.categoria_codigo && !r.categoria_nome).map(r => String(r.categoria_codigo)))];
  const fornCodesFaltando  = [...new Set(rows.filter(r => r.fornecedor_codigo && !r.fornecedor_nome).map(r => String(r.fornecedor_codigo)))];

  const [empRes, catRes, fornRes] = await Promise.all([
    empresaIdsFaltando.length ? ctx.supabase.from('empresas').select('id, nome').in('id', empresaIdsFaltando) : Promise.resolve({ data: [] }),
    catCodesFaltando.length   ? ctx.supabase.from('trade_chart_of_accounts').select('code, name').in('code', catCodesFaltando) : Promise.resolve({ data: [] }),
    fornCodesFaltando.length  ? ctx.supabase.from('fornecedores').select('codigo_externo, razao_social').in('codigo_externo', fornCodesFaltando) : Promise.resolve({ data: [] }),
  ]);
  const empMap = new Map((empRes.data || []).map((r: any) => [r.id, r.nome]));
  const catMap = new Map((catRes.data || []).map((r: any) => [r.code, r.name]));
  const fornMap = new Map((fornRes.data || []).map((r: any) => [r.codigo_externo, r.razao_social]));

  const enrichedData = rows.map((row: any) => shapeMetaRelacionados({
    ...row,
    empresa_nome: row.empresa_nome ?? empMap.get(row.empresa_id) ?? null,
    categoria_nome: row.categoria_nome ?? catMap.get(String(row.categoria_codigo)) ?? null,
    fornecedor_nome: row.fornecedor_nome ?? fornMap.get(String(row.fornecedor_codigo)) ?? null,
  }));

  return apiResponse({
    data: enrichedData,
    pagination: {
      total: count, limit: p.limit,
      offset: p.cursor ? undefined : p.offset,
      cursor: nextCursor,
      has_more: p.cursor ? data?.length === p.limit : (count || 0) > (p.offset || 0) + p.limit,
    },
  }, 200, ctx.corsHeaders, ctx.startTime);
}

// PR-24: handleGetRoot delega para handleQuery — antes retornava 100 itens sem filtro/paginação/meta.
// Agora herda enrichedSelect, paginação cursor/offset, meta_relacionados e filtros de query string.
export async function handleGetRoot(ctx: HandlerContext): Promise<Response> {
  return handleQuery(ctx);
}

export async function handleUpdate(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return apiResponse({ error: 'Unauthorized' }, 401, ctx.corsHeaders, ctx.startTime);

  const body = await ctx.req.json();
  const { id, ...updates } = body;

  if (!id) return apiResponse({ error: 'campo_obrigatorio', message: 'Campo "id" é obrigatório' }, 400, ctx.corsHeaders, ctx.startTime);

  // PR-23 (v4.4.0): allowlist expandida para paridade com IncluirSchema/UpsertSchema.
  const allowedFields = [
    'valor_original', 'valor_aberto', 'valor_pago', 'valor_juros', 'valor_desconto', 'valor_ajustes',
    'data_vencimento', 'data_pagamento', 'data_emissao', 'data_entrada',
    'portador', 'conta', 'categoria_codigo', 'categoria_nome',
    'status', 'observacao', 'numero_documento', 'tipo_documento',
    'numero_documento_fiscal', 'chave_nfe', 'codigo_tipo_documento', 'numero_pedido', 'codigo_projeto'
  ];

  const sanitizedUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) sanitizedUpdates[key] = value;
  }

  if (Object.keys(sanitizedUpdates).length === 0) return apiResponse({ error: 'sem_alteracoes', message: 'Nenhum campo válido para atualização' }, 400, ctx.corsHeaders, ctx.startTime);

  // PR-13 / Onda 2 (2B) — pré-validar referências em /update (paridade com /incluir e /upsert).
  if (sanitizedUpdates.categoria_codigo !== undefined && sanitizedUpdates.categoria_codigo !== null) {
    const refCat = await validateReference(ctx.supabase, 'trade_chart_of_accounts', 'code', String(sanitizedUpdates.categoria_codigo), 'Categoria', 'categoria_codigo');
    if (!refCat.valid) {
      return apiResponse({ id, ...refCat.error! }, 400, ctx.corsHeaders, ctx.startTime);
    }
  }
  const fornecedorRef = (updates.codigo_cliente_fornecedor ?? updates.fornecedor_codigo);
  if (fornecedorRef !== undefined && fornecedorRef !== null) {
    const refForn = await validateReference(ctx.supabase, 'fornecedores', 'codigo_externo', String(fornecedorRef), 'Fornecedor', 'codigo_cliente_fornecedor');
    if (!refForn.valid) {
      return apiResponse({ id, ...refForn.error! }, 400, ctx.corsHeaders, ctx.startTime);
    }
  }

  sanitizedUpdates.updated_at = new Date().toISOString();

  const { data, error } = await ctx.supabase.from('contas_pagar').update(sanitizedUpdates).eq('id', id).select().single();

  if (error) {
    if (error.code === 'PGRST116') return apiResponse({ error: 'nao_encontrado', message: `Título ${id} não encontrado` }, 404, ctx.corsHeaders, ctx.startTime);
    if (typeof error.code === 'string' && error.code.startsWith('PGRST')) {
      return apiResponse({ error: 'pgrst', message: `Erro de schema/PostgREST (${error.code}): ${error.message}` }, 400, ctx.corsHeaders, ctx.startTime);
    }
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

  // PR-13 / Onda 2 (2G) — separar canceláveis de bloqueados (já pagos / inexistentes)
  // antes de aplicar UPDATE, para devolver erro granular em vez de silenciosamente pular.
  const { data: prelim, error: prelimErr } = await ctx.supabase.from('contas_pagar')
    .select('id, status, empresa_id').in('id', targetIds);
  if (prelimErr) throw prelimErr;

  const found = prelim || [];
  const foundIds = new Set(found.map((r: any) => r.id));
  const bloqueados: Array<{ id: string; motivo: string }> = [];
  const cancelaveisIds: string[] = [];

  for (const r of found) {
    if (r.status === 'pago') {
      bloqueados.push({ id: r.id, motivo: 'Título já pago — use /estornar primeiro' });
    } else if (r.status === 'cancelado') {
      bloqueados.push({ id: r.id, motivo: 'Título já cancelado' });
    } else {
      cancelaveisIds.push(r.id);
    }
  }
  for (const reqId of targetIds) {
    if (!foundIds.has(reqId)) bloqueados.push({ id: reqId, motivo: 'Título não encontrado' });
  }

  let cancelados: any[] = [];
  if (cancelaveisIds.length > 0) {
    const { data: updated, error } = await ctx.supabase.from('contas_pagar')
      .update({ status: 'cancelado', observacao: motivo, updated_at: new Date().toISOString() })
      .in('id', cancelaveisIds).select('id, status, empresa_id');
    if (error) throw error;
    cancelados = updated || [];
    for (const d of cancelados) {
      enqueueWebhookEvent('conta_pagar.cancelado', { id: d.id, motivo }, d.empresa_id).catch(() => {});
    }
  }

  logSuccess('cancelar', { ids: targetIds, cancelados: cancelados.length, bloqueados: bloqueados.length });

  return apiResponse({
    success: true,
    cancelados: cancelados.length,
    ids: cancelados.map((d: any) => d.id),
    bloqueados,
  }, 200, ctx.corsHeaders, ctx.startTime);
}

export async function handleIncluir(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return apiResponse({ error: 'Unauthorized' }, 401, ctx.corsHeaders, ctx.startTime);

  // PR-24: idempotência centralizada via withIdempotency no router (CP_IDEMPOTENT_ROUTES).
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

  // Onda 1 / 1B — pré-validar referências (fornecedor por erp_code, categoria por code)
  if (parsed.data.codigo_cliente_fornecedor) {
    const refForn = await validateReference(ctx.supabase, 'fornecedores', 'codigo_externo', String(parsed.data.codigo_cliente_fornecedor), 'Fornecedor', 'codigo_cliente_fornecedor');
    if (!refForn.valid) {
      return apiResponse({ codigo_lancamento_integracao: parsed.data.codigo_lancamento_integracao, ...refForn.error! }, 400, ctx.corsHeaders, ctx.startTime);
    }
  }
  if (parsed.data.codigo_categoria) {
    const refCat = await validateReference(ctx.supabase, 'trade_chart_of_accounts', 'code', String(parsed.data.codigo_categoria), 'Categoria', 'codigo_categoria');
    if (!refCat.valid) {
      return apiResponse({ codigo_lancamento_integracao: parsed.data.codigo_lancamento_integracao, ...refCat.error! }, 400, ctx.corsHeaders, ctx.startTime);
    }
  }

  const { codigo_lancamento_integracao, codigo_cliente_fornecedor, data_vencimento, valor_documento, codigo_categoria, data_previsao, data_emissao, id_conta_corrente, descricao: _desc, observacao: _obs, ...validRest } = parsed.data;

  const erp_id = `API-${codigo_lancamento_integracao}-${Date.now()}`;

  // PR-23 (v4.4.0): data_emissao + numero_documento + tipo_documento explicitamente persistidos.
  // Spread validRest cobre o restante (numero_documento_fiscal, chave_nfe, codigo_tipo_documento, numero_pedido, etc).
  const insertData: Record<string, unknown> = {
    erp_id, codigo_lancamento_integracao, codigo_cliente_fornecedor,
    data_vencimento: parseDate(data_vencimento), valor_original: valor_documento, valor_aberto: valor_documento,
    valor_pago: 0, categoria_codigo: codigo_categoria,
    data_previsao: parseDate(data_previsao),
    data_emissao: parseDate(data_emissao),
    id_conta_corrente, status: 'pendente', importado_api: true, empresa_id: parsed.data.empresa_id || 5,
    ...validRest
  };

  const { data, error } = await ctx.supabase.from('contas_pagar').insert(insertData).select('id, codigo_lancamento_huggs, codigo_lancamento_integracao').single();
  if (error) {
    if (error.code === '23505') return apiResponse({ codigo_lancamento_integracao, codigo_status: '2', descricao_status: 'Registro já existe com este código de integração. Use /upsert.' }, 409, ctx.corsHeaders, ctx.startTime);
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

  // PR-24: idempotência salva pelo withIdempotency no router.
  return apiResponse(responseBody, 201, ctx.corsHeaders, ctx.startTime);
}

// handleAlterar removido em v4.0.0 (PR-7) — use handleUpsert.

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

  // PR-24: idempotência centralizada via withIdempotency no router.
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

  // Onda 1 / 1B — pré-validar referências em upsert
  if (parsed.data.codigo_cliente_fornecedor) {
    const refForn = await validateReference(ctx.supabase, 'fornecedores', 'codigo_externo', String(parsed.data.codigo_cliente_fornecedor), 'Fornecedor', 'codigo_cliente_fornecedor');
    if (!refForn.valid) {
      return apiResponse({ codigo_lancamento_integracao: parsed.data.codigo_lancamento_integracao, ...refForn.error! }, 400, ctx.corsHeaders, ctx.startTime);
    }
  }
  if (parsed.data.codigo_categoria) {
    const refCat = await validateReference(ctx.supabase, 'trade_chart_of_accounts', 'code', String(parsed.data.codigo_categoria), 'Categoria', 'codigo_categoria');
    if (!refCat.valid) {
      return apiResponse({ codigo_lancamento_integracao: parsed.data.codigo_lancamento_integracao, ...refCat.error! }, 400, ctx.corsHeaders, ctx.startTime);
    }
  }

  const { codigo_lancamento_integracao } = parsed.data;
  const upsertData: Record<string, unknown> = { ...parsed.data };
  if (upsertData.valor_documento !== undefined) {
    upsertData.valor_original = upsertData.valor_documento;
    upsertData.valor_aberto = upsertData.valor_aberto ?? upsertData.valor_documento;
    delete upsertData.valor_documento;
  }
  // PR-12 / Onda 1 fix — schema drift: coluna real é categoria_codigo, não codigo_categoria.
  if (upsertData.codigo_categoria !== undefined) {
    upsertData.categoria_codigo = upsertData.codigo_categoria;
    delete upsertData.codigo_categoria;
  }
  if (upsertData.data_vencimento) upsertData.data_vencimento = parseDate(upsertData.data_vencimento as string);
  if (upsertData.data_previsao) upsertData.data_previsao = parseDate(upsertData.data_previsao as string);
  if (upsertData.data_emissao) upsertData.data_emissao = parseDate(upsertData.data_emissao as string);
  upsertData.importado_api = true;
  upsertData.updated_at = new Date().toISOString();

  // PR-12 — onConflict deve casar com constraint UNIQUE existente.
  // contas_pagar tem UNIQUE em (erp_id) e (erp_id, empresa_id). Geramos erp_id determinístico
  // a partir de (empresa_id, codigo_lancamento_integracao) para que upsert seja idempotente.
  const empresaIdForKey = parsed.data.empresa_id ?? 5;
  const erpIdKey = `API-${empresaIdForKey}-${codigo_lancamento_integracao}`;
  upsertData.erp_id = erpIdKey;

  // PR-12 — implementação manual de upsert (select → update OR insert) porque a tabela não
  // tem UNIQUE em (empresa_id, codigo_lancamento_integracao), e PostgREST cache pode rejeitar
  // onConflict sintético. Esta abordagem é segura, idempotente e expõe erros DB com clareza.
  const { data: existing } = await ctx.supabase.from('contas_pagar')
    .select('id, codigo_lancamento_huggs, codigo_lancamento_integracao')
    .eq('erp_id', erpIdKey).maybeSingle();

  let data: any, error: any;
  if (existing) {
    const upd = await ctx.supabase.from('contas_pagar')
      .update(upsertData).eq('erp_id', erpIdKey)
      .select('id, codigo_lancamento_huggs, codigo_lancamento_integracao').single();
    data = upd.data; error = upd.error;
  } else {
    const ins = await ctx.supabase.from('contas_pagar')
      .insert(upsertData)
      .select('id, codigo_lancamento_huggs, codigo_lancamento_integracao').single();
    data = ins.data; error = ins.error;
  }

  if (error) {
    if (error.code === '23505') return apiResponse({ codigo_lancamento_integracao, codigo_status: '2', descricao_status: 'Conflito de registro: ' + (error.message || 'duplicidade') }, 409, ctx.corsHeaders, ctx.startTime);
    if (error.code === '23503') return apiResponse({ codigo_lancamento_integracao, codigo_status: '1', descricao_status: `Referência inválida: ${error.details || error.message}` }, 400, ctx.corsHeaders, ctx.startTime);
    if (error.code === '23502') return apiResponse({ codigo_lancamento_integracao, codigo_status: '1', descricao_status: `Campo obrigatório ausente: ${error.message}` }, 400, ctx.corsHeaders, ctx.startTime);
    if (error.code === '22P02') return apiResponse({ codigo_lancamento_integracao, codigo_status: '1', descricao_status: `Formato inválido: ${error.message}` }, 400, ctx.corsHeaders, ctx.startTime);
    if (error.code === '42P10') return apiResponse({ codigo_lancamento_integracao, codigo_status: '1', descricao_status: `Configuração de upsert inválida no servidor: ${error.message}` }, 500, ctx.corsHeaders, ctx.startTime);
    if (typeof error.code === 'string' && error.code.startsWith('PGRST')) {
      return apiResponse({ codigo_lancamento_integracao, codigo_status: '1', descricao_status: `Erro de schema/PostgREST (${error.code}): ${error.message}` }, 400, ctx.corsHeaders, ctx.startTime);
    }
    throw error;
  }

  await logAuditEvent(ctx.supabase, 'api_upsert', { id: data.id, codigo_lancamento_integracao }, ctx.req);

  const responseBody = {
    codigo_lancamento_huggs: data.codigo_lancamento_huggs, codigo_lancamento_integracao: data.codigo_lancamento_integracao,
    codigo_status: '0', descricao_status: 'Upsert realizado com sucesso!',
  };

  // PR-24: idempotência salva pelo withIdempotency no router.
  return apiResponse(responseBody, 200, ctx.corsHeaders, ctx.startTime);
}

// PR-24 (Production Hardening): refactor batch — antes era N+1 (até 2000 queries por chamada de 500 itens).
// Agora: 2 queries de pré-validação (fornecedores + categorias por IN-clause) + 1 select + 1 upsert real PostgREST.
// Performance esperada: ~10s → <2s para 500 itens.
export async function handleUpsertLote(ctx: HandlerContext): Promise<Response> {
  if (!await ctx.validateAuth()) return apiResponse({ error: 'Unauthorized' }, 401, ctx.corsHeaders, ctx.startTime);

  // PR-24: idempotência centralizada via withIdempotency no router.
  const body = await ctx.req.json();
  const lote = body.lote || 1;
  const registros = body.conta_pagar_cadastro || body.registros || [];

  if (!Array.isArray(registros) || registros.length === 0) {
    return apiResponse({ lote, codigo_status: '1', descricao_status: 'Array conta_pagar_cadastro vazio ou inválido' }, 400, ctx.corsHeaders, ctx.startTime);
  }

  if (registros.length > 500) {
    return apiResponse({ lote, codigo_status: '1', descricao_status: 'Máximo 500 registros por lote' }, 413, ctx.corsHeaders, ctx.startTime);
  }

  // ===== Fase 1: validação Zod por item (rápida, em memória) =====
  type ValidEntry = { idx: number; raw: any; data: any };
  const validas: ValidEntry[] = [];
  const errosDetalhe: Array<{ codigo_lancamento_integracao?: string; descricao_status: string }> = [];
  let erros = 0;

  registros.forEach((reg: any, idx: number) => {
    const regParsed = UpsertSchema.safeParse(reg);
    if (!regParsed.success) {
      erros++;
      errosDetalhe.push({
        codigo_lancamento_integracao: reg?.codigo_lancamento_integracao,
        descricao_status: 'Payload inválido: ' + regParsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
      return;
    }
    validas.push({ idx, raw: reg, data: regParsed.data });
  });

  // ===== Fase 2: batch validate referências em 2 IN-queries =====
  const empresaIds = Array.from(new Set(validas.map(v => v.data.empresa_id).filter(Boolean) as number[]));
  const fornecedorCodes = Array.from(new Set(validas.map(v => v.data.codigo_cliente_fornecedor).filter(Boolean).map(String)));
  const categoriaCodes = Array.from(new Set(validas.map(v => v.data.codigo_categoria).filter(Boolean).map(String)));

  const [empresasRes, fornecedoresRes, categoriasRes] = await Promise.all([
    empresaIds.length ? ctx.supabase.from('empresas').select('id').in('id', empresaIds) : Promise.resolve({ data: [] }),
    fornecedorCodes.length ? ctx.supabase.from('fornecedores').select('codigo_externo').in('codigo_externo', fornecedorCodes) : Promise.resolve({ data: [] }),
    categoriaCodes.length ? ctx.supabase.from('trade_chart_of_accounts').select('code').in('code', categoriaCodes) : Promise.resolve({ data: [] }),
  ]);

  const empresasOk = new Set((empresasRes.data || []).map((r: any) => r.id));
  const fornecedoresOk = new Set((fornecedoresRes.data || []).map((r: any) => r.codigo_externo));
  const categoriasOk = new Set((categoriasRes.data || []).map((r: any) => r.code));

  const upsertRows: Record<string, unknown>[] = [];
  for (const v of validas) {
    if (v.data.empresa_id && !empresasOk.has(v.data.empresa_id)) {
      erros++;
      errosDetalhe.push({ codigo_lancamento_integracao: v.data.codigo_lancamento_integracao, descricao_status: `Empresa não encontrada: empresa_id '${v.data.empresa_id}'` });
      continue;
    }
    if (v.data.codigo_cliente_fornecedor && !fornecedoresOk.has(String(v.data.codigo_cliente_fornecedor))) {
      erros++;
      errosDetalhe.push({ codigo_lancamento_integracao: v.data.codigo_lancamento_integracao, descricao_status: `Fornecedor não encontrado: codigo_cliente_fornecedor '${v.data.codigo_cliente_fornecedor}'` });
      continue;
    }
    if (v.data.codigo_categoria && !categoriasOk.has(String(v.data.codigo_categoria))) {
      erros++;
      errosDetalhe.push({ codigo_lancamento_integracao: v.data.codigo_lancamento_integracao, descricao_status: `Categoria não encontrada: codigo_categoria '${v.data.codigo_categoria}'` });
      continue;
    }

    // Normalização de payload
    const upsertData: Record<string, unknown> = { ...v.data };
    if (upsertData.valor_documento !== undefined) {
      upsertData.valor_original = upsertData.valor_documento;
      upsertData.valor_aberto = upsertData.valor_aberto ?? upsertData.valor_documento;
      delete upsertData.valor_documento;
    }
    if (upsertData.codigo_categoria !== undefined) {
      upsertData.categoria_codigo = upsertData.codigo_categoria;
      delete upsertData.codigo_categoria;
    }
    if (upsertData.data_vencimento) upsertData.data_vencimento = parseDate(upsertData.data_vencimento as string);
    if (upsertData.data_previsao) upsertData.data_previsao = parseDate(upsertData.data_previsao as string);
    if (upsertData.data_emissao) upsertData.data_emissao = parseDate(upsertData.data_emissao as string);
    upsertData.importado_api = true;
    upsertData.updated_at = new Date().toISOString();

    const empresaIdForKey = v.data.empresa_id ?? 5;
    upsertData.erp_id = `API-${empresaIdForKey}-${v.data.codigo_lancamento_integracao}`;
    upsertRows.push(upsertData);
  }

  // ===== Fase 3: 1 upsert PostgREST real (onConflict=erp_id) =====
  let processados = 0;
  if (upsertRows.length > 0) {
    const { data: upserted, error: upErr } = await ctx.supabase
      .from('contas_pagar')
      .upsert(upsertRows, { onConflict: 'erp_id' })
      .select('id');
    if (upErr) {
      // Fallback: marca todos como erro mas devolve resposta granular (não 500 cego).
      const msg = (upErr as any).message || JSON.stringify(upErr);
      for (const row of upsertRows) {
        erros++;
        errosDetalhe.push({
          codigo_lancamento_integracao: row.codigo_lancamento_integracao as string | undefined,
          descricao_status: `DB error (${(upErr as any).code || '?'}): ${msg}`,
        });
      }
    } else {
      processados = upserted?.length || upsertRows.length;
    }
  }

  const responseBody = {
    lote, codigo_status: erros === 0 ? '0' : '1',
    descricao_status: `${processados} processado(s), ${erros} erro(s)`,
    total_processados: processados,
    total_erros: erros,
    erros: errosDetalhe.length > 0 ? errosDetalhe : undefined,
  };

  // PR-24: idempotência salva pelo withIdempotency no router.
  return apiResponse(responseBody, 200, ctx.corsHeaders, ctx.startTime);
}
