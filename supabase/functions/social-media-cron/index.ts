import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Iniciando coleta automática de métricas...');

    // Buscar todas as contas configuradas
    const { data: accounts, error: accountsError } = await supabase
      .from('social_media_accounts')
      .select('platform, username, access_token');

    if (accountsError) throw accountsError;

    if (!accounts || accounts.length === 0) {
      console.log('Nenhuma conta configurada');
      return new Response(
        JSON.stringify({ message: 'Nenhuma conta configurada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Erro no cron job:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro ao executar cron job' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
