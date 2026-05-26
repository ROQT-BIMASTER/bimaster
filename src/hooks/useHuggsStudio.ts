import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Action =
  | "list_avatars" | "list_voices"
  | "create_video" | "video_status" | "list_my_videos"
  | "create_translation" | "translation_status" | "list_my_translations"
  | "list_translation_languages";

function mapInvokeError(err: unknown, action: string): string {
  const anyErr = err as any;
  const status: number | undefined = anyErr?.context?.response?.status ?? anyErr?.status;
  // Try to read body returned by the function (FunctionsHttpError keeps the Response in context)
  const ctxBody = anyErr?.context?.body;
  if (typeof ctxBody === "string" && ctxBody.length) {
    try {
      const parsed = JSON.parse(ctxBody);
      if (parsed?.error) return String(parsed.error);
    } catch { /* ignore */ }
  }
  if (status === 404) return "Estúdio indisponível: módulo não publicado. Tente novamente em instantes.";
  if (status === 403) return "Sem permissão para acessar o Estúdio Huggs.";
  if (status === 401) return "Sessão expirada. Faça login novamente.";
  if (status === 429) return "Muitas requisições. Aguarde alguns segundos e tente de novo.";
  if (status && status >= 500) return `Erro no Estúdio (${status}). Verifique os logs.`;
  if (err instanceof Error && err.message) return err.message;
  return `Erro ao chamar o Estúdio (${action})`;
}

export function useHuggsStudio() {
  const [loading, setLoading] = useState(false);
  const call = useCallback(async <T = any>(action: Action, payload?: Record<string, any>): Promise<T | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("huggs-studio", {
        body: { action, payload },
      });
      if (error) {
        console.error("[useHuggsStudio]", action, error);
        toast.error(mapInvokeError(error, action));
        return null;
      }
      if (!data?.ok) {
        const msg = data?.error || "Falha na operação";
        console.error("[useHuggsStudio]", action, msg);
        toast.error(msg);
        return null;
      }
      return data.data as T;
    } catch (err) {
      console.error("[useHuggsStudio]", action, err);
      toast.error(mapInvokeError(err, action));
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
