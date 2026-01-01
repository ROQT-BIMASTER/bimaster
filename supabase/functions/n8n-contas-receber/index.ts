import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const N8N_WEBHOOK_URL = 'https://huggs.app.n8n.cloud/webhook/contas-receber-mcp';
const MAX_LIMIT = 500;  // Reduzido para evitar timeout
const DEFAULT_LIMIT = 100;
const UPSERT_BATCH_SIZE = 100; // Tamanho do lote para upsert

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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate JWT
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

    console.log(`✅ N8N Contas Receber: User ${user.id} authenticated, path: ${path}`);

    // Route handling
    switch (path) {
      case 'status':
        return await handleStatus(supabase);
      
      case 'query':
        return await handleQuery(req);
      
      case 'sync-all':
        return await handleSyncAll(req, supabase, user.id);
      
      case 'preview':
        return await handlePreview(req);
      
      default:
        return new Response(
          JSON.stringify({ error: 'Unknown endpoint', availableEndpoints: ['status', 'query', 'sync-all', 'preview'] }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error('❌ N8N Contas Receber Error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Test connection to N8N webhook
async function handleStatus(supabase: any) {
  console.log('🔍 Testing N8N webhook connection...');
  
  const startTime = Date.now();
  let n8nResponse: any = null;
  let n8nConnected = false;
  let n8nError: string | null = null;
  let responseData: any = null;
  
  try {
    // Try POST first (expected for data queries)
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
    
    console.log(`📡 N8N Response - Status: ${response.status}, Body preview: ${responseText.substring(0, 200)}`);

    try {
      responseData = JSON.parse(responseText);
    } catch (parseErr) {
      console.log('⚠️ N8N response is not JSON:', responseText.substring(0, 100));
      responseData = { raw: responseText };
    }

    // Check connection - N8N is connected if we get a 200 response
    // The webhook might return data array directly or wrapped in success/data
    n8nConnected = response.ok && (
      responseData?.success === true || 
      Array.isArray(responseData?.data) || 
      Array.isArray(responseData) ||
      (responseData && typeof responseData === 'object' && !responseData.error)
    );

    n8nResponse = {
      connected: n8nConnected,
      responseTime: duration,
      webhookUrl: N8N_WEBHOOK_URL,
      httpStatus: response.status,
      sampleRecord: Array.isArray(responseData?.data) ? responseData.data[0] : 
                    Array.isArray(responseData) ? responseData[0] : null,
      metadata: responseData?.metadata || null,
      rawResponse: !n8nConnected ? responseData : undefined,
    };

  } catch (error: unknown) {
    const err = error as Error;
    console.error('❌ N8N connection error:', err.message);
    n8nError = err.message;
    n8nResponse = {
      connected: false,
      error: err.message,
      webhookUrl: N8N_WEBHOOK_URL,
    };
  }

  // Get last sync info from sync_logs
  const { data: lastSync } = await supabase
    .from('sync_logs')
    .select('*')
    .eq('tipo', 'contas_receber')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get local record count
  const { count: localCount } = await supabase
    .from('contas_receber')
    .select('*', { count: 'exact', head: true });

  return new Response(
    JSON.stringify({
      success: n8nConnected,
      n8n: n8nResponse,
      local: {
        totalRecords: localCount || 0,
        lastSync: lastSync?.created_at || null,
        lastSyncStatus: lastSync?.status || null,
        lastSyncRecords: lastSync?.registros_processados || null,
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Query data from N8N (single page)
async function handleQuery(req: Request) {
  const body = await req.json();
  const { limit = DEFAULT_LIMIT, offset = 0, filters = {} } = body;

  console.log(`📊 Querying N8N: limit=${limit}, offset=${offset}`);

  const response = await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tableName: 'ConsultaPowerBIReceber',
      limit: Math.min(limit, MAX_LIMIT),
      offset,
      filters,
    }),
  });

  if (!response.ok) {
    throw new Error(`N8N webhook error: ${response.status}`);
  }

  const data = await response.json();

  return new Response(
    JSON.stringify(data),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Preview first records (for UI display)
async function handlePreview(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { limit = 10 } = body;

  console.log(`👁️ Preview: fetching ${limit} records from N8N`);

  const response = await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tableName: 'ConsultaPowerBIReceber',
      limit: Math.min(limit, 100),
      offset: 0,
    }),
  });

  if (!response.ok) {
    throw new Error(`N8N webhook error: ${response.status}`);
  }

  const data = await response.json();

  // Transform for preview
  const transformedRecords = (data.data || []).map(transformErpData);

  return new Response(
    JSON.stringify({
      success: true,
      preview: transformedRecords,
      originalFormat: data.data?.[0] || null,
      metadata: data.metadata,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Full sync with pagination
async function handleSyncAll(req: Request, supabase: any, userId: string) {
  const body = await req.json().catch(() => ({}));
  // Forçar limite máximo para evitar timeout
  const requestedBatchSize = body.batchSize || MAX_LIMIT;
  const batchSize = Math.min(requestedBatchSize, MAX_LIMIT);

  console.log(`🔄 Starting full sync with batch size: ${batchSize} (requested: ${requestedBatchSize})`);

  const startTime = Date.now();

  // Create sync log entry in sync_logs table
  const { data: syncLog, error: logError } = await supabase
    .from('sync_logs')
    .insert({
      tipo: 'contas_receber',
      status: 'running',
      detalhes: { source: 'n8n-webhook', batchSize, startedBy: userId },
    })
    .select()
    .single();

  if (logError) {
    console.error('Failed to create sync log:', logError);
  }

  // Also create entry in sync_tracking table (used by frontend hook)
  const { data: syncTracking, error: trackingError } = await supabase
    .from('sync_tracking')
    .insert({
      entidade: 'contas_receber',
      tipo_sync: 'full',
      status: 'running',
      metadata: { source: 'n8n-webhook', batchSize, startedBy: userId },
    })
    .select()
    .single();

  if (trackingError) {
    console.error('Failed to create sync tracking:', trackingError);
  }

  const syncId = syncLog?.id;
  const trackingId = syncTracking?.id;
  
  let offset = 0;
  let totalProcessed = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let hasMore = true;
  let pageCount = 0;
  const errors: any[] = [];

  try {
    while (hasMore) {
      pageCount++;
      console.log(`📄 Processing page ${pageCount}, offset: ${offset}`);

      // Fetch from N8N
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableName: 'ConsultaPowerBIReceber',
          limit: batchSize,
          offset,
        }),
      });

      if (!response.ok) {
        throw new Error(`N8N webhook error on page ${pageCount}: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.data || data.data.length === 0) {
        hasMore = false;
        break;
      }

      // Transform records
      const transformedRecords = data.data.map(transformErpData);
      
      // Generate hashes for deduplication
      for (const record of transformedRecords) {
        record.data_hash = await generateHash({
          erp_id: record.erp_id,
          valor_original: record.valor_original,
          valor_aberto: record.valor_aberto,
          status: record.status,
        });
      }

      // Upsert in small batches to avoid memory issues
      for (let i = 0; i < transformedRecords.length; i += UPSERT_BATCH_SIZE) {
        const batch = transformedRecords.slice(i, i + UPSERT_BATCH_SIZE);
        
        const { error: upsertError } = await supabase
          .from('contas_receber')
          .upsert(batch, { 
            onConflict: 'erp_id',
            ignoreDuplicates: false 
          });

        if (upsertError) {
          console.error(`❌ Upsert error on page ${pageCount}, batch ${Math.floor(i / UPSERT_BATCH_SIZE) + 1}:`, upsertError);
          errors.push({ page: pageCount, batch: Math.floor(i / UPSERT_BATCH_SIZE) + 1, error: upsertError.message });
        } else {
          totalProcessed += batch.length;
        }
      }
      
      console.log(`✅ Page ${pageCount} processed: ${transformedRecords.length} records`);

      // Check if there's more data
      hasMore = data.metadata?.hasMoreData === true;
      offset = data.metadata?.nextOffset || offset + batchSize;

      // Update sync log progress
      if (syncId) {
        await supabase
          .from('sync_logs')
          .update({
            registros_processados: totalProcessed,
            detalhes: {
              source: 'n8n-webhook',
              batchSize,
              pagesProcessed: pageCount,
              currentOffset: offset,
              errors: errors.length,
            },
          })
          .eq('id', syncId);
      }

      // Update sync_tracking progress
      if (trackingId) {
        await supabase
          .from('sync_tracking')
          .update({
            records_processed: totalProcessed,
            metadata: {
              source: 'n8n-webhook',
              batchSize,
              pagesProcessed: pageCount,
              currentOffset: offset,
              errors: errors.length,
            },
          })
          .eq('id', trackingId);
      }

      // Small delay between pages to avoid overwhelming the webhook
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const duration = Date.now() - startTime;

    // Update sync log with final status
    if (syncId) {
      await supabase
        .from('sync_logs')
        .update({
          status: errors.length > 0 ? 'completed_with_errors' : 'completed',
          registros_processados: totalProcessed,
          detalhes: {
            source: 'n8n-webhook',
            batchSize,
            pagesProcessed: pageCount,
            duration_ms: duration,
            errors,
          },
        })
        .eq('id', syncId);
    }

    // Update sync_tracking with final status
    if (trackingId) {
      await supabase
        .from('sync_tracking')
        .update({
          status: errors.length > 0 ? 'partial' : 'completed',
          records_processed: totalProcessed,
          duration_ms: duration,
          last_sync_at: new Date().toISOString(),
          metadata: {
            source: 'n8n-webhook',
            batchSize,
            pagesProcessed: pageCount,
            duration_ms: duration,
            errors,
          },
        })
        .eq('id', trackingId);
    }

    console.log(`🎉 Sync completed: ${totalProcessed} records in ${pageCount} pages (${duration}ms)`);

    return new Response(
      JSON.stringify({
        success: true,
        syncId,
        trackingId,
        summary: {
          totalProcessed,
          pagesProcessed: pageCount,
          duration: duration,
          durationFormatted: `${Math.round(duration / 1000)}s`,
          recordsPerSecond: Math.round(totalProcessed / (duration / 1000)),
          errors: errors.length,
        },
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const err = error as Error;
    console.error('❌ Sync failed:', err);

    const failedDuration = Date.now() - startTime;

    // Update sync log with error
    if (syncId) {
      await supabase
        .from('sync_logs')
        .update({
          status: 'failed',
          erro_mensagem: err.message,
          registros_processados: totalProcessed,
          detalhes: {
            source: 'n8n-webhook',
            batchSize,
            pagesProcessed: pageCount,
            duration_ms: failedDuration,
            errors,
            fatalError: err.message,
          },
        })
        .eq('id', syncId);
    }

    // Update sync_tracking with error
    if (trackingId) {
      await supabase
        .from('sync_tracking')
        .update({
          status: 'failed',
          error_message: err.message,
          records_processed: totalProcessed,
          duration_ms: failedDuration,
          metadata: {
            source: 'n8n-webhook',
            batchSize,
            pagesProcessed: pageCount,
            duration_ms: failedDuration,
            errors,
            fatalError: err.message,
          },
        })
        .eq('id', trackingId);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: err.message,
        partial: {
          totalProcessed,
          pagesProcessed: pageCount,
        },
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
