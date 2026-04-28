// Hook para baixar mídia (avatar / thumbnail de post) sob demanda.
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useIngestMedia() {
  const [loading, setLoading] = useState(false);

  async function ingestAvatar(opts: { influencer_id?: string; discovered_profile_id?: string }) {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ingest-influencer-media", {
        body: { kind: "avatar", ...opts },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);
      toast.success("Foto de perfil salva");
      return (data as any)?.data?.path as string | undefined;
    } catch (e: any) {
      toast.error(e?.message || "Falha ao baixar foto");
      return undefined;
    } finally {
      setLoading(false);
    }
  }

  async function ingestPost(postId: string) {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ingest-influencer-media", {
        body: { kind: "post", post_id: postId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);
      toast.success("Mídia do post baixada");
      return (data as any)?.data;
    } catch (e: any) {
      toast.error(e?.message || "Falha ao baixar mídia");
      return undefined;
    } finally {
      setLoading(false);
    }
  }

  /**
   * Resolve um storage_path em URL assinada temporária (300s).
   */
  async function getSignedUrl(path: string, expiresIn = 300): Promise<string | null> {
    if (!path) return null;
    const { data, error } = await supabase.storage
      .from("influencer-media")
      .createSignedUrl(path, expiresIn);
    if (error) return null;
    return data?.signedUrl ?? null;
  }

  return { loading, ingestAvatar, ingestPost, getSignedUrl };
}
