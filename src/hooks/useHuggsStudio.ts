import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Action =
  | "list_avatars" | "list_voices"
  | "create_video" | "video_status" | "list_my_videos"
  | "create_translation" | "translation_status" | "list_my_translations"
  | "list_translation_languages";

export function useHuggsStudio() {
  const [loading, setLoading] = useState(false);
  const call = useCallback(async <T = any>(action: Action, payload?: Record<string, any>): Promise<T | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("huggs-studio", {
        body: { action, payload },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha na operação");
      return data.data as T;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao chamar o Estúdio";
      toast.error(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { call, loading };
}

/**
 * Hook para polling do status de um vídeo até completar.
 */
export function useVideoPolling(onUpdate: (row: any) => void) {
  const timers = useRef<Map<string, number>>(new Map());
  const stop = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
  }, []);
  const start = useCallback((id: string, kind: "video" | "translation") => {
    const action = kind === "video" ? "video_status" : "translation_status";
    const tick = async () => {
      const { data } = await supabase.functions.invoke("huggs-studio", {
        body: { action, payload: { id } },
      });
      const row = data?.data;
      if (row) onUpdate(row);
      if (row?.status === "completed" || row?.status === "failed") {
        stop(id);
        return;
      }
      timers.current.set(id, setTimeout(tick, 5000) as unknown as number);
    };
    tick();
  }, [onUpdate, stop]);
  useEffect(() => () => { timers.current.forEach((t) => clearTimeout(t)); }, []);
  return { start, stop };
}
