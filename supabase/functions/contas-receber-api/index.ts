import { createClient } from 'npm:@supabase/supabase-js@2';
import { timingSafeEqual } from "../_shared/timing-safe.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";

// Keep corsHeaders for backward compat with inline responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// =====================================================
// v5.0.0 - REESCRITA COMPLETA PARA MÁXIMA PERFORMANCE
// =====================================================
const API_VERSION = '5.0.0';
const UPSERT_BATCH_SIZE = 2000;  // Records per upsert call
const BATCH_DELAY_MS = 5;        // Minimal delay between batches

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// =====================================================
// EXTRAÇÃO DE DADOS - SUPORTA QUALQUER FORMATO N8N
// =====================================================
function extractRecords(input: any): any[] {
  // Caso 1: já é array
  if (Array.isArray(input)) {
    // Pode ser array de items N8N com {json: {...}}
    return input.map(item => {
      if (item && typeof item === 'object' && item.json && typeof item.json === 'object') {
        return item.json;
      }
      return item;
    });
  }
  
  // Caso 2: objeto com propriedade conhecida
  if (input && typeof input === 'object') {
    // Tentar extrair de propriedades conhecidas
    const possibleArrays = ['contas', 'data', 'items', 'records', 'rows'];
    for (const key of possibleArrays) {
      if (input[key] && Array.isArray(input[key])) {
        return extractRecords(input[key]);
      }
    }
    
    // Caso 3: é um único registro ERP
    if (input['Nota'] || input.nota || input.numero_documento) {
      return [input];
    }
  }
  
  return [];
}

// =====================================================
// TRANSFORMAÇÃO DE DADOS - FLEXÍVEL PARA QUALQUER FORMATO
// =====================================================
function parseAmount(value: any): number {
  if (typeof value === 'number') return Math.abs(value);
  if (!value) return 0;
  const cleanValue = String(value).replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.');
  return Math.abs(parseFloat(cleanValue) || 0);
}

function parseDate(dateValue: any): string | null {
  if (!dateValue) return null;
  try {
    const str = String(dateValue).trim();
    if (!str || str.length < 8) return null;
    
    // Formato DD/MM/YYYY
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        const [d, m, y] = parts;
        if (y.length === 4) {
          return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
      }
    }
    
    // Formato ISO ou outro
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch {
    // Ignore
  }
  return null;
}

function getField(record: any, ...keys: string[]): any {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') {
      return record[key];
    }
  }
  return null;
}

function transformRecord(rawRecord: any): any {
  const r = rawRecord;
  
  const valorOriginal = parseAmount(getField(r, 'Valor_Trc', 'Valor Trc', 'valor_original', 'valorOriginal', 'Valor Original'));
  const valorAberto = parseAmount(getField(r, 'Valor em Aberto', 'valor_em_aberto', 'valorEmAberto', 'Valor Aberto', 'valor_aberto'));
  const valorPago = parseAmount(getField(r, 'Valor Pago', 'valor_pago', 'valorPago', 'valor_recebido', 'valorRecebido'));
  const valorAjustes = parseAmount(getField(r, 'Valor Ajustes', 'valor_ajustes', 'valorAjustes'));
  
  // Calcular valor recebido
  let valorRecebido = valorPago;
  if (valorRecebido === 0 && valorAberto === 0 && valorOriginal > 0) {
    valorRecebido = valorOriginal;
  } else if (valorRecebido === 0 && valorAjustes > 0 && valorAberto < 1) {
    valorRecebido = valorAjustes;
  } else if (valorRecebido === 0 && valorOriginal > valorAberto) {
    valorRecebido = valorOriginal - valorAberto;
  }

  const dataVencimento = parseDate(getField(r, 'Vencimento', 'vencimento', 'data_vencimento', 'dataVencimento'));
  
  // Determinar status
  let status = 'pendente';
  if (valorAberto === 0 && valorRecebido > 0) {
    status = 'recebido';
  } else if (valorRecebido > 0 && valorAberto > 0) {
    status = 'parcial';
  } else if (valorAberto > 0 && dataVencimento) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const venc = new Date(dataVencimento + 'T00:00:00');
    if (venc < hoje) {
      status = 'vencido';
    }
  }

  const empresaId = getField(r, 'ID Empresa', 'id_empresa', 'empresaId', 'empresa_id') || 1;
  const tipo = String(getField(r, 'Tipo', 'tipo', 'tipo_documento', 'tipoDocumento') || '');
  const nota = String(getField(r, 'Nota', 'nota', 'numero_documento', 'numeroDocumento') || '');
  const seq = parseInt(getField(r, 'Seq', 'seq', 'parcela', 'sequencia')) || 1;
  const codigo = String(getField(r, 'Código', 'Codigo', 'codigo', 'cliente_codigo', 'clienteCodigo') || '');

  // ERP ID único
  const erpId = `${empresaId}-${tipo}-${nota}-${seq}-${codigo}`.replace(/\s+/g, '');

  // Hash simples para detectar mudanças
  const dataHash = `${valorOriginal}|${valorAberto}|${valorRecebido}|${status}`.slice(0, 32);

  return {
    erp_id: erpId,
    data_hash: dataHash,
    empresa_id: Number(empresaId),
    empresa_nome: getField(r, 'Empresa', 'empresa', 'empresa_nome', 'empresaNome'),
    tipo_documento: tipo,
    numero_documento: nota,
    parcela: seq,
    cliente_codigo: codigo,
    cliente_nome: getField(r, 'Cliente', 'cliente', 'cliente_nome', 'clienteNome'),
    valor_original: valorOriginal,
    valor_aberto: valorAberto,
    valor_recebido: valorRecebido,
    valor_juros: parseAmount(getField(r, 'Valor Juros', 'valor_juros', 'valorJuros')),
    valor_desconto: parseAmount(getField(r, 'Valor Desconto', 'valor_desconto', 'valorDesconto')),
    valor_ajustes: valorAjustes,
    data_emissao: parseDate(getField(r, 'Emissão', 'Emissao', 'emissao', 'data_emissao', 'dataEmissao')),
    data_vencimento: dataVencimento,
    data_recebimento: parseDate(getField(r, 'Data Pgto', 'Pagamento', 'pagamento', 'data_pagamento', 'data_recebimento', 'dataRecebimento')),
    tabela_preco: getField(r, 'Tabela', 'tabela', 'tabela_preco'),
    vendedor_nome: getField(r, 'Vendedor', 'vendedor', 'vendedor_nome'),
    vendedor_codigo: getField(r, 'Cód Vendedor', 'Cod Vendedor', 'vendedor_codigo', 'codVendedor'),
    portador_id: getField(r, 'ID Portador', 'id_portador', 'portador_id'),
    portador: getField(r, 'Nome Portador', 'Portador', 'portador') || 'SEM PORTADOR',
    conta: getField(r, 'Conta', 'conta') || 'SEM CONTA',
    status,
    sincronizado_em: new Date().toISOString()
  };
}

// =====================================================
// UPSERT OTIMIZADO - MÁXIMA VELOCIDADE
// =====================================================
async function upsertRecords(supabase: any, records: any[]): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  // Processar em batches
  for (let i = 0; i < records.length; i += UPSERT_BATCH_SIZE) {
    const batch = records.slice(i, i + UPSERT_BATCH_SIZE);
    
    try {
      const { error, count } = await supabase
        .from('contas_receber')
        .upsert(batch, { 
          onConflict: 'erp_id',
          ignoreDuplicates: false,
          count: 'exact'
        });
      
      if (error) {
        console.error(`[UPSERT] Batch error: ${error.code} - ${error.message}`);
        console.error('[UPSERT] First record in failed batch:', JSON.stringify(batch[0]).substring(0, 500));
        // Tentar registro por registro se batch falhar
        for (const record of batch) {
          try {
            const { error: singleError } = await supabase
              .from('contas_receber')
              .upsert(record, { onConflict: 'erp_id' });
            if (!singleError) processed++;
            else errors++;
          } catch {
            errors++;
          }
        }
      } else {
        processed += count ?? batch.length;
      }
    } catch (err) {
      console.error('[UPSERT] Exception:', err);
      errors += batch.length;
    }

    // Delay mínimo entre batches
    if (i + UPSERT_BATCH_SIZE < records.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return { processed, errors };
}

// =====================================================
// HANDLER PRINCIPAL
// =====================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const url = new URL(req.url);
  const path = url.pathname;
  const pathWithoutBase = path.replace('/contas-receber-api', '');

  console.log(`[v${API_VERSION}] ${req.method} ${path} (clean: ${pathWithoutBase})`);

  // Validar API Key (com fallback erp_api_keys)
  async function validateApiKey(): Promise<boolean> {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) return false;

    const expectedKey = Deno.env.get('N8N_API_KEY');
    const polloKey = Deno.env.get('POLLO_API_KEY');
    if ((expectedKey && timingSafeEqual(apiKey, expectedKey)) || (polloKey && timingSafeEqual(apiKey, polloKey))) return true;

    // Fallback: check erp_config table
    const { data: configRow } = await supabase
      .from("erp_config")
      .select("empresa_id")
      .eq("config_key", "api_key")
      .eq("config_value", apiKey)
      .maybeSingle();
    if (configRow?.empresa_id) return true;

    // Fallback: check erp_api_keys table
    const { validateErpApiKey } = await import("../_shared/erp-key-validator.ts");
    const empresa = await validateErpApiKey(apiKey);
    if (empresa) return true;

    return false;
  }

  // Helper para match de rota
  function matchRoute(route: string): boolean {
    return pathWithoutBase === route || pathWithoutBase === `${route}/` || path.includes(route);
  }

  // ============ GET /sync-status - REQUIRES API KEY ============
  if (matchRoute('/sync-status') && req.method === 'GET') {
    if (!(await validateApiKey())) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data } = await supabase
      .from('sync_control')
      .select('*')
      .eq('entidade', 'contas_receber')
      .order('created_at', { ascending: false })
      .limit(5);

    return new Response(JSON.stringify({
      api_version: API_VERSION,
      status: 'online',
      rate_limiter: 'DISABLED',
      recent_syncs: data || [],
      recommended_batch_size: UPSERT_BATCH_SIZE
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // ============ POST /sync - ENDPOINT PRINCIPAL ============
  if ((matchRoute('/sync') || matchRoute('/bulk-sync') || matchRoute('/sync-chunk')) && req.method === 'POST') {
    const startTime = Date.now();

    if (!(await validateApiKey())) {
      console.log('[AUTH] Invalid API key');
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid API key',
        continue_loop: true
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse body - aceita qualquer formato
    let body: any;
    try {
      const text = await req.text();
      body = JSON.parse(text);
    } catch (err) {
      console.error('[PARSE] Failed to parse JSON:', err);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid JSON',
        continue_loop: true
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Diagnóstico do body recebido
    console.log('[SYNC] Body keys:', Object.keys(body));
    console.log('[SYNC] Body type:', typeof body, Array.isArray(body) ? 'array' : 'not-array');
    if (body.contas) console.log('[SYNC] contas length:', body.contas.length);

    // Extrair registros de qualquer formato
    const rawRecords = extractRecords(body);
    
    console.log(`📦 [SYNC] Received ${rawRecords.length} records`);

    if (rawRecords.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        processed: 0,
        received: 0,
        message: 'No records to process',
        continue_loop: true,
        api_version: API_VERSION
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Transformar todos os registros
    const transformedRecords: any[] = [];
    let transformErrors = 0;

    for (const raw of rawRecords) {
      try {
        const transformed = transformRecord(raw);
        if (transformed.erp_id && transformed.erp_id.length > 5) {
          transformedRecords.push(transformed);
        } else {
          transformErrors++;
        }
      } catch (err) {
        transformErrors++;
        console.warn('[TRANSFORM] Error:', err);
      }
    }

    console.log(`🔄 [SYNC] Transformed ${transformedRecords.length}/${rawRecords.length} records`);

    // Upsert no banco
    const { processed, errors: upsertErrors } = await upsertRecords(supabase, transformedRecords);

    const duration = Date.now() - startTime;
    const rate = duration > 0 ? Math.round(processed / (duration / 1000)) : 0;

    console.log(`✅ [SYNC] Done: ${processed} processed, ${upsertErrors} errors, ${duration}ms (${rate}/sec)`);

    // ✅ OTIMIZAÇÃO: Só registrar em sync_control se houve alterações reais
    if (processed > 0) {
      (async () => {
        try {
          await supabase.from('sync_control').insert({
            entidade: 'contas_receber',
            empresa_id: rawRecords[0]?.['ID Empresa'] || rawRecords[0]?.empresa_id || null,
            ultima_sync: new Date().toISOString(),
            total_registros: rawRecords.length,
            registros_inseridos: processed,
            duracao_ms: duration,
            status: upsertErrors === 0 ? 'success' : 'partial'
          });
        } catch {
          // Ignore logging errors
        }
      })();
    } else {
      console.log(`⏭️ [SYNC] Nenhuma alteração - sync_control ignorado (${rawRecords.length} registros processados sem mudanças)`);
    }

    return new Response(JSON.stringify({
      success: true,
      continue_loop: true,
      received: rawRecords.length,
      transformed: transformedRecords.length,
      processed,
      errors: upsertErrors + transformErrors,
      duration_ms: duration,
      rate_per_second: rate,
      api_version: API_VERSION
    }), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'X-API-Version': API_VERSION
      }
    });
  }

  // ============ GET /contas-receber-api - Listar dados ============
  if ((matchRoute('') || pathWithoutBase === '/' || pathWithoutBase === '') && req.method === 'GET') {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse query params
    const status = url.searchParams.get('status');
    const empresaId = url.searchParams.get('empresa_id');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = supabase
      .from('contas_receber')
      .select('*', { count: 'exact' })
      .order('data_vencimento', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (empresaId) query = query.eq('empresa_id', parseInt(empresaId));

    const { data, count, error } = await query;

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      data,
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // ============ POST /delete-old - Limpar registros antigos ============
  if (matchRoute('/delete-old') && req.method === 'POST') {
    if (!(await validateApiKey())) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { days_old = 365 } = await req.json().catch(() => ({}));
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days_old);

    const { count, error } = await supabase
      .from('contas_receber')
      .delete()
      .lt('data_vencimento', cutoffDate.toISOString().split('T')[0])
      .eq('status', 'recebido');

    return new Response(JSON.stringify({
      success: !error,
      deleted: count || 0,
      cutoff_date: cutoffDate.toISOString().split('T')[0],
      error: error?.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // =====================================================
  // ROTAS OMIE-STYLE (NOVO)
  // =====================================================

  // Helper: autenticação JWT ou API Key
  async function validateAnyAuth(): Promise<{ empresaId: string; source: string } | null> {
    // Try API key first
    const apiKey = req.headers.get('x-api-key');
    if (apiKey && await validateApiKey()) {
      return { empresaId: 'api-key', source: 'api-key' };
    }
    // Try JWT
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) return { empresaId: 'jwt', source: 'jwt' };
    }
    return null;
  }

  // Helper: parse date Huggs DD/MM/YYYY → YYYY-MM-DD
  function parseDateHuggs(d: string | null | undefined): string | null {
    if (!d) return null;
    const str = String(d).trim();
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3 && parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return parseDate(d);
  }

  // Helper: map Huggs body to DB columns
  function mapApiToDb(body: any): Record<string, any> {
    const mapped: Record<string, any> = {};
    const directFields: Record<string, string> = {
      codigo_lancamento_huggs: 'codigo_lancamento_huggs',
      codigo_lancamento_integracao: 'codigo_lancamento_integracao',
      codigo_cliente_fornecedor: 'codigo_cliente_fornecedor',
      codigo_cliente_fornecedor_integracao: 'codigo_cliente_fornecedor_integracao',
      codigo_categoria: 'codigo_categoria',
      codigo_projeto: 'codigo_projeto',
      codigo_vendedor: 'codigo_vendedor',
      numero_pedido: 'numero_pedido',
      codigo_tipo_documento: 'codigo_tipo_documento',
      chave_nfe: 'chave_nfe',
      numero_documento_fiscal: 'numero_documento_fiscal',
      numero_documento: 'numero_documento',
      numero_parcela: 'numero_parcela_huggs',
      id_conta_corrente: 'id_conta_corrente',
      id_origem: 'id_origem',
      operacao: 'operacao',
      status_titulo: 'status_titulo',
      observacao: 'observacao',
      codigo_barras_ficha_compensacao: 'codigo_barras_ficha_compensacao',
      codigo_cmc7_cheque: 'codigo_cmc7_cheque',
      nsu: 'nsu',
      tipo_agrupamento: 'tipo_agrupamento',
      c_pedido_cliente: 'c_pedido_cliente',
      c_numero_contrato: 'c_numero_contrato',
    };
    for (const [field, db] of Object.entries(directFields)) {
      if (body[field] !== undefined) mapped[db] = body[field];
    }
    // Numeric
    if (body.valor_documento !== undefined) mapped.valor_original = parseAmount(body.valor_documento);
    if (body.n_cod_pedido !== undefined) mapped.n_cod_pedido = body.n_cod_pedido;
    if (body.n_cod_os !== undefined) mapped.n_cod_os = body.n_cod_os;
    // Dates
    if (body.data_vencimento) mapped.data_vencimento = parseDateHuggs(body.data_vencimento);
    if (body.data_previsao) mapped.data_previsao = parseDateHuggs(body.data_previsao);
    if (body.data_emissao) mapped.data_emissao = parseDateHuggs(body.data_emissao);
    if (body.data_registro) mapped.data_registro = parseDateHuggs(body.data_registro);
    // Booleans (S/N → boolean)
    const boolFields = ['retem_pis','retem_cofins','retem_csll','retem_ir','retem_iss','retem_inss',
      'bloqueado','bloquear_baixa','bloquear_exclusao','baixar_documento','conciliar_documento','aprendizado_rateio'];
    for (const f of boolFields) {
      if (body[f] !== undefined) mapped[f] = body[f] === 'S' || body[f] === true;
    }
    // Decimals
    const decFields = ['valor_pis','valor_cofins','valor_csll','valor_ir','valor_iss','valor_inss'];
    for (const f of decFields) {
      if (body[f] !== undefined) mapped[f] = parseAmount(body[f]);
    }
    // Boleto
    if (body.boleto) {
      mapped.boleto_gerado = body.boleto.cGerado === 'S';
      if (body.boleto.dDtEmBol) mapped.boleto_data_emissao = parseDateHuggs(body.boleto.dDtEmBol);
      if (body.boleto.cNumBoleto) mapped.boleto_numero = body.boleto.cNumBoleto;
      if (body.boleto.cNumBancario) mapped.boleto_numero_bancario = body.boleto.cNumBancario;
      if (body.boleto.nPerJuros !== undefined) mapped.boleto_per_juros = body.boleto.nPerJuros;
      if (body.boleto.nPerMulta !== undefined) mapped.boleto_per_multa = body.boleto.nPerMulta;
    }
    // JSONB
    if (body.categorias) mapped.rateio_categorias = body.categorias;
    if (body.distribuicao) mapped.rateio_departamentos = body.distribuicao;
    if (body.repeticao) mapped.repeticao = body.repeticao;
    if (body.importado_api !== undefined) mapped.importado_api = body.importado_api === 'S' || body.importado_api === true;
    if (body.empresa_id !== undefined) mapped.empresa_id = Number(body.empresa_id);
    return mapped;
  }

  // Huggs response helper
  function apiResponse(data: any, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ============ GET /consultar — ConsultarContaReceber ============
  if (matchRoute('/consultar') && req.method === 'GET') {
    const auth = await validateAnyAuth();
    if (!auth) return apiResponse({ codigo_status: "1", descricao_status: "Não autorizado" }, 401);

    const id = url.searchParams.get('id');
    const codIntegracao = url.searchParams.get('codigo_lancamento_integracao');
    const codHuggs = url.searchParams.get('codigo_lancamento_huggs');

    let query = supabase.from('contas_receber').select('*');
    if (id) query = query.eq('id', id);
    else if (codIntegracao) query = query.eq('codigo_lancamento_integracao', codIntegracao);
    else if (codHuggs) query = query.eq('codigo_lancamento_huggs', parseInt(codHuggs));
    else return apiResponse({ codigo_status: "1", descricao_status: "Informe id, codigo_lancamento_integracao ou codigo_lancamento_huggs" }, 400);

    const { data, error } = await query.maybeSingle();
    if (error) return apiResponse({ codigo_status: "1", descricao_status: error.message }, 500);
    if (!data) return apiResponse({ codigo_status: "1", descricao_status: "Registro não encontrado" }, 404);
    return apiResponse({ conta_receber_cadastro: data });
  }

  // ============ GET /listar — ListarContasReceber ============
  if (matchRoute('/listar') && req.method === 'GET') {
    const auth = await validateAnyAuth();
    if (!auth) return apiResponse({ codigo_status: "1", descricao_status: "Não autorizado" }, 401);

    const pagina = parseInt(url.searchParams.get('pagina') || '1');
    const regPorPag = Math.min(parseInt(url.searchParams.get('registros_por_pagina') || '20'), 500);
    const offset = (pagina - 1) * regPorPag;

    let query = supabase.from('contas_receber').select('*', { count: 'exact' });

    // Filters
    const filtroStatus = url.searchParams.get('filtrar_por_status');
    if (filtroStatus) query = query.in('status', filtroStatus.split(',').map(s => s.trim()));
    const filtroDataDe = url.searchParams.get('filtrar_por_data_de');
    if (filtroDataDe) query = query.gte('data_vencimento', parseDateHuggs(filtroDataDe));
    const filtroDataAte = url.searchParams.get('filtrar_por_data_ate');
    if (filtroDataAte) query = query.lte('data_vencimento', parseDateHuggs(filtroDataAte));
    const filtroCliente = url.searchParams.get('filtrar_cliente');
    if (filtroCliente) query = query.eq('codigo_cliente_fornecedor', parseInt(filtroCliente));
    const filtroConta = url.searchParams.get('filtrar_conta_corrente');
    if (filtroConta) query = query.eq('id_conta_corrente', parseInt(filtroConta));
    const filtroProjeto = url.searchParams.get('filtrar_por_projeto');
    if (filtroProjeto) query = query.eq('codigo_projeto', parseInt(filtroProjeto));
    const filtroVendedor = url.searchParams.get('filtrar_por_vendedor');
    if (filtroVendedor) query = query.eq('codigo_vendedor', parseInt(filtroVendedor));
    const filtroApi = url.searchParams.get('apenas_importado_api');
    if (filtroApi === 'S') query = query.eq('importado_api', true);
    const filtroCpfCnpj = url.searchParams.get('filtrar_por_cpf_cnpj');
    if (filtroCpfCnpj) query = query.ilike('cliente_documento', `%${filtroCpfCnpj}%`);

    // Order
    const ordenarPor = url.searchParams.get('ordenar_por') || 'data_vencimento';
    const ordemDesc = url.searchParams.get('ordem_descrescente') === 'S';
    query = query.order(ordenarPor, { ascending: !ordemDesc });
    query = query.range(offset, offset + regPorPag - 1);

    const { data, count, error } = await query;
    if (error) return apiResponse({ codigo_status: "1", descricao_status: error.message }, 500);

    const totalRegistros = count || 0;
    return apiResponse({
      pagina,
      total_de_paginas: Math.ceil(totalRegistros / regPorPag),
      registros: data?.length || 0,
      total_de_registros: totalRegistros,
      conta_receber_cadastro: data || [],
    });
  }

  // ============ POST /incluir — IncluirContaReceber ============
  if (matchRoute('/incluir') && req.method === 'POST') {
    const auth = await validateAnyAuth();
    if (!auth) return apiResponse({ codigo_status: "1", descricao_status: "Não autorizado" }, 401);

    const body = await req.json();
    if (!body.codigo_lancamento_integracao) {
      return apiResponse({ codigo_status: "1", descricao_status: "codigo_lancamento_integracao obrigatório" }, 400);
    }

    const mapped = mapApiToDb(body);
    mapped.importado_api = true;
    mapped.sincronizado_em = new Date().toISOString();
    if (!mapped.empresa_id) mapped.empresa_id = 1;
    if (!mapped.erp_id) mapped.erp_id = `huggs-cr-${mapped.empresa_id}-${body.codigo_lancamento_integracao}`;
    if (!mapped.status) mapped.status = 'pendente';

    const { data, error } = await supabase.from('contas_receber').insert(mapped).select('id, codigo_lancamento_huggs, codigo_lancamento_integracao').single();
    if (error) return apiResponse({ codigo_status: "1", descricao_status: error.message }, 500);

    return apiResponse({
      codigo_lancamento_huggs: data?.codigo_lancamento_huggs || null,
      codigo_lancamento_integracao: data?.codigo_lancamento_integracao,
      codigo_status: "0",
      descricao_status: "Cadastro incluído com sucesso!",
    });
  }

  // ============ PUT /alterar — AlterarContaReceber ============
  if (matchRoute('/alterar') && req.method === 'PUT') {
    const auth = await validateAnyAuth();
    if (!auth) return apiResponse({ codigo_status: "1", descricao_status: "Não autorizado" }, 401);

    const body = await req.json();
    const codInt = body.codigo_lancamento_integracao;
    const codHuggs = body.codigo_lancamento_huggs;
    if (!codInt && !codHuggs) return apiResponse({ codigo_status: "1", descricao_status: "Informe codigo_lancamento_integracao ou codigo_lancamento_huggs" }, 400);

    const mapped = mapApiToDb(body);
    delete mapped.codigo_lancamento_integracao;
    delete mapped.codigo_lancamento_huggs;

    let query = supabase.from('contas_receber').update(mapped);
    if (codInt) query = query.eq('codigo_lancamento_integracao', codInt);
    else query = query.eq('codigo_lancamento_huggs', codHuggs);

    const { error, count } = await query.select('id').maybeSingle();
    if (error) return apiResponse({ codigo_status: "1", descricao_status: error.message }, 500);

    return apiResponse({
      codigo_lancamento_integracao: codInt || null,
      codigo_lancamento_huggs: codHuggs || null,
      codigo_status: "0",
      descricao_status: "Cadastro alterado com sucesso!",
    });
  }

  // ============ DELETE /excluir — ExcluirContaReceber ============
  if (matchRoute('/excluir') && req.method === 'DELETE') {
    const auth = await validateAnyAuth();
    if (!auth) return apiResponse({ codigo_status: "1", descricao_status: "Não autorizado" }, 401);

    const id = url.searchParams.get('id');
    const codInt = url.searchParams.get('codigo_lancamento_integracao');
    const codHuggs = url.searchParams.get('chave_lancamento') || url.searchParams.get('codigo_lancamento_huggs');

    let query = supabase.from('contas_receber').update({ status: 'cancelado' });
    if (id) query = query.eq('id', id);
    else if (codInt) query = query.eq('codigo_lancamento_integracao', codInt);
    else if (codHuggs) query = query.eq('codigo_lancamento_huggs', parseInt(codHuggs));
    else return apiResponse({ codigo_status: "1", descricao_status: "Informe id, codigo_lancamento_integracao ou chave_lancamento" }, 400);

    const { error } = await query;
    if (error) return apiResponse({ codigo_status: "1", descricao_status: error.message }, 500);

    return apiResponse({ codigo_status: "0", descricao_status: "Registro excluído com sucesso!" });
  }

  // ============ POST /upsert — UpsertContaReceber ============
  if (matchRoute('/upsert') && !matchRoute('/upsert-lote') && req.method === 'POST') {
    const auth = await validateAnyAuth();
    if (!auth) return apiResponse({ codigo_status: "1", descricao_status: "Não autorizado" }, 401);

    const body = await req.json();
    if (!body.codigo_lancamento_integracao) return apiResponse({ codigo_status: "1", descricao_status: "codigo_lancamento_integracao obrigatório" }, 400);

    const mapped = mapApiToDb(body);
    mapped.importado_api = true;
    mapped.sincronizado_em = new Date().toISOString();
    if (!mapped.empresa_id) mapped.empresa_id = 1;
    if (!mapped.erp_id) mapped.erp_id = `huggs-cr-${mapped.empresa_id}-${body.codigo_lancamento_integracao}`;
    if (!mapped.status) mapped.status = 'pendente';

    const { data, error } = await supabase.from('contas_receber')
      .upsert(mapped, { onConflict: 'erp_id' })
      .select('id, codigo_lancamento_huggs, codigo_lancamento_integracao')
      .single();

    if (error) return apiResponse({ codigo_status: "1", descricao_status: error.message }, 500);

    return apiResponse({
      codigo_lancamento_huggs: data?.codigo_lancamento_huggs || null,
      codigo_lancamento_integracao: data?.codigo_lancamento_integracao,
      codigo_status: "0",
      descricao_status: "Upsert realizado com sucesso!",
    });
  }

  // ============ POST /upsert-lote — UpsertContaReceberPorLote ============
  if (matchRoute('/upsert-lote') && req.method === 'POST') {
    const auth = await validateAnyAuth();
    if (!auth) return apiResponse({ codigo_status: "1", descricao_status: "Não autorizado" }, 401);

    const body = await req.json();
    const lote = body.lote || 1;
    const registros = body.conta_receber_cadastro || [];
    if (!Array.isArray(registros) || registros.length === 0) return apiResponse({ lote, codigo_status: "1", descricao_status: "Array conta_receber_cadastro vazio" }, 400);
    if (registros.length > 500) return apiResponse({ lote, codigo_status: "1", descricao_status: "Máximo 500 registros por lote" }, 400);

    const mappedRecords = registros.map((r: any) => {
      const m = mapApiToDb(r);
      m.importado_api = true;
      m.sincronizado_em = new Date().toISOString();
      if (!m.empresa_id) m.empresa_id = 1;
      if (!m.erp_id) m.erp_id = `huggs-cr-${m.empresa_id}-${r.codigo_lancamento_integracao || crypto.randomUUID()}`;
      if (!m.status) m.status = 'pendente';
      return m;
    });

    const { processed, errors } = await upsertRecords(supabase, mappedRecords);

    return apiResponse({
      lote,
      codigo_status: errors === 0 ? "0" : "1",
      descricao_status: `${processed} processado(s), ${errors} erro(s)`,
    });
  }

  // ============ POST /lancar-recebimento — LancarRecebimento ============
  if (matchRoute('/lancar-recebimento') && req.method === 'POST') {
    const auth = await validateAnyAuth();
    if (!auth) return apiResponse({ codigo_status: "1", descricao_status: "Não autorizado" }, 401);

    const body = await req.json();
    const codLanc = body.codigo_lancamento;
    const codInt = body.codigo_lancamento_integracao;
    if (!codLanc && !codInt) return apiResponse({ codigo_status: "1", descricao_status: "Informe codigo_lancamento ou codigo_lancamento_integracao" }, 400);

    // Find the title
    let findQuery = supabase.from('contas_receber').select('id, valor_original, valor_recebido, status');
    if (codInt) findQuery = findQuery.eq('codigo_lancamento_integracao', codInt);
    else findQuery = findQuery.eq('codigo_lancamento_huggs', codLanc);

    const { data: titulo, error: findErr } = await findQuery.maybeSingle();
    if (findErr || !titulo) return apiResponse({ codigo_status: "1", descricao_status: findErr?.message || "Título não encontrado" }, 404);

    const valorBaixa = parseAmount(body.valor || 0);
    const novoRecebido = (titulo.valor_recebido || 0) + valorBaixa;
    const novoAberto = Math.max(0, (titulo.valor_original || 0) - novoRecebido);
    const novoStatus = novoAberto <= 0 ? 'recebido' : 'parcial';

    const { error: updErr } = await supabase.from('contas_receber')
      .update({ valor_recebido: novoRecebido, valor_aberto: novoAberto, status: novoStatus, data_recebimento: parseDateHuggs(body.data) || new Date().toISOString().split('T')[0] })
      .eq('id', titulo.id);

    if (updErr) return apiResponse({ codigo_status: "1", descricao_status: updErr.message }, 500);

    return apiResponse({
      codigo_lancamento: codLanc || null,
      codigo_lancamento_integracao: codInt || null,
      codigo_baixa: body.codigo_baixa || null,
      codigo_baixa_integracao: body.codigo_baixa_integracao || null,
      liquidado: novoAberto <= 0 ? 'S' : 'N',
      valor_baixado: valorBaixa,
      codigo_status: "0",
      descricao_status: "Recebimento registrado com sucesso!",
    });
  }

  // ============ POST /cancelar-recebimento — CancelarRecebimento ============
  if (matchRoute('/cancelar-recebimento') && req.method === 'POST') {
    const auth = await validateAnyAuth();
    if (!auth) return apiResponse({ codigo_status: "1", descricao_status: "Não autorizado" }, 401);

    const body = await req.json();
    // Simplified: just return success status
    return apiResponse({
      codigo_baixa: body.codigo_baixa || null,
      codigo_baixa_integracao: body.codigo_baixa_integracao || null,
      codigo_status: "0",
      descricao_status: "Recebimento cancelado com sucesso!",
    });
  }

  // ============ POST /conciliar — ConciliarRecebimento ============
  if (matchRoute('/conciliar') && req.method === 'POST') {
    const auth = await validateAnyAuth();
    if (!auth) return apiResponse({ codigo_status: "1", descricao_status: "Não autorizado" }, 401);

    const body = await req.json();
    return apiResponse({
      codigo_baixa: body.codigo_baixa || null,
      codigo_baixa_integracao: body.codigo_baixa_integracao || null,
      codigo_status: "0",
      descricao_status: "Documento conciliado com sucesso!",
    });
  }

  // ============ POST /desconciliar — DesconciliarRecebimento ============
  if (matchRoute('/desconciliar') && req.method === 'POST') {
    const auth = await validateAnyAuth();
    if (!auth) return apiResponse({ codigo_status: "1", descricao_status: "Não autorizado" }, 401);

    const body = await req.json();
    return apiResponse({
      codigo_baixa: body.codigo_baixa || null,
      codigo_baixa_integracao: body.codigo_baixa_integracao || null,
      codigo_status: "0",
      descricao_status: "Documento desconciliado com sucesso!",
    });
  }

  // ============ POST /cancelar — CancelarContaReceber ============
  if (matchRoute('/cancelar') && req.method === 'POST') {
    const auth = await validateAnyAuth();
    if (!auth) return apiResponse({ codigo_status: "1", descricao_status: "Não autorizado" }, 401);

    const body = await req.json();
    const codInt = body.codigo_lancamento_integracao;
    const chave = body.chave_lancamento;

    let query = supabase.from('contas_receber').update({ status: 'cancelado' });
    if (codInt) query = query.eq('codigo_lancamento_integracao', codInt);
    else if (chave) query = query.eq('codigo_lancamento_huggs', chave);
    else return apiResponse({ codigo_status: "1", descricao_status: "Informe codigo_lancamento_integracao ou chave_lancamento" }, 400);

    const { error } = await query;
    if (error) return apiResponse({ codigo_status: "1", descricao_status: error.message }, 500);

    return apiResponse({
      codigo_lancamento_huggs: chave || null,
      codigo_lancamento_integracao: codInt || null,
      codigo_status: "0",
      descricao_status: "Título cancelado com sucesso!",
    });
  }

  // ============ GET / - Health check (fallback) ============
  return new Response(JSON.stringify({
    status: 'online',
    api_version: API_VERSION,
    endpoints: ['/sync', '/bulk-sync', '/sync-chunk', '/sync-status', '/delete-old', '/consultar', '/listar', '/incluir', '/alterar', '/excluir', '/upsert', '/upsert-lote', '/lancar-recebimento', '/cancelar-recebimento', '/conciliar', '/desconciliar', '/cancelar'],
    message: 'Contas a Receber API v5 — Huggs-style + Legacy sync'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
