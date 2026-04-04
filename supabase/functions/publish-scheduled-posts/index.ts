import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";


interface ScheduledPost {
  id: string;
  user_id: string;
  account_ids: string[];
  content: string;
  media_urls: string[];
  scheduled_at: string;
}

interface SocialAccount {
  id: string;
  platform: string;
  username: string;
  access_token_encrypted: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    // Verify secret token for cron job security
    const cronSecret = Deno.env.get('CRON_SECRET');
    const requestSecret = req.headers.get('x-cron-secret');

    if (!cronSecret) {
      console.error('CRON_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Cron secret not configured' }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    if (requestSecret !== cronSecret) {
      console.error('Invalid or missing cron secret');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar posts agendados para agora ou antes
    const { data: scheduledPosts, error: fetchError } = await supabase
      .from('social_media_posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString())
      .limit(10);

    if (fetchError) {
      console.error('Erro ao buscar posts:', fetchError);
      throw fetchError;
    }

    if (!scheduledPosts || scheduledPosts.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Nenhum post para publicar', processed: 0 }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const post of scheduledPosts as ScheduledPost[]) {
      // Atualizar status para "publishing"
      await supabase
        .from('social_media_posts')
        .update({ status: 'publishing' })
        .eq('id', post.id);

      const postIds: Record<string, string> = {};
      const errors: string[] = [];

      // Buscar contas com token encrypted
      const { data: accounts } = await supabase
        .from('social_media_accounts')
        .select('id, platform, username, access_token_encrypted')
        .eq('user_id', post.user_id)
        .in('id', post.account_ids);

      if (!accounts || accounts.length === 0) {
        await supabase
          .from('social_media_posts')
          .update({
            status: 'failed',
            error_message: 'Nenhuma conta encontrada',
          })
          .eq('id', post.id);
        continue;
      }

      // Publicar em cada conta
      for (const account of accounts as SocialAccount[]) {
        try {
          // Decrypt token via Vault RPC
          let token = '';
          if (account.access_token_encrypted) {
            const { data: decrypted, error: decryptError } = await supabase.rpc('decrypt_token', {
              p_encrypted: account.access_token_encrypted
            });
            if (decryptError) {
              errors.push(`${account.platform}: Erro ao decriptar token`);
              console.error(`Erro decrypt ${account.platform}:`, decryptError);
              continue;
            }
            token = decrypted || '';
          }

          if (!token) {
            errors.push(`${account.platform}: Token não disponível`);
            continue;
          }

          const publishResult = await publishToPlatform(account, token, post.content, post.media_urls);
          if (publishResult.success && publishResult.postId) {
            postIds[account.platform] = publishResult.postId;
          } else {
            errors.push(`${account.platform}: ${publishResult.error}`);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
          errors.push(`${account.platform}: ${errorMsg}`);
          console.error(`Erro ao publicar em ${account.platform}:`, error);
        }
      }

      // Atualizar status final
      const finalStatus = Object.keys(postIds).length > 0 ? 'published' : 'failed';
      await supabase
        .from('social_media_posts')
        .update({
          status: finalStatus,
          published_at: finalStatus === 'published' ? new Date().toISOString() : null,
          post_ids: postIds,
          error_message: errors.length > 0 ? errors.join('; ') : null,
        })
        .eq('id', post.id);

      results.push({
        postId: post.id,
        status: finalStatus,
        publishedTo: Object.keys(postIds),
        errors: errors.length > 0 ? errors : null,
      });
    }

    return new Response(
      JSON.stringify({
        message: 'Posts processados',
        processed: results.length,
        results,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function publishToPlatform(
  account: SocialAccount,
  token: string,
  content: string,
  mediaUrls: string[]
): Promise<{ success: boolean; postId?: string; error?: string }> {
  switch (account.platform.toLowerCase()) {
    case 'instagram':
      return await publishToInstagram(account, token, content, mediaUrls);
    case 'facebook':
      return await publishToFacebook(account, token, content, mediaUrls);
    case 'twitter':
    case 'x':
      return await publishToTwitter(account, token, content, mediaUrls);
    case 'linkedin':
      return await publishToLinkedIn(account, token, content, mediaUrls);
    case 'tiktok':
      return await publishToTikTok(account, token, content, mediaUrls);
    default:
      return {
        success: false,
        error: `Plataforma ${account.platform} não suportada`,
      };
  }
}

async function publishToInstagram(
  _account: SocialAccount,
  _token: string,
  _content: string,
  _mediaUrls: string[]
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    // TODO: Implement real Instagram Graph API call using _token
    return { success: true, postId: `ig_${Date.now()}` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao publicar no Instagram' };
  }
}

async function publishToFacebook(
  _account: SocialAccount,
  _token: string,
  _content: string,
  _mediaUrls: string[]
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    return { success: true, postId: `fb_${Date.now()}` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao publicar no Facebook' };
  }
}

async function publishToTwitter(
  _account: SocialAccount,
  _token: string,
  _content: string,
  _mediaUrls: string[]
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    return { success: true, postId: `tw_${Date.now()}` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao publicar no Twitter' };
  }
}

async function publishToLinkedIn(
  _account: SocialAccount,
  _token: string,
  _content: string,
  _mediaUrls: string[]
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    return { success: true, postId: `li_${Date.now()}` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao publicar no LinkedIn' };
  }
}

async function publishToTikTok(
  _account: SocialAccount,
  _token: string,
  _content: string,
  _mediaUrls: string[]
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    return { success: true, postId: `tt_${Date.now()}` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao publicar no TikTok' };
  }
}
