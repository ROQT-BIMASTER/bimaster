import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// Rate limiting
const requestLog = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 3600000; // 1 hora
const MAX_REQUESTS_PER_HOUR = 100; // Mais generoso para integrações

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestStartTime = Date.now();
  let ipAddress = 'unknown';
  let endpoint = '';

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get IP address
    ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                req.headers.get('x-real-ip') || 
                'unknown';

    // Validate API key
    const apiKey = req.headers.get('X-API-Key');
    const expectedKey = Deno.env.get('N8N_API_KEY');
    
    if (!apiKey || apiKey !== expectedKey) {
      console.error(`❌ Invalid API key attempt from ${ipAddress}`);
      
      await logAccess(supabase, {
        endpoint: 'trade-marketing-api',
        ip_address: ipAddress,
        success: false,
        error_message: 'Invalid API key',
      });
      
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid API key' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 401 
        }
      );
    }

    // Rate limiting
    const now = Date.now();
    const userRequests = requestLog.get(ipAddress) || [];
    const recentRequests = userRequests.filter(time => now - time < RATE_LIMIT_WINDOW_MS);
    
    if (recentRequests.length >= MAX_REQUESTS_PER_HOUR) {
      console.error(`⚠️ Rate limit exceeded for ${ipAddress}`);
      
      await logAccess(supabase, {
        endpoint: 'trade-marketing-api',
        ip_address: ipAddress,
        success: false,
        error_message: 'Rate limit exceeded',
      });
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Rate limit exceeded. Maximum 100 requests per hour.' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 429 
        }
      );
    }
    
    recentRequests.push(now);
    requestLog.set(ipAddress, recentRequests);

    const url = new URL(req.url);
    const path = url.pathname.split('/').filter(Boolean);
    endpoint = path.join('/');

    // Parse query parameters
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const storeId = url.searchParams.get('store_id');
    const vendedorId = url.searchParams.get('vendedor_id');
    const supervisorId = url.searchParams.get('supervisor_id');
    const region = url.searchParams.get('region');
    const uf = url.searchParams.get('uf');
    const limit = parseInt(url.searchParams.get('limit') || '1000');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const format = url.searchParams.get('format') || 'json';

    console.log(`📊 Trade Marketing API - Endpoint: ${endpoint}`);

    let response: any;

    // Routes
    switch (req.method) {
      case 'GET':
        if (path.length === 0 || path[0] === 'docs') {
          response = getDocumentation();
        } else if (path[0] === 'visits') {
          response = await getVisits(supabase, { startDate, endDate, storeId, vendedorId, supervisorId, limit, offset });
        } else if (path[0] === 'sell-out') {
          response = await getSellOut(supabase, { startDate, endDate, storeId, vendedorId, limit, offset });
        } else if (path[0] === 'audits') {
          response = await getAudits(supabase, { startDate, endDate, storeId, vendedorId, limit, offset });
        } else if (path[0] === 'shelf-measurements') {
          response = await getShelfMeasurements(supabase, { startDate, endDate, storeId, vendedorId, limit, offset });
        } else if (path[0] === 'photos') {
          response = await getPhotos(supabase, { startDate, endDate, storeId, vendedorId, limit, offset });
        } else if (path[0] === 'investments') {
          response = await getInvestments(supabase, { startDate, endDate, storeId, limit, offset });
        } else if (path[0] === 'financial-entries') {
          response = await getFinancialEntries(supabase, { startDate, endDate, storeId, limit, offset });
        } else if (path[0] === 'stores') {
          response = await getStores(supabase, { vendedorId, supervisorId, region, uf, limit, offset });
        } else if (path[0] === 'kpis') {
          response = await getKPIs(supabase, { startDate, endDate, region, uf, limit, offset });
        } else if (path[0] === 'competitor-intelligence') {
          response = await getCompetitorIntelligence(supabase, { startDate, endDate, storeId, limit, offset });
        } else if (path[0] === 'promotion-execution') {
          response = await getPromotionExecution(supabase, { startDate, endDate, storeId, vendedorId, limit, offset });
        } else if (path[0] === 'full-export') {
          response = await getFullExport(supabase, { startDate, endDate });
        } else {
          throw new Error('Invalid endpoint');
        }
        break;

      default:
        throw new Error('Method not allowed');
    }

    // Log successful request
    const requestDurationMs = Date.now() - requestStartTime;
    await logAccess(supabase, {
      endpoint: `trade-marketing-api/${endpoint}`,
      ip_address: ipAddress,
      success: true,
      record_count: Array.isArray(response?.data) ? response.data.length : 0,
      request_duration_ms: requestDurationMs,
    });

    // Format response
    if (format === 'csv' && Array.isArray(response?.data)) {
      const csv = convertToCSV(response.data);
      return new Response(csv, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="trade_${endpoint}_${new Date().toISOString()}.csv"`,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        ...response
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Trade Marketing API Error:', error);
    
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await logAccess(supabase, {
        endpoint: `trade-marketing-api/${endpoint}`,
        ip_address: ipAddress,
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });
    } catch (logError) {
      console.warn('Failed to log error:', logError);
    }
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500
      }
    );
  }
});

// Helper functions

async function logAccess(supabase: any, data: any) {
  try {
    await supabase.from('api_access_log').insert({
      ...data,
      requested_at: new Date().toISOString()
    });
  } catch (error) {
    console.warn('Failed to log access:', error);
  }
}

function getDocumentation() {
  return {
    name: "Trade Marketing API",
    version: "1.0.0",
    description: "API para integração de dados de Trade Marketing com ERP",
    authentication: "X-API-Key header required",
    rate_limit: "100 requests per hour per IP",
    endpoints: {
      "/visits": {
        description: "Obter dados de visitas",
        params: ["start_date", "end_date", "store_id", "vendedor_id", "supervisor_id", "limit", "offset", "format"]
      },
      "/sell-out": {
        description: "Obter dados de sell-out",
        params: ["start_date", "end_date", "store_id", "vendedor_id", "limit", "offset", "format"]
      },
      "/audits": {
        description: "Obter dados de auditorias de gôndola",
        params: ["start_date", "end_date", "store_id", "vendedor_id", "limit", "offset", "format"]
      },
      "/shelf-measurements": {
        description: "Obter dados de medições de prateleira",
        params: ["start_date", "end_date", "store_id", "vendedor_id", "limit", "offset", "format"]
      },
      "/photos": {
        description: "Obter dados de fotos",
        params: ["start_date", "end_date", "store_id", "vendedor_id", "limit", "offset", "format"]
      },
      "/investments": {
        description: "Obter dados de investimentos",
        params: ["start_date", "end_date", "store_id", "limit", "offset", "format"]
      },
      "/financial-entries": {
        description: "Obter lançamentos financeiros",
        params: ["start_date", "end_date", "store_id", "limit", "offset", "format"]
      },
      "/stores": {
        description: "Obter dados de lojas",
        params: ["vendedor_id", "supervisor_id", "region", "uf", "limit", "offset", "format"]
      },
      "/kpis": {
        description: "Obter KPIs agregados",
        params: ["start_date", "end_date", "region", "uf", "limit", "offset", "format"]
      },
      "/competitor-intelligence": {
        description: "Obter inteligência competitiva",
        params: ["start_date", "end_date", "store_id", "limit", "offset", "format"]
      },
      "/promotion-execution": {
        description: "Obter execução de promoções",
        params: ["start_date", "end_date", "store_id", "vendedor_id", "limit", "offset", "format"]
      },
      "/full-export": {
        description: "Exportação completa de todos os dados de Trade Marketing",
        params: ["start_date", "end_date", "format"]
      }
    },
    examples: {
      visits: "/visits?start_date=2025-01-01&end_date=2025-01-31&vendedor_id=xxx&format=json",
      sell_out: "/sell-out?start_date=2025-01-01&store_id=xxx",
      full_export: "/full-export?start_date=2025-01-01&end_date=2025-01-31&format=csv"
    }
  };
}

async function getVisits(supabase: any, params: any) {
  let query = supabase
    .from('visits')
    .select(`
      *,
      stores (id, name, code, city, state),
      profiles!visits_user_id_fkey (id, nome, email)
    `)
    .order('created_at', { ascending: false })
    .range(params.offset, params.offset + params.limit - 1);

  if (params.startDate) query = query.gte('created_at', params.startDate);
  if (params.endDate) query = query.lte('created_at', params.endDate);
  if (params.storeId) query = query.eq('store_id', params.storeId);
  if (params.vendedorId) query = query.eq('user_id', params.vendedorId);

  const { data, error, count } = await query;
  if (error) throw error;

  return { data, total: count, count: data?.length || 0 };
}

async function getSellOut(supabase: any, params: any) {
  let query = supabase
    .from('store_sellout_batches')
    .select(`
      *,
      stores (id, name, code, city, state),
      store_sellout_items (
        id,
        quantity,
        unit_price,
        total_amount,
        our_products (id, name, sku, category)
      )
    `)
    .order('sellout_date', { ascending: false })
    .range(params.offset, params.offset + params.limit - 1);

  if (params.startDate) query = query.gte('sellout_date', params.startDate);
  if (params.endDate) query = query.lte('sellout_date', params.endDate);
  if (params.storeId) query = query.eq('store_id', params.storeId);
  if (params.vendedorId) query = query.eq('created_by', params.vendedorId);

  const { data, error, count } = await query;
  if (error) throw error;

  return { data, total: count, count: data?.length || 0 };
}

async function getAudits(supabase: any, params: any) {
  let query = supabase
    .from('gondola_audits')
    .select(`
      *,
      stores (id, name, code, city, state),
      profiles!gondola_audits_vendedor_id_fkey (id, nome, email)
    `)
    .order('created_at', { ascending: false })
    .range(params.offset, params.offset + params.limit - 1);

  if (params.startDate) query = query.gte('created_at', params.startDate);
  if (params.endDate) query = query.lte('created_at', params.endDate);
  if (params.storeId) query = query.eq('store_id', params.storeId);
  if (params.vendedorId) query = query.eq('vendedor_id', params.vendedorId);

  const { data, error, count } = await query;
  if (error) throw error;

  return { data, total: count, count: data?.length || 0 };
}

async function getShelfMeasurements(supabase: any, params: any) {
  let query = supabase
    .from('shelf_measurements')
    .select(`
      *,
      stores (id, name, code, city, state),
      profiles!shelf_measurements_vendedor_id_fkey (id, nome, email)
    `)
    .order('measurement_date', { ascending: false })
    .range(params.offset, params.offset + params.limit - 1);

  if (params.startDate) query = query.gte('measurement_date', params.startDate);
  if (params.endDate) query = query.lte('measurement_date', params.endDate);
  if (params.storeId) query = query.eq('store_id', params.storeId);
  if (params.vendedorId) query = query.eq('vendedor_id', params.vendedorId);

  const { data, error, count } = await query;
  if (error) throw error;

  return { data, total: count, count: data?.length || 0 };
}

async function getPhotos(supabase: any, params: any) {
  let query = supabase
    .from('photos')
    .select(`
      *,
      stores (id, name, code, city, state),
      visits (id, visit_date, status)
    `)
    .order('created_at', { ascending: false })
    .range(params.offset, params.offset + params.limit - 1);

  if (params.startDate) query = query.gte('created_at', params.startDate);
  if (params.endDate) query = query.lte('created_at', params.endDate);
  if (params.storeId) query = query.eq('store_id', params.storeId);
  if (params.vendedorId) query = query.eq('vendedor_id', params.vendedorId);

  const { data, error, count } = await query;
  if (error) throw error;

  return { data, total: count, count: data?.length || 0 };
}

async function getInvestments(supabase: any, params: any) {
  let query = supabase
    .from('trade_investments')
    .select(`
      *,
      stores (id, name, code, city, state),
      trade_chart_of_accounts (id, code, name),
      profiles!trade_investments_created_by_fkey (id, nome, email)
    `)
    .order('investment_date', { ascending: false })
    .range(params.offset, params.offset + params.limit - 1);

  if (params.startDate) query = query.gte('investment_date', params.startDate);
  if (params.endDate) query = query.lte('investment_date', params.endDate);
  if (params.storeId) query = query.eq('store_id', params.storeId);

  const { data, error, count } = await query;
  if (error) throw error;

  return { data, total: count, count: data?.length || 0 };
}

async function getFinancialEntries(supabase: any, params: any) {
  let query = supabase
    .from('trade_financial_entries')
    .select(`
      *,
      stores (id, name, code, city, state),
      trade_chart_of_accounts (id, code, name),
      trade_budgets (id, name, period_start, period_end),
      profiles!trade_financial_entries_created_by_fkey (id, nome, email)
    `)
    .order('entry_date', { ascending: false })
    .range(params.offset, params.offset + params.limit - 1);

  if (params.startDate) query = query.gte('entry_date', params.startDate);
  if (params.endDate) query = query.lte('entry_date', params.endDate);
  if (params.storeId) query = query.eq('store_id', params.storeId);

  const { data, error, count } = await query;
  if (error) throw error;

  return { data, total: count, count: data?.length || 0 };
}

async function getStores(supabase: any, params: any) {
  let query = supabase
    .from('stores')
    .select(`
      *,
      profiles!stores_vendedor_id_fkey (id, nome, email),
      store_chains (id, name),
      store_categories (id, name)
    `)
    .order('name', { ascending: true })
    .range(params.offset, params.offset + params.limit - 1);

  if (params.vendedorId) query = query.eq('vendedor_id', params.vendedorId);
  if (params.supervisorId) query = query.eq('supervisor_id', params.supervisorId);
  if (params.region) query = query.eq('region', params.region);
  if (params.uf) query = query.eq('state', params.uf);

  const { data, error, count } = await query;
  if (error) throw error;

  return { data, total: count, count: data?.length || 0 };
}

async function getKPIs(supabase: any, params: any) {
  let query = supabase
    .from('kpis_tracking')
    .select('*')
    .order('date', { ascending: false })
    .range(params.offset, params.offset + params.limit - 1);

  if (params.startDate) query = query.gte('date', params.startDate);
  if (params.endDate) query = query.lte('date', params.endDate);
  if (params.region) query = query.eq('region', params.region);

  const { data, error, count } = await query;
  if (error) throw error;

  return { data, total: count, count: data?.length || 0 };
}

async function getCompetitorIntelligence(supabase: any, params: any) {
  let query = supabase
    .from('competitor_intelligence')
    .select(`
      *,
      stores (id, name, code, city, state),
      competitors (id, name, brand),
      profiles!competitor_intelligence_vendedor_id_fkey (id, nome, email)
    `)
    .order('recorded_at', { ascending: false })
    .range(params.offset, params.offset + params.limit - 1);

  if (params.startDate) query = query.gte('recorded_at', params.startDate);
  if (params.endDate) query = query.lte('recorded_at', params.endDate);
  if (params.storeId) query = query.eq('store_id', params.storeId);

  const { data, error, count } = await query;
  if (error) throw error;

  return { data, total: count, count: data?.length || 0 };
}

async function getPromotionExecution(supabase: any, params: any) {
  let query = supabase
    .from('promotion_execution')
    .select(`
      *,
      stores (id, name, code, city, state),
      trade_promotions (id, name, promotion_type),
      profiles!promotion_execution_vendedor_id_fkey (id, nome, email)
    `)
    .order('checked_at', { ascending: false })
    .range(params.offset, params.offset + params.limit - 1);

  if (params.startDate) query = query.gte('checked_at', params.startDate);
  if (params.endDate) query = query.lte('checked_at', params.endDate);
  if (params.storeId) query = query.eq('store_id', params.storeId);
  if (params.vendedorId) query = query.eq('vendedor_id', params.vendedorId);

  const { data, error, count } = await query;
  if (error) throw error;

  return { data, total: count, count: data?.length || 0 };
}

async function getFullExport(supabase: any, params: any) {
  console.log('📦 Starting full Trade Marketing export...');

  const result: any = {
    visits: [],
    sell_out: [],
    audits: [],
    shelf_measurements: [],
    photos: [],
    investments: [],
    financial_entries: [],
    stores: [],
    kpis: [],
    competitor_intelligence: [],
    promotion_execution: []
  };

  // Export all data with filters
  const exports = [
    { key: 'visits', fn: getVisits },
    { key: 'sell_out', fn: getSellOut },
    { key: 'audits', fn: getAudits },
    { key: 'shelf_measurements', fn: getShelfMeasurements },
    { key: 'photos', fn: getPhotos },
    { key: 'investments', fn: getInvestments },
    { key: 'financial_entries', fn: getFinancialEntries },
    { key: 'kpis', fn: getKPIs },
    { key: 'competitor_intelligence', fn: getCompetitorIntelligence },
    { key: 'promotion_execution', fn: getPromotionExecution }
  ];

  for (const { key, fn } of exports) {
    try {
      const response = await fn(supabase, { ...params, limit: 10000, offset: 0 });
      result[key] = response.data || [];
      console.log(`✅ ${key}: ${result[key].length} records`);
    } catch (error) {
      console.error(`❌ Error exporting ${key}:`, error);
      result[key] = { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Add stores (no date filter)
  try {
    const storesResponse = await getStores(supabase, { limit: 10000, offset: 0 });
    result.stores = storesResponse.data || [];
    console.log(`✅ stores: ${result.stores.length} records`);
  } catch (error) {
    console.error('❌ Error exporting stores:', error);
    result.stores = { error: error instanceof Error ? error.message : 'Unknown error' };
  }

  return { data: result };
}

function convertToCSV(data: any[]): string {
  if (!Array.isArray(data) || data.length === 0) {
    return '';
  }

  const flattenObject = (obj: any, prefix = ''): any => {
    return Object.keys(obj).reduce((acc: any, key: string) => {
      const value = obj[key];
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(acc, flattenObject(value, newKey));
      } else if (Array.isArray(value)) {
        acc[newKey] = JSON.stringify(value);
      } else {
        acc[newKey] = value;
      }
      
      return acc;
    }, {});
  };

  const flatData = data.map(item => flattenObject(item));
  const headers = Object.keys(flatData[0] || {});
  
  const csvRows = flatData.map(row => 
    headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
      return value;
    }).join(',')
  );

  return [headers.join(','), ...csvRows].join('\n');
}
