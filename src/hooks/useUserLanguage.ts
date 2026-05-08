/**
 * useUserLanguage — preferência de idioma do usuário (pt | zh | en).
 *
 * Lê de `profiles.preferred_language`, com cache local em `localStorage`
 * para evitar flash de UI no primeiro render.
 *
 * Usado pelo chat China–Brasil para decidir em que idioma exibir cada
 * mensagem (mostra o original + a tradução automática armazenada).
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserLanguage = "pt" | "zh" | "en";

const STORAGE_KEY = "bm:user_language";

function readCached(): UserLanguage | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "pt" || v === "zh" || v === "en") return v;
  } catch { /* ignore */ }
  return null;
}

export function useUserLanguage() {
  const [language, setLanguageState] = useState<UserLanguage>(() => readCached() ?? "pt");
  const [loading, setLoading] = useState(true);

  // Carrega do perfil
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !alive) { setLoading(false); return; }
      const { data } = await supabase
        .from("profiles")
        .select("preferred_language")
        .eq("id", user.id)
        .maybeSingle();
      if (!alive) return;
      const lang = (data?.preferred_language as UserLanguage | undefined) ?? "pt";
      setLanguageState(lang);
      try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const setLanguage = useCallback(async (next: UserLanguage) => {
    setLanguageState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ preferred_language: next } as any).eq("id", user.id);
  }, []);

  return { language, setLanguage, loading };
}

export const LANGUAGE_LABEL: Record<UserLanguage, string> = {
  pt: "Português",
  zh: "中文",
  en: "English",
};

export const LANGUAGE_FLAG: Record<UserLanguage, string> = {
  pt: "PT",
  zh: "中",
  en: "EN",
};
