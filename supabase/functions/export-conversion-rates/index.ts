import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate API key for n8n integration
    const apiKey = req.headers.get('X-API-Key');
    const expectedKey = Deno.env.get('N8N_API_KEY');
    
    if (!apiKey || apiKey !== expectedKey) {
      console.error('❌ Invalid API key');
      throw new Error('Invalid API key');
    }

    console.log('📈 Calculando taxas de conversão...');

    // Buscar todos os prospects
    const { data: prospects, error: prospectsError } = await supabase
      .from('prospects')
      .select('id, status, vendedor_id, created_at');

    if (prospectsError) {
      console.error('❌ Erro ao buscar prospects:', prospectsError);
      throw prospectsError;
    }

    const totalProspects = prospects?.length || 0;
    
    // Calcular métricas gerais
    const prospectsGanhos = prospects?.filter(p => p.status === 'ganho').length || 0;
    const prospectsPerdidos = prospects?.filter(p => p.status === 'perdido').length || 0;
    const prospectsAtivos = prospects?.filter(p => 
      !['ganho', 'perdido'].includes(p.status)
    ).length || 0;

    const taxaConversaoGeral = totalProspects > 0 
      ? ((prospectsGanhos / totalProspects) * 100).toFixed(2)
      : '0.00';

    const taxaPerdaGeral = totalProspects > 0
      ? ((prospectsPerdidos / totalProspects) * 100).toFixed(2)
      : '0.00';

    // Calcular por vendedor
    const vendedorIds = [...new Set(prospects?.map(p => p.vendedor_id).filter(Boolean))];
    
    const { data: vendedores } = await supabase
      .from('profiles')
      .select('id, nome, email')
      .in('id', vendedorIds);

    const taxasPorVendedor = vendedorIds.map(vendedorId => {
      const prospectsVendedor = prospects?.filter(p => p.vendedor_id === vendedorId) || [];
      const totalVendedor = prospectsVendedor.length;
      const ganhosVendedor = prospectsVendedor.filter(p => p.status === 'ganho').length;
      const perdidosVendedor = prospectsVendedor.filter(p => p.status === 'perdido').length;
      const ativosVendedor = prospectsVendedor.filter(p => 
        !['ganho', 'perdido'].includes(p.status)
      ).length;

      const vendedor = vendedores?.find(v => v.id === vendedorId);

      return {
        vendedor_id: vendedorId,
        vendedor_nome: vendedor?.nome || 'Não identificado',
        vendedor_email: vendedor?.email,
        total_prospects: totalVendedor,
        prospects_ganhos: ganhosVendedor,
        prospects_perdidos: perdidosVendedor,
        prospects_ativos: ativosVendedor,
        taxa_conversao: totalVendedor > 0 
          ? ((ganhosVendedor / totalVendedor) * 100).toFixed(2)
          : '0.00',
        taxa_perda: totalVendedor > 0
          ? ((perdidosVendedor / totalVendedor) * 100).toFixed(2)
          : '0.00',
      };
    });

    // Calcular por status
    const statusDistribution = {
      novo: prospects?.filter(p => p.status === 'novo').length || 0,
      em_contato: prospects?.filter(p => p.status === 'em_contato').length || 0,
      proposta_enviada: prospects?.filter(p => p.status === 'proposta_enviada').length || 0,
      negociacao: prospects?.filter(p => p.status === 'negociacao').length || 0,
      ganho: prospectsGanhos,
      perdido: prospectsPerdidos,
    };

    // Calcular funil de conversão
    const funnelConversion = {
      novo_para_contato: statusDistribution.novo > 0
        ? (((statusDistribution.em_contato + statusDistribution.proposta_enviada + 
             statusDistribution.negociacao + statusDistribution.ganho) / 
            (statusDistribution.novo + statusDistribution.em_contato + 
             statusDistribution.proposta_enviada + statusDistribution.negociacao + 
             statusDistribution.ganho)) * 100).toFixed(2)
        : '0.00',
      contato_para_proposta: (statusDistribution.em_contato + statusDistribution.proposta_enviada + 
                               statusDistribution.negociacao + statusDistribution.ganho) > 0
        ? (((statusDistribution.proposta_enviada + statusDistribution.negociacao + 
             statusDistribution.ganho) / 
            (statusDistribution.em_contato + statusDistribution.proposta_enviada + 
             statusDistribution.negociacao + statusDistribution.ganho)) * 100).toFixed(2)
        : '0.00',
      proposta_para_negociacao: (statusDistribution.proposta_enviada + 
                                  statusDistribution.negociacao + statusDistribution.ganho) > 0
        ? (((statusDistribution.negociacao + statusDistribution.ganho) / 
            (statusDistribution.proposta_enviada + statusDistribution.negociacao + 
             statusDistribution.ganho)) * 100).toFixed(2)
        : '0.00',
      negociacao_para_ganho: (statusDistribution.negociacao + statusDistribution.ganho) > 0
        ? ((statusDistribution.ganho / 
            (statusDistribution.negociacao + statusDistribution.ganho)) * 100).toFixed(2)
        : '0.00',
    };

    console.log(`✅ Taxas calculadas com sucesso`);

    return new Response(
      JSON.stringify({
        success: true,
        metricas_gerais: {
          total_prospects: totalProspects,
          prospects_ganhos: prospectsGanhos,
          prospects_perdidos: prospectsPerdidos,
          prospects_ativos: prospectsAtivos,
          taxa_conversao_geral: taxaConversaoGeral,
          taxa_perda_geral: taxaPerdaGeral,
        },
        distribuicao_por_status: statusDistribution,
        funil_conversao: funnelConversion,
        taxas_por_vendedor: taxasPorVendedor,
        exported_at: new Date().toISOString(),
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    console.error('❌ Erro no cálculo:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido no cálculo' 
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
