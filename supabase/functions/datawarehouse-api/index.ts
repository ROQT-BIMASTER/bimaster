import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// =====================================================
// ALLOWLIST DE TABELAS PERMITIDAS
// =====================================================
const ALLOWED_DIMENSIONS = new Set([
  'municipios',
  'prospects',
  'stores',
  'profiles',
  'competitors',
  'trade_chart_of_accounts',
  'trade_campaigns',
]);

const ALLOWED_FACTS = new Set([
  'atividades',
  'visits',
  'gondola_audits',
  'shelf_share',
  'trade_investments',
  'trade_financial_entries',
  'trade_bank_transactions',
  'sales',
  'kpis_tracking',
]);

const ALLOWED_AGGREGATIONS = new Set([
  'mv_sales_performance',
  'mv_conversion_funnel',
  'mv_trade_performance',
  'agg_daily_kpis',
]);

const ALLOWED_CUSTOM_QUERY = new Set([
  ...ALLOWED_DIMENSIONS,
  ...ALLOWED_FACTS,
  ...ALLOWED_AGGREGATIONS,
  'etl_changelog',
]);

function isTableAllowed(table: string, allowedSet: Set<string>): boolean {
  return allowedSet.has(table);
}

interface QueryParams {
  table: string;
  filters?: Record<string, any>;
  aggregations?: {
    groupBy?: string[];
    metrics?: Array<{ field: string; operation: 'sum' | 'avg' | 'count' | 'min' | 'max' }>;
  };
  pagination?: {
    page?: number;
    pageSize?: number;
  };
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check for API key authentication (for ERP integrations)
    const apiKey = req.headers.get('X-API-Key');
    const expectedKey = Deno.env.get('N8N_API_KEY');
    
    let isAuthenticated = false;
    let userId = null;

    if (apiKey && apiKey === expectedKey) {
      // API Key authentication (for ERP/external systems)
      isAuthenticated = true;
      console.log('✅ Authenticated via API Key');
    } else {
      // JWT authentication (for web/mobile apps)
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        throw new Error('Missing authorization header or API key');
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        throw new Error('Unauthorized');
      }

      // Check if user is approved
      const { data: profile } = await supabase
        .from('profiles')
        .select('aprovado')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile?.aprovado) {
        throw new Error('User not approved');
      }

      isAuthenticated = true;
      userId = user.id;
      console.log('✅ Authenticated via JWT');
    }

    if (!isAuthenticated) {
      throw new Error('Authentication failed');
    }

    const url = new URL(req.url);
    const path = url.pathname.split('/').filter(Boolean);

    // Routes
    if (req.method === 'GET') {
      if (path.length === 0) {
        return handleGetSchema(supabase);
      }
      
      if (path[0] === 'dimensions' && path[1]) {
        if (!isTableAllowed(path[1], ALLOWED_DIMENSIONS)) {
          throw new Error(`Table '${path[1]}' is not allowed. Allowed dimensions: ${[...ALLOWED_DIMENSIONS].join(', ')}`);
        }
        return handleGetDimension(supabase, path[1], url.searchParams);
      }
      
      if (path[0] === 'facts' && path[1]) {
        if (!isTableAllowed(path[1], ALLOWED_FACTS)) {
          throw new Error(`Table '${path[1]}' is not allowed. Allowed facts: ${[...ALLOWED_FACTS].join(', ')}`);
        }
        return handleGetFacts(supabase, path[1], url.searchParams);
      }
      
      if (path[0] === 'aggregations') {
        const view = url.searchParams.get('view') || 'agg_daily_kpis';
        if (!isTableAllowed(view, ALLOWED_AGGREGATIONS)) {
          throw new Error(`View '${view}' is not allowed. Allowed aggregations: ${[...ALLOWED_AGGREGATIONS].join(', ')}`);
        }
        return handleGetAggregations(supabase, url.searchParams);
      }

      if (path[0] === 'changelog') {
        return handleGetChangelog(supabase, url.searchParams);
      }
    }

    if (req.method === 'POST' && path[0] === 'query') {
      const params: QueryParams = await req.json();
      if (!isTableAllowed(params.table, ALLOWED_CUSTOM_QUERY)) {
        throw new Error(`Table '${params.table}' is not allowed for custom queries`);
      }
      return handleCustomQuery(supabase, params);
    }

    if (req.method === 'POST' && path[0] === 'refresh') {
      return handleRefresh(supabase, path[1]);
    }

    throw new Error('Invalid endpoint');

  } catch (error) {
    console.error('API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: errorMessage === 'Unauthorized' ? 401 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function handleGetSchema(supabase: any) {
  const schema = {
    dimensions: [
      'municipios',
      'prospects',
      'stores',
      'profiles',
      'competitors',
      'trade_chart_of_accounts',
      'trade_campaigns',
    ],
    facts: [
      'atividades',
      'visits',
      'gondola_audits',
      'shelf_share',
      'trade_investments',
      'trade_financial_entries',
      'trade_bank_transactions',
      'sales',
      'kpis_tracking',
    ],
    aggregations: [
      'mv_sales_performance',
      'mv_conversion_funnel',
      'mv_trade_performance',
      'agg_daily_kpis',
    ],
  };

  return new Response(JSON.stringify(schema), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleGetDimension(supabase: any, table: string, params: URLSearchParams) {
  const page = parseInt(params.get('page') || '1');
  const pageSize = parseInt(params.get('pageSize') || '100');
  const offset = (page - 1) * pageSize;

  let query = supabase.from(table).select('*', { count: 'exact' });

  // Apply filters
  for (const [key, value] of params.entries()) {
    if (!['page', 'pageSize', 'sort', 'order'].includes(key)) {
      query = query.eq(key, value);
    }
  }

  // Apply sorting
  const sortField = params.get('sort');
  const sortOrder = params.get('order') || 'asc';
  if (sortField) {
    query = query.order(sortField, { ascending: sortOrder === 'asc' });
  }

  const { data, error, count } = await query.range(offset, offset + pageSize - 1);

  if (error) throw error;

  return new Response(JSON.stringify({
    data,
    pagination: {
      page,
      pageSize,
      total: count,
      totalPages: Math.ceil((count || 0) / pageSize),
    },
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleGetFacts(supabase: any, table: string, params: URLSearchParams) {
  const page = parseInt(params.get('page') || '1');
  const pageSize = parseInt(params.get('pageSize') || '100');
  const offset = (page - 1) * pageSize;

  let query = supabase.from(table).select('*', { count: 'exact' });

  // Apply date filters
  const startDate = params.get('start_date');
  const endDate = params.get('end_date');
  
  if (startDate || endDate) {
    const dateField = getDateField(table);
    if (startDate) query = query.gte(dateField, startDate);
    if (endDate) query = query.lte(dateField, endDate);
  }

  // Apply other filters
  for (const [key, value] of params.entries()) {
    if (!['page', 'pageSize', 'sort', 'order', 'start_date', 'end_date'].includes(key)) {
      query = query.eq(key, value);
    }
  }

  // Apply sorting
  const sortField = params.get('sort') || getDateField(table);
  const sortOrder = params.get('order') || 'desc';
  query = query.order(sortField, { ascending: sortOrder === 'asc' });

  const { data, error, count } = await query.range(offset, offset + pageSize - 1);

  if (error) throw error;

  return new Response(JSON.stringify({
    data,
    pagination: {
      page,
      pageSize,
      total: count,
      totalPages: Math.ceil((count || 0) / pageSize),
    },
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleGetAggregations(supabase: any, params: URLSearchParams) {
  const view = params.get('view') || 'agg_daily_kpis';
  const page = parseInt(params.get('page') || '1');
  const pageSize = parseInt(params.get('pageSize') || '100');
  const offset = (page - 1) * pageSize;

  let query = supabase.from(view).select('*', { count: 'exact' });

  // Apply filters
  for (const [key, value] of params.entries()) {
    if (!['page', 'pageSize', 'view', 'sort', 'order'].includes(key)) {
      query = query.eq(key, value);
    }
  }

  // Apply sorting
  const sortField = params.get('sort');
  const sortOrder = params.get('order') || 'desc';
  if (sortField) {
    query = query.order(sortField, { ascending: sortOrder === 'asc' });
  }

  const { data, error, count } = await query.range(offset, offset + pageSize - 1);

  if (error) throw error;

  return new Response(JSON.stringify({
    data,
    pagination: {
      page,
      pageSize,
      total: count,
      totalPages: Math.ceil((count || 0) / pageSize),
    },
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleGetChangelog(supabase: any, params: URLSearchParams) {
  const page = parseInt(params.get('page') || '1');
  const pageSize = parseInt(params.get('pageSize') || '100');
  const offset = (page - 1) * pageSize;

  let query = supabase.from('etl_changelog').select('*', { count: 'exact' });

  // Apply filters
  const tableName = params.get('table_name');
  const operation = params.get('operation');
  const startDate = params.get('start_date');
  const endDate = params.get('end_date');

  if (tableName) query = query.eq('table_name', tableName);
  if (operation) query = query.eq('operation', operation);
  if (startDate) query = query.gte('changed_at', startDate);
  if (endDate) query = query.lte('changed_at', endDate);

  query = query.order('changed_at', { ascending: false });

  const { data, error, count } = await query.range(offset, offset + pageSize - 1);

  if (error) throw error;

  return new Response(JSON.stringify({
    data,
    pagination: {
      page,
      pageSize,
      total: count,
      totalPages: Math.ceil((count || 0) / pageSize),
    },
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleCustomQuery(supabase: any, params: QueryParams) {
  let query = supabase.from(params.table).select('*');

  // Apply filters
  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      query = query.eq(key, value);
    }
  }

  // Apply pagination
  if (params.pagination) {
    const { page = 1, pageSize = 100 } = params.pagination;
    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);
  }

  // Apply sorting
  if (params.sort) {
    query = query.order(params.sort.field, { 
      ascending: params.sort.order === 'asc' 
    });
  }

  const { data, error } = await query;

  if (error) throw error;

  return new Response(JSON.stringify({ data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleRefresh(supabase: any, target?: string) {
  try {
    if (target === 'views') {
      await supabase.rpc('refresh_all_materialized_views');
    } else if (target === 'kpis') {
      await supabase.rpc('refresh_daily_kpis');
    } else {
      // Refresh both
      await supabase.rpc('refresh_all_materialized_views');
      await supabase.rpc('refresh_daily_kpis');
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Refresh completed successfully',
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    throw error;
  }
}

function getDateField(table: string): string {
  const dateFields: Record<string, string> = {
    atividades: 'data_atividade',
    visits: 'created_at',
    gondola_audits: 'created_at',
    shelf_share: 'recorded_at',
    trade_investments: 'investment_date',
    trade_financial_entries: 'entry_date',
    trade_bank_transactions: 'transaction_date',
    sales: 'sale_date',
    kpis_tracking: 'date',
  };

  return dateFields[table] || 'created_at';
}
