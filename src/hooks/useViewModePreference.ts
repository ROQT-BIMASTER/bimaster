import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Persiste a preferência de visualização (ex.: "kanban" | "list") por usuário.
 *
 * - Carrega o valor da tabela `user_view_preferences` no login.
 * - Fallback imediato em `localStorage` para evitar flicker e funcionar offline.
 * - Grava no banco (upsert) sempre que o usuário troca a visualização.
 *
 * Use chaves estáveis por tela (ex.: "vincular-china", "china-inbox").
 */
export function useViewModePreference<T extends string>(
  prefKey: string,
  defaultValue: T,
): [T, (next: T) => void] {
  const lsKey = `view-mode.${prefKey}`;

  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    const cached = window.localStorage.getItem(lsKey);
    return (cached as T | null) ?? defaultValue;
  });

  const userIdRef = useRef<string | null>(null);
  const loadedFromDb = useRef(false);

  // Carrega do banco no mount (uma vez por usuário) — sobrescreve o fallback local.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      userIdRef.current = uid;
      if (!uid) return;

      const { data, error } = await supabase
        .from("user_view_preferences" as any)
        .select("pref_value")
        .eq("user_id", uid)
        .eq("pref_key", prefKey)
        .maybeSingle();

      if (cancelled || error || !data) {
        loadedFromDb.current = true;
        return;
      }
      const remote = (data as { pref_value: string }).pref_value as T;
      if (remote && remote !== value) {
        setValue(remote);
        try { window.localStorage.setItem(lsKey, remote); } catch { /* ignore */ }
      }
      loadedFromDb.current = true;
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefKey]);

  const update = useCallback((next: T) => {
    setValue(next);
    try { window.localStorage.setItem(lsKey, next); } catch { /* ignore */ }
    const uid = userIdRef.current;
    if (!uid) return;
    void supabase
      .from("user_view_preferences" as any)
      .upsert(
        { user_id: uid, pref_key: prefKey, pref_value: next, updated_at: new Date().toISOString() },
        { onConflict: "user_id,pref_key" },
      );
  }, [lsKey, prefKey]);

  return [value, update];
}
