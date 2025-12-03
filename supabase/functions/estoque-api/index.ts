import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const tipo = url.searchParams.get('tipo');
    
    // Autenticação via JWT ou API Key
    const authHeader = req.headers.get('authorization');
    const apiKey = req.headers.get('x-api-key');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar autenticação
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        return new Response(
          JSON.stringify({ error: 'Token inválido' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (apiKey) {
      const expectedKey = Deno.env.get('EXPORT_API_KEY');
      if (apiKey !== expectedKey) {
        return new Response(
          JSON.stringify({ error: 'API Key inválida' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Autenticação necessária' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result;

    switch (tipo) {
      case 'por-distribuidora': {
        const distribuidoraId = url.searchParams.get('distribuidora_id');
        if (!distribuidoraId) {
          return new Response(
            JSON.stringify({ error: 'distribuidora_id é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const { data, error } = await supabase
          .from('estoque_saldos')
          .select(`
            id,
            quantidade_disponivel,
            quantidade_reservada,
            localizacao,
            lote,
            data_validade,
            custo_medio,
            ultimo_movimento,
            estoque_produtos_distribuidora!inner (
              id,
              codigo_produto_distribuidora,
              nome_exibicao,
              fator_conversao,
              estoque_produtos_master (
                id,
                nome,
                sku_master,
                unidade_medida,
                categoria
              )
            )
          `)
          .eq('distribuidora_id', distribuidoraId);
        
        if (error) throw error;
        result = data;
        break;
      }

      case 'por-produto-master': {
        const produtoMasterId = url.searchParams.get('produto_master_id');
        if (!produtoMasterId) {
          return new Response(
            JSON.stringify({ error: 'produto_master_id é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const { data, error } = await supabase
          .from('estoque_saldos')
          .select(`
            id,
            quantidade_disponivel,
            quantidade_reservada,
            localizacao,
            lote,
            data_validade,
            custo_medio,
            ultimo_movimento,
            estoque_distribuidoras!inner (
              id,
              nome,
              cnpj,
              cidade,
              uf
            ),
            estoque_produtos_distribuidora!inner (
              id,
              codigo_produto_distribuidora,
              nome_exibicao,
              fator_conversao,
              produto_master_id
            )
          `)
          .eq('estoque_produtos_distribuidora.produto_master_id', produtoMasterId);
        
        if (error) throw error;
        result = data;
        break;
      }

      case 'por-codigo': {
        const codigo = url.searchParams.get('codigo');
        const distribuidoraId = url.searchParams.get('distribuidora_id');
        
        if (!codigo || !distribuidoraId) {
          return new Response(
            JSON.stringify({ error: 'codigo e distribuidora_id são obrigatórios' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const { data, error } = await supabase
          .rpc('get_estoque_por_codigo_distribuidora', {
            p_distribuidora_id: distribuidoraId,
            p_codigo: codigo
          });
        
        if (error) throw error;
        result = data;
        break;
      }

      case 'consolidado': {
        const categoria = url.searchParams.get('categoria');
        
        const { data, error } = await supabase
          .rpc('get_estoque_consolidado_por_produto_master');
        
        if (error) throw error;
        
        result = categoria 
          ? data.filter((item: any) => item.categoria === categoria)
          : data;
        break;
      }

      case 'distribuidoras': {
        const { data, error } = await supabase
          .from('estoque_distribuidoras')
          .select('*')
          .eq('ativo', true)
          .order('nome');
        
        if (error) throw error;
        result = data;
        break;
      }

      case 'produtos-master': {
        const categoria = url.searchParams.get('categoria');
        let query = supabase
          .from('estoque_produtos_master')
          .select('*')
          .eq('ativo', true)
          .order('nome');
        
        if (categoria) {
          query = query.eq('categoria', categoria);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        result = data;
        break;
      }

      case 'movimentacoes': {
        const estoqueId = url.searchParams.get('estoque_id');
        const dataInicio = url.searchParams.get('data_inicio');
        const dataFim = url.searchParams.get('data_fim');
        const limit = parseInt(url.searchParams.get('limit') || '100');
        
        let query = supabase
          .from('estoque_movimentacoes')
          .select(`
            *,
            estoque_saldos (
              distribuidora_id,
              produto_distribuidora_id,
              localizacao,
              lote
            )
          `)
          .order('data_movimento', { ascending: false })
          .limit(limit);
        
        if (estoqueId) {
          query = query.eq('estoque_id', estoqueId);
        }
        if (dataInicio) {
          query = query.gte('data_movimento', dataInicio);
        }
        if (dataFim) {
          query = query.lte('data_movimento', dataFim);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        result = data;
        break;
      }

      case 'sync-logs': {
        const status = url.searchParams.get('status');
        const limit = parseInt(url.searchParams.get('limit') || '50');
        
        let query = supabase
          .from('estoque_sync_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);
        
        if (status) {
          query = query.eq('status', status);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        result = data;
        break;
      }

      default:
        return new Response(
          JSON.stringify({ 
            error: 'Tipo de consulta inválido',
            tipos_disponiveis: [
              'por-distribuidora',
              'por-produto-master', 
              'por-codigo',
              'consolidado',
              'distribuidoras',
              'produtos-master',
              'movimentacoes',
              'sync-logs'
            ]
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`✅ Consulta ${tipo} retornou ${Array.isArray(result) ? result.length : 1} registros`);

    return new Response(
      JSON.stringify({ data: result, tipo, timestamp: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const err = error as Error;
    console.error('❌ Erro na consulta:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
