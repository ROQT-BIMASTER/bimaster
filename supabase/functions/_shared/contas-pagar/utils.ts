// _shared/contas-pagar/utils.ts — Shared utilities for contas-pagar-api

// =====================================================
// CONSTANTS
// =====================================================
export const BULK_BATCH_SIZE = 10000;
export const MAX_PAYLOAD_SIZE = 200000;
export const RECOMMENDED_CHUNK_SIZE = 25000;
export const MAX_RETRIES = 5;
export const RETRY_DELAY_MS = 500;
export const API_VERSION = '2.4.0';

export const MAX_CONCURRENT_SYNCS = 2;
export const SLOT_TIMEOUT_MS = 90000;
export const WAIT_RETRY_MS = 500;
export const MAX_WAIT_RETRIES = 120;
export const MINI_BATCH_SIZE = 100;
export const INTER_BATCH_DELAY_MS = 150;

// =====================================================
// RETRY
// =====================================================
export interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  operationName?: string;
  alwaysSucceed?: boolean;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = MAX_RETRIES,
    delayMs = RETRY_DELAY_MS,
    operationName = 'operation',
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

export async function safeExecute<T>(
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

// =====================================================
// LOGGING
// =====================================================
export function logRequest(method: string, path: string, details?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  console.log(`📥 [${timestamp}] ${method} ${path}`, details ? JSON.stringify(details) : '');
}

export function logSuccess(operation: string, details?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  console.log(`✅ [${timestamp}] ${operation}`, details ? JSON.stringify(details) : '');
}

export function logError(operation: string, error: unknown, context?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const errorMessage = error instanceof Error ? error.message : (typeof error === 'object' ? JSON.stringify(error) : String(error));
  console.error(`❌ [${timestamp}] ${operation}: ${errorMessage}`, context ? JSON.stringify(context) : '');
}

// =====================================================
// AUDIT
// =====================================================
export async function logAuditEvent(supabase: any, action: string, details: Record<string, unknown>, req: Request) {
  try {
    await supabase.from('security_audit_log').insert({
      action,
      entity_type: 'contas_pagar_api',
      entity_id: details.id || details.codigo_lancamento_integracao || null,
      metadata: details,
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown',
      user_agent: req.headers.get('user-agent') || null,
    });
  } catch (e) {
    console.warn('⚠️ [audit] Erro ao gravar log:', e);
  }
}

// =====================================================
// DATA TRANSFORMS
// =====================================================
export async function calculateHash(data: Record<string, unknown>): Promise<string> {
  try {
    const dataToHash = [
      data.valor_original, data.valor_aberto, data.valor_pago,
      data.valor_juros, data.valor_desconto, data.valor_ajustes,
      data.data_pagamento
    ].join('|');

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(dataToHash);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    const simpleHash = String(data.valor_original) + String(data.valor_aberto) + String(data.data_pagamento);
    return simpleHash.slice(0, 32);
  }
}

export function transformErpData(erpRecord: Record<string, unknown>) {
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

export function parseDate(dateValue: unknown): string | null {
  if (!dateValue) return null;
  try {
    const date = new Date(dateValue as string);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

export function generateErpId(record: Record<string, unknown>): string {
  const empresaId = record['ID Empresa'] || record.empresa_id;
  const tipo = record['Tipo'] || record.tipo_documento;
  const nota = record['Nota'] || record.numero_documento;
  const seq = record['Seq'] || record.parcela || 1;
  const codigo = record['Código'] || record.fornecedor_codigo;
  return `${empresaId}-${tipo}-${nota}-${seq}-${codigo}`;
}

// =====================================================
// RATE LIMITER (sync slots)
// =====================================================
export async function cleanupExpiredSlots(supabase: any): Promise<void> {
  try {
    await supabase.from('sync_rate_limiter').delete().lt('expires_at', new Date().toISOString());
  } catch (err) {
    console.warn('⚠️ [rate-limiter] Erro ao limpar slots expirados:', err);
  }
}

export async function getActiveSlotCount(supabase: any): Promise<number> {
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

export async function acquireSlot(supabase: any, requestId: string): Promise<boolean> {
  try {
    await cleanupExpiredSlots(supabase);
    const activeCount = await getActiveSlotCount(supabase);
    if (activeCount >= MAX_CONCURRENT_SYNCS) {
      console.log(`⏳ [rate-limiter] Sem slots disponíveis (${activeCount}/${MAX_CONCURRENT_SYNCS})`);
      return false;
    }
    const { error } = await supabase.from('sync_rate_limiter').insert({
      slot_key: `sync_${Date.now()}_${requestId.substring(0, 8)}`,
      request_id: requestId,
      expires_at: new Date(Date.now() + SLOT_TIMEOUT_MS).toISOString()
    });
    if (error) {
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

export async function releaseSlot(supabase: any, requestId: string): Promise<void> {
  try {
    await supabase.from('sync_rate_limiter').delete().eq('request_id', requestId);
    console.log(`🔓 [rate-limiter] Slot liberado: ${requestId.substring(0, 8)}`);
  } catch (err) {
    console.warn('⚠️ [rate-limiter] Erro ao liberar slot:', err);
  }
}

export async function waitForSlot(supabase: any, requestId: string): Promise<{ acquired: boolean; waitTime: number }> {
  const startWait = Date.now();
  let attempts = 0;
  while (attempts < MAX_WAIT_RETRIES) {
    const acquired = await acquireSlot(supabase, requestId);
    if (acquired) return { acquired: true, waitTime: Date.now() - startWait };
    attempts++;
    if (attempts < MAX_WAIT_RETRIES) {
      await new Promise(r => setTimeout(r, WAIT_RETRY_MS));
    }
  }
  return { acquired: false, waitTime: Date.now() - startWait };
}

// =====================================================
// RECORDS PROCESSING
// =====================================================
export async function processRecordsWithRetry(
  supabase: any,
  records: Record<string, unknown>[],
  operationName: string,
  forceUpdate: boolean = false
): Promise<{ inserted: number; updated: number; skipped: number; total: number; force_update?: boolean }> {
  if (records.length > 0) {
    const sampleSize = Math.min(3, records.length);
    console.log(`📊 [${operationName}] Amostra de ${sampleSize} registros recebidos do N8N:`);
    for (let i = 0; i < sampleSize; i++) {
      const r = records[i];
      console.log(`  📄 Registro ${i + 1}:`, JSON.stringify({
        erp_id_campos: { 'ID Empresa': r['ID Empresa'], 'Tipo': r['Tipo'], 'Nota': r['Nota'], 'Seq': r['Seq'], 'Código': r['Código'] },
        valores: { 'Valor_Trc': r['Valor_Trc'], 'Valor em Aberto': r['Valor em Aberto'], 'Valor Pago': r['Valor Pago'], 'Data Pgto': r['Data Pgto'] }
      }));
    }
  }

  const preparedRecords = await Promise.all(records.map(async (conta) => {
    const transformed = transformErpData(conta);
    const erpId = generateErpId(conta);
    const dataHash = await calculateHash(transformed);
    return { erp_id: erpId, data_hash: dataHash, ...transformed };
  }));

  if (preparedRecords.length > 0) {
    console.log(`📊 [${operationName}] Primeiro registro TRANSFORMADO:`, JSON.stringify({
      erp_id: preparedRecords[0].erp_id,
      valor_aberto: preparedRecords[0].valor_aberto,
      valor_pago: preparedRecords[0].valor_pago,
      data_pagamento: preparedRecords[0].data_pagamento,
      data_hash: preparedRecords[0].data_hash
    }));
  }

  if (forceUpdate) {
    console.log(`🔄 [${operationName}] FORCE UPDATE ATIVADO - Ignorando comparação de hash`);
  }

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

  console.log(`📊 [${operationName}] Resultado do upsert:`, JSON.stringify(result));
  return result;
}

// =====================================================
// RESPONSE HELPERS
// =====================================================
export function jsonRes(body: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * Unified API response envelope — adds request_id, api_version, timestamp, duration.
 * Replaces jsonRes for all handler responses (Fase 3A).
 */
export function apiResponse(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>,
  startTime?: number
): Response {
  const requestId = crypto.randomUUID();
  const envelope: Record<string, unknown> = typeof body === 'object' && body !== null && !Array.isArray(body)
    ? { ...(body as Record<string, unknown>) }
    : { data: body };

  envelope.meta = {
    request_id: requestId,
    api_version: API_VERSION,
    processed_at: new Date().toISOString(),
    ...(startTime ? { duration_ms: Date.now() - startTime } : {}),
  };

  return new Response(JSON.stringify(envelope), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Request-Id': requestId,
      'X-API-Version': API_VERSION,
    }
  });
}

// UUID regex for validation
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// =====================================================
// IDEMPOTENCY (Fase 1A)
// =====================================================
export interface IdempotencyResult {
  found: boolean;
  response?: Response;
}

/**
 * Check if an idempotency key already exists and was processed.
 * Returns cached response if found, or marks key as pending.
 */
export async function checkIdempotency(
  supabase: any,
  key: string | null,
  endpoint: string,
  corsHeaders: Record<string, string>
): Promise<IdempotencyResult> {
  if (!key) return { found: false };

  // Cleanup expired keys opportunistically (1% chance)
  if (Math.random() < 0.01) {
    supabase.rpc('cleanup_expired_idempotency_keys').catch(() => {});
  }

  const { data: existing } = await supabase
    .from('idempotency_keys')
    .select('status, response_body, response_status')
    .eq('idempotency_key', key)
    .eq('endpoint', endpoint)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (existing) {
    if (existing.status === 'completed' && existing.response_body != null) {
      // Return cached response
      return {
        found: true,
        response: new Response(JSON.stringify(existing.response_body), {
          status: existing.response_status || 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-Idempotency-Replayed': 'true',
          }
        })
      };
    }
    // Still pending — another request is processing
    if (existing.status === 'pending') {
      return {
        found: true,
        response: jsonRes({ error: 'Request em processamento', message: 'Uma requisição com esta chave de idempotência está sendo processada' }, 409, corsHeaders)
      };
    }
  }

  // Insert new pending key
  await supabase.from('idempotency_keys').insert({
    idempotency_key: key,
    endpoint,
    status: 'pending',
  }).catch(() => {
    // Unique constraint violation = another request inserted first, that's OK
  });

  return { found: false };
}

/**
 * Save the response for an idempotency key after successful processing.
 */
export async function saveIdempotency(
  supabase: any,
  key: string | null,
  endpoint: string,
  responseBody: unknown,
  responseStatus: number
): Promise<void> {
  if (!key) return;
  await supabase.from('idempotency_keys')
    .update({
      status: 'completed',
      response_body: responseBody,
      response_status: responseStatus,
    })
    .eq('idempotency_key', key)
    .eq('endpoint', endpoint)
    .catch(() => {});
}
