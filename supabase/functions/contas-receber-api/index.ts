import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// Configurações para carga massiva - OTIMIZADO PARA CHUNKING INTELIGENTE
const BULK_BATCH_SIZE = 1000;
const MAX_PAYLOAD_SIZE = 35000;
const UPSERT_BATCH_SIZE = 50;
const BATCH_DELAY_MS = 30;
const MAX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 200;
const RECOMMENDED_CHUNK_SIZE = 5000; // Tamanho recomendado por chunk N8N

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function calculateHash(data: any): Promise<string> {
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
  const hashBuffer = await crypto.subtle.digest('MD5', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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

function transformErpData(erpRecord: any) {
  return {
    empresa_id: erpRecord['ID Empresa'],
    empresa_nome: erpRecord['Empresa'],
    tipo_documento: String(erpRecord['Tipo'] || ''),
    numero_documento: erpRecord['Nota'],
    parcela: erpRecord['Seq'] || 1,
    cliente_codigo: erpRecord['Código'],
    cliente_nome: erpRecord['Cliente'],
    valor_original: erpRecord['Valor_Trc'] || 0,
    valor_aberto: erpRecord['Valor em Aberto'] || 0,
    valor_recebido: erpRecord['Valor Pago'] || 0,
    valor_juros: erpRecord['Valor Juros'] || 0,
    valor_desconto: erpRecord['Valor Desconto'] || 0,
    valor_ajustes: erpRecord['Valor Ajustes'] || 0,
    data_emissao: parseDate(erpRecord['Emissão']),
    data_vencimento: parseDate(erpRecord['Vencimento']),
    data_recebimento: parseDate(erpRecord['Pigto de dados']),
    tabela_preco: erpRecord['Tabela'] || null,
    vendedor_nome: erpRecord['Vendedor'] || null,
    vendedor_codigo: erpRecord['Cód Vendedor'] || null,
    portador_id: erpRecord['ID Portador'] || null,
    portador: erpRecord['Nome Portador'] || 'SEM PORTADOR',
    conta: erpRecord['Conta'] || 'SEM CONTA',
  };
}

function generateErpId(conta: any): string {
  return `${conta['ID Empresa']}-${conta['Tipo']}-${conta['Nota']}-${conta['Seq']}-${conta['Código']}`;
}

function isRetryableError(error: any): boolean {
  if (!error) return false;
  const code = error.code || '';
  const message = error.message || '';
  return (
    code === '40P01' || code === '57014' || code === '40001' ||
    message.includes('deadlock') || message.includes('timeout') || message.includes('could not serialize')
  );
}

function escapeSql(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return `'${String(value).replace(/'/g, "''")}'`;
}

// ============ BULK INSERT SEGURO ============
async function processBulkInsert(
  supabase: any,
  contas: any[]
): Promise<{ processed: number; errors: any[] }> {
  const errors: any[] = [];
  let processed = 0;
  const now = new Date().toISOString();

  const records: any[] = [];
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

  const totalBatches = Math.ceil(records.length / BULK_BATCH_SIZE);
  console.log(`[BULK] Processing ${records.length} records in ${totalBatches} batches of ${BULK_BATCH_SIZE}`);

  for (let i = 0; i < records.length; i += BULK_BATCH_SIZE) {
    const batchNum = Math.floor(i / BULK_BATCH_SIZE) + 1;
    const batch = records.slice(i, i + BULK_BATCH_SIZE);
    
    let success = false;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const { data, error } = await supabase.rpc('bulk_upsert_contas_receber', { 
        p_records: batch 
      });
      
      if (!error) {
        const result = data || { processed: batch.length, errors: 0 };
        processed += result.processed;
        success = true;
        break;
      }
      
      if (isRetryableError(error) && attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 100;
        console.warn(`[BULK] Batch ${batchNum} retry ${attempt}/${MAX_RETRIES} after ${Math.round(delay)}ms`);
        await sleep(delay);
        continue;
      }
      
      console.error(`[BULK] Batch ${batchNum} failed:`, error);
      errors.push({ batch: batchNum, error: error?.message || String(error) });
      break;
    }

    if (batchNum % 5 === 0 || batchNum === totalBatches) {
      console.log(`[BULK] Progress: ${batchNum}/${totalBatches} (${processed} records)`);
    }
    
    if (i + BULK_BATCH_SIZE < records.length) {
      await sleep(20);
    }
  }

  return { processed, errors };
}

// ============ UPSERT PADRÃO (fallback) ============
async function upsertWithRetry(supabase: any, batch: any[], batchNumber: number): Promise<{ success: boolean; error?: any }> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { error } = await supabase.from('contas_receber').upsert(batch, { onConflict: 'erp_id', ignoreDuplicates: false });
      if (!error) return { success: true };
      if (isRetryableError(error) && attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 100);
        continue;
      }
      return { success: false, error };
    } catch (err) {
      if (attempt < MAX_RETRIES) await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1));
      else return { success: false, error: err };
    }
  }
  return { success: false };
}

async function processWithUpsert(supabase: any, contas: any[]): Promise<{ processed: number; errors: any[] }> {
  let processed = 0;
  const errors: any[] = [];
  const records: any[] = [];
  
  for (const conta of contas) {
    try {
      const erpId = generateErpId(conta);
      const transformed = transformErpData(conta);
      const dataHash = await calculateHash(transformed);
      records.push({ erp_id: erpId, data_hash: dataHash, ...transformed, sincronizado_em: new Date().toISOString() });
    } catch (error) {
      errors.push({ record: conta, error: error instanceof Error ? error.message : String(error) });
    }
  }

  records.sort((a, b) => a.erp_id.localeCompare(b.erp_id));
  const totalBatches = Math.ceil(records.length / UPSERT_BATCH_SIZE);
  
  for (let i = 0; i < records.length; i += UPSERT_BATCH_SIZE) {
    const batchNumber = Math.floor(i / UPSERT_BATCH_SIZE) + 1;
    const batch = records.slice(i, i + UPSERT_BATCH_SIZE);
    const result = await upsertWithRetry(supabase, batch, batchNumber);
    
    if (result.success) processed += batch.length;
    else errors.push({ batch_number: batchNumber, error: result.error?.message || String(result.error) });
    
    if (i + UPSERT_BATCH_SIZE < records.length) await sleep(BATCH_DELAY_MS);
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
    console.error('[CHUNK-LOG] Failed to log chunk progress:', err);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const path = url.pathname;

    console.log(`[contas-receber-api] ${req.method} ${path}`);

    // Helper function for auth validation
    async function validateAuth(): Promise<boolean> {
      const apiKey = req.headers.get('x-api-key');
      const expectedKey = Deno.env.get('N8N_API_KEY');
      if (apiKey && apiKey === expectedKey) return true;
      
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (!authError && user) return true;
      }
      return false;
    }

    // Helper for API key validation only
    function validateApiKey(): boolean {
      const apiKey = req.headers.get('x-api-key');
      const expectedKey = Deno.env.get('N8N_API_KEY');
      return !!(apiKey && apiKey === expectedKey);
    }

    // ============ GET /sync-status - Status da última sync ============
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
      
      if (error && error.code !== 'PGRST116') {
        console.error('[sync-status] Error:', error);
      }

      // Buscar progresso de chunks em andamento
      const { data: chunksProgress } = await supabase
        .from('sync_chunks_log')
        .select('chunk_id, total_chunks, registros_processados, status, created_at')
        .eq('entidade', 'contas_receber')
        .gte('created_at', new Date(Date.now() - 3600000).toISOString()) // última hora
        .order('created_at', { ascending: false })
        .limit(20);

      return new Response(JSON.stringify({ 
        last_sync: data || null,
        recent_chunks: chunksProgress || [],
        recommended_chunk_size: RECOMMENDED_CHUNK_SIZE
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ POST /sync-start - Iniciar nova sincronização ============
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
        recommended_delay_between_chunks_ms: 3000
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ POST /sync-complete - Marcar sync como completa ============
    if (path.endsWith('/sync-complete') && req.method === 'POST') {
      if (!validateApiKey()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { empresa_id, sync_id, total_chunks, total_registros, duracao_total_ms, errors_count } = await req.json();
      
      console.log(`[sync-complete] Sync ${sync_id} completed: ${total_registros} records, ${total_chunks} chunks, ${errors_count || 0} errors`);

      // Resumo dos chunks processados
      const { data: chunksSummary } = await supabase
        .from('sync_chunks_log')
        .select('registros_processados, erros, duracao_ms')
        .eq('entidade', 'contas_receber')
        .gte('created_at', new Date(Date.now() - 7200000).toISOString()); // últimas 2 horas

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
        metadata: { 
          sync_id, 
          total_chunks, 
          total_errors: totalErrors,
          completed_at: new Date().toISOString() 
        }
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

    // ============ POST /bulk-sync - CARGA MASSIVA ULTRA-RÁPIDA ============
    if (path.endsWith('/bulk-sync') && req.method === 'POST') {
      if (!validateApiKey()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const startTime = Date.now();
      
      let body;
      try {
        const text = await req.text();
        console.log(`[BULK-SYNC] Received ${text.length} bytes`);
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

      console.log(`[BULK-SYNC] Processing ${contas.length} records with SQL bulk insert`);

      const { processed, errors } = await processBulkInsert(supabase, contas);

      const duration = Date.now() - startTime;
      const rate = Math.round(processed / (duration / 1000));
      
      console.log(`[BULK-SYNC] Completed: ${processed}/${contas.length} in ${duration}ms (${rate} rec/sec)`);

      return new Response(JSON.stringify({
        success: true,
        mode: 'bulk_sql',
        statistics: { total: contas.length, processed, errors: errors.length, rate_per_second: rate },
        duration_ms: duration
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ POST /sync - Sincronizar dados do n8n ============
    if (path.endsWith('/sync') && req.method === 'POST') {
      if (!validateApiKey()) {
        console.error('[contas-receber-api] Unauthorized - Invalid API key');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const startTime = Date.now();
      
      let body;
      try {
        const text = await req.text();
        console.log(`[contas-receber-api] Received payload size: ${text.length} bytes`);
        body = JSON.parse(text);
      } catch (parseError) {
        console.error('[contas-receber-api] JSON parse error:', parseError);
        return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const contas = body.contas;

      if (!contas || !Array.isArray(contas)) {
        console.error('[contas-receber-api] Invalid payload - contas is not an array');
        return new Response(JSON.stringify({ error: 'Invalid payload - contas must be array' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (contas.length > MAX_PAYLOAD_SIZE) {
        console.warn(`[contas-receber-api] Payload too large: ${contas.length} records (max: ${MAX_PAYLOAD_SIZE})`);
        return new Response(JSON.stringify({ 
          error: `Payload muito grande. Máximo: ${MAX_PAYLOAD_SIZE} registros. Use chunking com /sync-chunk.`,
          max_allowed: MAX_PAYLOAD_SIZE,
          received: contas.length,
          hint: 'Configure N8N para dividir em chunks de 5000 registros com delay de 3s entre chunks'
        }), {
          status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`[contas-receber-api] Processing ${contas.length} records with sequential UPSERT`);

      const { processed, errors } = await processWithUpsert(supabase, contas);

      const duration = Date.now() - startTime;

      const empresaId = contas[0] ? contas[0]['ID Empresa'] : null;
      void supabase.from('sync_control').insert({
        entidade: 'contas_receber',
        empresa_id: empresaId,
        ultima_sync: new Date().toISOString(),
        total_registros: contas.length,
        registros_inseridos: processed,
        registros_atualizados: 0,
        registros_ignorados: 0,
        duracao_ms: duration,
        status: errors.length === 0 ? 'success' : 'partial',
        erro_mensagem: errors.length > 0 ? JSON.stringify(errors.slice(0, 5)) : null
      });

      console.log(`[contas-receber-api] Sync completed: ${processed} processed, ${errors.length} errors in ${duration}ms`);

      return new Response(JSON.stringify({
        success: true,
        statistics: { total_received: contas.length, processed, errors: errors.length },
        duration_ms: duration,
        message: `OK: ${processed} registros processados via UPSERT sequencial`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ POST /sync-chunk - Sincronização em chunks (APRIMORADO) ============
    if (path.endsWith('/sync-chunk') && req.method === 'POST') {
      if (!validateApiKey()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const startTime = Date.now();
      
      let body;
      try {
        body = await req.json();
      } catch (parseError) {
        return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { contas, chunk_id, total_chunks, sync_id, empresa_id } = body;

      // Validações
      if (!contas || !Array.isArray(contas)) {
        return new Response(JSON.stringify({ error: 'Invalid payload - contas must be array' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (chunk_id === undefined || typeof chunk_id !== 'number') {
        return new Response(JSON.stringify({ 
          error: 'chunk_id é obrigatório e deve ser um número',
          hint: 'Envie chunk_id (1-indexed) para rastrear progresso'
        }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const chunkInfo = `${chunk_id}/${total_chunks || '?'}`;
      console.log(`[CHUNK ${chunkInfo}] Iniciando processamento de ${contas.length} registros`);

      // Processar o chunk
      const { processed, errors } = await processWithUpsert(supabase, contas);

      const duration = Date.now() - startTime;
      const rate = duration > 0 ? Math.round(processed / (duration / 1000)) : 0;

      // Registrar progresso do chunk
      const empresaIdValue = empresa_id || (contas[0] ? contas[0]['ID Empresa'] : null);
      await logChunkProgress(
        supabase,
        'contas_receber',
        empresaIdValue,
        chunk_id,
        total_chunks,
        contas.length,
        processed,
        errors.length,
        duration,
        errors
      );

      console.log(`[CHUNK ${chunkInfo}] Concluído: ${processed}/${contas.length} em ${duration}ms (${rate} rec/sec)`);

      // Determinar próxima ação
      const isLastChunk = total_chunks && chunk_id >= total_chunks;
      const nextAction = isLastChunk ? 'complete' : 'continue';

      return new Response(JSON.stringify({
        success: errors.length === 0,
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
        next_action: nextAction,
        message: isLastChunk 
          ? `Último chunk processado. Chame /sync-complete para finalizar.`
          : `Chunk ${chunk_id} OK. Aguarde 3s antes do próximo chunk.`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ GET /chunks-progress - Progresso dos chunks ============
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

      // Calcular resumo
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

    // ============ GET / - Listar contas ============
    if (path.endsWith('/contas-receber-api') && req.method === 'GET') {
      if (!(await validateAuth())) {
        return new Response(JSON.stringify({ error: 'Unauthorized - API key or valid JWT required' }), {
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

    // ============ GET /vencidos - Listar contas vencidas ============
    if (path.endsWith('/vencidos') && req.method === 'GET') {
      if (!(await validateAuth())) {
        return new Response(JSON.stringify({ error: 'Unauthorized - API key or valid JWT required' }), {
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

    // ============ GET /stats - Estatísticas de sincronização ============
    if (path.endsWith('/stats') && req.method === 'GET') {
      if (!(await validateAuth())) {
        return new Response(JSON.stringify({ error: 'Unauthorized - API key or valid JWT required' }), {
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

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ GET /totais - Totais por status ============
    if (path.endsWith('/totais') && req.method === 'GET') {
      if (!(await validateAuth())) {
        return new Response(JSON.stringify({ error: 'Unauthorized - API key or valid JWT required' }), {
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

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[contas-receber-api] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
