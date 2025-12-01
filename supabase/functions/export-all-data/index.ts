import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// Rate limiting: Track last request time per IP (simple in-memory cache)
const requestLog = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 3600000; // 1 hour
const MAX_REQUESTS_PER_HOUR = 10;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestStartTime = Date.now();
  let totalRecords = 0;
  let ipAddress = 'unknown';

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get IP address for audit logging and rate limiting
    ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                req.headers.get('x-real-ip') || 
                'unknown';

    // Validate API key for n8n integration
    const apiKey = req.headers.get('X-API-Key');
    const expectedKey = Deno.env.get('N8N_API_KEY');
    
    if (!apiKey || apiKey !== expectedKey) {
      console.error(`❌ Invalid API key attempt from ${ipAddress}`);
      
      // Log failed authentication attempt
      try {
        await supabase.from('api_access_log').insert({
          endpoint: 'export-all-data',
          ip_address: ipAddress,
          success: false,
          error_message: 'Invalid API key',
          requested_at: new Date().toISOString()
        });
      } catch (logError) {
        console.warn('Failed to log invalid auth:', logError);
      }
      
      throw new Error('Invalid API key');
    }

    // Rate limiting check
    const now = Date.now();
    const userRequests = requestLog.get(ipAddress) || [];
    const recentRequests = userRequests.filter(time => now - time < RATE_LIMIT_WINDOW_MS);
    
    if (recentRequests.length >= MAX_REQUESTS_PER_HOUR) {
      console.error(`⚠️ Rate limit exceeded for ${ipAddress}`);
      
      try {
        await supabase.from('api_access_log').insert({
          endpoint: 'export-all-data',
          ip_address: ipAddress,
          success: false,
          error_message: 'Rate limit exceeded',
          requested_at: new Date().toISOString()
        });
      } catch (logError) {
        console.warn('Failed to log rate limit:', logError);
      }
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Rate limit exceeded. Maximum 10 requests per hour.' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 429 
        }
      );
    }
    
    // Update rate limiting log
    recentRequests.push(now);
    requestLog.set(ipAddress, recentRequests);

    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'json';
    const includePhotos = url.searchParams.get('include_photos') === 'true';
    
    console.log('📦 Iniciando exportação completa do sistema...');
    console.log(`📝 Formato: ${format}, Incluir fotos: ${includePhotos}`);

    const result: any = {
      export_info: {
        timestamp: new Date().toISOString(),
        format,
        version: '1.0.0'
      },
      dimensions: {},
      facts: {},
      aggregations: {},
      configuration: {}
    };

    // 1. DIMENSÕES (Tabelas de referência)
    console.log('📊 Exportando dimensões...');
    
    const dimensionTables = [
      'municipios',
      'prospects',
      'stores',
      'profiles',
      'competitors',
      'our_products',
      'competitor_products',
      'trade_chart_of_accounts',
      'trade_campaigns',
      'trade_budgets',
      'trade_bank_accounts',
      'planos',
      'telas_sistema',
    ];

    for (const table of dimensionTables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(50000);

        if (error) {
          console.error(`⚠️ Erro em ${table}:`, error.message);
          result.dimensions[table] = { error: error.message };
          continue;
        }

        result.dimensions[table] = data;
        console.log(`✅ ${table}: ${data?.length || 0} registros`);
      } catch (err) {
        console.error(`❌ Exceção em ${table}:`, err);
      }
    }

    // 2. FATOS (Transações e eventos)
    console.log('📈 Exportando fatos...');
    
    const factTables = [
      'atividades',
      'visits',
      'gondola_audits',
      'shelf_share',
      'trade_investments',
      'trade_financial_entries',
      'trade_bank_transactions',
      'sales',
      'sale_items',
      'kpis_tracking',
      'competitor_intelligence',
      'promotion_execution',
      'ai_insights',
    ];

    for (const table of factTables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(100000);

        if (error) {
          console.error(`⚠️ Erro em ${table}:`, error.message);
          result.facts[table] = { error: error.message };
          continue;
        }

        result.facts[table] = data;
        console.log(`✅ ${table}: ${data?.length || 0} registros`);
      } catch (err) {
        console.error(`❌ Exceção em ${table}:`, err);
      }
    }

    // 3. AGREGAÇÕES (Views materializadas e KPIs)
    console.log('📊 Exportando agregações...');
    
    const aggregationTables = [
      'agg_daily_kpis',
    ];

    for (const table of aggregationTables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(10000);

        if (error) {
          console.error(`⚠️ Erro em ${table}:`, error.message);
          result.aggregations[table] = { error: error.message };
          continue;
        }

        result.aggregations[table] = data;
        console.log(`✅ ${table}: ${data?.length || 0} registros`);
      } catch (err) {
        console.error(`❌ Exceção em ${table}:`, err);
      }
    }

    // 4. CONFIGURAÇÕES (Roles e permissões)
    console.log('⚙️ Exportando configurações...');
    
    const configTables = [
      'user_roles',
      'role_permissoes_telas',
      'usuario_permissoes_telas',
      'usuario_prospects',
      'assinaturas',
      'notification_preferences',
      'goals',
    ];

    for (const table of configTables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(50000);

        if (error) {
          console.error(`⚠️ Erro em ${table}:`, error.message);
          result.configuration[table] = { error: error.message };
          continue;
        }

        result.configuration[table] = data;
        console.log(`✅ ${table}: ${data?.length || 0} registros`);
      } catch (err) {
        console.error(`❌ Exceção em ${table}:`, err);
      }
    }

    // 5. FOTOS (Opcional - pode ser pesado)
    if (includePhotos) {
      console.log('📸 Exportando fotos...');
      try {
        const { data, error } = await supabase
          .from('photos')
          .select('*')
          .limit(10000);

        if (!error && data) {
          result.facts.photos = data;
          console.log(`✅ photos: ${data.length} registros`);
        }
      } catch (err) {
        console.error('❌ Erro ao exportar fotos:', err);
      }
    }

    // 6. ESTATÍSTICAS FINAIS
    totalRecords = calculateTotalRecords(result);
    result.export_info.statistics = {
      total_dimensions: Object.keys(result.dimensions).length,
      total_facts: Object.keys(result.facts).length,
      total_aggregations: Object.keys(result.aggregations).length,
      total_configuration: Object.keys(result.configuration).length,
      total_records: totalRecords,
    };

    console.log('✅ Exportação completa finalizada!');
    console.log(`📊 Total de registros: ${totalRecords}`);

    // Audit log: Record successful export
    const requestDurationMs = Date.now() - requestStartTime;
    try {
      await supabase.from('api_access_log').insert({
        endpoint: 'export-all-data',
        ip_address: ipAddress,
        success: true,
        record_count: totalRecords,
        request_duration_ms: requestDurationMs,
        exported_tables: [
          ...Object.keys(result.dimensions),
          ...Object.keys(result.facts),
          ...Object.keys(result.aggregations),
          ...Object.keys(result.configuration)
        ].join(','),
        requested_at: new Date().toISOString()
      });
    } catch (logError) {
      console.warn('Failed to log successful export:', logError);
    }

    // Resposta baseada no formato
    if (format === 'csv') {
      const csv = convertToCSV(result);
      return new Response(csv, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="export_all_${new Date().toISOString()}.csv"`,
        },
      });
    }

    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    console.error('❌ Erro na exportação:', error);
    
    // Log error to database
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase.from('api_access_log').insert({
        endpoint: 'export-all-data',
        ip_address: ipAddress,
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        requested_at: new Date().toISOString()
      });
    } catch (logError) {
      console.warn('Failed to log error:', logError);
    }
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido na exportação' 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }, 
        status: error instanceof Error && error.message === 'Invalid API key' ? 401 : 500
      }
    );
  }
});

function calculateTotalRecords(result: any): number {
  let total = 0;
  
  for (const category of ['dimensions', 'facts', 'aggregations', 'configuration']) {
    for (const [_table, data] of Object.entries(result[category])) {
      if (Array.isArray(data)) {
        total += data.length;
      }
    }
  }
  
  return total;
}

function convertToCSV(result: any): string {
  let csv = '';
  
  for (const category of ['dimensions', 'facts', 'aggregations', 'configuration']) {
    csv += `\n\n========== ${category.toUpperCase()} ==========\n\n`;
    
    for (const [tableName, tableData] of Object.entries(result[category])) {
      if (!Array.isArray(tableData) || tableData.length === 0) continue;
      
      csv += `\n--- ${tableName} (${tableData.length} registros) ---\n`;
      csv += arrayToCSV(tableData);
      csv += '\n';
    }
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
