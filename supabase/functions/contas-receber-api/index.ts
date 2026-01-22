import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// Configurações OTIMIZADAS para 1 MILHÃO+ de registros
const BULK_BATCH_SIZE = 10000;      // 10k por batch SQL
const MAX_PAYLOAD_SIZE = 100000;    // 100k registros max por request
const UPSERT_BATCH_SIZE = 500;      // REDUZIDO: batches menores para evitar timeout
const BATCH_DELAY_MS = 50;          // AUMENTADO: mais delay entre batches para evitar sobrecarga
const MAX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 200;    // AUMENTADO: mais tempo entre retries
const RECOMMENDED_CHUNK_SIZE = 500; // REDUZIDO: 500 por chunk N8N para evitar timeout
const MAX_CONCURRENT_SYNCS = 2;     // Limite de syncs paralelas
const QUEUE_WAIT_TIMEOUT_MS = 90000; // 90s timeout na fila
const MINI_BATCH_SIZE = 100;        // Mini-batches para throttling interno
const MINI_BATCH_DELAY_MS = 100;    // Delay entre mini-batches

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

// Extrai dados reais do registro (desempacota formato N8N $items())
function unwrapN8nItem(item: any): any {
  // Se o item tem propriedade 'json', é formato N8N - extrair conteúdo
  if (item && typeof item === 'object' && item.json && typeof item.json === 'object') {
    console.log(`[unwrapN8nItem] Unwrapping N8N item format`);
    return item.json;
  }
  return item;
}

// Transforma dados do ERP - suporta múltiplos formatos de campos
function transformErpData(rawRecord: any) {
  // Primeiro desempacota se for formato N8N
  const erpRecord = unwrapN8nItem(rawRecord);
  
  // DEBUG: Log primeiro registro para identificar campos
  const keys = Object.keys(erpRecord);
  if (keys.length > 0) {
    console.log(`[transformErpData] Record keys: ${keys.slice(0, 15).join(', ')}${keys.length > 15 ? '...' : ''}`);
  }

  // Valores financeiros - suporta múltiplos nomes de campo (inclui snake_case e camelCase)
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

  // Normalizar valores (usar absoluto para valores negativos que representam créditos)
  const valorOriginal = Math.abs(valorOriginalRaw);
  const valorAberto = Math.abs(valorAbertoRaw);
  
  // Calcular valor pago: Se ERP não enviou, inferir da diferença entre original e aberto
  // ou do valor de ajustes quando disponível
  let valorPago = valorPagoRaw;
  if (valorPago === 0 && valorAberto === 0 && valorOriginal > 0) {
    // Título foi totalmente pago, mas ERP não enviou valor_pago
    valorPago = valorOriginal;
  } else if (valorPago === 0 && valorAjustes > 0 && valorAberto < 1) {
    // Título foi pago via ajuste
    valorPago = Math.abs(valorAjustes);
  } else if (valorPago === 0 && valorOriginal > valorAberto) {
    // Calcular pagamento parcial
    valorPago = valorOriginal - valorAberto;
  }

  // DEBUG: Log valores extraídos para diagnóstico
  if (valorPago > 0 || valorAberto === 0) {
    console.log(`[transformErpData] VALUES: original=${valorOriginal}, pago=${valorPago}, aberto=${valorAberto}, raw_pago=${valorPagoRaw}, ajustes=${valorAjustes}`);
  }

  // Calcular status baseado nos valores
  let status = 'aberto';
  if (valorAberto === 0 && (valorPago > 0 || valorOriginal > 0)) {
    status = 'pago';
  } else if (valorPago > 0 && valorAberto > 0) {
    status = 'parcial';
  }

  // Campos de identificação - suporta múltiplos formatos
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
  // Primeiro desempacota se for formato N8N
  const conta = unwrapN8nItem(rawConta);
  
  const empresaId = conta['ID Empresa'] || conta.id_empresa || conta.empresaId || conta.empresa_id || 1;
  const tipo = conta['Tipo'] || conta.tipo || conta.tipo_documento || conta.tipoDocumento || '';
  const nota = conta['Nota'] || conta.nota || conta.numero_documento || conta.numeroDocumento || '';
  const seq = conta['Seq'] || conta.seq || conta.parcela || conta.sequencia || 1;
  const codigo = conta['Código'] || conta['Codigo'] || conta.codigo || conta.cliente_codigo || conta.clienteCodigo || '';
  const erpId = `${empresaId}-${tipo}-${nota}-${seq}-${codigo}`.replace(/\s+/g, '');
  console.log(`[generateErpId] Generated: ${erpId} from empresa=${empresaId}, tipo=${tipo}, nota=${nota}, seq=${seq}`);
  return erpId;
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

// ============ RATE LIMITING REMOVIDO - Processamento direto ============
// O rate limiting estava travando as requisições. Agora processa diretamente.

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
      // Usando função V2 otimizada (operação em conjunto, sem LOOP)
      const { data, error } = await supabase.rpc('bulk_upsert_contas_receber_v2', { 
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
async function upsertWithRetry(supabase: any, batch: any[], batchNumber: number): Promise<{ success: boolean; error?: any; processed?: number }> {
  console.log(`[upsertWithRetry] Batch ${batchNumber}: ${batch.length} records`);
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Usar upsert com erp_id como chave de conflito
      // Se houver conflito com idx_contas_receber_unique_natural, tentar insert individual
      const { data, error } = await supabase.from('contas_receber').upsert(batch, { 
        onConflict: 'erp_id', 
        ignoreDuplicates: false 
      });
      
      if (!error) {
        console.log(`[upsertWithRetry] Batch ${batchNumber} SUCCESS (${batch.length} records)`);
        return { success: true, processed: batch.length };
      }
      
      // Se erro de constraint natural, tentar um por um
      if (error.message?.includes('idx_contas_receber_unique_natural') || error.code === '23505') {
        console.warn(`[upsertWithRetry] Batch ${batchNumber} constraint conflict, trying individual upserts`);
        let individualProcessed = 0;
        for (const record of batch) {
          try {
            const { error: singleError } = await supabase.from('contas_receber').upsert(record, { 
              onConflict: 'erp_id', 
              ignoreDuplicates: true 
            });
            if (!singleError) individualProcessed++;
          } catch (singleErr) {
            // Ignorar erros individuais, continuar processando
          }
        }
        console.log(`[upsertWithRetry] Batch ${batchNumber} individual: ${individualProcessed}/${batch.length} processed`);
        return { success: true, processed: individualProcessed };
      }
      
      console.error(`[upsertWithRetry] Batch ${batchNumber} attempt ${attempt} error:`, error.message, error.code, error.details);
      if (isRetryableError(error) && attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 100);
        continue;
      }
      return { success: false, error, processed: 0 };
    } catch (err) {
      console.error(`[upsertWithRetry] Batch ${batchNumber} exception:`, err);
      if (attempt < MAX_RETRIES) await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1));
      else return { success: false, error: err, processed: 0 };
    }
  }
  return { success: false, processed: 0 };
}

async function processWithUpsert(supabase: any, contas: any[]): Promise<{ processed: number; errors: any[] }> {
  let processed = 0;
  const errors: any[] = [];
  const records: any[] = [];
  
  console.log(`[processWithUpsert] Starting transformation of ${contas.length} records`);
  
  for (const conta of contas) {
    try {
      const erpId = generateErpId(conta);
      const transformed = transformErpData(conta);
      const dataHash = await calculateHash(transformed);
      const record = { erp_id: erpId, data_hash: dataHash, ...transformed, sincronizado_em: new Date().toISOString() };
      console.log(`[processWithUpsert] Transformed record: erp_id=${erpId}, cliente=${transformed.cliente_nome?.substring(0, 20)}`);
      records.push(record);
    } catch (error) {
      console.error(`[processWithUpsert] Transform error:`, error);
      errors.push({ record: conta, error: error instanceof Error ? error.message : String(error) });
    }
  }
  
  console.log(`[processWithUpsert] Transformed ${records.length} records, ${errors.length} transform errors`);

  records.sort((a, b) => a.erp_id.localeCompare(b.erp_id));
  const totalBatches = Math.ceil(records.length / UPSERT_BATCH_SIZE);
  
  for (let i = 0; i < records.length; i += UPSERT_BATCH_SIZE) {
    const batchNumber = Math.floor(i / UPSERT_BATCH_SIZE) + 1;
    const batch = records.slice(i, i + UPSERT_BATCH_SIZE);
    const result = await upsertWithRetry(supabase, batch, batchNumber);
    
    if (result.success) processed += result.processed || batch.length;
    else errors.push({ batch_number: batchNumber, error: result.error?.message || String(result.error) });
    
    if (i + UPSERT_BATCH_SIZE < records.length) await sleep(BATCH_DELAY_MS);
  }

  console.log(`[processWithUpsert] Completed: ${processed} records processed, ${errors.length} batch errors`);
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
      const polloKey = Deno.env.get('POLLO_API_KEY');
      
      // Accept either N8N_API_KEY or POLLO_API_KEY
      if (apiKey && (apiKey === expectedKey || apiKey === polloKey)) {
        console.log('[auth] API key validated successfully');
        return true;
      }
      
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (!authError && user) {
          console.log('[auth] JWT validated successfully');
          return true;
        }
      }
      console.error('[auth] Authentication failed - no valid API key or JWT');
      return false;
    }

    // Helper for API key validation only
    function validateApiKey(): boolean {
      const apiKey = req.headers.get('x-api-key');
      const expectedKey = Deno.env.get('N8N_API_KEY');
      const polloKey = Deno.env.get('POLLO_API_KEY');
      
      const isValid = !!(apiKey && (apiKey === expectedKey || apiKey === polloKey));
      if (isValid) {
        console.log('[validateApiKey] API key validated');
      } else {
        console.error('[validateApiKey] Invalid API key provided');
      }
      return isValid;
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

    // ============ POST /sync - Sincronizar dados do n8n (COM RATE LIMITING) ============
    if (path.endsWith('/sync') && req.method === 'POST') {
      if (!validateApiKey()) {
        console.error('[contas-receber-api] Unauthorized - Invalid API key');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const startTime = Date.now();
      
      // Processamento direto sem rate limiting
      console.log(`[contas-receber-api] Starting sync at ${new Date().toISOString()}`);
      
      {
        let body;
        try {
          const text = await req.text();
          console.log(`[contas-receber-api] Received payload size: ${text.length} bytes`);
          console.log(`[contas-receber-api] Payload preview: ${text.substring(0, 500)}`);
          body = JSON.parse(text);
        } catch (parseError) {
          console.error('[contas-receber-api] JSON parse error:', parseError);
          return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.log(`[contas-receber-api] Body type: ${typeof body}, isArray: ${Array.isArray(body)}, keys: ${typeof body === 'object' && body ? Object.keys(body).slice(0, 10).join(', ') : 'N/A'}`);

        let contas = body.contas || body.data || body.items || body.records || body;
        
        if (!Array.isArray(contas)) {
          const hasErpFields = contas && typeof contas === 'object' && (
            contas['Nota'] || contas.nota || contas.numero_documento ||
            contas['Cliente'] || contas.cliente || contas.cliente_nome
          );
          if (hasErpFields) {
            console.log(`[contas-receber-api] Single record received, converting to array`);
            contas = [contas];
          } else {
            contas = [];
          }
        }

        console.log(`[contas-receber-api] Extracted ${contas.length} records to process`);
        
        if (contas.length > 0) {
          const sampleKeys = Object.keys(contas[0]).slice(0, 20);
          console.log(`[contas-receber-api] Sample record keys: ${sampleKeys.join(', ')}`);
          console.log(`[contas-receber-api] Sample record values: Nota=${contas[0]['Nota'] || contas[0].nota}, Cliente=${contas[0]['Cliente'] || contas[0].cliente}, Tipo=${contas[0]['Tipo'] || contas[0].tipo}`);
        }

        if (contas.length === 0) {
          console.warn(`[contas-receber-api] No valid records found in payload. Body keys: ${Object.keys(body).join(', ')}`);
          return new Response(JSON.stringify({ 
            success: true, 
            statistics: { total_received: 0, processed: 0, errors: 0 },
            message: 'Nenhum registro recebido',
            debug: { received_keys: Object.keys(body) }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (contas.length > MAX_PAYLOAD_SIZE) {
          console.warn(`[contas-receber-api] Payload too large: ${contas.length} records (max: ${MAX_PAYLOAD_SIZE})`);
          return new Response(JSON.stringify({ 
            error: `Payload muito grande. Máximo: ${MAX_PAYLOAD_SIZE} registros.`,
            max_allowed: MAX_PAYLOAD_SIZE,
            received: contas.length,
            hint: 'Configure N8N para dividir em chunks de 500 registros com delay de 5s entre chunks'
          }), {
            status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.log(`[contas-receber-api] Processing ${contas.length} records with THROTTLED UPSERT`);

        // Processar em mini-batches com throttling interno
        let totalProcessed = 0;
        const allErrors: any[] = [];
        const totalMiniBatches = Math.ceil(contas.length / MINI_BATCH_SIZE);
        
        for (let i = 0; i < contas.length; i += MINI_BATCH_SIZE) {
          const miniBatchNum = Math.floor(i / MINI_BATCH_SIZE) + 1;
          const miniBatch = contas.slice(i, i + MINI_BATCH_SIZE);
          
          const { processed, errors } = await processWithUpsert(supabase, miniBatch);
          totalProcessed += processed;
          allErrors.push(...errors);
          
          // Log progresso a cada 5 mini-batches
          if (miniBatchNum % 5 === 0 || miniBatchNum === totalMiniBatches) {
            console.log(`[contas-receber-api] Mini-batch ${miniBatchNum}/${totalMiniBatches}: ${totalProcessed} total processed`);
          }
          
          // Delay entre mini-batches para evitar sobrecarga
          if (i + MINI_BATCH_SIZE < contas.length) {
            await sleep(MINI_BATCH_DELAY_MS);
          }
        }

        const duration = Date.now() - startTime;
        const rate = duration > 0 ? Math.round(totalProcessed / (duration / 1000)) : 0;

        const empresaId = contas[0] ? contas[0]['ID Empresa'] : null;
        void supabase.from('sync_control').insert({
          entidade: 'contas_receber',
          empresa_id: empresaId,
          ultima_sync: new Date().toISOString(),
          total_registros: contas.length,
          registros_inseridos: totalProcessed,
          registros_atualizados: 0,
          registros_ignorados: 0,
          duracao_ms: duration,
          status: allErrors.length === 0 ? 'success' : 'partial',
          erro_mensagem: allErrors.length > 0 ? JSON.stringify(allErrors.slice(0, 5)) : null
        });

        console.log(`[contas-receber-api] Sync completed: ${totalProcessed} processed, ${allErrors.length} errors in ${duration}ms (${rate} rec/sec)`);

        return new Response(JSON.stringify({
          success: true,
          statistics: { total_received: contas.length, processed: totalProcessed, errors: allErrors.length, rate_per_second: rate },
          duration_ms: duration,
          message: `OK: ${totalProcessed} registros processados via UPSERT`
        }), {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Processing-Time-Ms': String(duration)
          }
        });
      }
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

    // ============ POST /sync-incremental - Sincronização INCREMENTAL ============
    if (path.endsWith('/sync-incremental') && req.method === 'POST') {
      // Accept both API key (N8N) and JWT (frontend)
      if (!(await validateAuth())) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const startTime = Date.now();
      
      let body;
      try {
        body = await req.json();
      } catch (parseError) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { contas, skip_unchanged = true } = body;
      
      if (!contas || !Array.isArray(contas)) {
        return new Response(JSON.stringify({ error: 'Invalid payload - contas must be array' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`[INCREMENTAL] Processing ${contas.length} records (skip_unchanged: ${skip_unchanged})`);

      // Registrar início da sync
      const { data: syncData } = await supabase.rpc('start_sync', {
        p_entidade: 'contas_receber',
        p_tipo: 'incremental',
        p_metadata: { total_records: contas.length }
      });
      const syncId = syncData;

      let processed = 0;
      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      const errors: any[] = [];
      const now = new Date().toISOString();

      // Transformar e calcular hashes
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

      if (skip_unchanged && records.length > 0) {
        // Buscar hashes existentes para comparação
        const erpIds = records.map(r => r.erp_id);
        const { data: existingRecords } = await supabase
          .from('contas_receber')
          .select('erp_id, data_hash')
          .in('erp_id', erpIds);

        const existingHashes = new Map(
          (existingRecords || []).map(r => [r.erp_id, r.data_hash])
        );

        // Filtrar apenas registros que mudaram
        const changedRecords = records.filter(r => {
          const existingHash = existingHashes.get(r.erp_id);
          if (!existingHash) {
            inserted++;
            return true; // Novo registro
          }
          if (existingHash !== r.data_hash) {
            updated++;
            return true; // Registro alterado
          }
          skipped++;
          return false; // Sem alteração
        });

        console.log(`[INCREMENTAL] Filtered: ${changedRecords.length} changed, ${skipped} unchanged`);

        // Processar apenas os que mudaram
        if (changedRecords.length > 0) {
          const result = await processBulkInsert(supabase, changedRecords.map(r => {
            // Reconverter para formato ERP para processBulkInsert
            return { ...r, _already_transformed: true };
          }));
          processed = result.processed;
          errors.push(...result.errors);
        }
      } else {
        // Processar todos (modo legacy)
        const result = await processBulkInsert(supabase, contas);
        processed = result.processed;
        inserted = processed;
        errors.push(...result.errors);
      }

      const duration = Date.now() - startTime;
      const rate = Math.round(processed / (duration / 1000));

      // Finalizar sync tracking
      await supabase.rpc('complete_sync', {
        p_sync_id: syncId,
        p_records_processed: processed,
        p_records_inserted: inserted,
        p_records_updated: updated,
        p_records_skipped: skipped,
        p_duration_ms: duration,
        p_status: errors.length === 0 ? 'completed' : 'partial',
        p_error_message: errors.length > 0 ? JSON.stringify(errors.slice(0, 5)) : null
      });

      console.log(`[INCREMENTAL] Completed: ${processed} processed, ${skipped} skipped, ${errors.length} errors in ${duration}ms`);

      return new Response(JSON.stringify({
        success: errors.length === 0,
        mode: 'incremental',
        sync_id: syncId,
        statistics: {
          total_received: contas.length,
          processed,
          inserted,
          updated,
          skipped,
          errors: errors.length,
          rate_per_second: rate
        },
        duration_ms: duration,
        message: `${processed} processados, ${skipped} sem alteração`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ GET /last-sync - Último timestamp de sincronização ============
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

      if (error) throw error;

      // Buscar histórico recente
      const { data: history } = await supabase
        .from('sync_tracking')
        .select('*')
        .eq('entidade', 'contas_receber')
        .order('last_sync_at', { ascending: false })
        .limit(10);

      return new Response(JSON.stringify({
        last_sync_timestamp: data,
        tipo,
        history: history || []
      }), {
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
