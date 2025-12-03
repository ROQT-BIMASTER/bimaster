import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

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
  access_token: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify secret token for cron job security
    const cronSecret = Deno.env.get('CRON_SECRET');
    const requestSecret = req.headers.get('x-cron-secret');

    if (!cronSecret) {
      console.error('❌ CRON_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Cron secret not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (requestSecret !== cronSecret) {
      console.error('❌ Invalid or missing cron secret');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Cron authentication verified');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 Buscando posts agendados para publicar...');

    // Buscar posts agendados para agora ou antes
    const { data: scheduledPosts, error: fetchError } = await supabase
      .from('social_media_posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString())
      .limit(10); // Processar até 10 posts por vez

    if (fetchError) {
      console.error('❌ Erro ao buscar posts:', fetchError);
      throw fetchError;
    }

    if (!scheduledPosts || scheduledPosts.length === 0) {
      console.log('✅ Nenhum post para publicar');
      return new Response(
        JSON.stringify({ message: 'Nenhum post para publicar', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📝 ${scheduledPosts.length} posts encontrados para publicar`);

    const results = [];

    for (const post of scheduledPosts as ScheduledPost[]) {
      console.log(`📤 Publicando post ${post.id}...`);

      // Atualizar status para "publishing"
      await supabase
        .from('social_media_posts')
        .update({ status: 'publishing' })
        .eq('id', post.id);

      const postIds: Record<string, string> = {};
      const errors: string[] = [];

      // Buscar contas de redes sociais
      const { data: accounts } = await supabase
        .from('social_media_accounts')
        .select('*')
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
          const publishResult = await publishToPlatform(account, post.content, post.media_urls);
          if (publishResult.success && publishResult.postId) {
            postIds[account.platform] = publishResult.postId;
            console.log(`✅ Publicado em ${account.platform}: ${publishResult.postId}`);
          } else {
            errors.push(`${account.platform}: ${publishResult.error}`);
            console.error(`❌ Erro em ${account.platform}:`, publishResult.error);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
          errors.push(`${account.platform}: ${errorMsg}`);
          console.error(`❌ Erro ao publicar em ${account.platform}:`, error);
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

    console.log('✅ Processamento concluído');

    return new Response(
      JSON.stringify({
        message: 'Posts processados',
        processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function publishToPlatform(
  account: SocialAccount,
  content: string,
  mediaUrls: string[]
): Promise<{ success: boolean; postId?: string; error?: string }> {
  console.log(`Tentando publicar em ${account.platform} (${account.username})`);

  switch (account.platform.toLowerCase()) {
    case 'instagram':
      return await publishToInstagram(account, content, mediaUrls);
    case 'facebook':
      return await publishToFacebook(account, content, mediaUrls);
    case 'twitter':
    case 'x':
      return await publishToTwitter(account, content, mediaUrls);
    case 'linkedin':
      return await publishToLinkedIn(account, content, mediaUrls);
    case 'tiktok':
      return await publishToTikTok(account, content, mediaUrls);
    default:
      return {
        success: false,
        error: `Plataforma ${account.platform} não suportada`,
      };
  }
}

async function publishToInstagram(
  account: SocialAccount,
  content: string,
  mediaUrls: string[]
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    console.log('📸 Instagram: Publicação simulada');
    return {
      success: true,
      postId: `ig_${Date.now()}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao publicar no Instagram',
    };
  }
}

async function publishToFacebook(
  account: SocialAccount,
  content: string,
  mediaUrls: string[]
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    console.log('📘 Facebook: Publicação simulada');
    return {
      success: true,
      postId: `fb_${Date.now()}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao publicar no Facebook',
    };
  }
}

async function publishToTwitter(
  account: SocialAccount,
  content: string,
  mediaUrls: string[]
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    console.log('🐦 Twitter/X: Publicação simulada');
    return {
      success: true,
      postId: `tw_${Date.now()}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao publicar no Twitter',
    };
  }
}

async function publishToLinkedIn(
  account: SocialAccount,
  content: string,
  mediaUrls: string[]
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    console.log('💼 LinkedIn: Publicação simulada');
    return {
      success: true,
      postId: `li_${Date.now()}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao publicar no LinkedIn',
    };
  }
}

async function publishToTikTok(
  account: SocialAccount,
  content: string,
  mediaUrls: string[]
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    console.log('🎵 TikTok: Publicação simulada');
    return {
      success: true,
      postId: `tt_${Date.now()}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao publicar no TikTok',
    };
  }
}