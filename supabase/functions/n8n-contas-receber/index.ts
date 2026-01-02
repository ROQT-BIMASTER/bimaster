import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const N8N_WEBHOOK_URL = 'https://huggs.app.n8n.cloud/webhook/contas-receber-mcp';

// ============= CONFIGURAÇÕES OTIMIZADAS =============
const DEFAULT_BATCH_SIZE = 1000;  // Registros por página
const UPSERT_BATCH_SIZE = 100;    // Registros por upsert
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const FETCH_TIMEOUT_MS = 30000;   // 30s timeout
const SUPABASE_BATCH_DELAY_MS = 100;

// Transform ERP data format to local format
function transformErpData(erpRecord: any) {
  return {
    empresa_id: erpRecord['ID Empresa'] || erpRecord.empresa_id || 1,
    empresa_nome: erpRecord['Empresa'] || erpRecord.empresa_nome || null,
    tipo_documento: erpRecord['Tipo'] || erpRecord.tipo_documento || null,
    numero_documento: erpRecord['Nota'] || erpRecord.numero_documento || null,
    parcela: erpRecord['Seq'] || erpRecord.parcela || 1,
    cliente_codigo: erpRecord['Codigo'] || erpRecord.cliente_codigo || null,
    cliente_nome: erpRecord['Cliente'] || erpRecord.cliente_nome || null,
    valor_original: parseFloat(erpRecord['Valor_Trc'] || erpRecord.valor_original || 0),
    valor_aberto: parseFloat(erpRecord['Valor em Aberto'] || erpRecord.valor_aberto || 0),
    valor_recebido: parseFloat(erpRecord['Valor Pago'] || erpRecord.valor_recebido || erpRecord.valor_pago || 0),
    data_emissao: erpRecord['Emissao'] || erpRecord.data_emissao || null,
    data_vencimento: erpRecord['Vencimento'] || erpRecord.data_vencimento || null,
    data_recebimento: erpRecord['Pagamento'] || erpRecord.data_recebimento || erpRecord.data_pagamento || null,
    status: erpRecord['Status'] || erpRecord.status || 'aberto',
    portador: erpRecord['Portador'] || erpRecord.portador || null,
    erp_id: `${erpRecord['ID Empresa'] || 1}-${erpRecord['Tipo'] || 'NF'}-${erpRecord['Nota'] || ''}-${erpRecord['Seq'] || 1}`,
    sincronizado_em: new Date().toISOString(),
  };
}

// Generate hash for data deduplication
async function generateHash(data: any): Promise<string> {
  const encoder = new TextEncoder();
  const dataStr = JSON.stringify(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(dataStr));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

// Fetch with retry logic and timeout
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = MAX_RETRIES): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.status < 500) {
        return response;
      }
      
      console.log(`⚠️ Attempt ${attempt}/${maxRetries} failed with status ${response.status}`);
      lastError = new Error(`HTTP ${response.status}`);
      
      if (attempt < maxRetries) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      const err = error as Error;
      const isTimeout = err.name === 'AbortError';
      console.log(`⚠️ Attempt ${attempt}/${maxRetries} ${isTimeout ? 'TIMEOUT' : 'failed'}:`, err.message);
      lastError = isTimeout ? new Error(`Request timeout after ${FETCH_TIMEOUT_MS}ms`) : err;
      
      if (attempt < maxRetries) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ User ${user.id} authenticated, path: ${path}`);

    switch (path) {
      case 'status':
        return await handleStatus(supabase);
      
      case 'query':
        return await handleQuery(req);
      
      case 'sync-page':
        // NOVO: Processa apenas UMA página e retorna próximo offset
        return await handleSyncPage(req, supabase, user.id);
      
      case 'sync-start':
        // NOVO: Inicia sync e retorna primeiro offset
        return await handleSyncStart(req, supabase, user.id);
      
      case 'sync-finish':
        // NOVO: Finaliza sync (atualiza logs)
        return await handleSyncFinish(req, supabase);
      
      case 'preview':
        return await handlePreview(req);
      
      // Mantém sync-all para compatibilidade mas marca como deprecated
      case 'sync-all':
        return await handleSyncPage(req, supabase, user.id);
      
      default:
        return new Response(
          JSON.stringify({ 
            error: 'Unknown endpoint', 
            availableEndpoints: ['status', 'query', 'sync-start', 'sync-page', 'sync-finish', 'preview'] 
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error('❌ Error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Test connection
async function handleStatus(supabase: any) {
  console.log('🔍 Testing N8N webhook connection...');
  
  const startTime = Date.now();
  let n8nConnected = false;
  let responseData: any = null;
  
  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        tableName: 'ConsultaPowerBIReceber',
        limit: 1, 
        offset: 0 
      }),
    });

    const duration = Date.now() - startTime;
    const responseText = await response.text();
    
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    n8nConnected = response.ok && (
      responseData?.success === true || 
      Array.isArray(responseData?.data) || 
      Array.isArray(responseData)
    );

  } catch (error: unknown) {
    console.error('❌ N8N connection error:', (error as Error).message);
  }

  const { data: lastSync } = await supabase
    .from('sync_logs')
    .select('*')
    .eq('tipo', 'contas_receber')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: localCount } = await supabase
    .from('contas_receber')
    .select('*', { count: 'exact', head: true });

  return new Response(
    JSON.stringify({
      success: n8nConnected,
      n8n: { connected: n8nConnected, webhookUrl: N8N_WEBHOOK_URL },
      local: {
        totalRecords: localCount || 0,
        lastSync: lastSync?.created_at || null,
        lastSyncStatus: lastSync?.status || null,
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Query data from N8N (single page)
async function handleQuery(req: Request) {
  const body = await req.json();
  const { limit = DEFAULT_BATCH_SIZE, offset = 0, filters = {} } = body;

  console.log(`📊 Querying N8N: limit=${limit}, offset=${offset}`);

  const response = await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tableName: 'ConsultaPowerBIReceber', limit, offset, filters }),
  });

  if (!response.ok) {
    throw new Error(`N8N webhook error: ${response.status}`);
  }

  return new Response(
    JSON.stringify(await response.json()),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Preview first records
async function handlePreview(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { limit = 10 } = body;

  const response = await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tableName: 'ConsultaPowerBIReceber', limit: Math.min(limit, 100), offset: 0 }),
  });

  if (!response.ok) {
    throw new Error(`N8N webhook error: ${response.status}`);
  }

  const data = await response.json();
  const transformedRecords = (data.data || []).map(transformErpData);

  return new Response(
    JSON.stringify({ success: true, preview: transformedRecords, metadata: data.metadata }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ============= ENDPOINTS PARA PAGINAÇÃO CONTROLADA PELO N8N =============
// IMPORTANTE: No N8N, o Loop Over Items tem limite de 15 iterações por padrão.
// Configure "Max Iterations" no nó de Loop para um valor maior (ex: 1000)

// SYNC-START: Inicia o sync e retorna o primeiro offset
async function handleSyncStart(req: Request, supabase: any, userId: string) {
  const body = await req.json().catch(() => ({}));
  const batchSize = body.batchSize || DEFAULT_BATCH_SIZE;

  console.log(`🚀 Starting sync session with batch size: ${batchSize}`);

  // Criar entrada no sync_logs
  const { data: syncLog } = await supabase
    .from('sync_logs')
    .insert({
      tipo: 'contas_receber',
      status: 'in_progress',
      detalhes: { source: 'n8n-pagination', batchSize, startedBy: userId },
    })
    .select()
    .single();

  const { data: syncTracking } = await supabase
    .from('sync_tracking')
    .insert({
      entidade: 'contas_receber',
      tipo_sync: 'full',
      status: 'in_progress',
      metadata: { source: 'n8n-pagination', batchSize, startedBy: userId },
    })
    .select()
    .single();

  return new Response(
    JSON.stringify({
      success: true,
      syncId: syncLog?.id,
      trackingId: syncTracking?.id,
      batchSize,
      nextOffset: 0,
      hasMore: true,
      loopIteration: 0,
      n8nConfig: {
        warning: 'Configure Max Iterations no Loop do N8N para 1000 ou mais!',
        defaultLimit: 15,
        recommendedLimit: 1000,
      },
      message: 'Sync iniciado. Use sync-page para processar cada página.',
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// SYNC-PAGE: Processa UMA página e retorna se tem mais
async function handleSyncPage(req: Request, supabase: any, userId: string) {
  const body = await req.json().catch(() => ({}));
  const { 
    offset = 0, 
    batchSize = DEFAULT_BATCH_SIZE,
    syncId = null,
    trackingId = null,
    totalProcessed = 0,
    pageNumber = 1,
  } = body;

  const startTime = Date.now();
  console.log(`📄 Processing page ${pageNumber}, offset: ${offset}`);

  try {
    // Buscar dados do N8N
    const response = await fetchWithRetry(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableName: 'ConsultaPowerBIReceber',
        limit: batchSize,
        offset,
      }),
    });

    if (!response.ok) {
      throw new Error(`N8N error: ${response.status}`);
    }

    const data = await response.json();
    const records = data.data || [];
    
    console.log(`📥 Received ${records.length} records from N8N`);

    if (records.length === 0) {
      // Sem mais registros - sync completo
      console.log(`✅ No more records - sync complete!`);
      
      return new Response(
        JSON.stringify({
          success: true,
          hasMore: false,
          pageProcessed: pageNumber,
          recordsInPage: 0,
          totalProcessed,
          syncId,
          trackingId,
          message: 'Sync completo - sem mais registros',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transformar registros
    const transformedRecords = records.map(transformErpData);
    
    for (const record of transformedRecords) {
      record.data_hash = await generateHash({
        erp_id: record.erp_id,
        valor_original: record.valor_original,
        valor_aberto: record.valor_aberto,
        status: record.status,
      });
    }

    // Upsert em batches menores
    let pageRecordsProcessed = 0;
    const errors: any[] = [];

    for (let i = 0; i < transformedRecords.length; i += UPSERT_BATCH_SIZE) {
      const batch = transformedRecords.slice(i, i + UPSERT_BATCH_SIZE);
      
      const { error: upsertError } = await supabase
        .from('contas_receber')
        .upsert(batch, { onConflict: 'erp_id', ignoreDuplicates: false });

      if (upsertError) {
        console.error(`❌ Upsert error:`, upsertError);
        errors.push({ batch: Math.floor(i / UPSERT_BATCH_SIZE) + 1, error: upsertError.message });
      } else {
        pageRecordsProcessed += batch.length;
      }

      if (i + UPSERT_BATCH_SIZE < transformedRecords.length) {
        await new Promise(resolve => setTimeout(resolve, SUPABASE_BATCH_DELAY_MS));
      }
    }

    const newTotalProcessed = totalProcessed + pageRecordsProcessed;
    const nextOffset = data.metadata?.nextOffset || (offset + records.length);
    const hasMore = records.length >= batchSize;
    const duration = Date.now() - startTime;

    console.log(`✅ Page ${pageNumber} done: ${pageRecordsProcessed} records in ${duration}ms`);

    // Atualizar sync_logs se fornecido
    if (syncId) {
      await supabase
        .from('sync_logs')
        .update({
          registros_processados: newTotalProcessed,
          detalhes: { 
            source: 'n8n-pagination', 
            batchSize, 
            pagesProcessed: pageNumber,
            currentOffset: nextOffset,
          },
        })
        .eq('id', syncId);
    }

    // Atualizar sync_tracking se fornecido
    if (trackingId) {
      await supabase
        .from('sync_tracking')
        .update({
          records_processed: newTotalProcessed,
          metadata: { 
            source: 'n8n-pagination', 
            batchSize, 
            pagesProcessed: pageNumber,
            currentOffset: nextOffset,
          },
        })
        .eq('id', trackingId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        hasMore,
        nextOffset,
        pageProcessed: pageNumber,
        recordsInPage: pageRecordsProcessed,
        totalProcessed: newTotalProcessed,
        syncId,
        trackingId,
        duration,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const err = error as Error;
    console.error(`❌ Page ${pageNumber} failed:`, err.message);

    return new Response(
      JSON.stringify({
        success: false,
        error: err.message,
        hasMore: true, // Assume que tem mais para N8N tentar novamente
        nextOffset: offset, // Mesmo offset para retry
        pageProcessed: pageNumber,
        totalProcessed,
        syncId,
        trackingId,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// SYNC-FINISH: Finaliza o sync e atualiza logs
async function handleSyncFinish(req: Request, supabase: any) {
  const body = await req.json().catch(() => ({}));
  const { 
    syncId, 
    trackingId, 
    totalProcessed = 0, 
    pagesProcessed = 0,
    hasErrors = false,
    duration = 0,
  } = body;

  console.log(`🎉 Finishing sync: ${totalProcessed} records in ${pagesProcessed} pages`);

  const status = hasErrors ? 'completed_with_errors' : 'completed';

  if (syncId) {
    await supabase
      .from('sync_logs')
      .update({
        status,
        registros_processados: totalProcessed,
        detalhes: { 
          source: 'n8n-pagination', 
          pagesProcessed,
          duration_ms: duration,
          finishedAt: new Date().toISOString(),
        },
      })
      .eq('id', syncId);
  }

  if (trackingId) {
    await supabase
      .from('sync_tracking')
      .update({
        status: hasErrors ? 'partial' : 'completed',
        records_processed: totalProcessed,
        duration_ms: duration,
        last_sync_at: new Date().toISOString(),
        metadata: { 
          source: 'n8n-pagination', 
          pagesProcessed,
          duration_ms: duration,
        },
      })
      .eq('id', trackingId);
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Sync finalizado com sucesso',
      summary: {
        totalProcessed,
        pagesProcessed,
        duration,
        status,
      },
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
