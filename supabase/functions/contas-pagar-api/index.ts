import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// =====================================================
// CONFIGURAÇÕES DE PERFORMANCE
// =====================================================
const BULK_BATCH_SIZE = 10000;      // Registros por operação SQL
const MAX_PAYLOAD_SIZE = 100000;    // Máximo de registros por requisição
const RECOMMENDED_CHUNK_SIZE = 25000; // Tamanho recomendado para chunks N8N

// Calcular hash MD5 dos dados para detectar alterações
async function calculateHash(data: any): Promise<string> {
  const dataToHash = [
    data.valor_original,
    data.valor_aberto,
    data.valor_pago,
    data.valor_juros,
    data.valor_desconto,
    data.valor_ajustes,
    data.data_pagamento
  ].join('|');
  
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(dataToHash);
  const hashBuffer = await crypto.subtle.digest('MD5', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Transformar dados do ERP para o formato do banco
function transformErpData(erpRecord: any) {
  return {
    empresa_id: erpRecord['ID Empresa'] || erpRecord.empresa_id,
    empresa_nome: erpRecord['Empresa'] || erpRecord.empresa_nome,
    tipo_documento: erpRecord['Tipo'] || erpRecord.tipo_documento,
    numero_documento: erpRecord['Nota'] || erpRecord.numero_documento,
    parcela: erpRecord['Seq'] || erpRecord.parcela || 1,
    fornecedor_codigo: erpRecord['Código'] || erpRecord.fornecedor_codigo,
    fornecedor_nome: erpRecord['Cliente'] || erpRecord.fornecedor_nome,
    valor_original: erpRecord['Valor_Trc'] || erpRecord.valor_original || 0,
    valor_aberto: erpRecord['Valor em Aberto'] || erpRecord.valor_aberto || 0,
    valor_pago: erpRecord['Valor Pago'] || erpRecord.valor_pago || 0,
    valor_juros: erpRecord['Valor Juros'] || erpRecord.valor_juros || 0,
    valor_desconto: erpRecord['Valor Desconto'] || erpRecord.valor_desconto || 0,
    valor_ajustes: erpRecord['Valor Ajustes'] || erpRecord.valor_ajustes || 0,
    data_emissao: parseDate(erpRecord['Emissão'] || erpRecord.data_emissao),
    data_vencimento: parseDate(erpRecord['Vencimento'] || erpRecord.data_vencimento),
    data_pagamento: parseDate(erpRecord['Data Pgto'] || erpRecord.data_pagamento),
    categoria_codigo: erpRecord['ID Historico'] || erpRecord.categoria_codigo,
    categoria_nome: erpRecord['Historico'] || erpRecord.categoria_nome,
    portador: erpRecord['Portador'] || erpRecord.portador || 'SEM PORTADOR',
    conta: erpRecord['Conta'] || erpRecord.conta || 'SEM CONTA'
  };
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

function generateErpId(record: any): string {
  const empresaId = record['ID Empresa'] || record.empresa_id;
  const tipo = record['Tipo'] || record.tipo_documento;
  const nota = record['Nota'] || record.numero_documento;
  const seq = record['Seq'] || record.parcela || 1;
  const codigo = record['Código'] || record.fornecedor_codigo;
  return `${empresaId}-${tipo}-${nota}-${seq}-${codigo}`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const path = url.pathname;

    // Validar API Key para endpoints de sincronização
    const validateApiKey = () => {
      const apiKey = req.headers.get('x-api-key');
      const expectedKey = Deno.env.get('N8N_API_KEY');
      return apiKey && apiKey === expectedKey;
    };

    // Validar autenticação (API Key ou JWT)
    const validateAuth = async () => {
      const apiKey = req.headers.get('x-api-key');
      const expectedKey = Deno.env.get('N8N_API_KEY');
      const authHeader = req.headers.get('Authorization');
      
      if (apiKey && apiKey === expectedKey) return true;
      
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error } = await supabase.auth.getUser(token);
        return !error && user;
      }
      
      return false;
    };

    // =====================================================
    // GET /status - Status da API
    // =====================================================
    if (path.endsWith('/status') && req.method === 'GET') {
      return new Response(JSON.stringify({
        status: 'online',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        config: {
          bulk_batch_size: BULK_BATCH_SIZE,
          max_payload_size: MAX_PAYLOAD_SIZE,
          recommended_chunk_size: RECOMMENDED_CHUNK_SIZE
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // POST /bulk-sync - Sincronização em massa (OTIMIZADO)
    // =====================================================
    if (path.endsWith('/bulk-sync') && req.method === 'POST') {
      if (!validateApiKey()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const startTime = Date.now();
      const body = await req.json();
      const contas = body.contas || body.data || body;
      const syncId = body.sync_id || crypto.randomUUID();
      const chunkNumber = body.chunk_number || 1;
      const totalChunks = body.total_chunks;

      if (!Array.isArray(contas) || contas.length === 0) {
        return new Response(JSON.stringify({ error: 'Invalid payload - array expected' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (contas.length > MAX_PAYLOAD_SIZE) {
        return new Response(JSON.stringify({ 
          error: `Payload too large. Max: ${MAX_PAYLOAD_SIZE}, received: ${contas.length}` 
        }), {
          status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`📦 bulk-sync: Recebidos ${contas.length} registros (chunk ${chunkNumber})`);

      // Preparar dados com erp_id e hash
      const preparedRecords = await Promise.all(contas.map(async (conta: any) => {
        const transformed = transformErpData(conta);
        const erpId = generateErpId(conta);
        const dataHash = await calculateHash(transformed);
        return {
          erp_id: erpId,
          data_hash: dataHash,
          ...transformed
        };
      }));

      // Chamar função SQL otimizada
      const { data: result, error } = await supabase.rpc('bulk_upsert_contas_pagar_v2', {
        p_records: preparedRecords
      });

      if (error) {
        console.error('❌ Erro bulk_upsert:', error);
        
        // Registrar chunk com erro
        await supabase.from('sync_chunks_tracking').insert({
          sync_id: syncId,
          entidade: 'contas_pagar',
          chunk_number: chunkNumber,
          total_chunks: totalChunks,
          records_in_chunk: contas.length,
          status: 'error',
          error_message: error.message,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime
        });

        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const duration = Date.now() - startTime;

      // Registrar chunk processado
      await supabase.from('sync_chunks_tracking').insert({
        sync_id: syncId,
        entidade: 'contas_pagar',
        chunk_number: chunkNumber,
        total_chunks: totalChunks,
        records_in_chunk: contas.length,
        records_processed: result.total,
        records_inserted: result.inserted,
        records_updated: result.updated,
        records_skipped: result.skipped,
        status: 'completed',
        completed_at: new Date().toISOString(),
        duration_ms: duration
      });

      console.log(`✅ bulk-sync: Chunk ${chunkNumber} processado em ${duration}ms - I:${result.inserted} U:${result.updated} S:${result.skipped}`);

      return new Response(JSON.stringify({
        success: true,
        sync_id: syncId,
        chunk_number: chunkNumber,
        statistics: {
          total_received: contas.length,
          inserted: result.inserted,
          updated: result.updated,
          skipped: result.skipped,
          errors: 0
        },
        duration_ms: duration,
        performance: {
          records_per_second: Math.round(contas.length / (duration / 1000))
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // POST /sync-incremental - Sincronização incremental
    // =====================================================
    if (path.endsWith('/sync-incremental') && req.method === 'POST') {
      if (!validateApiKey()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const startTime = Date.now();
      const body = await req.json();
      const contas = body.contas || body.data || body;

      if (!Array.isArray(contas) || contas.length === 0) {
        return new Response(JSON.stringify({ error: 'Invalid payload' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`🔄 sync-incremental: Processando ${contas.length} registros`);

      // Preparar dados
      const preparedRecords = await Promise.all(contas.map(async (conta: any) => {
        const transformed = transformErpData(conta);
        const erpId = generateErpId(conta);
        const dataHash = await calculateHash(transformed);
        return {
          erp_id: erpId,
          data_hash: dataHash,
          ...transformed
        };
      }));

      // Chamar função SQL otimizada
      const { data: result, error } = await supabase.rpc('bulk_upsert_contas_pagar_v2', {
        p_records: preparedRecords
      });

      if (error) {
        console.error('❌ Erro sync-incremental:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const duration = Date.now() - startTime;
      const empresaId = contas[0] ? (contas[0]['ID Empresa'] || contas[0].empresa_id) : null;

      // Registrar no sync_control
      await supabase.from('sync_control').insert({
        entidade: 'contas_pagar',
        empresa_id: empresaId,
        ultima_sync: new Date().toISOString(),
        total_registros: contas.length,
        registros_inseridos: result.inserted,
        registros_atualizados: result.updated,
        registros_ignorados: result.skipped,
        duracao_ms: duration,
        status: 'success'
      });

      console.log(`✅ sync-incremental: ${contas.length} registros em ${duration}ms`);

      return new Response(JSON.stringify({
        success: true,
        statistics: {
          total_received: contas.length,
          inserted: result.inserted,
          updated: result.updated,
          skipped: result.skipped,
          errors: 0
        },
        duration_ms: duration,
        message: `${result.skipped} registros ignorados (sem alterações)`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // POST /sync-chunk - Processar chunk (compatível com N8N)
    // =====================================================
    if (path.endsWith('/sync-chunk') && req.method === 'POST') {
      // Redireciona para bulk-sync mantendo compatibilidade
      const redirectUrl = new URL(req.url);
      redirectUrl.pathname = redirectUrl.pathname.replace('/sync-chunk', '/bulk-sync');
      
      const newReq = new Request(redirectUrl.toString(), {
        method: req.method,
        headers: req.headers,
        body: await req.text()
      });
      
      return await fetch(newReq);
    }

    // =====================================================
    // POST /sync-complete - Finalizar sincronização
    // =====================================================
    if (path.endsWith('/sync-complete') && req.method === 'POST') {
      if (!validateApiKey()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { sync_id, empresa_id } = await req.json();

      if (!sync_id) {
        return new Response(JSON.stringify({ error: 'sync_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Buscar resumo dos chunks
      const { data: progress } = await supabase
        .from('sync_chunks_progress')
        .select('*')
        .eq('sync_id', sync_id)
        .single();

      // Registrar no sync_control
      await supabase.from('sync_control').insert({
        entidade: 'contas_pagar',
        empresa_id: empresa_id,
        ultima_sync: new Date().toISOString(),
        total_registros: progress?.total_processed || 0,
        registros_inseridos: progress?.total_inserted || 0,
        registros_atualizados: progress?.total_updated || 0,
        registros_ignorados: progress?.total_skipped || 0,
        duracao_ms: progress?.total_duration_ms || 0,
        status: progress?.overall_status === 'completed' ? 'success' : 'partial'
      });

      console.log(`✅ sync-complete: Sincronização ${sync_id} finalizada`);

      return new Response(JSON.stringify({
        success: true,
        sync_id,
        summary: progress || { message: 'No chunks found for this sync_id' }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // GET /chunks-progress - Progresso dos chunks
    // =====================================================
    if (path.endsWith('/chunks-progress') && req.method === 'GET') {
      if (!await validateAuth()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const syncId = url.searchParams.get('sync_id');

      let query = supabase
        .from('sync_chunks_progress')
        .select('*')
        .eq('entidade', 'contas_pagar')
        .order('started_at', { ascending: false })
        .limit(10);

      if (syncId) {
        query = query.eq('sync_id', syncId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // POST /sync - Sincronização legada (compatibilidade)
    // =====================================================
    if (path.endsWith('/sync') && req.method === 'POST') {
      if (!validateApiKey()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const startTime = Date.now();
      const { contas } = await req.json();

      if (!contas || !Array.isArray(contas)) {
        return new Response(JSON.stringify({ error: 'Invalid payload' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`📦 sync (legado): Processando ${contas.length} registros`);

      // Preparar dados
      const preparedRecords = await Promise.all(contas.map(async (conta: any) => {
        const transformed = transformErpData(conta);
        const erpId = generateErpId(conta);
        const dataHash = await calculateHash(transformed);
        return {
          erp_id: erpId,
          data_hash: dataHash,
          ...transformed
        };
      }));

      // Chamar função SQL otimizada
      const { data: result, error } = await supabase.rpc('bulk_upsert_contas_pagar_v2', {
        p_records: preparedRecords
      });

      if (error) {
        console.error('❌ Erro sync legado:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const duration = Date.now() - startTime;
      const empresaId = contas[0] ? contas[0]['ID Empresa'] : null;

      await supabase.from('sync_control').insert({
        entidade: 'contas_pagar',
        empresa_id: empresaId,
        ultima_sync: new Date().toISOString(),
        total_registros: contas.length,
        registros_inseridos: result.inserted,
        registros_atualizados: result.updated,
        registros_ignorados: result.skipped,
        duracao_ms: duration,
        status: 'success'
      });

      return new Response(JSON.stringify({
        success: true,
        statistics: {
          total_received: contas.length,
          inserted: result.inserted,
          updated: result.updated,
          skipped: result.skipped,
          errors: 0
        },
        duration_ms: duration,
        message: `${result.skipped} registros ignorados (sem alterações)`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // GET / - Listar contas
    // =====================================================
    if (path.endsWith('/contas-pagar-api') && req.method === 'GET') {
      if (!await validateAuth()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data, error } = await supabase
        .from('contas_pagar')
        .select('*')
        .order('data_vencimento', { ascending: false })
        .limit(100);

      if (error) throw error;

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // GET /stats - Estatísticas de sincronização
    // =====================================================
    if (path.endsWith('/stats') && req.method === 'GET') {
      if (!await validateAuth()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data, error } = await supabase
        .from('sync_control')
        .select('*')
        .eq('entidade', 'contas_pagar')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
