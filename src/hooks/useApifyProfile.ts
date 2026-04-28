// Hook para enriquecer um perfil via Apify (lookup automático).
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ApifyEnrichedProfile {
  username: string;
  display_name: string;
  platform: string;
  profile_url: string;
  avatar_url: string | null;
  followers_count: number;
  following_count: number;
  posts_count: number;
  engagement_rate: number;
  avg_likes: number;
  avg_comments: number;
  bio: string | null;
  is_verified: boolean;
  is_private: boolean;
  business_category: string | null;
  external_url: string | null;
  niche: string | null;
  latest_posts: Array<{
    platform_post_id: string;
    post_url: string | null;
    post_type: string;
    caption: string | null;
    thumbnail_url: string | null;
    media_url: string | null;
    likes: number;
    comments_count: number;
    shares: number;
    posted_at: string | null;
  }>;
}

/**
 * Lookup automático de @username com debounce.
 * Retorna o perfil quando encontrado ou null. NÃO persiste — só consulta.
 */
export function useApifyProfileLookup(
  username: string,
  platform: string,
  enabled = true,
  debounceMs = 800,
) {
  const [data, setData] = useState<ApifyEnrichedProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastQueryRef = useRef<string>("");

  useEffect(() => {
    if (!enabled) return;
    const u = (username || "").trim().replace(/^@/, "");
    if (u.length < 2) {
      setData(null);
      setError(null);
      return;
    }
    const key = `${platform}:${u}`;
    if (key === lastQueryRef.current && data) return;

    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      lastQueryRef.current = key;
      try {
        const { data: res, error: err } = await supabase.functions.invoke(
          "apify-influencer-search",
          {
            body: { action: "enrich", username: u, platform },
          },
        );
        if (err) throw err;
        if (res?.data) {
          setData(res.data);
        } else {
          setData(null);
          setError(res?.message || "Perfil não encontrado");
        }
      } catch (e: any) {
        setError(e?.message || "Erro no lookup");
        setData(null);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, platform, enabled, debounceMs]);

  return { data, loading, error };
}

/**
 * Sincroniza 1 ou vários influenciadores existentes (chama apify-sync-influencer).
 */
export async function syncInfluencersViaApify(ids: string[]) {
  const { data, error } = await supabase.functions.invoke("apify-sync-influencer", {
    body: ids.length === 1 ? { influencer_id: ids[0] } : { influencer_ids: ids },
  });
  if (error) throw error;
  return data?.data;
}
