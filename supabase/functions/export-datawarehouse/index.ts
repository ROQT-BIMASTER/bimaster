import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExportParams {
  format?: 'json' | 'csv';
  entity_type: 'dimensions' | 'facts' | 'aggregations';
  table_name?: string;
  start_date?: string;
  end_date?: string;
  regiao?: string;
  uf?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
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
      .single();

    if (!profile?.aprovado) {
      throw new Error('User not approved');
    }

    const params: ExportParams = await req.json();
    const format = params.format || 'json';
    
    let data: any;
    let fileName: string;

    // Export based on entity type
    switch (params.entity_type) {
      case 'dimensions':
        data = await exportDimensions(supabase, params);
        fileName = `dimensions_${params.table_name || 'all'}_${new Date().toISOString()}`;
        break;
      
      case 'facts':
        data = await exportFacts(supabase, params);
        fileName = `facts_${params.table_name || 'all'}_${new Date().toISOString()}`;
        break;
      
      case 'aggregations':
        data = await exportAggregations(supabase, params);
        fileName = `aggregations_${new Date().toISOString()}`;
        break;
      
      default:
        throw new Error('Invalid entity_type');
    }

    // Format response
    if (format === 'csv') {
      const csv = convertToCSV(data);
      return new Response(csv, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${fileName}.csv"`,
        },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Export error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function exportDimensions(supabase: any, params: ExportParams) {
  const tables = params.table_name ? [params.table_name] : [
    'municipios',
    'prospects',
    'stores',
    'profiles',
    'competitors',
    'trade_chart_of_accounts',
    'trade_campaigns',
  ];

  const result: any = {};

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(10000);

    if (error) {
      console.error(`Error fetching ${table}:`, error);
      continue;
    }

    result[table] = data;
  }

  return result;
}

async function exportFacts(supabase: any, params: ExportParams) {
  const tables = params.table_name ? [params.table_name] : [
    'atividades',
    'visits',
    'gondola_audits',
    'shelf_share',
    'trade_investments',
    'trade_financial_entries',
    'trade_bank_transactions',
    'sales',
    'kpis_tracking',
  ];

  const result: any = {};

  for (const table of tables) {
    let query = supabase.from(table).select('*');

    // Apply date filters if provided
    if (params.start_date) {
      const dateField = getDateField(table);
      query = query.gte(dateField, params.start_date);
    }
    if (params.end_date) {
      const dateField = getDateField(table);
      query = query.lte(dateField, params.end_date);
    }

    const { data, error } = await query.limit(50000);

    if (error) {
      console.error(`Error fetching ${table}:`, error);
      continue;
    }

    result[table] = data;
  }

  return result;
}

async function exportAggregations(supabase: any, params: ExportParams) {
  const result: any = {};

  // Export materialized views
  const views = [
    'mv_sales_performance',
    'mv_conversion_funnel',
    'mv_trade_performance',
  ];

  for (const view of views) {
    let query = supabase.from(view).select('*');

    if (params.regiao) {
      query = query.eq('regiao', params.regiao);
    }
    if (params.uf) {
      query = query.eq('uf', params.uf);
    }

    const { data, error } = await query.limit(10000);

    if (error) {
      console.error(`Error fetching ${view}:`, error);
      continue;
    }

    result[view] = data;
  }

  // Export daily KPIs
  let kpisQuery = supabase.from('agg_daily_kpis').select('*');
  
  if (params.start_date) {
    kpisQuery = kpisQuery.gte('date', params.start_date);
  }
  if (params.end_date) {
    kpisQuery = kpisQuery.lte('date', params.end_date);
  }
  if (params.regiao) {
    kpisQuery = kpisQuery.eq('regiao', params.regiao);
  }
  if (params.uf) {
    kpisQuery = kpisQuery.eq('uf', params.uf);
  }

  const { data: kpis } = await kpisQuery.order('date', { ascending: false }).limit(1000);
  result.agg_daily_kpis = kpis;

  return result;
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

function convertToCSV(data: any): string {
  if (typeof data !== 'object') {
    return '';
  }

  let csv = '';
  
  // If data is an object with multiple tables
  if (!Array.isArray(data)) {
    for (const [tableName, tableData] of Object.entries(data)) {
      if (!Array.isArray(tableData) || tableData.length === 0) continue;
      
      csv += `\n\n=== ${tableName} ===\n`;
      csv += arrayToCSV(tableData as any[]);
    }
  } else {
    csv = arrayToCSV(data);
  }

  return csv;
}

function arrayToCSV(arr: any[]): string {
  if (arr.length === 0) return '';
  
  const headers = Object.keys(arr[0]);
  const rows = arr.map(row => 
    headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}
