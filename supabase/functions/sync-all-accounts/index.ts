import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar todas as contas ativas
    const { data: accounts, error: fetchError } = await supabase
      .from('social_media_accounts')
      .select('*')
      .eq('status', 'active');

    if (fetchError) throw fetchError;

    const results = {
      total: accounts?.length || 0,
      synced: 0,
      errors: 0,
      details: [] as any[],
    };

    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Nenhuma conta ativa encontrada', results }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Sincronizar cada conta
    for (const account of accounts) {
      try {
        // Atualizar status para syncing
        await supabase
          .from('social_media_accounts')
          .update({ status: 'syncing' })
          .eq('id', account.id);

        // Invocar função de métricas
        const { data: metrics, error: metricsError } = await supabase.functions.invoke(
          'social-media-metrics',
          {
            body: {
              platform: account.platform,
              username: account.username,
              token: account.access_token,
              accountId: account.id,
              saveToHistory: true,
            },
          }
        );

        if (metricsError) throw metricsError;

        // Atualizar status para active
        await supabase
          .from('social_media_accounts')
          .update({
            status: 'active',
            last_sync_at: new Date().toISOString(),
            error_message: null,
          })
          .eq('id', account.id);

        results.synced++;
        results.details.push({
          account: account.account_name || account.username,
          platform: account.platform,
          status: 'success',
          metrics,
        });

        console.log(`✓ Sincronizado: ${account.platform} - ${account.username}`);
      } catch (error: any) {
        // Atualizar status para error
        await supabase
          .from('social_media_accounts')
          .update({
            status: 'error',
            error_message: error.message,
          })
          .eq('id', account.id);

        results.errors++;
        results.details.push({
          account: account.account_name || account.username,
          platform: account.platform,
          status: 'error',
          error: error.message,
        });

        console.error(`✗ Erro ao sincronizar ${account.platform} - ${account.username}:`, error.message);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Sincronização concluída: ${results.synced} sucesso, ${results.errors} erro(s)`,
        results,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in sync-all-accounts:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro ao sincronizar contas' }),
      { 
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      }
    );
  }
});
