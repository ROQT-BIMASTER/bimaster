/**
 * i18n isolado do módulo Fábrica China (PT / ZH / EN).
 *
 * Fonte de verdade do idioma: `useUserLanguage` (persiste em
 * `profiles.preferred_language`). O hook `useChinaI18n` mantém o
 * `i18next` sincronizado quando o usuário troca o idioma.
 *
 * Namespaces estão consolidados em um único bundle por idioma para
 * simplificar o carregamento — adicionar novos arquivos aqui à medida
 * que cada fase do rollout for entregue (inbox, submissao, checklist,
 * ordens, ficha, chat, auditoria, documentos).
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import pt from "./pt.json";
import zh from "./zh.json";
import en from "./en.json";

export const CHINA_I18N_NS = "china";

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      pt: { [CHINA_I18N_NS]: pt },
      zh: { [CHINA_I18N_NS]: zh },
      en: { [CHINA_I18N_NS]: en },
    },
    lng: "pt",
    fallbackLng: "en",
    defaultNS: CHINA_I18N_NS,
    ns: [CHINA_I18N_NS],
    interpolation: { escapeValue: false },
    returnEmptyString: false,
    react: { useSuspense: false },
  });
}

export default i18n;
