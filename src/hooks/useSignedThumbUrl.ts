import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Gera (e cacheia) uma signed URL para um arquivo em bucket privado.
 * Cache de 50min com expiração assinada de 1h, para evitar reassinar a cada render.
 */
export function useSignedThumbUrl(
  bucket: string,
  path: string | null | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: ["signed-url", bucket, path],
    enabled: enabled && !!path,
    staleTime: 50 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path!, 3600);
      if (error) return null;
      return data?.signedUrl ?? null;
    },
  });
}
