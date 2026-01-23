import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// =====================================================
// CONFIGURAÇÕES DE PERFORMANCE - v3.8.0 (COM RATE LIMITER RESTAURADO)
// =====================================================
const BULK_BATCH_SIZE = 10000;      // 10k por batch SQL
const MAX_PAYLOAD_SIZE = 50000;     // 50k registros max por request
const UPSERT_BATCH_SIZE = 100;      // Batches menores para estabilidade
const BATCH_DELAY_MS = 100;         // Delay entre mini-batches
const MAX_RETRIES = 2;              // Menos retries
const RETRY_BASE_DELAY_MS = 300;    
const RECOMMENDED_CHUNK_SIZE = 100; 
const API_VERSION = '3.8.0';

// =====================================================
// RATE LIMITER - RESTAURADO (igual contas-pagar-api)
// =====================================================
const MAX_CONCURRENT_SYNCS = 2;     // Máximo 2 syncs simultâneas
const SLOT_TIMEOUT_MS = 90000;      // 90 segundos por slot
// IMPORTANTE: não manter requisições N8N penduradas por muito tempo (risco de timeout no HTTP node)
const WAIT_RETRY_MS = 500;          // Intervalo entre tentativas
const MAX_WAIT_RETRIES = 4;         // ~2s de espera total antes de pedir retry

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// =====================================================
// RATE LIMITER FUNCTIONS
// =====================================================
async function cleanupExpiredSlots(supabase: any): Promise<void> {
  try {
    await supabase
      .from('sync_rate_limiter')
      .delete()
      .lt('expires_at', new Date().toISOString());
  } catch {
    // não bloquear
  }
}

async function getActiveSlotCount(supabase: any, syncTypePrefix: string): Promise<number> {
  const { count } = await supabase
    .from('sync_rate_limiter')
    .select('id', { count: 'exact', head: true })
    // O schema real usa slot_key (sem coluna sync_type)
    .ilike('slot_key', `${syncTypePrefix}%`);
  return count || 0;
}

async function acquireSlot(supabase: any, syncTypePrefix: string, requestId: string): Promise<boolean> {
  try {
    await cleanupExpiredSlots(supabase);

    const activeCount = await getActiveSlotCount(supabase, syncTypePrefix);
    if (activeCount >= MAX_CONCURRENT_SYNCS) return false;

    const slotKey = `${syncTypePrefix}_${Date.now()}_${requestId.substring(0, 8)}`;
    const { error } = await supabase
      .from('sync_rate_limiter')
      .insert({
        slot_key: slotKey,
        request_id: requestId,
        expires_at: new Date(Date.now() + SLOT_TIMEOUT_MS).toISOString(),
      });

    if (error) {
      // conflito de unique slot_key = corrida
      if (error.code === '23505') return false;
      console.warn('[rate-limiter] insert error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('[rate-limiter] acquireSlot exception:', err);
    return false;
  }
}

async function waitForSlot(supabase: any, syncTypePrefix: string): Promise<{ slot_id: string | null; error?: string }> {
  const requestId = crypto.randomUUID();

  for (let attempt = 1; attempt <= MAX_WAIT_RETRIES; attempt++) {
    const acquired = await acquireSlot(supabase, syncTypePrefix, requestId);
    if (acquired) return { slot_id: requestId };
    if (attempt < MAX_WAIT_RETRIES) await sleep(WAIT_RETRY_MS);
  }

  return { slot_id: null, error: 'Rate limit - no available slots' };
}

async function releaseSlot(supabase: any, slotId: string | null): Promise<void> {
  if (!slotId) return;
  try {
    await supabase
      .from('sync_rate_limiter')
      .delete()
      .eq('request_id', slotId);
  } catch (err) {
    console.error('[RATE-LIMIT] Failed to release slot:', err);
  }
}

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
    // Usar SHA-256 (MD5 não é suportado pelo Web Crypto API)
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    // Fallback simples se crypto falhar
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
  
  let valorPago = valorPagoRaw;
  if (valorPago === 0 && valorAberto === 0 && valorOriginal > 0) {
    valorPago = valorOriginal;
  } else if (valorPago === 0 && valorAjustes > 0 && valorAberto < 1) {
    valorPago = Math.abs(valorAjustes);
  } else if (valorPago === 0 && valorOriginal > valorAberto) {
    valorPago = valorOriginal - valorAberto;
  }

  let status = 'aberto';
  if (valorAberto === 0 && (valorPago > 0 || valorOriginal > 0)) {
    status = 'pago';
  } else if (valorPago > 0 && valorAberto > 0) {
    status = 'parcial';
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
    valor_recebido: valorPago,
    valor_juros: parseAmount(erpRecord['Valor Juros'] || erpRecord.valor_juros || erpRecord.valorJuros || 0),
    valor_desconto: parseAmount(erpRecord['Valor Desconto'] || erpRecord.valor_desconto || erpRecord.valorDesconto || 0),
    valor_ajustes: valorAjustes,
    data_emissao: parseDate(erpRecord['Emissão'] || erpRecord['Emissao'] || erpRecord.emissao || erpRecord.data_emissao || erpRecord.dataEmissao),
    data_vencimento: parseDate(erpRecord['Vencimento'] || erpRecord.vencimento || erpRecord.data_vencimento || erpRecord.dataVencimento),
    data_recebimento: parseDate(erpRecord['Data Pgto'] || erpRecord['Pigto de dados'] || erpRecord['Pagamento'] || erpRecord.pagamento || erpRecord.data_pagamento || erpRecord.data_recebimento || erpRecord.dataRecebimento),
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
// v3.8.0 - PROCESSAMENTO ESTÁVEL COM RATE LIMITER
// =====================================================

// Processa registros um por um - mais lento mas sem deadlock
async function processIndividually(
  supabase: any, 
  batch: any[], 
  batchNumber: number,
  errorCode: string
): Promise<{ success: boolean; processed: number; error?: any }> {
  let individualProcessed = 0;
  
  for (const record of batch) {
    try {
      const { error: singleError } = await supabase.from('contas_receber').upsert(record, { 
        onConflict: 'erp_id', 
        ignoreDuplicates: true 
      });
      if (!singleError) individualProcessed++;
    } catch {
      // Ignorar erros individuais
    }
  }
  
  console.log(`[upsert] Batch ${batchNumber}: ${individualProcessed}/${batch.length} (individual mode, trigger: ${errorCode})`);
  return { success: true, processed: individualProcessed };
}

async function processWithUpsert(supabase: any, contas: any[]): Promise<{ processed: number; errors: any[] }> {
  let processed = 0;
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

  // Processar em mini-batches para evitar sobrecarga
  const totalBatches = Math.ceil(records.length / UPSERT_BATCH_SIZE);
  
  for (let i = 0; i < records.length; i += UPSERT_BATCH_SIZE) {
    const batchNumber = Math.floor(i / UPSERT_BATCH_SIZE) + 1;
    const batch = records.slice(i, i + UPSERT_BATCH_SIZE);
    
    try {
      const { error } = await supabase.from('contas_receber').upsert(batch, { 
        onConflict: 'erp_id', 
        ignoreDuplicates: true 
      });
      
      if (!error) {
        processed += batch.length;
      } else {
        // Fallback para processamento individual
        const result = await processIndividually(supabase, batch, batchNumber, error.code || 'unknown');
        processed += result.processed;
      }
    } catch (err) {
      const result = await processIndividually(supabase, batch, batchNumber, 'exception');
      processed += result.processed;
    }
    
    // Delay entre batches para não sobrecarregar
    if (i + UPSERT_BATCH_SIZE < records.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return { processed, errors };
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
  const createN8nResponse = (data: any, slotsRemaining?: number) => {
    const headers: Record<string, string> = {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-API-Version': API_VERSION,
      'X-Processing-Time-Ms': String(data.duration_ms || 0),
    };
    if (slotsRemaining !== undefined) {
      headers['X-RateLimit-Remaining'] = String(slotsRemaining);
      headers['X-RateLimit-Limit'] = String(MAX_CONCURRENT_SYNCS);
    }
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
      return !!(apiKey && (apiKey === expectedKey || apiKey === polloKey));
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
      
      // Verificar slots ativos
      const { count: activeSlots } = await supabase
        .from('sync_rate_limiter')
        .select('id', { count: 'exact', head: true })
        .ilike('slot_key', 'sync_cr%');

      return new Response(JSON.stringify({ 
        last_sync: data || null,
        rate_limiter: {
          active_slots: activeSlots || 0,
          max_slots: MAX_CONCURRENT_SYNCS,
          available: MAX_CONCURRENT_SYNCS - (activeSlots || 0)
        },
        recommended_chunk_size: RECOMMENDED_CHUNK_SIZE,
        api_version: API_VERSION
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ POST /sync - PRINCIPAL ENDPOINT N8N (COM RATE LIMITER) ============
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

      console.log(`📦 [sync] Received ${contas.length} records - acquiring slot...`);

      // =====================================================
      // RATE LIMITER: Aguardar slot disponível
      // =====================================================
      const { slot_id, error: slotError } = await waitForSlot(supabase, 'sync_cr');
      
      if (slotError) {
        console.warn(`[sync] Rate limit exceeded: ${slotError}`);
        // Retorna 200 mas com flag para N8N fazer retry
        return createN8nResponse({
          success: true,
          processed: 0,
          received: contas.length,
          message: 'Rate limit - please retry in 5 seconds',
          retry_after_ms: 5000,
          duration_ms: Date.now() - startTime
        }, 0);
      }

      // Processar com slot adquirido
      let processed = 0;
      let errors = 0;
      
      try {
        const result = await processWithUpsert(supabase, contas);
        processed = result.processed;
        errors = result.errors.length;
      } catch (err) {
        console.error('[sync] Processing error:', err);
        errors = contas.length;
      } finally {
        // SEMPRE liberar slot
        await releaseSlot(supabase, slot_id);
      }

      const duration = Date.now() - startTime;
      console.log(`✅ [sync] ${processed}/${contas.length} in ${duration}ms`);

      // Log async
      void supabase.from('sync_control').insert({
        entidade: 'contas_receber',
        empresa_id: contas[0]?.['ID Empresa'] || null,
        ultima_sync: new Date().toISOString(),
        total_registros: contas.length,
        registros_inseridos: processed,
        duracao_ms: duration,
        status: errors === 0 ? 'success' : 'partial'
      });

      // Verificar slots restantes para headers
      const { count: activeSlots } = await supabase
        .from('sync_rate_limiter')
        .select('id', { count: 'exact', head: true })
        .ilike('slot_key', 'sync_cr%');

      return createN8nResponse({
        success: true,
        processed,
        received: contas.length,
        errors,
        duration_ms: duration
      }, MAX_CONCURRENT_SYNCS - (activeSlots || 0));
    }

    // ============ POST /sync-chunk (COM RATE LIMITER) ============
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

      console.log(`[CHUNK ${chunk_id}/${total_chunks || '?'}] Acquiring slot...`);

      // Rate limiter
      const { slot_id, error: slotError } = await waitForSlot(supabase, 'sync_cr_chunk');
      
      if (slotError) {
        // Para N8N não quebrar loop: responder 200 e instruir retry
        return new Response(JSON.stringify({
          success: true,
          continue_loop: true,
          chunk_id,
          total_chunks: total_chunks || null,
          sync_id: sync_id || null,
          statistics: {
            received: contas.length,
            processed: 0,
            errors: 0,
            rate_per_second: 0
          },
          retry_after_ms: 5000,
          message: 'Rate limit - retry chunk in 5 seconds',
          api_version: API_VERSION
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let processed = 0;
      let errors: any[] = [];
      
      try {
        const result = await processWithUpsert(supabase, contas);
        processed = result.processed;
        errors = result.errors;
      } finally {
        await releaseSlot(supabase, slot_id);
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
        recommended_delay_between_chunks_ms: 3000,
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

    // ============ POST /bulk-sync ============
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

      // Rate limiter para bulk
      const { slot_id, error: slotError } = await waitForSlot(supabase, 'sync_cr_bulk');
      
      if (slotError) {
        // Para N8N não quebrar loop: responder 200 e instruir retry
        return new Response(JSON.stringify({
          success: true,
          continue_loop: true,
          mode: 'bulk',
          statistics: { total: contas.length, processed: 0, errors: 0, rate_per_second: 0 },
          retry_after_ms: 10000,
          message: 'Rate limit - retry bulk in 10 seconds',
          api_version: API_VERSION
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`[BULK-SYNC] Processing ${contas.length} records`);

      let processed = 0;
      let errors: any[] = [];
      
      try {
        const result = await processWithUpsert(supabase, contas);
        processed = result.processed;
        errors = result.errors;
      } finally {
        await releaseSlot(supabase, slot_id);
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
