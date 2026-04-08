import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ResolvedMedia {
  media_url: string | null;
  thumbnail_url: string | null;
  post_url: string | null;
  source: string;
}

const sessionCache = new Map<string, ResolvedMedia>();

export function useResolvePostMedia() {
  const [resolving, setResolving] = useState(false);

  const resolve = useCallback(async (postId: string): Promise<ResolvedMedia | null> => {
    if (sessionCache.has(postId)) return sessionCache.get(postId)!;

    setResolving(true);
    try {
      const { data, error } = await supabase.functions.invoke("resolve-post-media", {
        body: { post_id: postId },
      });

      if (error || !data) return null;

      const result = data as ResolvedMedia;
      sessionCache.set(postId, result);
      return result;
    } catch {
      return null;
    } finally {
      setResolving(false);
    }
  }, []);

  return { resolve, resolving };
}
