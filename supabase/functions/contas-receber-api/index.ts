import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// Calcular hash MD5 dos dados para detectar alterações
async function calculateHash(data: any): Promise<string> {
  const dataToHash = [
    data.valor_original,
    data.valor_aberto,
    data.valor_recebido,
    data.valor_juros,
    data.valor_desconto,
    data.valor_ajustes,
    data.data_recebimento
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
    empresa_id: erpRecord['ID Empresa'],
    empresa_nome: erpRecord['Empresa'],
    tipo_documento: erpRecord['Tipo'],
    numero_documento: erpRecord['Nota'],
    parcela: erpRecord['Seq'] || 1,
    cliente_codigo: erpRecord['Código'],
    cliente_nome: erpRecord['Cliente'],
    valor_original: erpRecord['Valor_Trc'] || 0,
    valor_aberto: erpRecord['Valor em Aberto'] || 0,
    valor_recebido: erpRecord['Valor Recebido'] || 0,
    valor_juros: erpRecord['Valor Juros'] || 0,
    valor_desconto: erpRecord['Valor Desconto'] || 0,
    valor_ajustes: erpRecord['Valor Ajustes'] || 0,
    data_emissao: erpRecord['Emissão'] ? new Date(erpRecord['Emissão']).toISOString().split('T')[0] : null,
    data_vencimento: erpRecord['Vencimento'] ? new Date(erpRecord['Vencimento']).toISOString().split('T')[0] : null,
    data_recebimento: erpRecord['Data Recebimento'] ? new Date(erpRecord['Data Recebimento']).toISOString().split('T')[0] : null,
    categoria_codigo: erpRecord['ID Historico'],
    categoria_nome: erpRecord['Historico'],
    portador: erpRecord['Portador'] || 'SEM PORTADOR',
    conta: erpRecord['Conta'] || 'SEM CONTA',
    vendedor_codigo: erpRecord['Vendedor Codigo'] || null,
    vendedor_nome: erpRecord['Vendedor'] || null
  };
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

    // POST /sync - Sincronizar dados do n8n
    if (path.endsWith('/sync') && req.method === 'POST') {
      const apiKey = req.headers.get('x-api-key');
      const expectedKey = Deno.env.get('EXPORT_API_KEY');
      
      if (!apiKey || apiKey !== expectedKey) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const startTime = Date.now();
      const { contas } = await req.json();

      if (!contas || !Array.isArray(contas)) {
        return new Response(JSON.stringify({ error: 'Invalid payload' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      const errors: any[] = [];

      for (const conta of contas) {
        try {
          // Gerar erp_id único
          const erpId = `${conta['ID Empresa']}-${conta['Tipo']}-${conta['Nota']}-${conta['Seq']}-${conta['Código']}`;
          
          // Transformar dados
          const transformed = transformErpData(conta);
          const dataHash = await calculateHash(transformed);

          // Buscar registro existente
          const { data: existing } = await supabase
            .from('contas_receber')
            .select('id, data_hash')
            .eq('erp_id', erpId)
            .maybeSingle();

          if (!existing) {
            // INSERT - Registro novo
            const { error } = await supabase.from('contas_receber').insert({
              erp_id: erpId,
              data_hash: dataHash,
              ...transformed,
              sincronizado_em: new Date().toISOString()
            });
            
            if (error) throw error;
            inserted++;
          } else if (existing.data_hash !== dataHash) {
            // UPDATE - Registro alterado
            const { error } = await supabase
              .from('contas_receber')
              .update({
                data_hash: dataHash,
                ...transformed,
                sincronizado_em: new Date().toISOString()
              })
              .eq('id', existing.id);
            
            if (error) throw error;
            updated++;
          } else {
            // SKIP - Dados iguais
            skipped++;
          }
        } catch (error) {
          errors.push({
            record: conta,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      const duration = Date.now() - startTime;

      // Registrar estatísticas de sincronização
      const empresaId = contas[0] ? contas[0]['ID Empresa'] : null;
      await supabase.from('sync_control').insert({
        entidade: 'contas_receber',
        empresa_id: empresaId,
        ultima_sync: new Date().toISOString(),
        total_registros: contas.length,
        registros_inseridos: inserted,
        registros_atualizados: updated,
        registros_ignorados: skipped,
        duracao_ms: duration,
        status: errors.length === 0 ? 'success' : 'partial',
        erro_mensagem: errors.length > 0 ? JSON.stringify(errors) : null
      });

      return new Response(JSON.stringify({
        success: true,
        statistics: {
          total_received: contas.length,
          inserted,
          updated,
          skipped,
          errors: errors.length
        },
        duration_ms: duration,
        message: `Processado: ${inserted} novos, ${updated} atualizados, ${skipped} inalterados`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET / - Listar contas
    if (path.endsWith('/contas-receber-api') && req.method === 'GET') {
      const { data, error } = await supabase
        .from('contas_receber')
        .select('*')
        .order('data_vencimento', { ascending: false })
        .limit(100);

      if (error) throw error;

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /stats - Estatísticas de sincronização
    if (path.endsWith('/stats') && req.method === 'GET') {
      const { data, error } = await supabase
        .from('sync_control')
        .select('*')
        .eq('entidade', 'contas_receber')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /totais - Totais por status
    if (path.endsWith('/totais') && req.method === 'GET') {
      const { data, error } = await supabase
        .rpc('calcular_totais_contas_receber');

      if (error) throw error;

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
