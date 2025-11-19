import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { platform, username, token, accountId, saveToHistory = false } = await req.json();

    console.log(`Fetching metrics for ${platform} - ${username}`);

    let metrics;

    switch (platform) {
      case 'instagram':
        metrics = await fetchInstagramMetrics(username, token);
        break;
      case 'facebook':
        metrics = await fetchFacebookMetrics(username, token);
        break;
      case 'twitter':
        metrics = await fetchTwitterMetrics(username, token);
        break;
      case 'youtube':
        metrics = await fetchYouTubeMetrics(username, token);
        break;
      case 'linkedin':
        metrics = await fetchLinkedInMetrics(username, token);
        break;
      case 'tiktok':
        metrics = await fetchTikTokMetrics(username, token);
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error fetching social media metrics:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro ao buscar métricas' }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function fetchInstagramMetrics(username: string, token: string) {
  // Instagram Graph API
  const response = await fetch(
    `https://graph.instagram.com/me?fields=username,account_type,media_count,followers_count&access_token=${token}`
  );

  if (!response.ok) {
    throw new Error('Erro ao buscar métricas do Instagram. Verifique seu token de acesso.');
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
    reach: data.followers_count * 0.15 || 0, // Estimativa de 15% de alcance
    likes: totalLikes,
    comments: totalComments,
    shares: 0,
  };
}

async function fetchFacebookMetrics(username: string, token: string) {
  // Facebook Graph API
  const response = await fetch(
    `https://graph.facebook.com/me?fields=name,fan_count,engagement&access_token=${token}`
  );

  if (!response.ok) {
    throw new Error('Erro ao buscar métricas do Facebook. Verifique seu token de acesso.');
  }

  const data = await response.json();

  return {
    followers: data.fan_count || 0,
    posts: 0, // Precisa de endpoint adicional
    engagement: data.engagement?.count ? (data.engagement.count / data.fan_count) * 100 : 0,
    reach: data.fan_count * 0.2 || 0,
    likes: 0,
    comments: 0,
    shares: 0,
  };
}

async function fetchTwitterMetrics(username: string, token: string) {
  // Twitter API v2
  const response = await fetch(
    `https://api.twitter.com/2/users/by/username/${username}?user.fields=public_metrics`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    }
  );

  if (!response.ok) {
    throw new Error('Erro ao buscar métricas do Twitter. Verifique seu token de acesso.');
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
  // YouTube Data API v3
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelId}&key=${token}`
  );

  if (!response.ok) {
    throw new Error('Erro ao buscar métricas do YouTube. Verifique seu token de acesso.');
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
  // LinkedIn Marketing API
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
    throw new Error('Erro ao buscar métricas do LinkedIn. Verifique seu token de acesso.');
  }

  const data = await response.json();

  return {
    followers: data.followersCount || 0,
    posts: 0, // Precisa de endpoint adicional
    engagement: 0,
    reach: data.followersCount * 0.25 || 0,
    likes: 0,
    comments: 0,
    shares: 0,
  };
}

async function fetchTikTokMetrics(username: string, token: string) {
  // TikTok API
  const response = await fetch(
    `https://open-api.tiktok.com/user/info/?access_token=${token}`,
    {
      headers: {
        'Content-Type': 'application/json',
      }
    }
  );

  if (!response.ok) {
    throw new Error('Erro ao buscar métricas do TikTok. Verifique seu token de acesso.');
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
