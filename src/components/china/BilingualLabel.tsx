import { cn } from "@/lib/utils";
import { useChinaI18n } from "@/hooks/useChinaI18n";

interface BilingualLabelProps {
  pt: string;
  cn: string;
  /** Inglês opcional. Quando informado, o componente renderiza apenas o idioma
   *  ativo (pt / zh / en) em vez do tradicional layout PT + 中文. */
  en?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: { primary: "text-xs font-medium", secondary: "text-[10px]" },
  md: { primary: "text-sm font-semibold", secondary: "text-xs" },
  lg: { primary: "text-base font-bold", secondary: "text-sm" },
} as const;

export function BilingualLabel({ pt, cn: chinese, en, className, size = "md" }: BilingualLabelProps) {
  const { language } = useChinaI18n();
  const s = SIZES[size];

  // Modo legado (compatível): sem `en` → renderiza PT + 中文 empilhados.
  if (!en) {
    return (
      <div className={cn("flex flex-col", className)}>
        <span className={cn(s.primary, "text-foreground")}>{pt}</span>
        <span className={cn(s.secondary, "text-muted-foreground")}>{chinese}</span>
      </div>
    );
  }

  // Modo i18n: mostra somente o idioma ativo.
  const primary = language === "en" ? en : language === "zh" ? chinese : pt;
  return (
    <div className={cn("flex flex-col", className)}>
      <span className={cn(s.primary, "text-foreground")}>{primary}</span>
    </div>
  );
}
