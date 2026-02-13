import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Language = "pt-BR" | "en" | "es" | "ar";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  dir: "ltr" | "rtl";
}

const translations: Record<Language, Record<string, string>> = {
  "pt-BR": {
    "system.title": "Sistema Huggs",
    "nav.dashboard": "Dashboard",
    "nav.notifications": "Notificações",
    "lang.label": "Idioma",
    "lang.pt-BR": "Português (BR)",
    "lang.en": "English",
    "lang.es": "Español",
    "lang.ar": "العربية",
    "offline.message": "Você está offline. Algumas funcionalidades podem estar limitadas.",
    "offline.poor": "Conexão instável detectada.",
    "loading": "Carregando...",
  },
  en: {
    "system.title": "Huggs System",
    "nav.dashboard": "Dashboard",
    "nav.notifications": "Notifications",
    "lang.label": "Language",
    "lang.pt-BR": "Português (BR)",
    "lang.en": "English",
    "lang.es": "Español",
    "lang.ar": "العربية",
    "offline.message": "You are offline. Some features may be limited.",
    "offline.poor": "Unstable connection detected.",
    "loading": "Loading...",
  },
  es: {
    "system.title": "Sistema Huggs",
    "nav.dashboard": "Panel",
    "nav.notifications": "Notificaciones",
    "lang.label": "Idioma",
    "lang.pt-BR": "Português (BR)",
    "lang.en": "English",
    "lang.es": "Español",
    "lang.ar": "العربية",
    "offline.message": "Estás sin conexión. Algunas funciones pueden estar limitadas.",
    "offline.poor": "Conexión inestable detectada.",
    "loading": "Cargando...",
  },
  ar: {
    "system.title": "نظام هاغز",
    "nav.dashboard": "لوحة التحكم",
    "nav.notifications": "الإشعارات",
    "lang.label": "اللغة",
    "lang.pt-BR": "Português (BR)",
    "lang.en": "English",
    "lang.es": "Español",
    "lang.ar": "العربية",
    "offline.message": "أنت غير متصل. قد تكون بعض الميزات محدودة.",
    "offline.poor": "تم اكتشاف اتصال غير مستقر.",
    "loading": "جاري التحميل...",
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

  const t = (key: string): string => {
    return translations[language]?.[key] || translations["pt-BR"]?.[key] || key;
  };

  const dir = language === "ar" ? "rtl" : "ltr";

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
