import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-integration-source',
};

interface IntegrationConfig {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  sistema_origem: string;
  entidade_destino: string;
  auth_type: string;
  auth_config: Record<string, any>;
  batch_size: number;
  retry_attempts: number;
  ativo: boolean;
}

interface FieldMapping {
  campo_origem: string;
  path_origem: string | null;
  campo_destino: string;
  tipo_transformacao: string;
  formato_origem: string | null;
  formato_destino: string | null;
  funcao_transformacao: string | null;
  valor_default: string | null;
  obrigatorio: boolean;
}

// Helper: Get nested value from object using path
function getNestedValue(obj: any, path: string): any {
  if (!path) return obj;
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

// Helper: Parse date with multiple format support
function parseDate(value: any, formatOrigem?: string): string | null {
  if (!value) return null;
  
  try {
    // Handle ISO format
    if (typeof value === 'string' && value.includes('T')) {
      return new Date(value).toISOString().split('T')[0];
    }
    
    // Handle DD/MM/YYYY format
    if (typeof value === 'string' && value.includes('/')) {
      const parts = value.split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
    
    // Handle timestamp
    if (typeof value === 'number') {
      return new Date(value).toISOString().split('T')[0];
    }
    
    return value;
  } catch {
    return null;
  }
}

// Helper: Parse number
function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  
  // Handle Brazilian number format (1.234,56)
  if (typeof value === 'string') {
    value = value.replace(/\./g, '').replace(',', '.');
  }
  
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

// Transform data using field mappings
function transformData(sourceData: Record<string, any>, mappings: FieldMapping[]): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const mapping of mappings) {
    const sourceValue = mapping.path_origem 
      ? getNestedValue(sourceData, mapping.path_origem)
      : sourceData[mapping.campo_origem];
    
    let transformedValue = sourceValue;
    
    // Apply transformation
    switch (mapping.tipo_transformacao) {
      case 'format_date':
        transformedValue = parseDate(sourceValue, mapping.formato_origem || undefined);
        break;
      case 'parse_number':
        transformedValue = parseNumber(sourceValue);
        break;
      case 'uppercase':
        transformedValue = typeof sourceValue === 'string' ? sourceValue.toUpperCase() : sourceValue;
        break;
      case 'lowercase':
        transformedValue = typeof sourceValue === 'string' ? sourceValue.toLowerCase() : sourceValue;
        break;
      case 'trim':
        transformedValue = typeof sourceValue === 'string' ? sourceValue.trim() : sourceValue;
        break;
      case 'boolean':
        transformedValue = sourceValue === true || sourceValue === 'true' || sourceValue === '1' || sourceValue === 1;
        break;
      default:
        // direct mapping
        transformedValue = sourceValue;
    }
    
    // Apply default if null
    if ((transformedValue === null || transformedValue === undefined) && mapping.valor_default) {
      transformedValue = mapping.valor_default;
    }
    
    result[mapping.campo_destino] = transformedValue;
  }
  
  return result;
}

// Calculate MD5 hash for data deduplication
async function calculateHash(data: any): Promise<string> {
  const str = JSON.stringify(data);
  const msgBuffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('MD5', msgBuffer).catch(() => null);
  
  if (!hashBuffer) {
    // Fallback: simple hash
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
  
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Log integration execution
async function logIntegration(
  supabase: any,
  configId: string | null,
  codigoIntegracao: string,
  direcao: string,
  status: string,
  details: Partial<{
    request_id: string;
    endpoint: string;
    metodo: string;
    payload_preview: string;
    payload_size_bytes: number;
    status_code: number;
    response_preview: string;
    registros_recebidos: number;
    registros_processados: number;
    registros_sucesso: number;
    registros_erro: number;
    duracao_ms: number;
    erro_tipo: string;
    erro_mensagem: string;
    erro_stack: string;
    ip_address: string;
    user_agent: string;
  }> = {}
) {
  try {
    await supabase.from('integration_logs').insert({
      config_id: configId,
      codigo_integracao: codigoIntegracao,
      direcao,
      status,
      ...details,
      finalizado_em: status !== 'processing' ? new Date().toISOString() : null,
    });
  } catch (e) {
    console.error('Failed to log integration:', e);
  }
}

// Update integration config status
async function updateConfigStatus(
  supabase: any,
  configId: string,
  status: string,
  erro?: string
) {
  try {
    await supabase.from('integration_configs').update({
      ultima_execucao: new Date().toISOString(),
      ultimo_status: status,
      ultimo_erro: erro || null,
    }).eq('id', configId);
  } catch (e) {
    console.error('Failed to update config status:', e);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Route: /integration-router/inbound/:source_code
    // Route: /integration-router/outbound/:destination_code
    // Route: /integration-router/health
    // Route: /integration-router/configs (list all configs)
    
    const action = pathParts[1]; // inbound, outbound, health, configs
    const sourceCode = pathParts[2]; // integration config codigo
    
    // Health check endpoint
    if (action === 'health' || (!action && req.method === 'GET')) {
      return new Response(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // List configs endpoint
    if (action === 'configs' && req.method === 'GET') {
      const { data: configs, error } = await supabase
        .from('integration_configs')
        .select('id, codigo, nome, tipo, sistema_origem, entidade_destino, ativo, ultima_execucao, ultimo_status')
        .order('nome');
      
      if (error) throw error;
      
      return new Response(JSON.stringify({ configs }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Inbound data sync
    if (action === 'inbound' && req.method === 'POST') {
      if (!sourceCode) {
        return new Response(JSON.stringify({ error: 'Source code is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Load integration config
      const { data: config, error: configError } = await supabase
        .from('integration_configs')
        .select('*')
        .eq('codigo', sourceCode)
        .eq('ativo', true)
        .single();
      
      if (configError || !config) {
        return new Response(JSON.stringify({ 
          error: 'Integration config not found or inactive',
          codigo: sourceCode 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Validate authentication
      const apiKey = req.headers.get('x-api-key');
      const authHeader = req.headers.get('authorization');
      
      if (config.auth_type === 'api_key') {
        const expectedKey = config.auth_config?.api_key || Deno.env.get('INTEGRATION_API_KEY');
        if (!apiKey || apiKey !== expectedKey) {
          await logIntegration(supabase, config.id, sourceCode, 'inbound', 'error', {
            request_id: requestId,
            erro_tipo: 'AUTH_ERROR',
            erro_mensagem: 'Invalid or missing API key',
          });
          
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      
      // Parse request body
      const body = await req.json();
      const records = Array.isArray(body) ? body : (body.data || body.records || body.contas || [body]);
      
      if (!records.length) {
        return new Response(JSON.stringify({ error: 'No records to process' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Log start
      await logIntegration(supabase, config.id, sourceCode, 'inbound', 'processing', {
        request_id: requestId,
        registros_recebidos: records.length,
        payload_size_bytes: JSON.stringify(body).length,
        payload_preview: JSON.stringify(body).substring(0, 500),
      });
      
      // Load field mappings
      const { data: mappings } = await supabase
        .from('integration_field_mappings')
        .select('*')
        .eq('config_id', config.id)
        .eq('ativo', true)
        .order('ordem');
      
      // Process records
      let processedCount = 0;
      let successCount = 0;
      let errorCount = 0;
      const errors: any[] = [];
      
      // Process in batches
      const batchSize = config.batch_size || 100;
      
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const transformedBatch: any[] = [];
        
        for (const record of batch) {
          try {
            // Transform data if mappings exist
            const transformed = mappings?.length 
              ? transformData(record, mappings)
              : record;
            
            // Add hash for deduplication if entidade supports it
            if (config.entidade_destino === 'contas_receber' || config.entidade_destino === 'contas_pagar') {
              transformed.data_hash = await calculateHash({
                erp_id: transformed.erp_id,
                valor_original: transformed.valor_original,
                data_vencimento: transformed.data_vencimento,
              });
            }
            
            transformedBatch.push(transformed);
            processedCount++;
          } catch (e: unknown) {
            errorCount++;
            const errorMessage = e instanceof Error ? e.message : String(e);
            errors.push({ record, error: errorMessage });
          }
        }
        
        // Upsert batch
        if (transformedBatch.length > 0) {
          const { error: upsertError, count } = await supabase
            .from(config.entidade_destino)
            .upsert(transformedBatch, { 
              onConflict: 'erp_id',
              ignoreDuplicates: false 
            });
          
          if (upsertError) {
            console.error('Upsert error:', upsertError);
            errorCount += transformedBatch.length;
            errors.push({ batch: i / batchSize, error: upsertError.message });
          } else {
            successCount += transformedBatch.length;
          }
        }
        
        // Small delay between batches
        if (i + batchSize < records.length) {
          await new Promise(r => setTimeout(r, 10));
        }
      }
      
      const duration = Date.now() - startTime;
      const finalStatus = errorCount === 0 ? 'success' : (successCount > 0 ? 'partial' : 'error');
      
      // Log completion
      await logIntegration(supabase, config.id, sourceCode, 'inbound', finalStatus, {
        request_id: requestId,
        registros_recebidos: records.length,
        registros_processados: processedCount,
        registros_sucesso: successCount,
        registros_erro: errorCount,
        duracao_ms: duration,
        erro_mensagem: errors.length > 0 ? JSON.stringify(errors.slice(0, 10)) : undefined,
      });
      
      // Update config status
      await updateConfigStatus(supabase, config.id, finalStatus, errors[0]?.error);
      
      return new Response(JSON.stringify({
        success: true,
        request_id: requestId,
        status: finalStatus,
        stats: {
          received: records.length,
          processed: processedCount,
          success: successCount,
          errors: errorCount,
          duration_ms: duration,
        },
        errors: errors.slice(0, 10),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Outbound data sync (for future use)
    if (action === 'outbound' && req.method === 'POST') {
      // Load config
      const { data: config, error: configError } = await supabase
        .from('integration_configs')
        .select('*')
        .eq('codigo', sourceCode)
        .eq('ativo', true)
        .eq('tipo', 'outbound')
        .single();
      
      if (configError || !config) {
        return new Response(JSON.stringify({ 
          error: 'Outbound integration config not found',
          codigo: sourceCode 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // TODO: Implement outbound sync
      // 1. Query data from entidade_destino
      // 2. Transform using field mappings (reversed)
      // 3. Send to endpoint_url
      
      return new Response(JSON.stringify({
        message: 'Outbound sync not yet implemented',
        config: config.codigo,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Unknown route
    return new Response(JSON.stringify({ 
      error: 'Not found',
      available_routes: [
        'GET /integration-router/health',
        'GET /integration-router/configs',
        'POST /integration-router/inbound/:source_code',
        'POST /integration-router/outbound/:destination_code',
      ]
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error: unknown) {
    console.error('Integration router error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: errorMessage,
      request_id: requestId,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
