/**
 * i18n isolado do módulo Fábrica China (PT / ZH / EN).
 *
 * Usa uma instância dedicada do i18next (`createInstance`) para não
 * colidir com o singleton global e garantir que o bundle `china`
 * seja sempre registrado.
 */
import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import pt from "./pt.json";
import zh from "./zh.json";
import en from "./en.json";

export const CHINA_I18N_NS = "china";

export const chinaI18n = i18next.createInstance();

void chinaI18n.use(initReactI18next).init({
  resources: {
    pt: { [CHINA_I18N_NS]: pt },
    zh: { [CHINA_I18N_NS]: zh },
    en: { [CHINA_I18N_NS]: en },
  },
  lng: "pt",
  fallbackLng: "pt",
  defaultNS: CHINA_I18N_NS,
  ns: [CHINA_I18N_NS],
  interpolation: { escapeValue: false },
  returnEmptyString: false,
  react: { useSuspense: false },
});

export default chinaI18n;
