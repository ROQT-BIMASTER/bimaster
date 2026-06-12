import { logger } from "../_shared/logger.ts";
import { secureHandler } from "../_shared/secure-handler.ts";
import { requireAdminJwt } from "../_shared/admin-jwt.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";


Deno.serve(secureHandler({ auth: "any", rateLimit: 30, rateLimitPrefix: "export-prospects" }, async (req, _ctx) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth: require admin JWT (n8n key path retired)
    const adminAuth = await requireAdminJwt(req);
    if (!adminAuth.ok) {
      logger.error(`Auth failed: ${adminAuth.error}`);
      throw new Error(adminAuth.error ?? 'Unauthorized');
    }

    logger.log('📊 Iniciando exportação de prospects...');

    // Buscar prospects com dados completos
    const { data: prospects, error: prospectsError } = await supabase
      .from('prospects')
      .select(`
        id,
        nome_empresa,
        nome_fantasia,
        cnpj,
        contato_principal,
        email,
        telefone,
        endereco,
        tipo_logradouro,
        logradouro,
        numero,
        bairro,
        municipio,
        uf,
        cep,
        status,
        categoria,
        observacoes,
        ultimo_contato,
        proxima_acao,
        vendedor_id,
        municipio_id,
        zona,
        porte_empresa,
        segmento,
        total_funcionarios,
        faixa_faturamento,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false });

    if (prospectsError) {
      logger.error('❌ Erro ao buscar prospects:', prospectsError);
      throw prospectsError;
    }

    // Buscar vendedores
    const vendedorIds = prospects
      ?.map(p => p.vendedor_id)
      .filter((id): id is string => id !== null) || [];

    const { data: vendedores } = await supabase
      .from('profiles')
      .select('id, nome, email')
      .in('id', vendedorIds);

    const vendedoresMap = new Map(vendedores?.map(v => [v.id, v]) || []);

    // Buscar atividades por prospect
    const { data: atividades } = await supabase
      .from('atividades')
      .select('prospect_id, tipo, status, created_at')
      .in('prospect_id', prospects?.map(p => p.id) || []);

    // Agrupar atividades por prospect
    const atividadesPorProspect = new Map<string, any[]>();
    atividades?.forEach(ativ => {
      const list = atividadesPorProspect.get(ativ.prospect_id) || [];
      list.push(ativ);
      atividadesPorProspect.set(ativ.prospect_id, list);
    });

    // Enriquecer dados dos prospects
    const prospectsEnriquecidos = prospects?.map(prospect => {
      const vendedor = prospect.vendedor_id ? vendedoresMap.get(prospect.vendedor_id) : null;
      const atividadesProspect = atividadesPorProspect.get(prospect.id) || [];
      
      return {
        ...prospect,
        vendedor: vendedor ? {
          id: vendedor.id,
          nome: vendedor.nome,
          email: vendedor.email
        } : null,
        total_atividades: atividadesProspect.length,
        atividades_pendentes: atividadesProspect.filter(a => a.status === 'pendente').length,
        atividades_concluidas: atividadesProspect.filter(a => a.status === 'concluido').length,
      };
    });

    logger.log(`✅ ${prospectsEnriquecidos?.length || 0} prospects exportados com sucesso`);

    return new Response(
      JSON.stringify({
        success: true,
        total: prospectsEnriquecidos?.length || 0,
        data: prospectsEnriquecidos,
        exported_at: new Date().toISOString(),
      }),
      { 
        headers: { 
          ...getCorsHeaders(req), 
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    logger.error('❌ Erro na exportação:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido na exportação' 
      }),
      { 
        headers: { 
          ...getCorsHeaders(req), 
          'Content-Type': 'application/json' 
        }, 
        status: error instanceof Error && error.message === 'Invalid API key' ? 401 : 500
      }
    );
  }
}));