import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    // Verify secret token for cron job security
    const cronSecret = Deno.env.get('CRON_SECRET');
    const requestSecret = req.headers.get('x-cron-secret');

    if (!cronSecret) {
      console.error('❌ CRON_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Cron secret not configured' }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    if (requestSecret !== cronSecret) {
      console.error('❌ Invalid cron secret');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Cron authentication verified');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Iniciando coleta automática de métricas...');

    // Buscar todas as contas configuradas
    const { data: accounts, error: accountsError } = await supabase
      .from('social_media_accounts')
      .select('platform, username, access_token_encrypted');

    if (accountsError) throw accountsError;

    if (!accounts || accounts.length === 0) {
      console.log('Nenhuma conta configurada');
      return new Response(
        JSON.stringify({ message: 'Nenhuma conta configurada' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    let successCount = 0;
    let errorCount = 0;

    // Coletar métricas de cada conta
    for (const account of accounts) {
      try {
        console.log(`Coletando métricas: ${account.platform} - ${account.username}`);
        
        const { data: metrics, error: metricsError } = await supabase.functions.invoke(
          'social-media-metrics',
          {
            body: {
              platform: account.platform,
              username: account.username,
              token: account.access_token,
              saveToHistory: true,
            },
          }
        );

        if (metricsError) {
          console.error(`Erro ao coletar ${account.platform}:`, metricsError);
          errorCount++;
        } else {
          console.log(`✅ Métricas coletadas: ${account.platform} - ${account.username}`);
          successCount++;
        }
      } catch (error) {
        console.error(`Erro ao processar ${account.platform}:`, error);
        errorCount++;
      }
    }

    const message = `Coleta concluída: ${successCount} sucessos, ${errorCount} erros`;
    console.log(message);

    return new Response(
      JSON.stringify({ 
        message,
        successCount,
        errorCount,
        totalAccounts: accounts.length,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Erro no cron job:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro ao executar cron job' }),
      { 
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      }
    );
  }
});
