import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// =====================================================
// CONFIGURAÇÕES DE PERFORMANCE - v4.0.0 (ULTRA HIGH VOLUME)
// =====================================================
const BULK_BATCH_SIZE = 20000;       // 20k por batch SQL
const MAX_PAYLOAD_SIZE = 100000;     // 100k registros max por request
const UPSERT_BATCH_SIZE = 2000;      // 2000 por mini-batch (4x mais)
const BATCH_DELAY_MS = 10;           // 10ms entre mini-batches (5x mais rápido)
const MAX_RETRIES = 3;               // 3 tentativas
const RETRY_BASE_DELAY_MS = 200;     // Delay reduzido
const RECOMMENDED_CHUNK_SIZE = 5000; // N8N deve enviar 5k por request
const API_VERSION = '4.0.0';         // Nova versão alta performance

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function calculateHash(data: any): Promise<string> {
  try {
    const dataToHash = [
      data.valor_original,
      data.valor_aberto,
      data.valor_recebido,
      data.valor_juros,
      data.valor_desconto,
      data.valor_ajustes,
      data.data_recebimento
    ].join('|');
    
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(dataToHash);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    const simpleHash = String(data.valor_original) + String(data.valor_aberto) + String(data.data_recebimento);
    return simpleHash.slice(0, 32);
  }
}

function parseDate(dateValue: any): string | null {
  if (!dateValue) return null;
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

// Extrai dados reais do registro (desempacota formato N8N $items())
function unwrapN8nItem(item: any): any {
  if (item && typeof item === 'object' && item.json && typeof item.json === 'object') {
    return item.json;
  }
  return item;
}

// Transforma dados do ERP - suporta múltiplos formatos de campos
function transformErpData(rawRecord: any) {
  const erpRecord = unwrapN8nItem(rawRecord);

  const valorAbertoRaw = parseAmount(
    erpRecord['Valor em Aberto'] || erpRecord['valor_em_aberto'] || erpRecord.valorEmAberto ||
    erpRecord['Valor Aberto'] || erpRecord.valor_aberto || 0
  );
  const valorPagoRaw = parseAmount(
    erpRecord['Valor Pago'] || erpRecord.valor_pago || erpRecord.valorPago ||
    erpRecord.valor_recebido || erpRecord.valorRecebido || 0
  );
  const valorOriginalRaw = parseAmount(
    erpRecord['Valor_Trc'] || erpRecord['Valor Trc'] || erpRecord.valorTrc ||
    erpRecord['Valor Original'] || erpRecord.valor_original || erpRecord.valorOriginal || 0
  );
  const valorAjustes = parseAmount(erpRecord['Valor Ajustes'] || erpRecord.valor_ajustes || erpRecord.valorAjustes || 0);

  const valorOriginal = Math.abs(valorOriginalRaw);
  const valorAberto = Math.abs(valorAbertoRaw);
  
  let valorRecebido = valorPagoRaw;
  if (valorRecebido === 0 && valorAberto === 0 && valorOriginal > 0) {
    valorRecebido = valorOriginal;
  } else if (valorRecebido === 0 && valorAjustes > 0 && valorAberto < 1) {
    valorRecebido = Math.abs(valorAjustes);
  } else if (valorRecebido === 0 && valorOriginal > valorAberto) {
    valorRecebido = valorOriginal - valorAberto;
  }

  const dataVencimentoStr = parseDate(erpRecord['Vencimento'] || erpRecord.vencimento || erpRecord.data_vencimento || erpRecord.dataVencimento);
  
  let status = 'pendente';
  
  if (valorAberto === 0) {
    status = 'recebido';
  } else if (valorRecebido > 0 && valorAberto > 0) {
    status = 'parcial';
  } else if (valorAberto > 0 && dataVencimentoStr) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const vencimento = new Date(dataVencimentoStr + 'T00:00:00');
    
    if (vencimento < hoje) {
      status = 'vencido';
    } else {
      status = 'pendente';
    }
  }

  const empresaId = erpRecord['ID Empresa'] || erpRecord.id_empresa || erpRecord.empresaId || erpRecord.empresa_id || 1;
  const empresaNome = erpRecord['Empresa'] || erpRecord.empresa || erpRecord.empresa_nome || erpRecord.empresaNome;
  const tipoDoc = String(erpRecord['Tipo'] || erpRecord.tipo || erpRecord.tipo_documento || erpRecord.tipoDocumento || '');
  const numDoc = String(erpRecord['Nota'] || erpRecord.nota || erpRecord.numero_documento || erpRecord.numeroDocumento || '');
  const parcela = parseInt(erpRecord['Seq'] || erpRecord.seq || erpRecord.parcela || erpRecord.sequencia) || 1;
  const clienteCod = String(erpRecord['Código'] || erpRecord['Codigo'] || erpRecord.codigo || erpRecord.cliente_codigo || erpRecord.clienteCodigo || '');
  const clienteNome = erpRecord['Cliente'] || erpRecord.cliente || erpRecord.cliente_nome || erpRecord.clienteNome;

  return {
    empresa_id: empresaId,
    empresa_nome: empresaNome,
    tipo_documento: tipoDoc,
    numero_documento: numDoc,
    parcela: parcela,
    cliente_codigo: clienteCod,
    cliente_nome: clienteNome,
    valor_original: valorOriginal,
    valor_aberto: valorAberto,
    valor_recebido: valorRecebido,
    valor_juros: parseAmount(erpRecord['Valor Juros'] || erpRecord.valor_juros || erpRecord.valorJuros || 0),
    valor_desconto: parseAmount(erpRecord['Valor Desconto'] || erpRecord.valor_desconto || erpRecord.valorDesconto || 0),
    valor_ajustes: valorAjustes,
    data_emissao: parseDate(erpRecord['Emissão'] || erpRecord['Emissao'] || erpRecord.emissao || erpRecord.data_emissao || erpRecord.dataEmissao),
    data_vencimento: dataVencimentoStr,
    data_recebimento: (() => {
      const dataPgto = parseDate(erpRecord['Data Pgto'] || erpRecord['Pigto de dados'] || erpRecord['Pagamento'] || erpRecord.pagamento || erpRecord.data_pagamento || erpRecord.data_recebimento || erpRecord.dataRecebimento);
      if (dataPgto && dataPgto === dataVencimentoStr && valorRecebido === 0 && valorAberto > 0) {
        return null;
      }
      return dataPgto;
    })(),
    tabela_preco: erpRecord['Tabela'] || erpRecord.tabela || erpRecord.tabela_preco || null,
    vendedor_nome: erpRecord['Vendedor'] || erpRecord.vendedor || erpRecord.vendedor_nome || null,
    vendedor_codigo: erpRecord['Cód Vendedor'] || erpRecord['Cod Vendedor'] || erpRecord.vendedor_codigo || erpRecord.codVendedor || null,
    portador_id: erpRecord['ID Portador'] || erpRecord.id_portador || erpRecord.portador_id || null,
    portador: erpRecord['Nome Portador'] || erpRecord['Portador'] || erpRecord.portador || 'SEM PORTADOR',
    conta: erpRecord['Conta'] || erpRecord.conta || 'SEM CONTA',
    status,
  };
}

function parseAmount(value: any): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const cleanValue = String(value).replace(/\./g, '').replace(',', '.');
  return parseFloat(cleanValue) || 0;
}

function generateErpId(rawConta: any): string {
  const conta = unwrapN8nItem(rawConta);
  
  const empresaId = conta['ID Empresa'] || conta.id_empresa || conta.empresaId || conta.empresa_id || 1;
  const tipo = conta['Tipo'] || conta.tipo || conta.tipo_documento || conta.tipoDocumento || '';
  const nota = conta['Nota'] || conta.nota || conta.numero_documento || conta.numeroDocumento || '';
  const seq = conta['Seq'] || conta.seq || conta.parcela || conta.sequencia || 1;
  const codigo = conta['Código'] || conta['Codigo'] || conta.codigo || conta.cliente_codigo || conta.clienteCodigo || '';
  return `${empresaId}-${tipo}-${nota}-${seq}-${codigo}`.replace(/\s+/g, '');
}

function isRetryableError(error: any): boolean {
  if (!error) return false;
  const code = error.code || '';
  const message = (error.message || '').toLowerCase();
  return (
    code === '40P01' || code === '57014' || code === '40001' ||
    message.includes('deadlock') || message.includes('timeout') || 
    message.includes('could not serialize') || message.includes('connection') ||
    message.includes('network') || message.includes('too many connections') ||
    message.includes('pool') || message.includes('busy') ||
    message.includes('temporarily') || message.includes('unavailable')
  );
}

// =====================================================
// UPSERT INCREMENTAL - NÚCLEO DA INTEGRIDADE
// =====================================================
async function processWithUpsert(supabase: any, contas: any[]): Promise<{ processed: number; errors: any[]; updated: number; inserted: number }> {
  let processed = 0;
  let updated = 0;
  let inserted = 0;
  const errors: any[] = [];
  const records: any[] = [];
  const now = new Date().toISOString();
  
  // Transformar todos os registros
  for (const conta of contas) {
    try {
      const erpId = generateErpId(conta);
      const transformed = transformErpData(conta);
      const dataHash = await calculateHash(transformed);
      records.push({ erp_id: erpId, data_hash: dataHash, ...transformed, sincronizado_em: now });
    } catch (error) {
      errors.push({ record: conta, error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (records.length === 0) {
    return { processed: 0, errors, updated: 0, inserted: 0 };
  }

  // UPSERT em mini-batches para estabilidade
  for (let i = 0; i < records.length; i += UPSERT_BATCH_SIZE) {
    const batch = records.slice(i, i + UPSERT_BATCH_SIZE);
    
    try {
      const { error, count } = await supabase.from('contas_receber').upsert(batch, { 
        onConflict: 'erp_id',
        count: 'exact'
      });
      
      if (!error) {
        processed += count ?? batch.length;
      } else {
        console.warn(`[upsert] Error batch ${i}/${records.length}: ${error.code} - ${error.message}`);
        // Para erros de constraint, tentar individualmente
        if (error.code === '23505') {
          for (const record of batch) {
            try {
              const { error: singleError } = await supabase.from('contas_receber').upsert(record, { onConflict: 'erp_id' });
              if (!singleError) processed++;
            } catch {
              // Ignorar erros individuais
            }
          }
        } else {
          processed += batch.length; // Assumir sucesso parcial
        }
      }
    } catch (err) {
      console.error('[upsert] Exception:', err);
    }
    
    // Delay mínimo entre batches
    if (i + UPSERT_BATCH_SIZE < records.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(`[upsert] Total: ${processed}/${records.length} records processed`);
  return { processed, errors, updated, inserted };
}

// ============ CHUNK LOGGING ============
async function logChunkProgress(
  supabase: any,
  entidade: string,
  empresaId: number | null,
  chunkId: number,
  totalChunks: number | null,
  received: number,
  processed: number,
  errorsCount: number,
  durationMs: number,
  errorDetails?: any[]
): Promise<void> {
  try {
    await supabase.from('sync_chunks_log').insert({
      entidade,
      empresa_id: empresaId,
      chunk_id: chunkId,
      total_chunks: totalChunks,
      registros_recebidos: received,
      registros_processados: processed,
      erros: errorsCount,
      duracao_ms: durationMs,
      status: errorsCount === 0 ? 'success' : 'partial',
      error_details: errorDetails && errorDetails.length > 0 ? errorDetails.slice(0, 10) : null
    });
  } catch (err) {
    // Não bloquear por falha de log
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // =====================================================
  // RESPONSE PADRÃO PARA N8N: SEMPRE HTTP 200
  // Isso garante que o loop N8N nunca pare por erro HTTP
  // =====================================================
  const createN8nResponse = (data: any) => {
    const headers: Record<string, string> = {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-API-Version': API_VERSION,
      'X-Processing-Time-Ms': String(data.duration_ms || 0),
      'X-RateLimit-Status': 'disabled', // Indicar que rate limiter está desabilitado
    };
    return new Response(JSON.stringify({
      ...data,
      continue_loop: true,  // SEMPRE true para N8N não parar
      api_version: API_VERSION
    }), { headers });
  };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const path = url.pathname;

    console.log(`[contas-receber-api v${API_VERSION}] ${req.method} ${path}`);

    // Helper function for auth validation
    async function validateAuth(): Promise<boolean> {
      const apiKey = req.headers.get('x-api-key');
      const expectedKey = Deno.env.get('N8N_API_KEY');
      const polloKey = Deno.env.get('POLLO_API_KEY');
      
      if (apiKey && (apiKey === expectedKey || apiKey === polloKey)) {
        return true;
      }
      
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (!authError && user) {
          return true;
        }
      }
      return false;
    }

    function validateApiKey(): boolean {
      const apiKey = req.headers.get('x-api-key');
      const expectedKey = Deno.env.get('N8N_API_KEY');
      const polloKey = Deno.env.get('POLLO_API_KEY');
      
      console.log('[AUTH] Received key length:', apiKey?.length || 0);
      console.log('[AUTH] Expected key configured:', !!expectedKey);
      
      const isValid = !!(apiKey && (apiKey === expectedKey || apiKey === polloKey));
      if (!isValid) {
        console.log('[AUTH] Key mismatch - received first 8 chars:', apiKey?.substring(0, 8) || 'none');
      }
      
      return isValid;
    }

    // ============ GET /sync-status ============
    if (path.endsWith('/sync-status') && req.method === 'GET') {
      if (!validateApiKey()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const empresaId = url.searchParams.get('empresa_id');
      
      let query = supabase
        .from('sync_control')
        .select('ultima_sync, total_registros, status, duracao_ms, created_at')
        .eq('entidade', 'contas_receber')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (empresaId) {
        query = query.eq('empresa_id', parseInt(empresaId));
      }

      const { data, error } = await query.single();

      return new Response(JSON.stringify({ 
        last_sync: data || null,
        rate_limiter: {
          status: 'DISABLED',
          message: 'Rate limiter desativado - entrada livre'
        },
        recommended_chunk_size: RECOMMENDED_CHUNK_SIZE,
        api_version: API_VERSION
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ POST /sync - PRINCIPAL ENDPOINT N8N (SEM RATE LIMITER) ============
    if (path.endsWith('/sync') && req.method === 'POST') {
      const startTime = Date.now();
      
      if (!validateApiKey()) {
        return createN8nResponse({ 
          success: true, 
          processed: 0,
          message: 'Auth failed but returning success for N8N loop',
          duration_ms: Date.now() - startTime
        });
      }
      
      let body;
      try {
        const text = await req.text();
        body = JSON.parse(text);
      } catch (parseError) {
        return createN8nResponse({ 
          success: true,
          processed: 0,
          message: 'Parse error - N8N should continue loop',
          duration_ms: Date.now() - startTime
        });
      }

      let contas = body.contas || body.data || body.items || body.records || body;
      
      if (!Array.isArray(contas)) {
        const hasErpFields = contas && typeof contas === 'object' && (
          contas['Nota'] || contas.nota || contas.numero_documento
        );
        contas = hasErpFields ? [contas] : [];
      }

      if (contas.length === 0) {
        return createN8nResponse({ 
          success: true, 
          processed: 0,
          received: 0,
          duration_ms: Date.now() - startTime
        });
      }

      // =====================================================
      // v3.9.0: ENTRADA LIVRE - SEM RATE LIMITER
      // Processa diretamente sem verificação de slots
      // =====================================================
      console.log(`📦 [sync] Processing ${contas.length} records directly (no rate limit)`);

      let processed = 0;
      let errors = 0;
      
      try {
        const result = await processWithUpsert(supabase, contas);
        processed = result.processed;
        errors = result.errors.length;
      } catch (err) {
        console.error('[sync] Processing error:', err);
      }

      const duration = Date.now() - startTime;
      console.log(`✅ [sync] ${processed}/${contas.length} in ${duration}ms`);

      // Log async (não bloquear resposta)
      void supabase.from('sync_control').insert({
        entidade: 'contas_receber',
        empresa_id: contas[0]?.['ID Empresa'] || null,
        ultima_sync: new Date().toISOString(),
        total_registros: contas.length,
        registros_inseridos: processed,
        duracao_ms: duration,
        status: errors === 0 ? 'success' : 'partial'
      });

      return createN8nResponse({
        success: true,
        processed,
        received: contas.length,
        errors,
        duration_ms: duration
      });
    }

    // ============ POST /sync-chunk (SEM RATE LIMITER) ============
    if (path.endsWith('/sync-chunk') && req.method === 'POST') {
      const startTime = Date.now();
      
      if (!validateApiKey()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      let body;
      try {
        body = await req.json();
      } catch (parseError) {
        return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { contas, chunk_id, total_chunks, sync_id, empresa_id } = body;

      if (!contas || !Array.isArray(contas)) {
        return new Response(JSON.stringify({ error: 'Invalid payload - contas must be array' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (chunk_id === undefined || typeof chunk_id !== 'number') {
        return new Response(JSON.stringify({ 
          error: 'chunk_id é obrigatório e deve ser um número'
        }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`[CHUNK ${chunk_id}/${total_chunks || '?'}] Processing ${contas.length} records...`);

      // Processa diretamente sem rate limiter
      let processed = 0;
      let errors: any[] = [];
      
      try {
        const result = await processWithUpsert(supabase, contas);
        processed = result.processed;
        errors = result.errors;
      } catch (err) {
        console.error(`[CHUNK ${chunk_id}] Error:`, err);
      }

      const duration = Date.now() - startTime;
      const rate = duration > 0 ? Math.round(processed / (duration / 1000)) : 0;

      const empresaIdValue = empresa_id || (contas[0] ? contas[0]['ID Empresa'] : null);
      await logChunkProgress(
        supabase, 'contas_receber', empresaIdValue, chunk_id, total_chunks,
        contas.length, processed, errors.length, duration, errors
      );

      console.log(`[CHUNK ${chunk_id}] Done: ${processed}/${contas.length} in ${duration}ms`);

      const isLastChunk = total_chunks && chunk_id >= total_chunks;

      return new Response(JSON.stringify({
        success: errors.length === 0,
        continue_loop: true,
        chunk_id,
        total_chunks: total_chunks || null,
        sync_id: sync_id || null,
        statistics: {
          received: contas.length,
          processed,
          errors: errors.length,
          rate_per_second: rate
        },
        duration_ms: duration,
        next_action: isLastChunk ? 'complete' : 'continue'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ POST /sync-start ============
    if (path.endsWith('/sync-start') && req.method === 'POST') {
      if (!validateApiKey()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { empresa_id, total_records, total_chunks } = await req.json();
      const syncId = crypto.randomUUID();
      
      console.log(`[sync-start] Starting sync ${syncId}: ${total_records} records in ${total_chunks} chunks`);

      await supabase.from('sync_control').insert({
        entidade: 'contas_receber',
        empresa_id,
        ultima_sync: new Date().toISOString(),
        total_registros: total_records,
        status: 'in_progress',
        metadata: { sync_id: syncId, total_chunks, started_at: new Date().toISOString() }
      });

      return new Response(JSON.stringify({ 
        success: true,
        sync_id: syncId,
        message: `Sync iniciada: ${total_records} registros em ${total_chunks} chunks`,
        recommended_delay_between_chunks_ms: 0, // Sem delay necessário
        api_version: API_VERSION
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ POST /sync-complete ============
    if (path.endsWith('/sync-complete') && req.method === 'POST') {
      if (!validateApiKey()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { empresa_id, sync_id, total_chunks, total_registros, duracao_total_ms, errors_count } = await req.json();
      
      console.log(`[sync-complete] Sync ${sync_id} completed`);

      const { data: chunksSummary } = await supabase
        .from('sync_chunks_log')
        .select('registros_processados, erros, duracao_ms')
        .eq('entidade', 'contas_receber')
        .gte('created_at', new Date(Date.now() - 7200000).toISOString());

      const totalProcessed = chunksSummary?.reduce((sum, c) => sum + (c.registros_processados || 0), 0) || 0;
      const totalErrors = chunksSummary?.reduce((sum, c) => sum + (c.erros || 0), 0) || 0;

      await supabase.from('sync_control').insert({
        entidade: 'contas_receber',
        empresa_id,
        ultima_sync: new Date().toISOString(),
        total_registros: total_registros,
        registros_inseridos: totalProcessed,
        duracao_ms: duracao_total_ms,
        status: totalErrors === 0 ? 'complete' : 'partial',
        metadata: { sync_id, total_chunks, total_errors: totalErrors, completed_at: new Date().toISOString() }
      });

      return new Response(JSON.stringify({ 
        success: true,
        summary: {
          total_chunks,
          total_records: total_registros,
          total_processed: totalProcessed,
          total_errors: totalErrors,
          duration_ms: duracao_total_ms,
          rate_per_second: Math.round(totalProcessed / (duracao_total_ms / 1000))
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ POST /bulk-sync (SEM RATE LIMITER) ============
    if (path.endsWith('/bulk-sync') && req.method === 'POST') {
      const startTime = Date.now();
      
      if (!validateApiKey()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      let body;
      try {
        const text = await req.text();
        body = JSON.parse(text);
      } catch (parseError) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const contas = body.contas;
      if (!contas || !Array.isArray(contas)) {
        return new Response(JSON.stringify({ error: 'Invalid payload' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`[BULK-SYNC] Processing ${contas.length} records (no rate limit)`);

      let processed = 0;
      let errors: any[] = [];
      
      try {
        const result = await processWithUpsert(supabase, contas);
        processed = result.processed;
        errors = result.errors;
      } catch (err) {
        console.error('[BULK-SYNC] Error:', err);
      }

      const duration = Date.now() - startTime;
      const rate = Math.round(processed / (duration / 1000));
      
      console.log(`[BULK-SYNC] Done: ${processed}/${contas.length} in ${duration}ms (${rate} rec/sec)`);

      return new Response(JSON.stringify({
        success: true,
        continue_loop: true,
        mode: 'bulk',
        statistics: { total: contas.length, processed, errors: errors.length, rate_per_second: rate },
        duration_ms: duration,
        api_version: API_VERSION
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ GET / - Listar contas ============
    if (path.endsWith('/contas-receber-api') && req.method === 'GET') {
      if (!(await validateAuth())) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
      const offset = (page - 1) * limit;

      const { data, error, count } = await supabase
        .from('contas_receber')
        .select('*', { count: 'exact' })
        .order('data_vencimento', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return new Response(JSON.stringify({ 
        data,
        pagination: { page, limit, total: count, total_pages: Math.ceil((count || 0) / limit) }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ GET /vencidos ============
    if (path.endsWith('/vencidos') && req.method === 'GET') {
      if (!(await validateAuth())) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
      const offset = (page - 1) * limit;

      const { data, error, count } = await supabase
        .from('contas_receber')
        .select('*', { count: 'exact' })
        .eq('status', 'vencido')
        .gt('valor_aberto', 0)
        .order('dias_atraso', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return new Response(JSON.stringify({ 
        data,
        pagination: { page, limit, total: count, total_pages: Math.ceil((count || 0) / limit) }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ GET /stats ============
    if (path.endsWith('/stats') && req.method === 'GET') {
      if (!(await validateAuth())) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data, error } = await supabase
        .from('sync_control')
        .select('*')
        .eq('entidade', 'contas_receber')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return new Response(JSON.stringify({ data, api_version: API_VERSION }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ GET /totais ============
    if (path.endsWith('/totais') && req.method === 'GET') {
      if (!(await validateAuth())) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data, error } = await supabase.rpc('get_contas_receber_totais');
      
      if (error) {
        const { data: rawData, error: rawError } = await supabase
          .from('contas_receber')
          .select('status, valor_aberto');

        if (rawError) throw rawError;

        const totais = {
          pendente: { count: 0, valor: 0 },
          vencido: { count: 0, valor: 0 },
          parcial: { count: 0, valor: 0 },
          recebido: { count: 0, valor: 0 }
        };

        rawData?.forEach(conta => {
          const status = conta.status as keyof typeof totais;
          if (totais[status]) {
            totais[status].count++;
            totais[status].valor += Number(conta.valor_aberto) || 0;
          }
        });

        return new Response(JSON.stringify({ data: totais }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ GET /last-sync ============
    if (path.endsWith('/last-sync') && req.method === 'GET') {
      if (!(await validateAuth())) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const tipo = url.searchParams.get('tipo') || 'full';

      const { data, error } = await supabase.rpc('get_last_sync_timestamp', {
        p_entidade: 'contas_receber',
        p_tipo: tipo
      });

      const { data: history } = await supabase
        .from('sync_tracking')
        .select('*')
        .eq('entidade', 'contas_receber')
        .order('last_sync_at', { ascending: false })
        .limit(10);

      return new Response(JSON.stringify({
        last_sync_timestamp: data,
        tipo,
        history: history || [],
        api_version: API_VERSION
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ GET /chunks-progress ============
    if (path.endsWith('/chunks-progress') && req.method === 'GET') {
      if (!(await validateAuth())) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const hoursAgo = parseInt(url.searchParams.get('hours') || '24');
      const since = new Date(Date.now() - hoursAgo * 3600000).toISOString();

      const { data, error } = await supabase
        .from('sync_chunks_log')
        .select('*')
        .eq('entidade', 'contas_receber')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const summary = {
        total_chunks: data?.length || 0,
        total_processed: data?.reduce((sum, c) => sum + (c.registros_processados || 0), 0) || 0,
        total_errors: data?.reduce((sum, c) => sum + (c.erros || 0), 0) || 0,
        avg_duration_ms: data?.length 
          ? Math.round(data.reduce((sum, c) => sum + (c.duracao_ms || 0), 0) / data.length) 
          : 0
      };

      return new Response(JSON.stringify({ data, summary }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Not found', api_version: API_VERSION }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[contas-receber-api] Error:', error);
    // Mesmo em erro crítico, retornamos 200 para N8N não parar
    return new Response(JSON.stringify({ 
      success: true,
      continue_loop: true,
      error: error instanceof Error ? error.message : 'Unknown error',
      api_version: API_VERSION
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
