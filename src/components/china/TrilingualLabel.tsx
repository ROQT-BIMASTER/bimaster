/**
 * TrilingualLabel — exibe rótulos do checklist China em 3 idiomas (PT / ZH / EN),
 * destacando o idioma ativo (lido de `useChinaI18n`) e mantendo os demais
 * como linha secundária (separados por · ).
 *
 * Fallback: quando o idioma ativo está vazio, escolhe PT → EN → ZH.
 */
import { cn } from "@/lib/utils";
import { useChinaI18n } from "@/hooks/useChinaI18n";
import { pickLabel, type TriLabel } from "@/lib/china/pickLabel";

interface Props {
  pt?: string | null;
  zh?: string | null;
  en?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
  inline?: boolean;
}

const SIZES = {
  sm: { primary: "text-xs font-medium", secondary: "text-[10px]" },
  md: { primary: "text-sm font-semibold", secondary: "text-xs" },
  lg: { primary: "text-base font-bold", secondary: "text-sm" },
} as const;

export function TrilingualLabel({ pt, zh, en, className, size = "md", inline = false }: Props) {
  const { language } = useChinaI18n();
  const labels: TriLabel = { pt, zh, en };
  const primary = pickLabel(labels, language);
  const secondaries = (["pt", "zh", "en"] as const)
    .filter((l) => l !== language)
    .map((l) => pickLabel(labels, l))
    .filter((v) => v && v !== primary);

  return (
    <div className={cn(inline ? "inline-flex flex-col" : "flex flex-col", className)}>
      <span className={cn(SIZES[size].primary, "text-foreground")}>{primary}</span>
      {secondaries.length > 0 && (
        <span className={cn(SIZES[size].secondary, "text-muted-foreground")}>
          {secondaries.join(" · ")}
        </span>
      )}
    </div>
  );
}
