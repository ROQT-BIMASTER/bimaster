/**
 * useChinaI18n — wrapper único que componentes do módulo China devem usar.
 *
 * - Inicializa o i18n isolado (src/i18n/china).
 * - Mantém o idioma do `i18next` sincronizado com `useUserLanguage`
 *   (que persiste em `profiles.preferred_language`).
 * - Expõe `t`, `language` e `setLanguage` em uma API única.
 *
 * Componentes NÃO devem importar `useTranslation` direto — sempre via
 * este hook, para que a troca de idioma propague em toda a árvore.
 */
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import i18n, { CHINA_I18N_NS } from "@/i18n/china";
import { useUserLanguage, type UserLanguage } from "@/hooks/useUserLanguage";

export type ChinaLanguage = UserLanguage;

export function useChinaI18n() {
  const { language, setLanguage, loading } = useUserLanguage();
  const { t } = useTranslation(CHINA_I18N_NS, { i18n });

  useEffect(() => {
    if (i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
  }, [language]);

  return { t, language, setLanguage, loading };
}
