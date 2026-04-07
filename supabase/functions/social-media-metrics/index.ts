import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const { platform, username, token, accountId, saveToHistory = false } = await req.json();

    // If accountId provided without token, fetch and decrypt server-side
    let resolvedToken = token;
    let resolvedPlatform = platform;
    let resolvedUsername = username;

    if (accountId && !token) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: account, error: accError } = await supabase
        .from('social_media_accounts')
        .select('platform, username, access_token_encrypted')
        .eq('id', accountId)
        .single();

      if (accError || !account) {
        throw new Error('Conta não encontrada');
      }

      if (!account.access_token_encrypted) {
        throw new Error('Token não configurado para esta conta');
      }

      const { data: decryptedToken, error: decryptError } = await supabase.rpc('decrypt_token', {
        p_encrypted: account.access_token_encrypted,
      });

      if (decryptError || !decryptedToken) {
        throw new Error('Erro ao decriptar token');
      }

      resolvedToken = decryptedToken;
      resolvedPlatform = account.platform;
      resolvedUsername = account.username;
    }

    if (!resolvedToken) {
      throw new Error('Token não fornecido');
    }

    console.log(`Fetching metrics for ${resolvedPlatform} - ${resolvedUsername}`);

    let metrics;

    switch (resolvedPlatform) {
      case 'instagram':
        metrics = await fetchInstagramMetrics(resolvedUsername, resolvedToken);
        break;
      case 'facebook':
        metrics = await fetchFacebookMetrics(resolvedUsername, resolvedToken);
        break;
      case 'twitter':
        metrics = await fetchTwitterMetrics(resolvedUsername, resolvedToken);
        break;
      case 'youtube':
        metrics = await fetchYouTubeMetrics(resolvedUsername, resolvedToken);
        break;
      case 'linkedin':
        metrics = await fetchLinkedInMetrics(resolvedUsername, resolvedToken);
        break;
      case 'tiktok':
        metrics = await fetchTikTokMetrics(resolvedUsername, resolvedToken);
        break;
      default:
        throw new Error('Plataforma não suportada');
    }

    // Salvar no histórico se solicitado
    if (saveToHistory) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.from('social_media_metrics_history').insert({
        account_id: accountId || null,
        platform,
        username,
        followers: metrics.followers,
        posts: metrics.posts,
        engagement: metrics.engagement,
        reach: metrics.reach,
        likes: metrics.likes || 0,
        comments: metrics.comments || 0,
        shares: metrics.shares || 0,
      });
    }

    return new Response(JSON.stringify(metrics), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error fetching social media metrics:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro ao buscar métricas' }),
      { 
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      }
    );
  }
});

/**
 * Helper: read Meta API error body and throw with detailed message
 */
async function handleMetaApiError(response: Response, platformLabel: string): Promise<never> {
  const errorBody = await response.json().catch(() => ({}));
  const metaError = errorBody?.error;
  console.error(`${platformLabel} API error (HTTP ${response.status}):`, JSON.stringify(errorBody));

  const code = metaError?.code;
  const subcode = metaError?.error_subcode;
  let hint = '';

  if (code === 190) {
    hint = subcode === 463 ? 'Token expirado. Gere um novo token.' :
           subcode === 467 ? 'Token invalidado. O usuário pode ter alterado a senha.' :
           'Token inválido ou expirado.';
  } else if (code === 100) {
    hint = 'Permissões insuficientes ou endpoint incorreto.';
  } else if (code === 10) {
    hint = 'Permissão necessária não concedida ao App.';
  } else if (code === 4) {
    hint = 'Limite de chamadas da API atingido. Tente novamente em alguns minutos.';
  }

  const detail = metaError?.message || response.statusText;
  throw new Error(
    `${platformLabel}: ${detail} (code: ${code || response.status}${subcode ? `, subcode: ${subcode}` : ''})${hint ? ` — ${hint}` : ''}`
  );
}

async function fetchInstagramMetrics(username: string, token: string) {
  // Try Instagram Graph API first
  const response = await fetch(
    `https://graph.instagram.com/me?fields=username,account_type,media_count,followers_count&access_token=${token}`
  );

  if (!response.ok) {
    // Check if this might be a Facebook Page Token — try fallback
    console.log('Instagram direct endpoint failed, trying Facebook Pages fallback...');
    
    const fbPagesResponse = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,instagram_business_account{id,username,followers_count,media_count}&access_token=${token}`
    );

    if (!fbPagesResponse.ok) {
      // Both failed — show original Instagram error
      const errorBody = await response.json().catch(() => ({}));
      const fbErrorBody = await fbPagesResponse.json().catch(() => ({}));
      console.error('Instagram API error:', JSON.stringify(errorBody));
      console.error('Facebook Pages fallback error:', JSON.stringify(fbErrorBody));
      
      const metaError = errorBody?.error;
      const code = metaError?.code;
      const subcode = metaError?.error_subcode;
      let hint = '';
      if (code === 190) {
        hint = 'Token inválido ou expirado.';
      } else if (code === 100) {
        hint = 'Este token pode não ter as permissões instagram_basic ou pages_show_list.';
      }
      
      throw new Error(
        `Instagram API: ${metaError?.message || response.statusText} (code: ${code || response.status}${subcode ? `, subcode: ${subcode}` : ''})${hint ? ` — ${hint}` : ''}`
      );
    }

    const fbPagesData = await fbPagesResponse.json();
    console.log('Facebook Pages response:', JSON.stringify(fbPagesData));

    // Find a page with Instagram Business Account linked
    const pageWithIg = fbPagesData.data?.find((p: any) => p.instagram_business_account);

    if (!pageWithIg || !pageWithIg.instagram_business_account) {
      throw new Error(
        'Token é de Página do Facebook, mas nenhuma conta Instagram Business foi encontrada vinculada. Vincule uma conta Instagram Business à sua Página no Facebook.'
      );
    }

    const igAccount = pageWithIg.instagram_business_account;
    console.log(`Found Instagram Business Account via Facebook Page: ${igAccount.username} (${igAccount.id})`);

    // Fetch media engagement via IG Business Account ID
    const mediaResponse = await fetch(
      `https://graph.facebook.com/v19.0/${igAccount.id}/media?fields=like_count,comments_count,media_type&limit=10&access_token=${token}`
    );
    const mediaData = mediaResponse.ok ? await mediaResponse.json() : { data: [] };
    
    const totalLikes = mediaData.data?.reduce((sum: number, post: any) => sum + (post.like_count || 0), 0) || 0;
    const totalComments = mediaData.data?.reduce((sum: number, post: any) => sum + (post.comments_count || 0), 0) || 0;
    const totalEngagement = totalLikes + totalComments;
    const followers = igAccount.followers_count || 0;
    const avgEngagement = mediaData.data?.length && followers ?
      (totalEngagement / (followers * mediaData.data.length)) * 100 : 0;

    return {
      followers,
      posts: igAccount.media_count || 0,
      engagement: avgEngagement,
      reach: followers * 0.15 || 0,
      likes: totalLikes,
      comments: totalComments,
      shares: 0,
    };
  }

  const data = await response.json();

  // Buscar métricas de engajamento dos últimos posts
  const mediaResponse = await fetch(
    `https://graph.instagram.com/me/media?fields=like_count,comments_count,media_type&limit=10&access_token=${token}`
  );

  const mediaData = await mediaResponse.json();
  const totalLikes = mediaData.data?.reduce((sum: number, post: any) => 
    sum + (post.like_count || 0), 0) || 0;
  const totalComments = mediaData.data?.reduce((sum: number, post: any) => 
    sum + (post.comments_count || 0), 0) || 0;
  const totalEngagement = totalLikes + totalComments;
  
  const avgEngagement = mediaData.data?.length ? 
    (totalEngagement / (data.followers_count * mediaData.data.length)) * 100 : 0;

  return {
    followers: data.followers_count || 0,
    posts: data.media_count || 0,
    engagement: avgEngagement,
    reach: data.followers_count * 0.15 || 0,
    likes: totalLikes,
    comments: totalComments,
    shares: 0,
  };
}

async function fetchFacebookMetrics(username: string, token: string) {
  const response = await fetch(
    `https://graph.facebook.com/me?fields=name,fan_count,engagement&access_token=${token}`
  );

  if (!response.ok) {
    await handleMetaApiError(response, 'Facebook');
  }

  const data = await response.json();

  return {
    followers: data.fan_count || 0,
    posts: 0,
    engagement: data.engagement?.count ? (data.engagement.count / data.fan_count) * 100 : 0,
    reach: data.fan_count * 0.2 || 0,
    likes: 0,
    comments: 0,
    shares: 0,
  };
}

async function fetchTwitterMetrics(username: string, token: string) {
  const response = await fetch(
    `https://api.twitter.com/2/users/by/username/${username}?user.fields=public_metrics`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    console.error('Twitter API error:', JSON.stringify(errorBody));
    throw new Error(`Twitter API: ${errorBody?.detail || errorBody?.title || response.statusText} (status: ${response.status})`);
  }

  const data = await response.json();
  const metrics = data.data?.public_metrics;

  return {
    followers: metrics?.followers_count || 0,
    posts: metrics?.tweet_count || 0,
    engagement: metrics?.followers_count ? 
      ((metrics.listed_count / metrics.followers_count) * 100) : 0,
    reach: metrics?.followers_count * 0.1 || 0,
    likes: 0,
    comments: 0,
    shares: 0,
  };
}

async function fetchYouTubeMetrics(channelId: string, token: string) {
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelId}&key=${token}`
  );

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    console.error('YouTube API error:', JSON.stringify(errorBody));
    throw new Error(`YouTube API: ${errorBody?.error?.message || response.statusText} (status: ${response.status})`);
  }

  const data = await response.json();
  const stats = data.items?.[0]?.statistics;

  return {
    followers: parseInt(stats?.subscriberCount || '0'),
    posts: parseInt(stats?.videoCount || '0'),
    engagement: stats?.viewCount && stats?.subscriberCount ? 
      ((parseInt(stats.viewCount) / parseInt(stats.subscriberCount)) / parseInt(stats.videoCount || '1')) : 0,
    reach: parseInt(stats?.viewCount || '0'),
    likes: 0,
    comments: 0,
    shares: 0,
  };
}

async function fetchLinkedInMetrics(companyId: string, token: string) {
  const response = await fetch(
    `https://api.linkedin.com/v2/organizations/${companyId}?projection=(firstDegreeSize,followersCount)`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'LinkedIn-Version': '202401',
      }
    }
  );

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    console.error('LinkedIn API error:', JSON.stringify(errorBody));
    throw new Error(`LinkedIn API: ${errorBody?.message || response.statusText} (status: ${response.status})`);
  }

  const data = await response.json();

  return {
    followers: data.followersCount || 0,
    posts: 0,
    engagement: 0,
    reach: data.followersCount * 0.25 || 0,
    likes: 0,
    comments: 0,
    shares: 0,
  };
}

async function fetchTikTokMetrics(username: string, token: string) {
  const response = await fetch(
    `https://open-api.tiktok.com/user/info/?access_token=${token}`,
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    console.error('TikTok API error:', JSON.stringify(errorBody));
    throw new Error(`TikTok API: ${errorBody?.message || response.statusText} (status: ${response.status})`);
  }

  const data = await response.json();
  const user = data.data?.user;

  return {
    followers: user?.follower_count || 0,
    posts: user?.video_count || 0,
    engagement: user?.follower_count && user?.total_favorited ? 
      ((user.total_favorited / (user.follower_count * user.video_count)) * 100) : 0,
    reach: user?.follower_count * 0.3 || 0,
    likes: user?.total_favorited || 0,
    comments: 0,
    shares: 0,
  };
}
