/**
 * ChinaLanguageSwitcher — seletor de idioma fixo no header do shell China.
 *
 * Mostra os 3 idiomas em paralelo (PT · 中文 · EN), persistindo a escolha
 * em `profiles.preferred_language` via `useUserLanguage`. Sincronizado
 * automaticamente com o i18n do módulo via `useChinaI18n`.
 *
 * Posicionamento proeminente: garante que usuários chineses encontrem o
 * controle em qualquer tela do módulo China sem precisar abrir menu.
 */
import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChinaI18n, type ChinaLanguage } from "@/hooks/useChinaI18n";

const ORDER: ChinaLanguage[] = ["pt", "zh", "en"];
const LABEL: Record<ChinaLanguage, string> = {
  pt: "Português",
  zh: "中文",
  en: "English",
};
const SHORT: Record<ChinaLanguage, string> = {
  pt: "PT",
  zh: "中",
  en: "EN",
};

interface Props {
  className?: string;
  variant?: "full" | "compact";
}

export function ChinaLanguageSwitcher({ className, variant = "full" }: Props) {
  const { language, setLanguage } = useChinaI18n();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-md border bg-card/80 backdrop-blur-sm p-0.5 shadow-sm",
        className,
      )}
      role="group"
      aria-label="Language"
    >
      <Languages className="h-3.5 w-3.5 text-muted-foreground ml-1" aria-hidden="true" />
      {ORDER.map((lng) => {
        const active = language === lng;
        return (
          <button
            key={lng}
            type="button"
            onClick={() => void setLanguage(lng)}
            aria-pressed={active}
            title={LABEL[lng]}
            className={cn(
              "h-6 rounded px-2 text-[11px] font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
          >
            {variant === "compact" ? SHORT[lng] : LABEL[lng]}
          </button>
        );
      })}
    </div>
  );
}
