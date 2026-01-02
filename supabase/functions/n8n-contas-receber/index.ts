import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const N8N_WEBHOOK_URL = 'https://huggs.app.n8n.cloud/webhook/contas-receber-mcp';

// ============= CONFIGURAÇÕES OTIMIZADAS =============
const DEFAULT_BATCH_SIZE = 500;   // Registros por página do SQL Server
const UPSERT_BATCH_SIZE = 50;     // Registros por upsert no Supabase
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const FETCH_TIMEOUT_MS = 120000;  // 2 minutos timeout para N8N
const SUPABASE_BATCH_DELAY_MS = 50;

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
      
      // NOVA ABORDAGEM: Sync incremental automático controlado pelo banco
      case 'sync-auto':
        return await handleSyncAuto(req, supabase, user.id);
      
      case 'sync-resume':
        return await handleSyncResume(req, supabase, user.id);
      
      case 'preview':
        return await handlePreview(req);
      
      // Mantém endpoints antigos para compatibilidade
      case 'sync-start':
        return await handleSyncStart(req, supabase, user.id);
      
      case 'sync-page':
        return await handleSyncPage(req, supabase, user.id);
      
      case 'sync-finish':
        return await handleSyncFinish(req, supabase);
      
      default:
        return new Response(
          JSON.stringify({ 
            error: 'Unknown endpoint', 
            availableEndpoints: ['status', 'query', 'sync-auto', 'sync-resume', 'preview'] 
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

  // Verificar sync em progresso
  const { data: inProgressSync } = await supabase
    .from('sync_tracking')
    .select('*')
    .eq('entidade', 'contas_receber')
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

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
      },
      inProgressSync: inProgressSync ? {
        id: inProgressSync.id,
        offset: inProgressSync.metadata?.currentOffset || 0,
        recordsProcessed: inProgressSync.records_processed || 0,
        message: 'Sync em andamento - use sync-resume para continuar',
      } : null,
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

// ============= NOVA ABORDAGEM: SYNC AUTOMÁTICO SEM LOOP NO N8N =============
// O N8N chama sync-auto UMA VEZ, e a função processa TUDO automaticamente
// Usa sync_tracking para salvar progresso e retomar se der timeout

async function handleSyncAuto(req: Request, supabase: any, userId: string) {
  const body = await req.json().catch(() => ({}));
  const batchSize = body.batchSize || DEFAULT_BATCH_SIZE;
  const maxPagesPerCall = body.maxPagesPerCall || 50; // Processa até 50 páginas por chamada

  console.log(`🚀 SYNC-AUTO: Starting automatic sync (batchSize=${batchSize}, maxPages=${maxPagesPerCall})`);

  // Verificar se já tem sync em progresso
  const { data: existingSync } = await supabase
    .from('sync_tracking')
    .select('*')
    .eq('entidade', 'contas_receber')
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let trackingId: string;
  let currentOffset: number;
  let totalProcessed: number;
  let pagesProcessed: number;

  if (existingSync) {
    // Retomar sync existente
    trackingId = existingSync.id;
    currentOffset = existingSync.metadata?.currentOffset || 0;
    totalProcessed = existingSync.records_processed || 0;
    pagesProcessed = existingSync.metadata?.pagesProcessed || 0;
    console.log(`📋 Resuming existing sync from offset ${currentOffset}, ${totalProcessed} records already processed`);
  } else {
    // Criar novo sync
    const { data: newTracking, error: trackingError } = await supabase
      .from('sync_tracking')
      .insert({
        entidade: 'contas_receber',
        tipo_sync: 'full',
        status: 'in_progress',
        records_processed: 0,
        metadata: { 
          source: 'n8n-sync-auto', 
          batchSize, 
          startedBy: userId,
          currentOffset: 0,
          pagesProcessed: 0,
        },
      })
      .select()
      .single();

    if (trackingError || !newTracking) {
      throw new Error(`Failed to create sync tracking: ${trackingError?.message}`);
    }

    trackingId = newTracking.id;
    currentOffset = 0;
    totalProcessed = 0;
    pagesProcessed = 0;
    console.log(`📋 Created new sync tracking: ${trackingId}`);
  }

  const startTime = Date.now();
  const errors: any[] = [];
  let hasMore = true;
  let pagesInThisCall = 0;

  // Processar páginas até acabar ou atingir limite
  while (hasMore && pagesInThisCall < maxPagesPerCall) {
    try {
      console.log(`📄 Fetching page ${pagesProcessed + 1}, offset: ${currentOffset}`);

      const response = await fetchWithRetry(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableName: 'ConsultaPowerBIReceber',
          limit: batchSize,
          offset: currentOffset,
        }),
      });

      if (!response.ok) {
        throw new Error(`N8N error: ${response.status}`);
      }

      const data = await response.json();
      const records = data.data || [];

      console.log(`📥 Received ${records.length} records`);

      if (records.length === 0) {
        hasMore = false;
        console.log(`✅ No more records - sync complete!`);
        break;
      }

      // Transformar registros
      const transformedRecords = [];
      for (const record of records) {
        const transformed = transformErpData(record);
        const dataHash = await generateHash({
          erp_id: transformed.erp_id,
          valor_original: transformed.valor_original,
          valor_aberto: transformed.valor_aberto,
          status: transformed.status,
        });
        transformedRecords.push({ ...transformed, data_hash: dataHash });
      }

      // Upsert em batches menores
      let pageRecordsProcessed = 0;
      for (let i = 0; i < transformedRecords.length; i += UPSERT_BATCH_SIZE) {
        const batch = transformedRecords.slice(i, i + UPSERT_BATCH_SIZE);
        
        const { error: upsertError } = await supabase
          .from('contas_receber')
          .upsert(batch, { onConflict: 'erp_id', ignoreDuplicates: false });

        if (upsertError) {
          console.error(`❌ Upsert error:`, upsertError);
          errors.push({ page: pagesProcessed + 1, batch: Math.floor(i / UPSERT_BATCH_SIZE) + 1, error: upsertError.message });
        } else {
          pageRecordsProcessed += batch.length;
        }

        // Pequeno delay entre batches
        if (i + UPSERT_BATCH_SIZE < transformedRecords.length) {
          await new Promise(resolve => setTimeout(resolve, SUPABASE_BATCH_DELAY_MS));
        }
      }

      totalProcessed += pageRecordsProcessed;
      currentOffset += records.length;
      pagesProcessed++;
      pagesInThisCall++;
      hasMore = records.length >= batchSize;

      // Atualizar progresso no banco
      await supabase
        .from('sync_tracking')
        .update({
          records_processed: totalProcessed,
          metadata: {
            source: 'n8n-sync-auto',
            batchSize,
            startedBy: userId,
            currentOffset,
            pagesProcessed,
            lastUpdated: new Date().toISOString(),
          },
        })
        .eq('id', trackingId);

      console.log(`✅ Page ${pagesProcessed} done: ${pageRecordsProcessed} records (total: ${totalProcessed})`);

    } catch (error) {
      const err = error as Error;
      console.error(`❌ Page ${pagesProcessed + 1} failed:`, err.message);
      errors.push({ page: pagesProcessed + 1, error: err.message });
      
      // Salvar progresso antes de falhar
      await supabase
        .from('sync_tracking')
        .update({
          records_processed: totalProcessed,
          metadata: {
            source: 'n8n-sync-auto',
            batchSize,
            startedBy: userId,
            currentOffset,
            pagesProcessed,
            lastError: err.message,
            lastUpdated: new Date().toISOString(),
          },
        })
        .eq('id', trackingId);

      // Continuar com a próxima página se possível
      currentOffset += batchSize;
      pagesInThisCall++;
    }
  }

  const duration = Date.now() - startTime;

  // Se completou tudo, marcar como concluído
  if (!hasMore) {
    await supabase
      .from('sync_tracking')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        records_processed: totalProcessed,
        metadata: {
          source: 'n8n-sync-auto',
          batchSize,
          startedBy: userId,
          currentOffset,
          pagesProcessed,
          duration,
          completedAt: new Date().toISOString(),
        },
      })
      .eq('id', trackingId);

    // Criar log de sync
    await supabase.from('sync_logs').insert({
      tipo: 'contas_receber',
      status: 'completed',
      registros_processados: totalProcessed,
      duracao_ms: duration,
      detalhes: { source: 'n8n-sync-auto', pagesProcessed, errors: errors.length > 0 ? errors : undefined },
    });

    console.log(`🎉 SYNC COMPLETE! ${totalProcessed} records in ${pagesProcessed} pages (${duration}ms)`);

    return new Response(
      JSON.stringify({
        success: true,
        status: 'completed',
        totalProcessed,
        pagesProcessed,
        duration,
        hasMore: false,
        message: 'Sync completo!',
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Se ainda tem mais, retornar status para N8N chamar novamente
  console.log(`⏳ Processed ${pagesInThisCall} pages, more data available. Call sync-auto again to continue.`);

  return new Response(
    JSON.stringify({
      success: true,
      status: 'in_progress',
      totalProcessed,
      pagesProcessed,
      pagesInThisCall,
      currentOffset,
      duration,
      hasMore: true,
      message: `Processado ${pagesInThisCall} páginas. Chame sync-auto novamente para continuar.`,
      nextAction: 'Chame sync-auto novamente para continuar de onde parou.',
      errors: errors.length > 0 ? errors : undefined,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// SYNC-RESUME: Retoma um sync interrompido
async function handleSyncResume(req: Request, supabase: any, userId: string) {
  console.log(`🔄 SYNC-RESUME: Looking for interrupted syncs...`);

  // Verificar se tem sync em progresso
  const { data: existingSync } = await supabase
    .from('sync_tracking')
    .select('*')
    .eq('entidade', 'contas_receber')
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existingSync) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Nenhum sync em progresso encontrado. Use sync-auto para iniciar um novo.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log(`📋 Found sync to resume: ${existingSync.id}, offset: ${existingSync.metadata?.currentOffset || 0}`);

  // Delegar para sync-auto que vai detectar e continuar
  return handleSyncAuto(req, supabase, userId);
}

// ============= ENDPOINTS LEGADOS (para compatibilidade) =============

async function handleSyncStart(req: Request, supabase: any, userId: string) {
  const body = await req.json().catch(() => ({}));
  const batchSize = body.batchSize || DEFAULT_BATCH_SIZE;

  console.log(`🚀 [LEGACY] Starting sync session with batch size: ${batchSize}`);

  const { data: syncTracking } = await supabase
    .from('sync_tracking')
    .insert({
      entidade: 'contas_receber',
      tipo_sync: 'full',
      status: 'in_progress',
      metadata: { source: 'n8n-pagination-legacy', batchSize, startedBy: userId },
    })
    .select()
    .single();

  return new Response(
    JSON.stringify({
      success: true,
      trackingId: syncTracking?.id,
      batchSize,
      nextOffset: 0,
      hasMore: true,
      message: 'ATENÇÃO: Use sync-auto ao invés deste endpoint! Ele processa tudo automaticamente sem precisar de loop.',
      recommendation: {
        endpoint: 'sync-auto',
        description: 'Processa todas as páginas automaticamente sem limite de loop',
        usage: 'Chame sync-auto uma vez. Se der timeout, chame novamente - ele continua de onde parou.',
      },
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleSyncPage(req: Request, supabase: any, userId: string) {
  // Redirecionar para sync-auto
  console.log(`⚠️ [LEGACY] sync-page called - redirecting to sync-auto`);
  return handleSyncAuto(req, supabase, userId);
}

async function handleSyncFinish(req: Request, supabase: any) {
  const body = await req.json().catch(() => ({}));
  const { trackingId, totalProcessed = 0 } = body;

  if (trackingId) {
    await supabase
      .from('sync_tracking')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        records_processed: totalProcessed,
      })
      .eq('id', trackingId);
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Sync finalizado' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
