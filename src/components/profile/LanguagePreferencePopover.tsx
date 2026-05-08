import { Languages, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUserLanguage, LANGUAGE_LABEL, LANGUAGE_FLAG, type UserLanguage } from "@/hooks/useUserLanguage";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  triggerClassName?: string;
}

const LANGS: UserLanguage[] = ["pt", "zh", "en"];

/**
 * Quick language switcher used in the global sidebar / app shell.
 * Persists to `profiles.preferred_language` (also used by the China–Brasil chat
 * to decide which translated variant to display).
 */
export function LanguagePreferencePopover({ className, triggerClassName }: Props) {
  const { language, setLanguage } = useUserLanguage();

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "p-1.5 rounded-md text-[var(--sidebar-text-muted-raw)] hover:text-[var(--sidebar-text-hover-raw)] hover:bg-[var(--sidebar-hover-raw)] transition-colors flex items-center gap-1",
          triggerClassName,
        )}
        title="Idioma de comunicação / 沟通语言"
        aria-label="Selecionar idioma de comunicação"
      >
        <Languages className="h-4 w-4" />
        <span className="text-[10px] font-mono leading-none">{LANGUAGE_FLAG[language]}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className={cn("w-56 p-1", className)}>
        <div className="px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
          Idioma / 语言
        </div>
        {LANGS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLanguage(l)}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent text-left"
          >
            <span className="font-mono text-xs w-6 text-muted-foreground">{LANGUAGE_FLAG[l]}</span>
            <span className="flex-1">{LANGUAGE_LABEL[l]}</span>
            {language === l && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>
        ))}
        <p className="px-2 py-1.5 text-[10px] text-muted-foreground border-t mt-1">
          Define o idioma das mensagens traduzidas no chat China–Brasil.
        </p>
      </PopoverContent>
    </Popover>
  );
}
