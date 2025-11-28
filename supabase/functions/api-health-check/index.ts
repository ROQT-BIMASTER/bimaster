import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApiRoute {
  path: string;
  method: string;
  description: string;
  requiresAuth: boolean;
}

const EXPECTED_APIS: ApiRoute[] = [
  { path: '/api/products', method: 'GET', description: 'Listar produtos', requiresAuth: true },
  { path: '/api/categories', method: 'GET', description: 'Listar categorias', requiresAuth: true },
  { path: '/api/price-tables', method: 'GET', description: 'Listar tabelas de preço', requiresAuth: true },
  { path: '/api/price-tables/:id', method: 'GET', description: 'Obter tabela específica', requiresAuth: true },
  { path: '/api/price-tables/:id/rows', method: 'GET', description: 'Obter preços da tabela', requiresAuth: true },
  { path: '/api/price-tables/:id/import', method: 'POST', description: 'Importar CSV de preços', requiresAuth: true },
  { path: '/api/price-tables/:id/export/csv', method: 'GET', description: 'Exportar CSV', requiresAuth: true },
  { path: '/api/price-tables/:id/export/pdf', method: 'GET', description: 'Exportar PDF', requiresAuth: true },
  { path: '/api/clients', method: 'GET', description: 'Listar clientes', requiresAuth: true },
  { path: '/api/client-price-tables', method: 'GET', description: 'Vincular tabelas a clientes', requiresAuth: true },
  { path: '/api/client/:clientToken/table', method: 'GET', description: 'Portal do cliente', requiresAuth: false },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Autenticação necessária');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Usuário não autenticado');
    }

    // Verificar se é admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!userRole || userRole.role !== 'admin') {
      throw new Error('Acesso negado - apenas administradores');
    }

    const results = {
      ok: [] as string[],
      missing: [] as string[],
      inactive: [] as string[],
      timestamp: new Date().toISOString(),
    };

    // Verificar cada API esperada
    for (const api of EXPECTED_APIS) {
      // Para esta primeira versão, vamos marcar como OK as APIs que existem nas edge functions
      // e missing as que ainda não foram implementadas
      
      // APIs implementadas (baseadas nas edge functions existentes)
      const implementedApis = [
        '/api/admin/api-health-check',
        '/api/price-tables/:id/approve',
        '/api/price-tables/:id/reject',
      ];

      if (implementedApis.some(impl => impl === api.path)) {
        results.ok.push(api.path);
      } else {
        // Verificar se existem tabelas correspondentes no banco
        if (api.path.includes('products')) {
          const { count } = await supabase
            .from('fabrica_materias_primas')
            .select('*', { count: 'exact', head: true });
          
          if (count !== null && count >= 0) {
            results.ok.push(api.path + ' (via database)');
          } else {
            results.missing.push(api.path);
          }
        } else if (api.path.includes('price-tables')) {
          const { count } = await supabase
            .from('fabrica_tabelas_preco')
            .select('*', { count: 'exact', head: true });
          
          if (count !== null && count >= 0) {
            results.ok.push(api.path + ' (via database)');
          } else {
            results.missing.push(api.path);
          }
        } else {
          results.missing.push(api.path);
        }
      }
    }

    console.log('API Health Check:', results);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro no health check:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
