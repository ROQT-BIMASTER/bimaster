import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// Configurações otimizadas para evitar deadlocks
const UPSERT_BATCH_SIZE = 25; // Batches menores para evitar conflitos
const MAX_PAYLOAD_SIZE = 5000;
const BATCH_DELAY_MS = 100; // Delay maior entre batches
const MAX_RETRIES = 3; // Número de tentativas em caso de deadlock
const RETRY_BASE_DELAY_MS = 200; // Delay base para retry exponencial

// Helper para delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Calcular hash MD5 dos dados para detectar alterações
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
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
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

// Verifica se é erro de deadlock ou timeout
function isRetryableError(error: any): boolean {
  if (!error) return false;
  const code = error.code || '';
  const message = error.message || '';
  return (
    code === '40P01' || // deadlock_detected
    code === '57014' || // query_canceled (statement timeout)
    code === '40001' || // serialization_failure
    message.includes('deadlock') ||
    message.includes('timeout') ||
    message.includes('could not serialize')
  );
}

// Upsert com retry para deadlocks
async function upsertWithRetry(
  supabase: any,
  batch: any[],
  batchNumber: number
): Promise<{ success: boolean; error?: any }> {
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { error } = await supabase
        .from('contas_receber')
        .upsert(batch, { 
          onConflict: 'erp_id',
          ignoreDuplicates: false 
        });
      
      if (!error) {
        if (attempt > 1) {
          console.log(`[contas-receber-api] Batch ${batchNumber} succeeded on attempt ${attempt}`);
        }
        return { success: true };
      }
      
      if (isRetryableError(error)) {
        lastError = error;
        const delayMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 100;
        console.warn(`[contas-receber-api] Batch ${batchNumber} deadlock/timeout (attempt ${attempt}/${MAX_RETRIES}), retrying in ${Math.round(delayMs)}ms...`);
        await sleep(delayMs);
        continue;
      }
      
      // Erro não-retryable
      return { success: false, error };
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        const delayMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 100;
        console.warn(`[contas-receber-api] Batch ${batchNumber} exception (attempt ${attempt}/${MAX_RETRIES}), retrying in ${Math.round(delayMs)}ms...`);
        await sleep(delayMs);
      }
    }
  }
  
  return { success: false, error: lastError };
}

// Processar registros SEQUENCIALMENTE para evitar deadlocks
async function processWithUpsert(
  supabase: any, 
  contas: any[]
): Promise<{ processed: number; errors: any[] }> {
  let processed = 0;
  const errors: any[] = [];
  
  // Preparar todos os registros para upsert
  const records: any[] = [];
  
  for (const conta of contas) {
    try {
      const erpId = generateErpId(conta);
      const transformed = transformErpData(conta);
      const dataHash = await calculateHash(transformed);
      
      records.push({
        erp_id: erpId,
        data_hash: dataHash,
        ...transformed,
        sincronizado_em: new Date().toISOString()
      });
    } catch (error) {
      errors.push({
        record: conta,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Ordenar por erp_id para evitar deadlocks (ordem consistente)
  records.sort((a, b) => a.erp_id.localeCompare(b.erp_id));

  // Processar SEQUENCIALMENTE - um batch por vez
  const totalBatches = Math.ceil(records.length / UPSERT_BATCH_SIZE);
  console.log(`[contas-receber-api] Processing ${records.length} records in ${totalBatches} sequential batches`);
  
  for (let i = 0; i < records.length; i += UPSERT_BATCH_SIZE) {
    const batchNumber = Math.floor(i / UPSERT_BATCH_SIZE) + 1;
    const batch = records.slice(i, i + UPSERT_BATCH_SIZE);
    
    const result = await upsertWithRetry(supabase, batch, batchNumber);
    
    if (result.success) {
      processed += batch.length;
    } else {
      console.error(`[contas-receber-api] Batch ${batchNumber} failed after ${MAX_RETRIES} attempts:`, result.error);
      errors.push({ 
        operation: 'upsert_batch', 
        batch_number: batchNumber,
        batch_start: i, 
        error: result.error?.message || String(result.error)
      });
    }
    
    // Delay entre batches para dar tempo ao banco processar
    if (i + UPSERT_BATCH_SIZE < records.length) {
      await sleep(BATCH_DELAY_MS);
    }
    
    // Log de progresso a cada 10 batches
    if (batchNumber % 10 === 0) {
      console.log(`[contas-receber-api] Progress: ${batchNumber}/${totalBatches} batches (${processed} records processed)`);
    }
  }

  return { processed, errors };
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

    // POST /sync - Sincronizar dados do n8n (REQUIRES API KEY)
    if (path.endsWith('/sync') && req.method === 'POST') {
      const apiKey = req.headers.get('x-api-key');
      const expectedKey = Deno.env.get('N8N_API_KEY');
      
      if (!apiKey || apiKey !== expectedKey) {
        console.error('[contas-receber-api] Unauthorized - Invalid API key');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const contas = body.contas;

      if (!contas || !Array.isArray(contas)) {
        console.error('[contas-receber-api] Invalid payload - contas is not an array');
        return new Response(JSON.stringify({ error: 'Invalid payload - contas must be array' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (contas.length > MAX_PAYLOAD_SIZE) {
        console.warn(`[contas-receber-api] Payload too large: ${contas.length} records (max: ${MAX_PAYLOAD_SIZE})`);
        return new Response(JSON.stringify({ 
          error: `Payload muito grande. Máximo: ${MAX_PAYLOAD_SIZE} registros. Recebido: ${contas.length}. Use o endpoint /sync-chunk para lotes menores.`,
          max_allowed: MAX_PAYLOAD_SIZE,
          received: contas.length
        }), {
          status: 413,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`[contas-receber-api] Processing ${contas.length} records with sequential UPSERT`);

      // Usar UPSERT nativo - processamento sequencial
      const { processed, errors } = await processWithUpsert(supabase, contas);

      const duration = Date.now() - startTime;

      // Log de sincronização
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
        statistics: {
          total_received: contas.length,
          processed,
          errors: errors.length
        },
        duration_ms: duration,
        message: `OK: ${processed} registros processados via UPSERT sequencial`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /sync-chunk - Sincronização em chunks (REQUIRES API KEY)
    if (path.endsWith('/sync-chunk') && req.method === 'POST') {
      const apiKey = req.headers.get('x-api-key');
      const expectedKey = Deno.env.get('N8N_API_KEY');
      
      if (!apiKey || apiKey !== expectedKey) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const startTime = Date.now();
      const { contas, chunk_id, total_chunks } = await req.json();

      if (!contas || !Array.isArray(contas)) {
        return new Response(JSON.stringify({ error: 'Invalid payload' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`[contas-receber-api] Processing chunk ${chunk_id || '?'}/${total_chunks || '?'} with ${contas.length} records (sequential)`);

      // Usar UPSERT nativo - processamento sequencial
      const { processed, errors } = await processWithUpsert(supabase, contas);

      const duration = Date.now() - startTime;

      console.log(`[contas-receber-api] Chunk ${chunk_id} completed: ${processed} processed in ${duration}ms`);

      return new Response(JSON.stringify({
        success: true,
        chunk_id,
        statistics: {
          total_received: contas.length,
          processed,
          errors: errors.length
        },
        duration_ms: duration
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET / - Listar contas (REQUIRES AUTH)
    if (path.endsWith('/contas-receber-api') && req.method === 'GET') {
      if (!(await validateAuth())) {
        return new Response(JSON.stringify({ error: 'Unauthorized - API key or valid JWT required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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

    // GET /vencidos - Listar contas vencidas (REQUIRES AUTH)
    if (path.endsWith('/vencidos') && req.method === 'GET') {
      if (!(await validateAuth())) {
        return new Response(JSON.stringify({ error: 'Unauthorized - API key or valid JWT required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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

    // GET /stats - Estatísticas de sincronização (REQUIRES AUTH)
    if (path.endsWith('/stats') && req.method === 'GET') {
      if (!(await validateAuth())) {
        return new Response(JSON.stringify({ error: 'Unauthorized - API key or valid JWT required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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

    // GET /totais - Totais por status (REQUIRES AUTH)
    if (path.endsWith('/totais') && req.method === 'GET') {
      if (!(await validateAuth())) {
        return new Response(JSON.stringify({ error: 'Unauthorized - API key or valid JWT required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[contas-receber-api] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
