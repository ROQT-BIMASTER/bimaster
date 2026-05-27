import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from "react";

import ptCommon from "@/i18n/locales/pt-BR/common.json";
import ptDashboard from "@/i18n/locales/pt-BR/dashboard.json";
import ptProspects from "@/i18n/locales/pt-BR/prospects.json";
import ptFinanceiro from "@/i18n/locales/pt-BR/financeiro.json";
import ptTrade from "@/i18n/locales/pt-BR/trade.json";
import ptMarketing from "@/i18n/locales/pt-BR/marketing.json";
import ptFabrica from "@/i18n/locales/pt-BR/fabrica.json";
import ptPortal from "@/i18n/locales/pt-BR/portal.json";

import enCommon from "@/i18n/locales/en/common.json";
import enDashboard from "@/i18n/locales/en/dashboard.json";
import enProspects from "@/i18n/locales/en/prospects.json";
import enFinanceiro from "@/i18n/locales/en/financeiro.json";
import enTrade from "@/i18n/locales/en/trade.json";
import enMarketing from "@/i18n/locales/en/marketing.json";
import enFabrica from "@/i18n/locales/en/fabrica.json";
import enPortal from "@/i18n/locales/en/portal.json";

import esCommon from "@/i18n/locales/es/common.json";
import esDashboard from "@/i18n/locales/es/dashboard.json";
import esProspects from "@/i18n/locales/es/prospects.json";
import esFinanceiro from "@/i18n/locales/es/financeiro.json";
import esTrade from "@/i18n/locales/es/trade.json";
import esMarketing from "@/i18n/locales/es/marketing.json";
import esFabrica from "@/i18n/locales/es/fabrica.json";
import esPortal from "@/i18n/locales/es/portal.json";

import arCommon from "@/i18n/locales/ar/common.json";
import arDashboard from "@/i18n/locales/ar/dashboard.json";
import arProspects from "@/i18n/locales/ar/prospects.json";
import arFinanceiro from "@/i18n/locales/ar/financeiro.json";
import arTrade from "@/i18n/locales/ar/trade.json";
import arMarketing from "@/i18n/locales/ar/marketing.json";
import arFabrica from "@/i18n/locales/ar/fabrica.json";
import arPortal from "@/i18n/locales/ar/portal.json";

export type Language = "pt-BR" | "en" | "es" | "ar";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  dir: "ltr" | "rtl";
}

/**
 * Fase 1 da migração para i18next: dicionários extraídos para
 * `src/i18n/locales/<lang>/<ns>.json` (8 namespaces). A API pública deste
 * Context permanece inalterada — call sites continuam usando `useLanguage()`
 * e chaves planas (`t("nav.dashboard")`).
 *
 * Fase 2 trocará estes imports estáticos por `i18next-resources-to-backend`
 * (lazy por idioma) e migrará páginas para `useTranslation()`.
 */
const translations: Record<Language, Record<string, string>> = {
  "pt-BR": {
    ...ptCommon, ...ptDashboard, ...ptProspects, ...ptFinanceiro,
    ...ptTrade, ...ptMarketing, ...ptFabrica, ...ptPortal,
  },
  en: {
    ...enCommon, ...enDashboard, ...enProspects, ...enFinanceiro,
    ...enTrade, ...enMarketing, ...enFabrica, ...enPortal,
  },
  es: {
    ...esCommon, ...esDashboard, ...esProspects, ...esFinanceiro,
    ...esTrade, ...esMarketing, ...esFabrica, ...esPortal,
  },
  ar: {
    ...arCommon, ...arDashboard, ...arProspects, ...arFinanceiro,
    ...arTrade, ...arMarketing, ...arFabrica, ...arPortal,
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("app-language");
    return (saved as Language) || "pt-BR";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("app-language", lang);
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  };

  useEffect(() => {
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<LanguageContextType>(() => ({
    language,
    setLanguage,
    t: (key: string) =>
      translations[language]?.[key] ?? translations["pt-BR"]?.[key] ?? key,
    dir: language === "ar" ? "rtl" : "ltr",
  }), [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
