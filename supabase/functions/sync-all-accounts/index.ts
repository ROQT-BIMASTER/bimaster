import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { secureHandler } from "../_shared/secure-handler.ts";

Deno.serve(secureHandler({
  auth: "none",
  rateLimit: 10,
  rateLimitPrefix: "sync-all-accounts",
}, async (req, _ctx) => {

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar todas as contas ativas (com token encrypted)
    const { data: accounts, error: fetchError } = await supabase
      .from('social_media_accounts')
      .select('id, platform, username, account_name, status, access_token_encrypted')
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

        // Decriptar token via Vault RPC
        let token: string | null = null;
        if (account.access_token_encrypted) {
          const { data: decrypted, error: decryptError } = await supabase.rpc(
            'decrypt_token',
            { p_encrypted: account.access_token_encrypted }
          );
          if (decryptError) {
            console.error(`Erro ao decriptar token para ${account.username}:`, decryptError.message);
          } else {
            token = decrypted;
          }
        }

        // Invocar função de métricas
        const { data: metrics, error: metricsError } = await supabase.functions.invoke(
          'social-media-metrics',
          {
            body: {
              platform: account.platform,
              username: account.username,
              token,
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
}));
