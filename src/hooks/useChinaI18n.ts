/**
 * useChinaI18n — wrapper único que componentes do módulo China devem usar.
 * Lê `t` da instância dedicada (via I18nextProvider no ChinaPageShell)
 * e mantém o idioma sincronizado com `useUserLanguage`.
 */
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { chinaI18n, CHINA_I18N_NS } from "@/i18n/china";
import { useUserLanguage, type UserLanguage } from "@/hooks/useUserLanguage";

export type ChinaLanguage = UserLanguage;

export function useChinaI18n() {
  const { language, setLanguage, loading } = useUserLanguage();
  const { t } = useTranslation(CHINA_I18N_NS, { i18n: chinaI18n });

  useEffect(() => {
    if (chinaI18n.language !== language) {
      void chinaI18n.changeLanguage(language);
    }
  }, [language]);

  return { t, language, setLanguage, loading };
}
