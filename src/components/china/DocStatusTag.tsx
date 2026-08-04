/**
 * DocStatusTag — etiqueta visual única dos status de documento do fluxo China.
 *
 * Regras:
 *  - sempre ícone + cor + texto (cor nunca é o único sinal);
 *  - rótulo bilíngue (PT 中文) por padrão, com opção PT ou 中文;
 *  - classificação sempre derivada de `docStatus.ts` (nunca comparação solta).
 */
import { cn } from "@/lib/utils";
import {
  checklistStatusTexto,
  docStatusIconComponent,
  docStatusVisual,
  formatarLabelBilingue,
  type DocStatusIdioma,
} from "@/lib/china/docStatus";

interface Props {
  status: string | null | undefined;
  /** xs = listas densas / nós de fluxo; sm = painéis e cabeçalhos. */
  size?: "xs" | "sm";
  idioma?: DocStatusIdioma;
  showIcon?: boolean;
  className?: string;
}

export function DocStatusTag({
  status,
  size = "xs",
  idioma = "bi",
  showIcon = true,
  className,
}: Props) {
  const visual = docStatusVisual(status);
  const Icon = docStatusIconComponent(status);
  const texto = checklistStatusTexto(status);
  const label = formatarLabelBilingue(texto, idioma);

  return (
    <span
      title={`${texto.pt} / ${texto.zh}`}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md border font-medium leading-none",
        visual.badge,
        size === "xs" ? "h-4 px-1 text-[9.5px]" : "h-5 px-1.5 text-[11px]",
        className,
      )}
    >
      {showIcon && <Icon className={cn("shrink-0", size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3")} />}
      <span className="truncate">{label}</span>
    </span>
  );
}
