import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

const N8N_WEBHOOK_URL = 'https://huggs.app.n8n.cloud/webhook/contas-receber-mcp';

// ============= CONFIGURAÇÕES OTIMIZADAS PARA 500K+ REGISTROS =============
const DEFAULT_BATCH_SIZE = 2000;     // Aumentado para processar mais rápido
const MAX_BATCH_SIZE = 5000;         // Máximo para grande volume
const UPSERT_BATCH_SIZE = 200;       // Aumentado para melhor throughput
const MAX_RETRIES = 5;               // Mais retries para grande volume
const RETRY_DELAY_MS = 2000;         // 2s entre retries
const FETCH_TIMEOUT_MS = 60000;      // 60s timeout para queries grandes
const SUPABASE_BATCH_DELAY_MS = 100; // Reduzido para maior velocidade

// ============= PROTEÇÕES BALANCEADAS PARA GRANDE VOLUME =============
const RATE_LIMIT_WINDOW_MS = 60000;  // Janela de 1 minuto
const MAX_REQUESTS_PER_WINDOW = 100; // Aumentado para sync massivo
const MAX_CONCURRENT_SYNCS = 1;      // Apenas 1 sync por vez
const PAGE_DELAY_MS = 1000;          // 1s entre páginas
const DB_HEALTH_CHECK_INTERVAL = 10; // Verificar a cada 10 páginas
const CIRCUIT_BREAKER_THRESHOLD_MS = 8000; // Se resposta > 8s, pausar
const CIRCUIT_BREAKER_WAIT_MS = 15000;     // Esperar 15s se banco lento

// Rate limiter em memória (reset quando função reinicia)
const rateLimiter = new Map<string, { count: number; resetAt: number }>();
const activeSyncs = new Map<string, { startedAt: number; lastActivity: number }>();

// Função para verificar rate limit
function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number; message?: string } {
  const now = Date.now();
  const userLimit = rateLimiter.get(userId);
  
  if (!userLimit || userLimit.resetAt < now) {
    rateLimiter.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  
  if (userLimit.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((userLimit.resetAt - now) / 1000);
    return { 
      allowed: false, 
      retryAfter,
      message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`
    };
  }
  
  userLimit.count++;
  return { allowed: true };
}

// Função para verificar syncs ativos
function checkConcurrentSyncs(syncId: string): { allowed: boolean; message?: string } {
  const now = Date.now();
  
  // Limpar syncs inativos (mais de 5 minutos sem atividade)
  for (const [id, sync] of activeSyncs.entries()) {
    if (now - sync.lastActivity > 300000) { // 5 minutos
      activeSyncs.delete(id);
      console.log(`🧹 Cleaned up inactive sync: ${id}`);
    }
  }
  
  // Se este sync já está ativo, atualizar e permitir
  if (activeSyncs.has(syncId)) {
    activeSyncs.set(syncId, { ...activeSyncs.get(syncId)!, lastActivity: now });
    return { allowed: true };
  }
  
  // Verificar limite de syncs simultâneos - APENAS 1 PERMITIDO
  if (activeSyncs.size >= MAX_CONCURRENT_SYNCS) {
    const activeList = Array.from(activeSyncs.entries()).map(([id, s]) => ({
      id,
      runningFor: Math.round((now - s.startedAt) / 1000) + 's',
      lastActivity: Math.round((now - s.lastActivity) / 1000) + 's ago'
    }));
    return { 
      allowed: false, 
      message: `Já existe ${MAX_CONCURRENT_SYNCS} sync em andamento. Aguarde a conclusão antes de iniciar outro. Syncs ativos: ${JSON.stringify(activeList)}`
    };
  }
  
  // Registrar novo sync
  activeSyncs.set(syncId, { startedAt: now, lastActivity: now });
  return { allowed: true };
}

// Função para remover sync ativo
function removeSyncFromActive(syncId: string) {
  activeSyncs.delete(syncId);
  console.log(`✅ Sync ${syncId} removed from active list. Active syncs: ${activeSyncs.size}`);
}

// Verificação de saúde do banco com circuit breaker
async function checkDatabaseHealth(supabase: any): Promise<{ healthy: boolean; responseTime: number; message?: string; shouldWait?: boolean; waitMs?: number }> {
  try {
    const startTime = Date.now();
    
    // Query simples para verificar responsividade
    const { error } = await supabase
      .from('sync_logs')
      .select('id')
      .limit(1)
      .maybeSingle();
    
    const duration = Date.now() - startTime;
    
    if (error) {
      console.warn(`⚠️ DB health check failed:`, error.message);
      return { healthy: false, responseTime: duration, message: error.message };
    }
    
    // CIRCUIT BREAKER: Se resposta muito lenta, pausar
    if (duration > CIRCUIT_BREAKER_THRESHOLD_MS) {
      console.warn(`🔴 CIRCUIT BREAKER: DB responding slowly (${duration}ms > ${CIRCUIT_BREAKER_THRESHOLD_MS}ms)`);
      return { 
        healthy: false, 
        responseTime: duration,
        message: `Database responding slowly: ${duration}ms. Circuit breaker activated.`,
        shouldWait: true,
        waitMs: CIRCUIT_BREAKER_WAIT_MS
      };
    }
    
    console.log(`💚 DB healthy: ${duration}ms`);
    return { healthy: true, responseTime: duration };
    
  } catch (error) {
    const err = error as Error;
    console.error(`❌ DB health check error:`, err.message);
    return { healthy: false, responseTime: 0, message: err.message };
  }
}

// Transform ERP data format to local format
// MAPEAMENTO ATUALIZADO baseado nos dados REAIS do webhook N8N:
// ID Empresa, Empresa, Tipo, Nota, Seq, Código, Cliente, Emissão, Vencimento,
// Valor_Trc, Valor em Aberto, Data Pgto, Valor Pago, Valor Juros, Valor Desconto,
// Valor Ajustes, Tabela, Vendedor, ID Portador, Nome Portador, Conta, RowNum
function transformErpData(erpRecord: any) {
  // Função auxiliar para parsear datas (formato ISO do SQL Server)
  const parseDate = (value: any): string | null => {
    if (!value) return null;
    // Se já é uma data válida em formato ISO
    if (typeof value === 'string') {
      try {
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date.toISOString();
      } catch {
        return null;
      }
    }
    return null;
  };

  // Função auxiliar para parsear valores monetários
  const parseAmount = (value: any): number => {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    // Remover formatação brasileira se houver
    const cleanValue = String(value).replace(/\./g, '').replace(',', '.');
    return parseFloat(cleanValue) || 0;
  };

  // Determinar status baseado no valor em aberto vs valor pago
  const valorAberto = parseAmount(erpRecord['Valor em Aberto']);
  const valorPago = parseAmount(erpRecord['Valor Pago']);
  const valorOriginal = parseAmount(erpRecord['Valor_Trc']);
  
  let status = 'aberto';
  if (valorAberto === 0 && valorPago > 0) {
    status = 'pago';
  } else if (valorPago > 0 && valorAberto > 0) {
    status = 'parcial';
  }

  // Gerar erp_id único usando campos do webhook real
  const empresaId = erpRecord['ID Empresa'] || 1;
  const tipo = erpRecord['Tipo'] || '';
  const nota = erpRecord['Nota'] || '';
  const seq = erpRecord['Seq'] || 1;
  
  const erpId = `${empresaId}-${tipo}-${nota}-${seq}`.replace(/\s+/g, '');

  return {
    empresa_id: empresaId,
    empresa_nome: erpRecord['Empresa'] || null,
    tipo_documento: String(erpRecord['Tipo'] || ''),
    numero_documento: String(erpRecord['Nota'] || ''),
    parcela: parseInt(erpRecord['Seq']) || 1,
    cliente_codigo: String(erpRecord['Código'] || erpRecord['Codigo'] || ''),
    cliente_nome: erpRecord['Cliente'] || null,
    valor_original: valorOriginal,
    valor_aberto: valorAberto,
    valor_recebido: valorPago,
    valor_juros: parseAmount(erpRecord['Valor Juros']),
    valor_desconto: parseAmount(erpRecord['Valor Desconto']),
    valor_ajustes: parseAmount(erpRecord['Valor Ajustes']),
    data_emissao: parseDate(erpRecord['Emissão'] || erpRecord['Emissao']),
    data_vencimento: parseDate(erpRecord['Vencimento']),
    data_recebimento: parseDate(erpRecord['Data Pgto']),
    status,
    portador: erpRecord['Nome Portador'] || null,
    portador_id: erpRecord['ID Portador'] || null,
    vendedor: erpRecord['Vendedor'] || null,
    tabela: erpRecord['Tabela'] || null,
    conta: erpRecord['Conta'] || null,
    erp_id: erpId || `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      const err = error as Error;
      const isTimeout = err.name === 'AbortError';
      console.log(`⚠️ Attempt ${attempt}/${maxRetries} ${isTimeout ? 'TIMEOUT' : 'failed'}:`, err.message);
      lastError = isTimeout ? new Error(`Request timeout after ${FETCH_TIMEOUT_MS}ms`) : err;
      
      if (attempt < maxRetries) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`⏳ Waiting ${delay}ms before retry...`);
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

    // ============= AUTENTICAÇÃO DUAL: N8N API Key OU JWT =============
    const n8nApiKey = Deno.env.get('N8N_API_KEY');
    const xApiKey = req.headers.get('x-api-key');
    const authHeader = req.headers.get('Authorization');
    
    let userId = 'n8n-service'; // ID padrão para chamadas do N8N
    let isN8NRequest = false;
    
    // Verificar se é uma chamada do N8N via x-api-key
    if (xApiKey && n8nApiKey && xApiKey === n8nApiKey) {
      isN8NRequest = true;
      console.log(`🤖 N8N request authenticated via x-api-key, path: ${path}`);
    } 
    // Verificar se é uma chamada do N8N via Authorization header com a API key
    else if (authHeader && n8nApiKey && authHeader === `Bearer ${n8nApiKey}`) {
      isN8NRequest = true;
      console.log(`🤖 N8N request authenticated via Bearer API key, path: ${path}`);
    }
    // Verificar autenticação JWT normal (frontend)
    else if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid token or API key', hint: 'Use x-api-key header with N8N_API_KEY or valid Supabase JWT' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = user.id;
      console.log(`✅ User ${user.id} authenticated via JWT, path: ${path}`);
    } else {
      return new Response(
        JSON.stringify({ error: 'Authentication required', hint: 'Use x-api-key header with N8N_API_KEY or Authorization header with JWT' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar rate limit (mais relaxado para N8N)
    if (!isN8NRequest) {
      const rateLimitCheck = checkRateLimit(userId);
      if (!rateLimitCheck.allowed) {
        console.warn(`🚫 Rate limit exceeded for user ${userId}`);
        return new Response(
          JSON.stringify({ 
            error: 'Rate limit exceeded', 
            message: rateLimitCheck.message,
            retryAfter: rateLimitCheck.retryAfter,
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rateLimitCheck.retryAfter) } }
        );
      }
    }

    console.log(`✅ Request authenticated (${isN8NRequest ? 'N8N' : 'User'}), path: ${path}`);

    switch (path) {
      case 'status':
        return await handleStatus(supabase);
      
      case 'query':
        return await handleQuery(req);
      
      case 'sync-page':
        return await handleSyncPage(req, supabase, userId);
      
      case 'sync-start':
        return await handleSyncStart(req, supabase, userId);
      
      case 'sync-finish':
        return await handleSyncFinish(req, supabase);
      
      case 'preview':
        return await handlePreview(req);
      
      case 'health':
        return await handleHealthCheck(supabase);
      
      case 'sync-auto':
        return await handleSyncAuto(req, supabase, userId);
      
      // Mantém sync-all para compatibilidade mas marca como deprecated
      case 'sync-all':
        return await handleSyncPage(req, supabase, userId);
      
      default:
        return new Response(
          JSON.stringify({ 
            error: 'Unknown endpoint', 
            availableEndpoints: ['status', 'query', 'sync-start', 'sync-page', 'sync-finish', 'preview', 'health', 'sync-auto'] 
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

// Health check endpoint
async function handleHealthCheck(supabase: any) {
  const dbHealth = await checkDatabaseHealth(supabase);
  const activeSyncCount = activeSyncs.size;
  
  return new Response(
    JSON.stringify({
      success: true,
      database: dbHealth,
      activeSyncs: activeSyncCount,
      maxConcurrentSyncs: MAX_CONCURRENT_SYNCS,
      rateLimiting: {
        maxRequestsPerMinute: MAX_REQUESTS_PER_WINDOW,
        pageDelayMs: PAGE_DELAY_MS,
      },
      config: {
        batchSize: DEFAULT_BATCH_SIZE,
        maxBatchSize: MAX_BATCH_SIZE,
        upsertBatchSize: UPSERT_BATCH_SIZE,
        dbHealthCheckInterval: DB_HEALTH_CHECK_INTERVAL,
        circuitBreakerThresholdMs: CIRCUIT_BREAKER_THRESHOLD_MS,
      },
      protections: {
        description: 'Proteções ultra-conservadoras para evitar sobrecarga',
        maxConcurrentSyncs: MAX_CONCURRENT_SYNCS,
        pageDelayMs: PAGE_DELAY_MS,
        circuitBreakerWaitMs: CIRCUIT_BREAKER_WAIT_MS,
      },
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

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

  // Contagem por ano
  const { count: count2025 } = await supabase
    .from('contas_receber')
    .select('*', { count: 'exact', head: true })
    .gte('data_vencimento', '2025-01-01');

  const { count: count2024 } = await supabase
    .from('contas_receber')
    .select('*', { count: 'exact', head: true })
    .gte('data_vencimento', '2024-01-01');

  const dbHealth = await checkDatabaseHealth(supabase);

  return new Response(
    JSON.stringify({
      success: n8nConnected,
      n8n: { connected: n8nConnected, webhookUrl: N8N_WEBHOOK_URL },
      local: {
        totalRecords: localCount || 0,
        records2025: count2025 || 0,
        records2024Plus: count2024 || 0,
        lastSync: lastSync?.created_at || null,
        lastSyncStatus: lastSync?.status || null,
      },
      database: dbHealth,
      activeSyncs: activeSyncs.size,
      protections: {
        rateLimitPerMinute: MAX_REQUESTS_PER_WINDOW,
        maxConcurrentSyncs: MAX_CONCURRENT_SYNCS,
        pageDelayMs: PAGE_DELAY_MS,
        circuitBreakerMs: CIRCUIT_BREAKER_THRESHOLD_MS,
      },
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Query data from N8N (single page) - com suporte a filtro de ano
async function handleQuery(req: Request) {
  const body = await req.json();
  const { limit = DEFAULT_BATCH_SIZE, offset = 0, filters = {}, anoMinimo } = body;

  console.log(`📊 Querying N8N: limit=${limit}, offset=${offset}, anoMinimo=${anoMinimo || 'all'}`);

  const queryFilters = { ...filters };
  if (anoMinimo) {
    queryFilters.anoMinimo = anoMinimo;
  }

  const response = await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tableName: 'ConsultaPowerBIReceber', limit, offset, filters: queryFilters }),
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
// IMPORTANTE: 
// - Configure Max Iterations no Loop do N8N para 1000+
// - Configure delay de 3 segundos entre iterações no N8N
// - Use filtro de ano para reduzir volume inicial

// SYNC-START: Inicia o sync e retorna o primeiro offset
async function handleSyncStart(req: Request, supabase: any, userId: string) {
  const body = await req.json().catch(() => ({}));
  const requestedBatchSize = body.batchSize || DEFAULT_BATCH_SIZE;
  const batchSize = Math.min(requestedBatchSize, MAX_BATCH_SIZE); // Máximo absoluto
  const anoMinimo = body.anoMinimo || null; // Filtro de ano opcional
  const scope = body.scope || 'full'; // 'full', '2025', '2024+'

  console.log(`🚀 Starting sync session with batch size: ${batchSize}, scope: ${scope}, anoMinimo: ${anoMinimo}`);

  // Verificar saúde do banco antes de iniciar
  const dbHealth = await checkDatabaseHealth(supabase);
  if (!dbHealth.healthy) {
    console.error(`❌ Database unhealthy, refusing to start sync: ${dbHealth.message}`);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Database unhealthy',
        message: `Cannot start sync: ${dbHealth.message}. Wait a few minutes and try again.`,
        dbResponseTime: dbHealth.responseTime,
        shouldWait: dbHealth.shouldWait,
        waitMs: dbHealth.waitMs,
      }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Gerar ID único para este sync
  const syncSessionId = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Verificar syncs simultâneos - APENAS 1 PERMITIDO
  const concurrentCheck = checkConcurrentSyncs(syncSessionId);
  if (!concurrentCheck.allowed) {
    console.warn(`🚫 Sync blocked: ${concurrentCheck.message}`);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Sync already in progress',
        message: concurrentCheck.message,
        activeSyncs: activeSyncs.size,
        maxConcurrentSyncs: MAX_CONCURRENT_SYNCS,
      }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Criar entrada no sync_logs
  const { data: syncLog } = await supabase
    .from('sync_logs')
    .insert({
      tipo: 'contas_receber',
      status: 'in_progress',
      detalhes: { 
        source: 'n8n-pagination', 
        batchSize, 
        startedBy: userId,
        syncSessionId,
        scope,
        anoMinimo,
        protections: {
          pageDelayMs: PAGE_DELAY_MS,
          maxConcurrentSyncs: MAX_CONCURRENT_SYNCS,
          rateLimit: MAX_REQUESTS_PER_WINDOW,
          circuitBreakerMs: CIRCUIT_BREAKER_THRESHOLD_MS,
        },
      },
    })
    .select()
    .single();

  const { data: syncTracking } = await supabase
    .from('sync_tracking')
    .insert({
      entidade: 'contas_receber',
      tipo_sync: scope === 'full' ? 'full' : 'partial',
      status: 'running',
      metadata: { 
        source: 'n8n-pagination', 
        batchSize, 
        startedBy: userId,
        syncSessionId,
        scope,
        anoMinimo,
      },
    })
    .select()
    .single();

  return new Response(
    JSON.stringify({
      success: true,
      syncId: syncLog?.id,
      trackingId: syncTracking?.id,
      syncSessionId,
      batchSize,
      scope,
      anoMinimo,
      nextOffset: 0,
      hasMore: true,
      loopIteration: 0,
      dbHealth: {
        healthy: dbHealth.healthy,
        responseTime: dbHealth.responseTime,
      },
      n8nConfig: {
        warning: '⚠️ OBRIGATÓRIO: Configure delay de 3s entre páginas no N8N!',
        requiredDelayBetweenPages: `${PAGE_DELAY_MS}ms (3 segundos)`,
        maxBatchSize: MAX_BATCH_SIZE,
        recommendedBatchSize: DEFAULT_BATCH_SIZE,
        maxIterations: 1000,
      },
      protections: {
        pageDelayMs: PAGE_DELAY_MS,
        maxConcurrentSyncs: MAX_CONCURRENT_SYNCS,
        dbHealthCheckInterval: DB_HEALTH_CHECK_INTERVAL,
        circuitBreakerThresholdMs: CIRCUIT_BREAKER_THRESHOLD_MS,
      },
      message: `Sync iniciado (scope: ${scope}). Use sync-page para processar cada página. OBRIGATÓRIO: delay de 3s entre páginas no N8N!`,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// SYNC-PAGE: Processa UMA página e retorna se tem mais
async function handleSyncPage(req: Request, supabase: any, userId: string) {
  const body = await req.json().catch(() => ({}));
  const { 
    offset = 0, 
    batchSize: requestedBatchSize = DEFAULT_BATCH_SIZE,
    syncId = null,
    trackingId = null,
    syncSessionId = null,
    totalProcessed = 0,
    pageNumber = 1,
    anoMinimo = null,
    scope = 'full',
  } = body;

  // Limitar batch size
  const batchSize = Math.min(requestedBatchSize, MAX_BATCH_SIZE);

  const startTime = Date.now();
  console.log(`📄 Processing page ${pageNumber}, offset: ${offset}, batchSize: ${batchSize}, scope: ${scope}`);

  // Atualizar atividade do sync se temos sessão
  if (syncSessionId && activeSyncs.has(syncSessionId)) {
    activeSyncs.set(syncSessionId, { ...activeSyncs.get(syncSessionId)!, lastActivity: Date.now() });
  }

  // Verificar saúde do banco a cada N páginas (mais frequente agora)
  if (pageNumber % DB_HEALTH_CHECK_INTERVAL === 0) {
    console.log(`🔍 Performing periodic DB health check (page ${pageNumber})`);
    const dbHealth = await checkDatabaseHealth(supabase);
    if (!dbHealth.healthy) {
      console.error(`❌ Database unhealthy at page ${pageNumber}: ${dbHealth.message}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Database unhealthy',
          message: `Sync paused: ${dbHealth.message}. The N8N workflow should wait and retry.`,
          hasMore: true,
          nextOffset: offset, // Mesmo offset para retry
          pageProcessed: pageNumber,
          totalProcessed,
          syncId,
          trackingId,
          syncSessionId,
          shouldWait: true,
          waitMs: dbHealth.waitMs || CIRCUIT_BREAKER_WAIT_MS,
          dbResponseTime: dbHealth.responseTime,
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  try {
    // Preparar filtros para N8N
    const queryFilters: Record<string, any> = {};
    if (anoMinimo) {
      queryFilters.anoMinimo = anoMinimo;
    }

    // Buscar dados do N8N
    const response = await fetchWithRetry(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableName: 'ConsultaPowerBIReceber',
        limit: batchSize,
        offset,
        filters: Object.keys(queryFilters).length > 0 ? queryFilters : undefined,
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
      
      // Remover sync da lista de ativos
      if (syncSessionId) {
        removeSyncFromActive(syncSessionId);
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          hasMore: false,
          pageProcessed: pageNumber,
          recordsInPage: 0,
          totalProcessed,
          syncId,
          trackingId,
          syncSessionId,
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

    // Upsert em batches menores com delays
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
        
        // Se erro grave, pausar
        if (upsertError.message.includes('timeout') || upsertError.message.includes('connection') || upsertError.message.includes('deadlock')) {
          console.error(`❌ Critical DB error, pausing sync`);
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Database error',
              message: `Critical error: ${upsertError.message}. Sync should pause and retry.`,
              hasMore: true,
              nextOffset: offset,
              pageProcessed: pageNumber,
              totalProcessed,
              syncId,
              trackingId,
              syncSessionId,
              shouldWait: true,
              waitMs: 60000, // Esperar 1 minuto
            }),
            { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        pageRecordsProcessed += batch.length;
      }

      // Delay entre batches de upsert
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
            lastPageDuration: duration,
            scope,
            anoMinimo,
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
            lastPageDuration: duration,
            scope,
            anoMinimo,
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
        syncSessionId,
        duration,
        errors: errors.length > 0 ? errors : undefined,
        // Informar o N8N sobre delay obrigatório
        requiredDelay: PAGE_DELAY_MS,
        message: hasMore ? `Page ${pageNumber} complete. ⚠️ WAIT ${PAGE_DELAY_MS}ms before next page.` : 'Processing complete.',
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
        syncSessionId,
        shouldWait: true,
        waitMs: 10000, // Esperar 10s antes de retry
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
    syncSessionId,
    totalProcessed = 0, 
    pagesProcessed = 0,
    hasErrors = false,
    duration = 0,
    scope = 'full',
  } = body;

  console.log(`🎉 Finishing sync: ${totalProcessed} records in ${pagesProcessed} pages (scope: ${scope})`);

  // Remover da lista de syncs ativos
  if (syncSessionId) {
    removeSyncFromActive(syncSessionId);
  }

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
          scope,
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
          scope,
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
        scope,
      },
      activeSyncsRemaining: activeSyncs.size,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ============= SYNC-AUTO: SINCRONIZAÇÃO COMPLETA AUTOMÁTICA (CRON) =============
// Endpoint chamado pelo pg_cron a cada 6 horas
async function handleSyncAuto(req: Request, supabase: any, userId: string) {
  const body = await req.json().catch(() => ({}));
  const batchSize = Math.min(body.batchSize || 2500, MAX_BATCH_SIZE);
  const webhookUrl = body.webhookUrl || N8N_WEBHOOK_URL;
  const maxPages = body.maxPages || 250; // ~500k registros com batch de 2500

  console.log(`🤖 SYNC-AUTO iniciado: batchSize=${batchSize}, maxPages=${maxPages}`);
  
  const syncStartTime = Date.now();
  const syncSessionId = `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Verificar saúde do banco
  const dbHealth = await checkDatabaseHealth(supabase);
  if (!dbHealth.healthy) {
    console.error(`❌ Database unhealthy, aborting auto-sync`);
    return new Response(
      JSON.stringify({ success: false, error: 'Database unhealthy', message: dbHealth.message }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verificar syncs simultâneos
  const concurrentCheck = checkConcurrentSyncs(syncSessionId);
  if (!concurrentCheck.allowed) {
    console.warn(`🚫 Auto-sync blocked: ${concurrentCheck.message}`);
    return new Response(
      JSON.stringify({ success: false, error: 'Sync in progress', message: concurrentCheck.message }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Criar log de sync
  const { data: syncLog } = await supabase
    .from('sync_logs')
    .insert({
      tipo: 'contas_receber',
      status: 'in_progress',
      detalhes: { source: 'cron-auto', batchSize, syncSessionId, startedAt: new Date().toISOString() },
    })
    .select()
    .single();

  let totalProcessed = 0;
  let pagesProcessed = 0;
  let offset = 0;
  let hasMore = true;
  const errors: any[] = [];

  try {
    // Loop por todas as páginas
    while (hasMore && pagesProcessed < maxPages) {
      pagesProcessed++;
      console.log(`📄 Auto-sync page ${pagesProcessed}, offset: ${offset}`);

      // Verificar saúde a cada 10 páginas
      if (pagesProcessed % 10 === 0) {
        const health = await checkDatabaseHealth(supabase);
        if (!health.healthy) {
          console.warn(`⚠️ DB slow at page ${pagesProcessed}, waiting ${CIRCUIT_BREAKER_WAIT_MS}ms`);
          await new Promise(r => setTimeout(r, CIRCUIT_BREAKER_WAIT_MS));
        }
      }

      // Buscar dados do webhook N8N
      const response = await fetchWithRetry(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: batchSize, offset }),
      });

      if (!response.ok) {
        throw new Error(`Webhook error: ${response.status}`);
      }

      const data = await response.json();
      const records = data.data || [];
      
      console.log(`📥 Page ${pagesProcessed}: received ${records.length} records`);

      if (records.length === 0) {
        hasMore = false;
        break;
      }

      // Transformar e inserir
      const transformedRecords = records.map(transformErpData);
      for (const record of transformedRecords) {
        record.data_hash = await generateHash({
          erp_id: record.erp_id,
          valor_original: record.valor_original,
          valor_aberto: record.valor_aberto,
          status: record.status,
        });
      }

      // Upsert em batches
      for (let i = 0; i < transformedRecords.length; i += UPSERT_BATCH_SIZE) {
        const batch = transformedRecords.slice(i, i + UPSERT_BATCH_SIZE);
        
        const { error: upsertError } = await supabase
          .from('contas_receber')
          .upsert(batch, { onConflict: 'erp_id', ignoreDuplicates: false });

        if (upsertError) {
          console.error(`❌ Upsert error page ${pagesProcessed}:`, upsertError.message);
          errors.push({ page: pagesProcessed, error: upsertError.message });
        } else {
          totalProcessed += batch.length;
        }

        await new Promise(r => setTimeout(r, SUPABASE_BATCH_DELAY_MS));
      }

      // Próxima página
      offset = data.metadata?.nextOffset || (offset + records.length);
      hasMore = records.length >= batchSize;

      // Atualizar log
      if (syncLog?.id) {
        await supabase
          .from('sync_logs')
          .update({
            registros_processados: totalProcessed,
            detalhes: { source: 'cron-auto', pagesProcessed, currentOffset: offset, lastUpdate: new Date().toISOString() },
          })
          .eq('id', syncLog.id);
      }

      // Delay entre páginas
      await new Promise(r => setTimeout(r, PAGE_DELAY_MS));
    }

    const duration = Date.now() - syncStartTime;
    console.log(`✅ SYNC-AUTO completo: ${totalProcessed} records em ${pagesProcessed} páginas (${duration}ms)`);

    // Remover sync ativo
    removeSyncFromActive(syncSessionId);

    // Atualizar log final
    if (syncLog?.id) {
      await supabase
        .from('sync_logs')
        .update({
          status: errors.length > 0 ? 'completed_with_errors' : 'completed',
          registros_processados: totalProcessed,
          detalhes: { 
            source: 'cron-auto', 
            pagesProcessed, 
            duration_ms: duration, 
            errors: errors.length,
            finishedAt: new Date().toISOString(),
          },
        })
        .eq('id', syncLog.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sincronização automática concluída',
        summary: {
          totalProcessed,
          pagesProcessed,
          duration_ms: duration,
          errors: errors.length,
          syncSessionId,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const err = error as Error;
    console.error(`❌ SYNC-AUTO failed:`, err.message);
    
    removeSyncFromActive(syncSessionId);
    
    if (syncLog?.id) {
      await supabase
        .from('sync_logs')
        .update({ status: 'failed', detalhes: { error: err.message, pagesProcessed, totalProcessed } })
        .eq('id', syncLog.id);
    }

    return new Response(
      JSON.stringify({ success: false, error: err.message, totalProcessed, pagesProcessed }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
