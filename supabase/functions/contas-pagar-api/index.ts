import { createClient } from 'npm:@supabase/supabase-js@2';
import { timingSafeEqual } from "../_shared/timing-safe.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// =====================================================
// CONFIGURAÇÕES DE PERFORMANCE - v2.4.0 (Rate Limiting)
// =====================================================
const BULK_BATCH_SIZE = 10000;
const MAX_PAYLOAD_SIZE = 200000;
const RECOMMENDED_CHUNK_SIZE = 25000;
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 500;
const API_VERSION = '2.4.0';

// =====================================================
// CONFIGURAÇÕES DE RATE LIMITING
// =====================================================
const MAX_CONCURRENT_SYNCS = 2;       // Máximo de requisições simultâneas
const SLOT_TIMEOUT_MS = 90000;        // Timeout do slot (90s)
const WAIT_RETRY_MS = 500;            // Intervalo entre tentativas de slot
const MAX_WAIT_RETRIES = 120;         // 60 segundos de espera máxima
const MINI_BATCH_SIZE = 100;          // Tamanho do mini-batch interno
const INTER_BATCH_DELAY_MS = 150;     // Delay entre mini-batches

// =====================================================
// UTILITÁRIOS DE RETRY E LOGGING
// =====================================================
interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  operationName?: string;
  alwaysSucceed?: boolean;
}

async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { 
    maxRetries = MAX_RETRIES, 
    delayMs = RETRY_DELAY_MS, 
    operationName = 'operation',
    alwaysSucceed = false 
  } = options;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const errorStr = error instanceof Error ? error.message : (typeof error === 'object' ? JSON.stringify(error) : String(error));
      lastError = error instanceof Error ? error : new Error(errorStr);
      const errorMessage = lastError.message.toLowerCase();
      
      const isRetryable = 
        errorMessage.includes('pldbgapi2') ||
        errorMessage.includes('statement call stack') ||
        errorMessage.includes('deadlock') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('network') ||
        errorMessage.includes('too many connections') ||
        errorMessage.includes('pool') ||
        errorMessage.includes('busy') ||
        errorMessage.includes('temporarily') ||
        errorMessage.includes('unavailable') ||
        errorMessage.includes('socket') ||
        errorMessage.includes('econnreset') ||
        errorMessage.includes('epipe') ||
        errorMessage.includes('abort') ||
        errorMessage.includes('closed');

      if (attempt === maxRetries) {
        console.error(`❌ [${operationName}] Falha após ${attempt} tentativa(s):`, lastError.message);
        throw lastError;
      }

      if (!isRetryable) {
        console.error(`❌ [${operationName}] Erro não recuperável:`, lastError.message);
        throw lastError;
      }

      const jitter = Math.random() * 200;
      const backoffDelay = Math.min(delayMs * Math.pow(2, attempt - 1) + jitter, 10000);
      console.warn(`⚠️ [${operationName}] Tentativa ${attempt}/${maxRetries} falhou: ${lastError.message}. Retry em ${Math.round(backoffDelay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }

  throw lastError || new Error('Retry failed');
}

async function safeExecute<T>(
  operation: () => Promise<T>,
  fallbackValue: T,
  operationName: string
): Promise<{ data: T; success: boolean; error?: string }> {
  try {
    const result = await withRetry(operation, { operationName, maxRetries: MAX_RETRIES });
    return { data: result, success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : (typeof error === 'object' ? JSON.stringify(error) : String(error));
    console.error(`⚠️ [${operationName}] Retornando fallback após erro:`, errorMessage);
    return { data: fallbackValue, success: false, error: errorMessage };
  }
}

function logRequest(method: string, path: string, details?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  console.log(`📥 [${timestamp}] ${method} ${path}`, details ? JSON.stringify(details) : '');
}

function logSuccess(operation: string, details?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  console.log(`✅ [${timestamp}] ${operation}`, details ? JSON.stringify(details) : '');
}

function logError(operation: string, error: unknown, context?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const errorMessage = error instanceof Error ? error.message : (typeof error === 'object' ? JSON.stringify(error) : String(error));
  console.error(`❌ [${timestamp}] ${operation}: ${errorMessage}`, context ? JSON.stringify(context) : '');
}

// =====================================================
// FUNÇÕES DE TRANSFORMAÇÃO
// =====================================================
async function calculateHash(data: Record<string, unknown>): Promise<string> {
  try {
    const dataToHash = [
      data.valor_original,
      data.valor_aberto,
      data.valor_pago,
      data.valor_juros,
      data.valor_desconto,
      data.valor_ajustes,
      data.data_pagamento
    ].join('|');
    
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(dataToHash);
    // Usar SHA-256 (MD5 não é suportado pelo Web Crypto API)
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    // Fallback simples se crypto falhar
    const simpleHash = String(data.valor_original) + String(data.valor_aberto) + String(data.data_pagamento);
    return simpleHash.slice(0, 32);
  }
}

function transformErpData(erpRecord: Record<string, unknown>) {
  return {
    empresa_id: erpRecord['ID Empresa'] || erpRecord.empresa_id,
    empresa_nome: erpRecord['Empresa'] || erpRecord.empresa_nome,
    tipo_documento: erpRecord['Tipo'] || erpRecord.tipo_documento,
    numero_documento: erpRecord['Nota'] || erpRecord.numero_documento,
    parcela: erpRecord['Seq'] || erpRecord.parcela || 1,
    fornecedor_codigo: erpRecord['Código'] || erpRecord.fornecedor_codigo,
    fornecedor_nome: erpRecord['Cliente'] || erpRecord.fornecedor_nome,
    valor_original: erpRecord['Valor_Trc'] || erpRecord.valor_original || 0,
    valor_aberto: erpRecord['Valor em Aberto'] || erpRecord.valor_aberto || 0,
    valor_pago: erpRecord['Valor Pago'] || erpRecord.valor_pago || 0,
    valor_juros: erpRecord['Valor Juros'] || erpRecord.valor_juros || 0,
    valor_desconto: erpRecord['Valor Desconto'] || erpRecord.valor_desconto || 0,
    valor_ajustes: erpRecord['Valor Ajustes'] || erpRecord.valor_ajustes || 0,
    data_emissao: parseDate(erpRecord['Emissão'] || erpRecord.data_emissao),
    data_vencimento: parseDate(erpRecord['Vencimento'] || erpRecord.data_vencimento),
    data_pagamento: parseDate(erpRecord['Data Pgto'] || erpRecord.data_pagamento),
    categoria_codigo: erpRecord['ID Historico'] || erpRecord.categoria_codigo,
    categoria_nome: erpRecord['Historico'] || erpRecord.categoria_nome,
    portador: erpRecord['Portador'] || erpRecord.portador || 'SEM PORTADOR',
    conta: erpRecord['Conta'] || erpRecord.conta || 'SEM CONTA'
  };
}

function parseDate(dateValue: unknown): string | null {
  if (!dateValue) return null;
  try {
    const date = new Date(dateValue as string);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

// =====================================================
// FUNÇÕES DE RATE LIMITING
// =====================================================
async function cleanupExpiredSlots(supabase: any): Promise<void> {
  try {
    await supabase
      .from('sync_rate_limiter')
      .delete()
      .lt('expires_at', new Date().toISOString());
  } catch (err) {
    console.warn('⚠️ [rate-limiter] Erro ao limpar slots expirados:', err);
  }
}

async function getActiveSlotCount(supabase: any): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('sync_rate_limiter')
      .select('*', { count: 'exact', head: true })
      .gt('expires_at', new Date().toISOString());
    
    if (error) throw error;
    return count || 0;
  } catch (err) {
    console.warn('⚠️ [rate-limiter] Erro ao contar slots:', err);
    return 0;
  }
}

async function acquireSlot(supabase: any, requestId: string): Promise<boolean> {
  try {
    // Limpar slots expirados primeiro
    await cleanupExpiredSlots(supabase);
    
    // Verificar slots disponíveis
    const activeCount = await getActiveSlotCount(supabase);
    
    if (activeCount >= MAX_CONCURRENT_SYNCS) {
      console.log(`⏳ [rate-limiter] Sem slots disponíveis (${activeCount}/${MAX_CONCURRENT_SYNCS})`);
      return false;
    }
    
    // Tentar adquirir slot
    const { error } = await supabase
      .from('sync_rate_limiter')
      .insert({
        slot_key: `sync_${Date.now()}_${requestId.substring(0, 8)}`,
        request_id: requestId,
        expires_at: new Date(Date.now() + SLOT_TIMEOUT_MS).toISOString()
      });
    
    if (error) {
      // Erro de constraint única = outro processo pegou o slot
      if (error.code === '23505') {
        console.log(`⏳ [rate-limiter] Conflito de slot, tentando novamente...`);
        return false;
      }
      throw error;
    }
    
    console.log(`✅ [rate-limiter] Slot adquirido: ${requestId.substring(0, 8)}`);
    return true;
  } catch (err) {
    console.warn('⚠️ [rate-limiter] Erro ao adquirir slot:', err);
    return false;
  }
}

async function releaseSlot(supabase: any, requestId: string): Promise<void> {
  try {
    await supabase
      .from('sync_rate_limiter')
      .delete()
      .eq('request_id', requestId);
    
    console.log(`🔓 [rate-limiter] Slot liberado: ${requestId.substring(0, 8)}`);
  } catch (err) {
    console.warn('⚠️ [rate-limiter] Erro ao liberar slot:', err);
  }
}

async function waitForSlot(supabase: any, requestId: string): Promise<{ acquired: boolean; waitTime: number }> {
  const startWait = Date.now();
  let attempts = 0;
  
  while (attempts < MAX_WAIT_RETRIES) {
    const acquired = await acquireSlot(supabase, requestId);
    
    if (acquired) {
      return { acquired: true, waitTime: Date.now() - startWait };
    }
    
    attempts++;
    if (attempts < MAX_WAIT_RETRIES) {
      await new Promise(r => setTimeout(r, WAIT_RETRY_MS));
    }
  }
  
  return { acquired: false, waitTime: Date.now() - startWait };
}

function generateErpId(record: Record<string, unknown>): string {
  const empresaId = record['ID Empresa'] || record.empresa_id;
  const tipo = record['Tipo'] || record.tipo_documento;
  const nota = record['Nota'] || record.numero_documento;
  const seq = record['Seq'] || record.parcela || 1;
  const codigo = record['Código'] || record.fornecedor_codigo;
  return `${empresaId}-${tipo}-${nota}-${seq}-${codigo}`;
}

// =====================================================
// PROCESSAMENTO DE REGISTROS COM RETRY
// =====================================================
async function processRecordsWithRetry(
  supabase: any,
  records: Record<string, unknown>[],
  operationName: string,
  forceUpdate: boolean = false
): Promise<{ inserted: number; updated: number; skipped: number; total: number; force_update?: boolean }> {
  // Log detalhado dos primeiros registros para debug
  if (records.length > 0) {
    const sampleSize = Math.min(3, records.length);
    console.log(`📊 [${operationName}] Amostra de ${sampleSize} registros recebidos do N8N:`);
    for (let i = 0; i < sampleSize; i++) {
      const r = records[i];
      console.log(`  📄 Registro ${i + 1}:`, JSON.stringify({
        erp_id_campos: {
          'ID Empresa': r['ID Empresa'],
          'Tipo': r['Tipo'],
          'Nota': r['Nota'],
          'Seq': r['Seq'],
          'Código': r['Código']
        },
        valores: {
          'Valor_Trc': r['Valor_Trc'],
          'Valor em Aberto': r['Valor em Aberto'],
          'Valor Pago': r['Valor Pago'],
          'Data Pgto': r['Data Pgto']
        }
      }));
    }
  }

  // Preparar dados com erp_id e hash
  const preparedRecords = await Promise.all(records.map(async (conta) => {
    const transformed = transformErpData(conta);
    const erpId = generateErpId(conta);
    const dataHash = await calculateHash(transformed);
    return {
      erp_id: erpId,
      data_hash: dataHash,
      ...transformed
    };
  }));

  // Log do primeiro registro transformado
  if (preparedRecords.length > 0) {
    console.log(`📊 [${operationName}] Primeiro registro TRANSFORMADO:`, JSON.stringify({
      erp_id: preparedRecords[0].erp_id,
      valor_aberto: preparedRecords[0].valor_aberto,
      valor_pago: preparedRecords[0].valor_pago,
      data_pagamento: preparedRecords[0].data_pagamento,
      data_hash: preparedRecords[0].data_hash
    }));
  }

  // Log do force_update
  if (forceUpdate) {
    console.log(`🔄 [${operationName}] FORCE UPDATE ATIVADO - Ignorando comparação de hash`);
  }

  // Executar com retry automático
  const result = await withRetry(
    async () => {
      const { data, error } = await supabase.rpc('bulk_upsert_contas_pagar_v2', {
        p_records: preparedRecords,
        p_force_update: forceUpdate
      });
      
      if (error) throw error;
      return data as { inserted: number; updated: number; skipped: number; total: number; force_update?: boolean };
    },
    { operationName, maxRetries: MAX_RETRIES }
  );

  // Log do resultado
  console.log(`📊 [${operationName}] Resultado do upsert:`, JSON.stringify(result));

  return result;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const url = new URL(req.url);
  const path = url.pathname;

  logRequest(req.method, path);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validar API Key para endpoints de sincronização
    const validateApiKey = async () => {
      const apiKey = req.headers.get('x-api-key');
      if (!apiKey) return false;

      // Check legacy N8N_API_KEY (timing-safe)
      const expectedKey = Deno.env.get('N8N_API_KEY');
      if (apiKey && expectedKey && timingSafeEqual(apiKey, expectedKey)) return true;

      // Check erp_config table
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
      return !!empresa;
    };

    // Validar autenticação (API Key ou JWT)
    const validateAuth = async () => {
      // Try API key first (all methods)
      if (await validateApiKey()) return true;
      
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error } = await supabase.auth.getUser(token);
        return !error && user;
      }
      
      return false;
    };

    // =====================================================
    // GET /status - Status da API
    // =====================================================
    if (path.endsWith('/status') && req.method === 'GET') {
      // Require API key for status endpoint
      if (!await validateApiKey()) {
        logError('status', 'Unauthorized - API Key inválida');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Buscar slots ativos para mostrar no status
      const activeSlots = await getActiveSlotCount(supabase);
      
      return new Response(JSON.stringify({
        status: 'online',
        version: API_VERSION,
        timestamp: new Date().toISOString(),
        config: {
          bulk_batch_size: BULK_BATCH_SIZE,
          max_payload_size: MAX_PAYLOAD_SIZE,
          recommended_chunk_size: RECOMMENDED_CHUNK_SIZE,
          max_retries: MAX_RETRIES
        },
        rate_limiting: {
          max_concurrent_syncs: MAX_CONCURRENT_SYNCS,
          active_syncs: activeSlots,
          available_slots: MAX_CONCURRENT_SYNCS - activeSlots,
          slot_timeout_seconds: SLOT_TIMEOUT_MS / 1000,
          max_wait_seconds: (MAX_WAIT_RETRIES * WAIT_RETRY_MS) / 1000
        },
        features: {
          force_update: 'Adicione ?force_update=true para forçar atualização ignorando hash',
          debug_payload: 'POST /debug-payload para analisar payload sem modificar dados',
          rate_limiting: 'Controle de concorrência automático - máximo 2 syncs simultâneos'
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // POST /debug-payload - Analisar payload sem processar
    // =====================================================
    if (path.endsWith('/debug-payload') && req.method === 'POST') {
      if (!await validateApiKey()) {
        logError('debug-payload', 'Unauthorized - API Key inválida');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const body = await req.json();
      const contas = body.contas || body.data || body;

      if (!Array.isArray(contas)) {
        return new Response(JSON.stringify({ error: 'Invalid payload - array expected' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // IDs específicos para buscar
      const targetErpIds = ['8-2-1-1-4006', '8-2-12-1-2630'];
      
      // Analisar registros recebidos
      const analysis = {
        total_received: contas.length,
        sample_raw: contas.slice(0, 3).map((c: Record<string, unknown>) => ({
          raw: {
            'ID Empresa': c['ID Empresa'],
            'Tipo': c['Tipo'],
            'Nota': c['Nota'],
            'Seq': c['Seq'],
            'Código': c['Código'],
            'Valor_Trc': c['Valor_Trc'],
            'Valor em Aberto': c['Valor em Aberto'],
            'Valor Pago': c['Valor Pago'],
            'Data Pgto': c['Data Pgto'],
            'Cliente': c['Cliente']
          },
          generated_erp_id: generateErpId(c),
          transformed: transformErpData(c)
        })),
        target_records: [] as Array<{
          erp_id: string;
          found: boolean;
          raw?: Record<string, unknown>;
          transformed?: Record<string, unknown>;
        }>,
        campos_disponiveis: contas.length > 0 ? Object.keys(contas[0]) : []
      };

      // Buscar registros específicos
      for (const targetId of targetErpIds) {
        const found = contas.find((c: Record<string, unknown>) => generateErpId(c) === targetId);
        if (found) {
          analysis.target_records.push({
            erp_id: targetId,
            found: true,
            raw: {
              'Valor_Trc': found['Valor_Trc'],
              'Valor em Aberto': found['Valor em Aberto'],
              'Valor Pago': found['Valor Pago'],
              'Data Pgto': found['Data Pgto'],
              'Cliente': found['Cliente']
            },
            transformed: transformErpData(found)
          });
        } else {
          analysis.target_records.push({
            erp_id: targetId,
            found: false
          });
        }
      }

      // Buscar o que está no banco para comparar
      const { data: dbRecords } = await supabase
        .from('contas_pagar')
        .select('erp_id, valor_aberto, valor_pago, data_pagamento, data_hash, status')
        .in('erp_id', targetErpIds);

      logSuccess('debug-payload', { total: contas.length, targets_found: analysis.target_records.filter(r => r.found).length });

      return new Response(JSON.stringify({
        success: true,
        analysis,
        database_records: dbRecords || [],
        message: 'Use esses dados para comparar o que o N8N envia vs o que está no banco'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // POST /bulk-sync - Sincronização em massa (COM RATE LIMITING)
    // =====================================================
    if (path.endsWith('/bulk-sync') && req.method === 'POST') {
      if (!await validateApiKey()) {
        logError('bulk-sync', 'Unauthorized - API Key inválida');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const requestId = crypto.randomUUID();
      const body = await req.json();
      const contas = body.contas || body.data || body;
      const syncId = body.sync_id || requestId;
      const chunkNumber = body.chunk_number || 1;
      const totalChunks = body.total_chunks;
      
      // Flag force_update via query param ou body
      const forceUpdate = url.searchParams.get('force_update') === 'true' || body.force_update === true;

      if (!Array.isArray(contas) || contas.length === 0) {
        logError('bulk-sync', 'Payload inválido - array esperado');
        return new Response(JSON.stringify({ error: 'Invalid payload - array expected' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (contas.length > MAX_PAYLOAD_SIZE) {
        logError('bulk-sync', `Payload muito grande: ${contas.length}`);
        return new Response(JSON.stringify({ 
          error: `Payload too large. Max: ${MAX_PAYLOAD_SIZE}, received: ${contas.length}` 
        }), {
          status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`📦 [bulk-sync] Chunk ${chunkNumber}/${totalChunks || '?'}: ${contas.length} registros${forceUpdate ? ' (FORCE UPDATE)' : ''} - Aguardando slot...`);

      // =====================================================
      // RATE LIMITING: Aguardar slot disponível
      // =====================================================
      const { acquired, waitTime } = await waitForSlot(supabase, requestId);
      
      if (!acquired) {
        const activeCount = await getActiveSlotCount(supabase);
        logError('bulk-sync', `Rate limit excedido após ${waitTime}ms de espera`);
        return new Response(JSON.stringify({
          success: false,
          error: 'Rate limit exceeded - too many concurrent requests',
          retry_after_ms: 5000,
          queue_info: {
            max_concurrent: MAX_CONCURRENT_SYNCS,
            active_syncs: activeCount,
            wait_time_ms: waitTime
          }
        }), {
          status: 429,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json', 
            'Retry-After': '5',
            'X-RateLimit-Limit': MAX_CONCURRENT_SYNCS.toString(),
            'X-RateLimit-Remaining': '0'
          }
        });
      }

      console.log(`✅ [bulk-sync] Slot adquirido após ${waitTime}ms - Processando...`);

      try {
        // =====================================================
        // PROCESSAMENTO COM THROTTLE INTERNO
        // =====================================================
        const processStartTime = Date.now();
        
        // Processar com fallback - SEMPRE retorna sucesso
        const { data: result, success: processSuccess, error: processError } = await safeExecute(
          () => processRecordsWithRetry(supabase, contas, 'bulk-sync', forceUpdate),
          { inserted: 0, updated: 0, skipped: contas.length, total: contas.length },
          'bulk-sync-process'
        );
        
        const processDuration = Date.now() - processStartTime;
        const totalDuration = Date.now() - startTime;

        // Registrar chunk (mesmo com erro parcial)
        try {
          await supabase.from('sync_chunks_tracking').insert({
            sync_id: syncId,
            entidade: 'contas_pagar',
            chunk_number: chunkNumber,
            total_chunks: totalChunks,
            records_in_chunk: contas.length,
            records_processed: result.total,
            records_inserted: result.inserted,
            records_updated: result.updated,
            records_skipped: result.skipped,
            status: processSuccess ? 'completed' : 'partial',
            error_message: processError || null,
            completed_at: new Date().toISOString(),
            duration_ms: processDuration
          });
        } catch (trackingErr) {
          console.warn('⚠️ Erro ao registrar chunk:', trackingErr);
        }

        if (processSuccess) {
          logSuccess('bulk-sync', {
            chunk: chunkNumber,
            total: contas.length,
            inserted: result.inserted,
            updated: result.updated,
            skipped: result.skipped,
            wait_time_ms: waitTime,
            process_duration_ms: processDuration,
            force_update: forceUpdate
          });
        } else {
          console.warn(`⚠️ [bulk-sync] Chunk ${chunkNumber} processado com erro parcial: ${processError}`);
        }

        // Obter slots restantes para header
        const remainingSlots = Math.max(0, MAX_CONCURRENT_SYNCS - await getActiveSlotCount(supabase));

        // SEMPRE retorna 200 para o N8N continuar
        return new Response(JSON.stringify({
          success: true,
          partial: !processSuccess,
          sync_id: syncId,
          chunk_number: chunkNumber,
          force_update: forceUpdate,
          statistics: {
            total_received: contas.length,
            inserted: result.inserted,
            updated: result.updated,
            skipped: result.skipped,
            errors: processSuccess ? 0 : 1
          },
          duration_ms: totalDuration,
          rate_limit_info: {
            wait_time_ms: waitTime,
            process_time_ms: processDuration,
            slots_remaining: remainingSlots
          },
          performance: {
            records_per_second: processDuration > 0 ? Math.round(contas.length / (processDuration / 1000)) : 0
          },
          warning: processError || undefined
        }), {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': MAX_CONCURRENT_SYNCS.toString(),
            'X-RateLimit-Remaining': remainingSlots.toString(),
            'X-Processing-Time-Ms': processDuration.toString(),
            'X-Wait-Time-Ms': waitTime.toString()
          }
        });
      } finally {
        // SEMPRE liberar o slot, mesmo em caso de erro
        await releaseSlot(supabase, requestId);
      }
    }

    // =====================================================
    // POST /sync-incremental - Sincronização incremental
    // =====================================================
    if (path.endsWith('/sync-incremental') && req.method === 'POST') {
      if (!await validateApiKey()) {
        logError('sync-incremental', 'Unauthorized');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const body = await req.json();
      const contas = body.contas || body.data || body;
      const forceUpdate = url.searchParams.get('force_update') === 'true' || body.force_update === true;

      if (!Array.isArray(contas) || contas.length === 0) {
        return new Response(JSON.stringify({ error: 'Invalid payload' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`🔄 [sync-incremental] Processando ${contas.length} registros${forceUpdate ? ' (FORCE UPDATE)' : ''}`);

      try {
        const result = await processRecordsWithRetry(supabase, contas, 'sync-incremental', forceUpdate);
        const duration = Date.now() - startTime;
        const empresaId = contas[0] ? (contas[0]['ID Empresa'] || contas[0].empresa_id) : null;

        // ✅ OTIMIZAÇÃO: Só registrar em sync_control se houve alterações reais
        if (result.inserted > 0 || result.updated > 0) {
          await supabase.from('sync_control').insert({
            entidade: 'contas_pagar',
            empresa_id: empresaId,
            ultima_sync: new Date().toISOString(),
            total_registros: contas.length,
            registros_inseridos: result.inserted,
            registros_atualizados: result.updated,
            registros_ignorados: result.skipped,
            duracao_ms: duration,
            status: 'success'
          });
        } else {
          console.log(`⏭️ [sync-incremental] Nenhuma alteração - sync_control ignorado (${result.skipped} skipped)`);
        }

        logSuccess('sync-incremental', { total: contas.length, duration_ms: duration, force_update: forceUpdate });

        return new Response(JSON.stringify({
          success: true,
          force_update: forceUpdate,
          statistics: {
            total_received: contas.length,
            inserted: result.inserted,
            updated: result.updated,
            skipped: result.skipped,
            errors: 0
          },
          duration_ms: duration,
          message: forceUpdate 
            ? `${result.updated} registros atualizados (force_update ativado)`
            : `${result.skipped} registros ignorados (sem alterações)`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        logError('sync-incremental', error);
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // =====================================================
    // POST /sync-chunk - Processar chunk (compatível com N8N)
    // =====================================================
    if (path.endsWith('/sync-chunk') && req.method === 'POST') {
      // Redireciona para bulk-sync mantendo compatibilidade
      const redirectUrl = new URL(req.url);
      redirectUrl.pathname = redirectUrl.pathname.replace('/sync-chunk', '/bulk-sync');
      
      const newReq = new Request(redirectUrl.toString(), {
        method: req.method,
        headers: req.headers,
        body: await req.text()
      });
      
      return await fetch(newReq);
    }

    // =====================================================
    // POST /sync-complete - Finalizar sincronização
    // =====================================================
    if (path.endsWith('/sync-complete') && req.method === 'POST') {
      if (!await validateApiKey()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { sync_id, empresa_id } = await req.json();

      if (!sync_id) {
        return new Response(JSON.stringify({ error: 'sync_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Buscar resumo dos chunks
      const { data: progress } = await supabase
        .from('sync_chunks_progress')
        .select('*')
        .eq('sync_id', sync_id)
        .single();

      // Registrar no sync_control
      await supabase.from('sync_control').insert({
        entidade: 'contas_pagar',
        empresa_id: empresa_id,
        ultima_sync: new Date().toISOString(),
        total_registros: progress?.total_processed || 0,
        registros_inseridos: progress?.total_inserted || 0,
        registros_atualizados: progress?.total_updated || 0,
        registros_ignorados: progress?.total_skipped || 0,
        duracao_ms: progress?.total_duration_ms || 0,
        status: progress?.overall_status === 'completed' ? 'success' : 'partial'
      });

      logSuccess('sync-complete', { sync_id });

      return new Response(JSON.stringify({
        success: true,
        sync_id,
        summary: progress || { message: 'No chunks found for this sync_id' }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // GET /chunks-progress - Progresso dos chunks
    // =====================================================
    if (path.endsWith('/chunks-progress') && req.method === 'GET') {
      if (!await validateAuth()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const syncId = url.searchParams.get('sync_id');

      let query = supabase
        .from('sync_chunks_progress')
        .select('*')
        .eq('entidade', 'contas_pagar')
        .order('started_at', { ascending: false })
        .limit(10);

      if (syncId) {
        query = query.eq('sync_id', syncId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // POST /sync - Sincronização legada (compatibilidade)
    // =====================================================
    if (path.endsWith('/sync') && req.method === 'POST') {
      if (!await validateApiKey()) {
        logError('sync', 'Unauthorized');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let contas: Record<string, unknown>[] = [];
      let bodyData: Record<string, unknown> = {};
      try {
        bodyData = await req.json();
        contas = (bodyData.contas || bodyData.data || bodyData) as Record<string, unknown>[];
        if (!Array.isArray(contas)) contas = [];
      } catch (parseErr) {
        console.warn('⚠️ [sync] Erro ao fazer parse do body, tentando como array direto');
        contas = [];
      }

      const forceUpdate = url.searchParams.get('force_update') === 'true' || bodyData.force_update === true;

      if (contas.length === 0) {
        return new Response(JSON.stringify({ 
          success: true, 
          statistics: { total_received: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 },
          message: 'Nenhum registro recebido'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`📦 [sync-legado] Processando ${contas.length} registros${forceUpdate ? ' (FORCE UPDATE)' : ''}`);

      // Processar com fallback - SEMPRE retorna sucesso
      const { data: result, success: processSuccess, error: processError } = await safeExecute(
        () => processRecordsWithRetry(supabase, contas, 'sync-legado', forceUpdate),
        { inserted: 0, updated: 0, skipped: contas.length, total: contas.length },
        'sync-legado-process'
      );
      
      const duration = Date.now() - startTime;
      const empresaId = contas[0] ? (contas[0]['ID Empresa'] || contas[0].empresa_id) : null;

      // ✅ SEMPRE registrar em sync_control para evitar loop infinito no n8n
      try {
        await supabase.from('sync_control').insert({
          entidade: 'contas_pagar',
          empresa_id: empresaId,
          ultima_sync: new Date().toISOString(),
          total_registros: contas.length,
          registros_inseridos: result.inserted,
          registros_atualizados: result.updated,
          registros_ignorados: result.skipped,
          duracao_ms: duration,
          status: processSuccess ? 'success' : 'partial'
        });
      } catch (trackErr) {
        console.warn('⚠️ Erro ao registrar sync_control:', trackErr);
      }

      // Recalcular status baseado em datas (pendente->vencido, vencido->pendente)
      try {
        const { data: statusResult } = await supabase.rpc('recalculate_contas_pagar_status');
        if (statusResult) {
          console.log(`🔄 [sync-legado] Status recalculados:`, JSON.stringify(statusResult));
        }
      } catch (statusErr) {
        console.warn('⚠️ [sync-legado] Erro ao recalcular status:', statusErr);
      }

      if (processSuccess) {
        logSuccess('sync-legado', { total: contas.length, duration_ms: duration, force_update: forceUpdate });
      } else {
        console.warn(`⚠️ [sync-legado] Processado com erro parcial: ${processError}`);
      }

      // SEMPRE retorna 200
      return new Response(JSON.stringify({
        success: true,
        partial: !processSuccess,
        force_update: forceUpdate,
        statistics: {
          total_received: contas.length,
          inserted: result.inserted,
          updated: result.updated,
          skipped: result.skipped,
          errors: processSuccess ? 0 : 1
        },
        duration_ms: duration,
        message: processSuccess 
          ? (forceUpdate 
              ? `${result.updated} registros atualizados (force_update)` 
              : `${result.skipped} registros ignorados (sem alterações)`)
          : `Processado com erro parcial: ${processError}`,
        warning: processError || undefined
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // GET / - Listar contas
    // =====================================================
    if (path.endsWith('/contas-pagar-api') && req.method === 'GET') {
      if (!await validateAuth()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data, error } = await supabase
        .from('contas_pagar')
        .select('*')
        .order('data_vencimento', { ascending: false })
        .limit(100);

      if (error) throw error;

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // GET /stats - Estatísticas de sincronização
    // =====================================================
    if (path.endsWith('/stats') && req.method === 'GET') {
      if (!await validateAuth()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data, error } = await supabase
        .from('sync_control')
        .select('*')
        .eq('entidade', 'contas_pagar')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // GET /last-sync - Data da última sincronização
    // =====================================================
    if (path.endsWith('/last-sync') && req.method === 'GET') {
      const apiKey = req.headers.get('x-api-key');
      const expectedKey = Deno.env.get('N8N_API_KEY');
      
      if (apiKey !== expectedKey && !await validateAuth()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: lastSync, error } = await supabase
        .from('sync_control')
        .select('ultima_sync, total_registros, registros_inseridos, registros_atualizados')
        .eq('entidade', 'contas_pagar')
        .eq('status', 'success')
        .order('ultima_sync', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() - 7);

      const lastSyncDate = lastSync?.ultima_sync 
        ? new Date(lastSync.ultima_sync).toISOString().split('T')[0]
        : defaultDate.toISOString().split('T')[0];

      return new Response(JSON.stringify({
        lastSyncDate,
        lastSync: lastSync || null,
        message: lastSync 
          ? `Última sync: ${lastSync.total_registros} registros` 
          : 'Nenhuma sync anterior encontrada, usando 7 dias como padrão'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // POST /trigger-n8n - Disparar sincronização via N8N
    // =====================================================
    if (path.endsWith('/trigger-n8n') && req.method === 'POST') {
      if (!await validateAuth()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const n8nWebhookUrl = Deno.env.get('N8N_CONTAS_PAGAR_WEBHOOK');
      
      if (!n8nWebhookUrl) {
        return new Response(JSON.stringify({ 
          error: 'N8N webhook não configurado',
          message: 'Configure o secret N8N_CONTAS_PAGAR_WEBHOOK no backend'
        }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: lastSync } = await supabase
        .from('sync_control')
        .select('ultima_sync')
        .eq('entidade', 'contas_pagar')
        .eq('status', 'success')
        .order('ultima_sync', { ascending: false })
        .limit(1)
        .single();

      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() - 7);
      const lastSyncDate = lastSync?.ultima_sync 
        ? new Date(lastSync.ultima_sync).toISOString().split('T')[0]
        : defaultDate.toISOString().split('T')[0];

      try {
        const response = await withRetry(
          async () => {
            const resp = await fetch(n8nWebhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                trigger: 'manual',
                lastSyncDate,
                timestamp: new Date().toISOString()
              })
            });

            if (!resp.ok) {
              throw new Error(`N8N retornou status ${resp.status}`);
            }
            return resp;
          },
          { operationName: 'trigger-n8n', maxRetries: 2 }
        );

        logSuccess('trigger-n8n', { lastSyncDate, status: response.status });

        return new Response(JSON.stringify({
          success: true,
          message: 'Sincronização disparada via N8N',
          lastSyncDate,
          n8n_status: response.status
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (n8nError) {
        logError('trigger-n8n', n8nError);
        return new Response(JSON.stringify({
          success: false,
          error: n8nError instanceof Error ? n8nError.message : 'Erro ao disparar N8N',
          message: 'Verifique se o workflow N8N está ativo'
        }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // =====================================================
    // GET /query - Consulta avançada com filtros e paginação
    // =====================================================
    if (path.endsWith('/query') && req.method === 'GET') {
      if (!await validateAuth()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const empresaId = url.searchParams.get('empresa_id');
      const fornecedorCodigo = url.searchParams.get('fornecedor_codigo');
      const status = url.searchParams.get('status');
      const vencimentoDe = url.searchParams.get('vencimento_de');
      const vencimentoAte = url.searchParams.get('vencimento_ate');
      const emissaoDe = url.searchParams.get('emissao_de');
      const emissaoAte = url.searchParams.get('emissao_ate');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 1000);
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const orderBy = url.searchParams.get('order_by') || 'data_vencimento';
      const orderDir = url.searchParams.get('order_dir') === 'asc';

      let query = supabase
        .from('contas_pagar')
        .select('*', { count: 'exact' });

      if (empresaId) query = query.eq('empresa_id', empresaId);
      if (fornecedorCodigo) query = query.eq('fornecedor_codigo', fornecedorCodigo);
      if (status) {
        const statusList = status.split(',').map(s => s.trim());
        query = query.in('status', statusList);
      }
      if (vencimentoDe) query = query.gte('data_vencimento', vencimentoDe);
      if (vencimentoAte) query = query.lte('data_vencimento', vencimentoAte);
      if (emissaoDe) query = query.gte('data_emissao', emissaoDe);
      if (emissaoAte) query = query.lte('data_emissao', emissaoAte);

      query = query.order(orderBy, { ascending: orderDir }).range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error) throw error;

      const duration = Date.now() - startTime;
      logSuccess('query', { filters: { empresaId, status, limit, offset }, results: data?.length, total: count });

      return new Response(JSON.stringify({
        data,
        pagination: { total: count, limit, offset, has_more: (count || 0) > offset + limit },
        meta: { duration_ms: duration, processed_at: new Date().toISOString() }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // PUT /update - Atualização individual de título
    // =====================================================
    if (path.endsWith('/update') && req.method === 'PUT') {
      if (!await validateAuth()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const body = await req.json();
      const { id, ...updates } = body;

      if (!id) {
        return new Response(JSON.stringify({ error: 'campo_obrigatorio', message: 'Campo "id" é obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Campos permitidos para atualização
      const allowedFields = [
        'valor_original', 'valor_aberto', 'valor_pago', 'valor_juros', 'valor_desconto', 'valor_ajustes',
        'data_vencimento', 'data_pagamento', 'portador', 'conta', 'categoria_codigo', 'categoria_nome',
        'status', 'observacao', 'numero_documento', 'tipo_documento'
      ];

      const sanitizedUpdates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          sanitizedUpdates[key] = value;
        }
      }

      if (Object.keys(sanitizedUpdates).length === 0) {
        return new Response(JSON.stringify({ error: 'sem_alteracoes', message: 'Nenhum campo válido para atualização' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      sanitizedUpdates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('contas_pagar')
        .update(sanitizedUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return new Response(JSON.stringify({ error: 'nao_encontrado', message: `Título ${id} não encontrado` }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        throw error;
      }

      const duration = Date.now() - startTime;
      logSuccess('update', { id, fields: Object.keys(sanitizedUpdates), duration_ms: duration });

      return new Response(JSON.stringify({
        success: true,
        data,
        meta: { duration_ms: duration, processed_at: new Date().toISOString() }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // POST /cancelar - Cancelamento de título via API
    // =====================================================
    if (path.endsWith('/cancelar') && req.method === 'POST') {
      if (!await validateAuth()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const body = await req.json();
      const { id, ids, motivo } = body;

      const targetIds = ids || (id ? [id] : []);
      if (targetIds.length === 0) {
        return new Response(JSON.stringify({ error: 'campo_obrigatorio', message: 'Campo "id" ou "ids" é obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (!motivo) {
        return new Response(JSON.stringify({ error: 'campo_obrigatorio', message: 'Campo "motivo" é obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data, error } = await supabase
        .from('contas_pagar')
        .update({
          status: 'cancelado',
          observacao: motivo,
          updated_at: new Date().toISOString()
        })
        .in('id', targetIds)
        .select('id, status');

      if (error) throw error;

      const duration = Date.now() - startTime;
      logSuccess('cancelar', { ids: targetIds, cancelados: data?.length, duration_ms: duration });

      return new Response(JSON.stringify({
        success: true,
        cancelados: data?.length || 0,
        ids: data?.map((d: any) => d.id) || [],
        meta: { duration_ms: duration, processed_at: new Date().toISOString() }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // POST /registrar-pagamento - Registrar pagamento/baixa
    // =====================================================
    if (path.endsWith('/registrar-pagamento') && req.method === 'POST') {
      if (!await validateAuth()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const body = await req.json();
      const { conta_pagar_id, valor_pago, data_pagamento, metodo_pagamento, observacao } = body;

      if (!conta_pagar_id || !valor_pago) {
        return new Response(JSON.stringify({ error: 'campo_obrigatorio', message: 'Campos "conta_pagar_id" e "valor_pago" são obrigatórios' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Verificar se o título existe e não está cancelado
      const { data: titulo, error: tituloErr } = await supabase
        .from('contas_pagar')
        .select('id, status, valor_original, valor_pago, valor_aberto')
        .eq('id', conta_pagar_id)
        .single();

      if (tituloErr || !titulo) {
        return new Response(JSON.stringify({ error: 'nao_encontrado', message: `Título ${conta_pagar_id} não encontrado` }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (titulo.status === 'cancelado') {
        return new Response(JSON.stringify({ error: 'titulo_cancelado', message: 'Não é possível registrar pagamento em título cancelado' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Inserir pagamento
      const { data: pagamento, error: pagErr } = await supabase
        .from('pagamentos')
        .insert({
          conta_pagar_id,
          valor: valor_pago,
          data_pagamento: data_pagamento || new Date().toISOString().split('T')[0],
          metodo_pagamento: metodo_pagamento || 'API',
          observacao: observacao || 'Pagamento registrado via API',
          baixa_origem: 'api'
        })
        .select()
        .single();

      if (pagErr) throw pagErr;

      // Atualizar título
      const novoValorPago = (titulo.valor_pago || 0) + valor_pago;
      const novoValorAberto = Math.max(0, (titulo.valor_original || 0) - novoValorPago);
      const novoStatus = novoValorAberto <= 0 ? 'pago' : 'parcial';

      await supabase
        .from('contas_pagar')
        .update({
          valor_pago: novoValorPago,
          valor_aberto: novoValorAberto,
          status: novoStatus,
          data_pagamento: novoStatus === 'pago' ? (data_pagamento || new Date().toISOString().split('T')[0]) : null,
          data_baixa: novoStatus === 'pago' ? new Date().toISOString() : null,
          baixa_origem: 'api',
          updated_at: new Date().toISOString()
        })
        .eq('id', conta_pagar_id);

      const duration = Date.now() - startTime;
      logSuccess('registrar-pagamento', { conta_pagar_id, valor_pago, status: novoStatus, duration_ms: duration });

      return new Response(JSON.stringify({
        success: true,
        pagamento,
        titulo_atualizado: { id: conta_pagar_id, status: novoStatus, valor_pago: novoValorPago, valor_aberto: novoValorAberto },
        meta: { duration_ms: duration, processed_at: new Date().toISOString() }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // GET /parcelas - Consulta de parcelas de um título
    // =====================================================
    if (path.endsWith('/parcelas') && req.method === 'GET') {
      if (!await validateAuth()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const contaPagarId = url.searchParams.get('conta_pagar_id');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = supabase
        .from('parcelas')
        .select('*', { count: 'exact' });

      if (contaPagarId) query = query.eq('conta_pagar_id', contaPagarId);

      query = query.order('numero_parcela', { ascending: true }).range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({
        data,
        pagination: { total: count, limit, offset },
        meta: { duration_ms: Date.now() - startTime, processed_at: new Date().toISOString() }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // POST /parcelas/sync - Sync de parcelas do ERP
    // =====================================================
    if (path.includes('/parcelas/sync') && req.method === 'POST') {
      if (!await validateApiKey()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const body = await req.json();
      const parcelas = body.parcelas || body.data || body;

      if (!Array.isArray(parcelas) || parcelas.length === 0) {
        return new Response(JSON.stringify({ error: 'payload_invalido', message: 'Array de parcelas esperado' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (parcelas.length > 5000) {
        return new Response(JSON.stringify({ error: 'payload_excedido', message: 'Máximo 5000 parcelas por request' }), {
          status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data, error } = await supabase
        .from('parcelas')
        .upsert(parcelas, { onConflict: 'id' })
        .select('id');

      if (error) throw error;

      const duration = Date.now() - startTime;
      logSuccess('parcelas/sync', { total: parcelas.length, processados: data?.length, duration_ms: duration });

      return new Response(JSON.stringify({
        success: true,
        processados: data?.length || 0,
        meta: { duration_ms: duration, processed_at: new Date().toISOString() }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // GET /pagamentos - Histórico de pagamentos
    // =====================================================
    if (path.endsWith('/pagamentos') && req.method === 'GET') {
      if (!await validateAuth()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const contaPagarId = url.searchParams.get('conta_pagar_id');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = supabase
        .from('pagamentos')
        .select('*', { count: 'exact' });

      if (contaPagarId) query = query.eq('conta_pagar_id', contaPagarId);

      query = query.order('data_pagamento', { ascending: false }).range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({
        data,
        pagination: { total: count, limit, offset },
        meta: { duration_ms: Date.now() - startTime, processed_at: new Date().toISOString() }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // POST /estornar - Estorno de pagamento
    // =====================================================
    if (path.endsWith('/estornar') && req.method === 'POST') {
      if (!await validateAuth()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const body = await req.json();
      const { id, motivo, valor_estorno } = body;

      if (!id || !motivo) {
        return new Response(JSON.stringify({ error: 'campo_obrigatorio', message: 'Campos "id" (conta_pagar_id) e "motivo" são obrigatórios' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Buscar título
      const { data: titulo, error: tituloErr } = await supabase
        .from('contas_pagar')
        .select('id, status, valor_original, valor_pago, valor_aberto')
        .eq('id', id)
        .single();

      if (tituloErr || !titulo) {
        return new Response(JSON.stringify({ error: 'nao_encontrado', message: `Título ${id} não encontrado` }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (titulo.status !== 'pago' && titulo.status !== 'parcial') {
        return new Response(JSON.stringify({ error: 'status_invalido', message: `Estorno só é permitido para títulos com status "pago" ou "parcial". Status atual: ${titulo.status}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const valorEstorno = valor_estorno || titulo.valor_pago || 0;
      const novoValorPago = Math.max(0, (titulo.valor_pago || 0) - valorEstorno);
      const novoValorAberto = (titulo.valor_original || 0) - novoValorPago;
      const novoStatus = novoValorPago <= 0 ? 'pendente' : 'parcial';

      // Atualizar título
      const { data: updated, error: updateErr } = await supabase
        .from('contas_pagar')
        .update({
          valor_pago: novoValorPago,
          valor_aberto: novoValorAberto,
          status: novoStatus,
          data_pagamento: null,
          data_baixa: null,
          observacao: `Estorno: ${motivo}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      const duration = Date.now() - startTime;
      logSuccess('estornar', { id, valor_estorno: valorEstorno, novo_status: novoStatus, duration_ms: duration });

      return new Response(JSON.stringify({
        success: true,
        estorno: { valor_estornado: valorEstorno, motivo },
        titulo_atualizado: { id, status: novoStatus, valor_pago: novoValorPago, valor_aberto: novoValorAberto },
        meta: { duration_ms: duration, processed_at: new Date().toISOString() }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // POST /anexos - Upload de comprovante (metadata)
    // =====================================================
    if (path.endsWith('/anexos') && req.method === 'POST') {
      if (!await validateAuth()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const body = await req.json();
      const { conta_pagar_id, nome_arquivo, tipo, url: fileUrl, observacao } = body;

      if (!conta_pagar_id || !nome_arquivo) {
        return new Response(JSON.stringify({ error: 'campo_obrigatorio', message: 'Campos "conta_pagar_id" e "nome_arquivo" são obrigatórios' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Verificar título
      const { data: titulo } = await supabase
        .from('contas_pagar')
        .select('id')
        .eq('id', conta_pagar_id)
        .single();

      if (!titulo) {
        return new Response(JSON.stringify({ error: 'nao_encontrado', message: `Título ${conta_pagar_id} não encontrado` }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: anexo, error } = await supabase
        .from('payment_attachments')
        .insert({
          payment_id: conta_pagar_id,
          file_name: nome_arquivo,
          file_type: tipo || 'application/pdf',
          file_url: fileUrl || null,
          notes: observacao || null,
          source: 'api'
        })
        .select()
        .single();

      if (error) throw error;

      const duration = Date.now() - startTime;
      return new Response(JSON.stringify({
        success: true,
        anexo,
        meta: { duration_ms: duration, processed_at: new Date().toISOString() }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // GET /anexos - Listar comprovantes de um título
    // =====================================================
    if (path.endsWith('/anexos') && req.method === 'GET') {
      if (!await validateAuth()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const contaPagarId = url.searchParams.get('conta_pagar_id');
      if (!contaPagarId) {
        return new Response(JSON.stringify({ error: 'campo_obrigatorio', message: 'Query param "conta_pagar_id" é obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data, error } = await supabase
        .from('payment_attachments')
        .select('*')
        .eq('payment_id', contaPagarId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({
        data,
        meta: { duration_ms: Date.now() - startTime, processed_at: new Date().toISOString() }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logError('global-handler', error, { path, duration_ms: duration });
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      duration_ms: duration
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
