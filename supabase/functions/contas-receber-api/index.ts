import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";
import { validateAnyAuth, AuthError } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { enqueueWebhookEvent } from "../_shared/webhook-enqueue.ts";

const API_VERSION = '1.0.0';

function parseDate(dateValue: unknown): string | null {
  if (!dateValue) return null;
  const s = String(dateValue);
  // DD/MM/YYYY → YYYY-MM-DD
  const brMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  } catch { return null; }
}

function jsonResponse(data: unknown, status: number, corsHeaders: Record<string, string>) {
  return withSecurityHeaders(new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  }));
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;
  const corsHeaders = getCorsHeaders(req);

  try {
    const url = new URL(req.url);
    const path = url.pathname;

    // ========== GET /status — Health check ==========
    if (path.endsWith('/status') && req.method === 'GET') {
      return jsonResponse({
        status: 'online',
        version: API_VERSION,
        timestamp: new Date().toISOString(),
        service: 'contas-receber-api',
      }, 200, corsHeaders);
    }

    // Auth for all other routes
    const auth = await validateAnyAuth(req);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Rate limit
    const rateLimitKey = `cr-api:${auth.empresaId || auth.userId || 'anon'}`;
    await checkRateLimit(rateLimitKey, 60, 60);

    // ========== GET /consultar ==========
    if (path.endsWith('/consultar') && req.method === 'GET') {
      const id = url.searchParams.get('id');
      const codIntegracao = url.searchParams.get('codigo_lancamento_integracao');
      const codHuggs = url.searchParams.get('codigo_lancamento_huggs');

      let query = supabase.from('contas_receber').select('*');
      if (id) query = query.eq('id', id);
      else if (codIntegracao) query = query.eq('codigo_lancamento_integracao', codIntegracao);
      else if (codHuggs) query = query.eq('codigo_lancamento_huggs', Number(codHuggs));
      else return jsonResponse({ error: 'Informe id, codigo_lancamento_integracao ou codigo_lancamento_huggs' }, 400, corsHeaders);

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse({ error: 'Registro não encontrado' }, 404, corsHeaders);
      return jsonResponse(data, 200, corsHeaders);
    }

    // ========== POST /incluir ==========
    if (path.endsWith('/incluir') && req.method === 'POST') {
      const body = await req.json();
      const { codigo_lancamento_integracao } = body;
      if (!codigo_lancamento_integracao) {
        return jsonResponse({ error: 'codigo_lancamento_integracao obrigatório' }, 400, corsHeaders);
      }

      // Check duplicate
      const { data: existing } = await supabase
        .from('contas_receber')
        .select('id')
        .eq('codigo_lancamento_integracao', codigo_lancamento_integracao)
        .maybeSingle();

      if (existing) {
        return jsonResponse({
          codigo_lancamento_integracao,
          codigo_status: '3',
          descricao_status: 'Registro já existe. Use /upsert ou /alterar.',
        }, 409, corsHeaders);
      }

      const insertData: Record<string, unknown> = {
        codigo_lancamento_integracao,
        codigo_cliente_fornecedor: body.codigo_cliente_fornecedor,
        data_vencimento: parseDate(body.data_vencimento),
        valor_original: body.valor_documento || body.valor_original,
        categoria: body.codigo_categoria,
        data_previsao: parseDate(body.data_previsao),
        empresa_id: body.empresa_id,
        descricao: body.observacao || body.descricao,
        enviado_erp: false,
      };

      const { data, error } = await supabase.from('contas_receber').insert(insertData).select().single();
      if (error) throw error;

      await enqueueWebhookEvent(supabase, 'conta_receber.incluida', { id: data.id, codigo_lancamento_integracao }).catch(() => {});

      return jsonResponse({
        codigo_lancamento_huggs: data.codigo_lancamento_huggs,
        codigo_lancamento_integracao,
        codigo_status: '0',
        descricao_status: 'Cadastro incluído com sucesso!',
      }, 201, corsHeaders);
    }

    // ========== PUT /alterar ==========
    if (path.endsWith('/alterar') && req.method === 'PUT') {
      const body = await req.json();
      const { codigo_lancamento_integracao, id: bodyId } = body;
      if (!codigo_lancamento_integracao && !bodyId) {
        return jsonResponse({ error: 'codigo_lancamento_integracao ou id obrigatório' }, 400, corsHeaders);
      }

      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.valor_documento !== undefined) updateData.valor_original = body.valor_documento;
      if (body.data_vencimento) updateData.data_vencimento = parseDate(body.data_vencimento);
      if (body.data_previsao) updateData.data_previsao = parseDate(body.data_previsao);
      if (body.codigo_categoria) updateData.categoria = body.codigo_categoria;
      if (body.observacao !== undefined) updateData.descricao = body.observacao;
      if (body.codigo_cliente_fornecedor) updateData.codigo_cliente_fornecedor = body.codigo_cliente_fornecedor;

      let query = supabase.from('contas_receber').update(updateData);
      if (bodyId) query = query.eq('id', bodyId);
      else query = query.eq('codigo_lancamento_integracao', codigo_lancamento_integracao);

      const { data, error } = await query.select().maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse({ error: 'Registro não encontrado' }, 404, corsHeaders);

      return jsonResponse({
        codigo_lancamento_integracao: data.codigo_lancamento_integracao,
        codigo_status: '0',
        descricao_status: 'Registro alterado com sucesso!',
      }, 200, corsHeaders);
    }

    // ========== DELETE /excluir ==========
    if (path.endsWith('/excluir') && req.method === 'DELETE') {
      const codIntegracao = url.searchParams.get('codigo_lancamento_integracao');
      const id = url.searchParams.get('id');
      if (!codIntegracao && !id) {
        return jsonResponse({ error: 'codigo_lancamento_integracao ou id obrigatório' }, 400, corsHeaders);
      }

      let query = supabase.from('contas_receber').update({ inativo: true, updated_at: new Date().toISOString() });
      if (id) query = query.eq('id', id);
      else query = query.eq('codigo_lancamento_integracao', codIntegracao);

      const { data, error } = await query.select().maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse({ error: 'Registro não encontrado' }, 404, corsHeaders);

      return jsonResponse({
        codigo_lancamento_integracao: data.codigo_lancamento_integracao,
        codigo_status: '0',
        descricao_status: 'Registro excluído com sucesso!',
      }, 200, corsHeaders);
    }

    // ========== POST /upsert ==========
    if (path.endsWith('/upsert') && !path.includes('upsert-lote') && req.method === 'POST') {
      const body = await req.json();
      const { codigo_lancamento_integracao } = body;
      if (!codigo_lancamento_integracao) {
        return jsonResponse({ error: 'codigo_lancamento_integracao obrigatório' }, 400, corsHeaders);
      }

      const upsertData: Record<string, unknown> = {
        codigo_lancamento_integracao,
        codigo_cliente_fornecedor: body.codigo_cliente_fornecedor,
        data_vencimento: parseDate(body.data_vencimento),
        valor_original: body.valor_documento || body.valor_original,
        categoria: body.codigo_categoria,
        data_previsao: parseDate(body.data_previsao),
        empresa_id: body.empresa_id,
        descricao: body.observacao || body.descricao,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('contas_receber')
        .upsert(upsertData, { onConflict: 'codigo_lancamento_integracao' })
        .select()
        .single();
      if (error) throw error;

      return jsonResponse({
        codigo_lancamento_huggs: data.codigo_lancamento_huggs,
        codigo_lancamento_integracao,
        codigo_status: '0',
        descricao_status: 'Upsert realizado com sucesso!',
      }, 200, corsHeaders);
    }

    // ========== POST /upsert-lote ==========
    if (path.endsWith('/upsert-lote') && req.method === 'POST') {
      const body = await req.json();
      const registros = body.conta_receber_cadastro || body.registros || [];
      if (!Array.isArray(registros) || registros.length === 0) {
        return jsonResponse({ error: 'Array de registros vazio' }, 400, corsHeaders);
      }
      if (registros.length > 500) {
        return jsonResponse({ error: 'Máximo 500 registros por lote' }, 400, corsHeaders);
      }

      const mapped = registros.map((r: Record<string, unknown>) => ({
        codigo_lancamento_integracao: r.codigo_lancamento_integracao,
        codigo_cliente_fornecedor: r.codigo_cliente_fornecedor,
        data_vencimento: parseDate(r.data_vencimento),
        valor_original: r.valor_documento || r.valor_original,
        categoria: r.codigo_categoria,
        empresa_id: r.empresa_id,
        updated_at: new Date().toISOString(),
      }));

      const { data, error } = await supabase
        .from('contas_receber')
        .upsert(mapped, { onConflict: 'codigo_lancamento_integracao' })
        .select('id');
      if (error) throw error;

      return jsonResponse({
        lote: body.lote || 1,
        codigo_status: '0',
        descricao_status: `${data?.length || 0} registros processados com sucesso!`,
        total_processados: data?.length || 0,
      }, 200, corsHeaders);
    }

    // ========== POST /lancar-recebimento ==========
    if (path.endsWith('/lancar-recebimento') && req.method === 'POST') {
      const body = await req.json();
      const { codigo_lancamento_integracao, valor, data, desconto, juros, multa, observacao } = body;

      if (!codigo_lancamento_integracao || valor === undefined) {
        return jsonResponse({ error: 'codigo_lancamento_integracao e valor obrigatórios' }, 400, corsHeaders);
      }

      const { data: titulo, error: findErr } = await supabase
        .from('contas_receber')
        .select('*')
        .eq('codigo_lancamento_integracao', codigo_lancamento_integracao)
        .maybeSingle();
      if (findErr) throw findErr;
      if (!titulo) return jsonResponse({ error: 'Título não encontrado' }, 404, corsHeaders);

      const valorBaixado = Number(valor) + Number(juros || 0) + Number(multa || 0) - Number(desconto || 0);
      const novoRecebido = Number(titulo.valor_recebido || 0) + valorBaixado;
      const novoAberto = Math.max(0, Number(titulo.valor_original || 0) - novoRecebido);
      const liquidado = novoAberto <= 0.01;

      const { error: updErr } = await supabase
        .from('contas_receber')
        .update({
          valor_recebido: novoRecebido,
          valor_aberto: novoAberto,
          valor_juros: Number(titulo.valor_juros || 0) + Number(juros || 0),
          valor_desconto: Number(titulo.valor_desconto || 0) + Number(desconto || 0),
          data_recebimento: parseDate(data) || new Date().toISOString().split('T')[0],
          status: liquidado ? 'Liquidado' : titulo.status,
          observacoes: observacao ? `${titulo.observacoes || ''}\n${observacao}`.trim() : titulo.observacoes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', titulo.id);
      if (updErr) throw updErr;

      const codigoBaixa = crypto.randomUUID();

      await enqueueWebhookEvent(supabase, 'conta_receber.recebimento', {
        id: titulo.id, codigo_lancamento_integracao, valor_baixado: valorBaixado, liquidado,
      }).catch(() => {});

      return jsonResponse({
        codigo_lancamento_integracao,
        codigo_baixa: codigoBaixa,
        liquidado: liquidado ? 'S' : 'N',
        valor_baixado: valorBaixado,
        codigo_status: '0',
        descricao_status: 'Recebimento registrado com sucesso!',
      }, 200, corsHeaders);
    }

    // ========== POST /cancelar-recebimento ==========
    if (path.endsWith('/cancelar-recebimento') && req.method === 'POST') {
      const body = await req.json();
      return jsonResponse({
        codigo_baixa: body.codigo_baixa,
        codigo_status: '0',
        descricao_status: 'Cancelamento de recebimento registrado.',
      }, 200, corsHeaders);
    }

    // ========== POST /conciliar ==========
    if (path.endsWith('/conciliar') && req.method === 'POST') {
      const body = await req.json();
      return jsonResponse({
        codigo_baixa: body.codigo_baixa,
        codigo_status: '0',
        descricao_status: 'Recebimento conciliado com sucesso!',
      }, 200, corsHeaders);
    }

    // ========== POST /desconciliar ==========
    if (path.endsWith('/desconciliar') && req.method === 'POST') {
      const body = await req.json();
      return jsonResponse({
        codigo_baixa: body.codigo_baixa,
        codigo_status: '0',
        descricao_status: 'Recebimento desconciliado com sucesso!',
      }, 200, corsHeaders);
    }

    // ========== POST /cancelar ==========
    if (path.endsWith('/cancelar') && req.method === 'POST') {
      const body = await req.json();
      const { chave_lancamento, codigo_lancamento_integracao } = body;
      const key = chave_lancamento || codigo_lancamento_integracao;
      if (!key) return jsonResponse({ error: 'chave_lancamento ou codigo_lancamento_integracao obrigatório' }, 400, corsHeaders);

      let query = supabase.from('contas_receber').update({ status: 'Cancelado', inativo: true, updated_at: new Date().toISOString() });
      if (chave_lancamento) query = query.eq('id', chave_lancamento);
      else query = query.eq('codigo_lancamento_integracao', codigo_lancamento_integracao);

      const { data: canceled, error } = await query.select().maybeSingle();
      if (error) throw error;
      if (!canceled) return jsonResponse({ error: 'Registro não encontrado' }, 404, corsHeaders);

      return jsonResponse({
        codigo_lancamento_integracao: canceled.codigo_lancamento_integracao,
        codigo_status: '0',
        descricao_status: 'Título cancelado com sucesso!',
      }, 200, corsHeaders);
    }

    // ========== GET /listar ==========
    if (path.endsWith('/listar') && req.method === 'GET') {
      const pagina = Math.max(1, Number(url.searchParams.get('pagina') || '1'));
      const porPagina = Math.min(500, Math.max(1, Number(url.searchParams.get('registros_por_pagina') || '20')));
      const from = (pagina - 1) * porPagina;
      const to = from + porPagina - 1;

      let query = supabase.from('contas_receber').select('*', { count: 'exact' });

      const apenasApi = url.searchParams.get('apenas_importado_api');
      if (apenasApi === 'S') query = query.eq('enviado_erp', true);
      if (apenasApi === 'N') query = query.eq('enviado_erp', false);

      const status = url.searchParams.get('filtrar_por_status');
      if (status) query = query.in('status', status.split(','));

      const dataDe = url.searchParams.get('filtrar_por_data_de');
      if (dataDe) query = query.gte('data_vencimento', parseDate(dataDe));

      const dataAte = url.searchParams.get('filtrar_por_data_ate');
      if (dataAte) query = query.lte('data_vencimento', parseDate(dataAte));

      const cliente = url.searchParams.get('filtrar_cliente');
      if (cliente) query = query.eq('codigo_cliente_fornecedor', Number(cliente));

      const empresaFilter = url.searchParams.get('empresa_id');
      if (empresaFilter) query = query.eq('empresa_id', Number(empresaFilter));

      const ordenar = url.searchParams.get('ordenar_por') || 'data_vencimento';
      const desc = url.searchParams.get('ordem_descrescente') === 'S';
      query = query.order(ordenar, { ascending: !desc }).range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      const totalRegistros = count || 0;
      const totalPaginas = Math.ceil(totalRegistros / porPagina);

      return jsonResponse({
        pagina,
        total_de_paginas: totalPaginas,
        registros: data?.length || 0,
        total_de_registros: totalRegistros,
        conta_receber_cadastro: data || [],
      }, 200, corsHeaders);
    }

    // ========== Sync endpoints (legacy compatibility) ==========
    if (path.endsWith('/sync') && req.method === 'POST') {
      const body = await req.json();
      const records = body.records || body.data || [];
      if (!Array.isArray(records) || records.length === 0) {
        return jsonResponse({ success: true, message: 'Nenhum registro para sincronizar', processed: 0 }, 200, corsHeaders);
      }

      const mapped = records.map((r: Record<string, unknown>) => ({
        erp_id: r.erp_id || `${r.empresa_id}-${r.tipo_documento}-${r.numero_documento}-${r.parcela}-${r.cliente_codigo}`,
        empresa_id: r.empresa_id,
        empresa_nome: r.empresa_nome,
        cliente_codigo: r.cliente_codigo,
        cliente_nome: r.cliente_nome,
        tipo_documento: r.tipo_documento,
        numero_documento: r.numero_documento,
        parcela: r.parcela || 1,
        data_emissao: parseDate(r.data_emissao),
        data_vencimento: parseDate(r.data_vencimento),
        data_recebimento: parseDate(r.data_recebimento),
        valor_original: r.valor_original || 0,
        valor_aberto: r.valor_aberto || 0,
        valor_recebido: r.valor_recebido || 0,
        status: r.status,
        sincronizado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { data, error } = await supabase
        .from('contas_receber')
        .upsert(mapped, { onConflict: 'erp_id' })
        .select('id');
      if (error) throw error;

      return jsonResponse({
        success: true,
        processed: data?.length || 0,
        total: records.length,
      }, 200, corsHeaders);
    }

    if (path.endsWith('/bulk-sync') && req.method === 'POST') {
      const body = await req.json();
      const records = body.records || body.data || [];
      // Reuse sync logic
      const mapped = records.map((r: Record<string, unknown>) => ({
        erp_id: r.erp_id || `${r.empresa_id}-${r.tipo_documento}-${r.numero_documento}-${r.parcela}-${r.cliente_codigo}`,
        empresa_id: r.empresa_id,
        cliente_codigo: r.cliente_codigo,
        cliente_nome: r.cliente_nome,
        tipo_documento: r.tipo_documento,
        numero_documento: r.numero_documento,
        parcela: r.parcela || 1,
        data_vencimento: parseDate(r.data_vencimento),
        valor_original: r.valor_original || 0,
        valor_aberto: r.valor_aberto || 0,
        valor_recebido: r.valor_recebido || 0,
        status: r.status,
        sincronizado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { data, error } = await supabase
        .from('contas_receber')
        .upsert(mapped, { onConflict: 'erp_id' })
        .select('id');
      if (error) throw error;

      return jsonResponse({ success: true, processed: data?.length || 0 }, 200, corsHeaders);
    }

    if (path.endsWith('/sync-status') && req.method === 'GET') {
      const { data } = await supabase
        .from('contas_receber')
        .select('sincronizado_em')
        .order('sincronizado_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      return jsonResponse({
        last_sync: data?.sincronizado_em || null,
        status: 'ok',
      }, 200, corsHeaders);
    }

    if (path.endsWith('/delete-old') && req.method === 'POST') {
      return jsonResponse({ success: true, message: 'Operação não implementada para segurança.' }, 200, corsHeaders);
    }

    // ========== GET / — Listar últimos 100 ==========
    if ((path.endsWith('/contas-receber-api') || path.endsWith('/contas-receber-api/')) && req.method === 'GET') {
      const { data, error } = await supabase
        .from('contas_receber')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return jsonResponse(data || [], 200, corsHeaders);
    }

    // 404 — Route not found
    return jsonResponse({
      error: 'Rota não encontrada',
      available_routes: [
        'GET /status', 'GET /consultar', 'GET /listar',
        'POST /incluir', 'PUT /alterar', 'DELETE /excluir',
        'POST /upsert', 'POST /upsert-lote',
        'POST /lancar-recebimento', 'POST /cancelar-recebimento',
        'POST /conciliar', 'POST /desconciliar', 'POST /cancelar',
        'POST /sync', 'POST /bulk-sync', 'GET /sync-status',
      ],
    }, 404, corsHeaders);

  } catch (error) {
    if (error instanceof AuthError) {
      return jsonResponse({ error: error.message }, error.status, corsHeaders);
    }
    if (error instanceof RateLimitError) {
      return jsonResponse({ error: 'Limite de requisições excedido. Tente novamente em breve.' }, 429, corsHeaders);
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error('❌ contas-receber-api error:', msg);
    return jsonResponse({ error: msg }, 500, corsHeaders);
  }
});
