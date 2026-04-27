/**
 * StatusPill — pill compacta e padronizada para uso em listagens densas.
 * Substitui o uso heterogêneo de `Badge` (variants outline/secondary/default
 * misturadas) nas colunas de Tipo, Origem e Status, garantindo:
 *  - mesma altura (h-5)
 *  - mesma tipografia (text-[10px] uppercase tracking-wide font-medium)
 *  - paleta consistente por "tom"
 *  - opção de "dot" para reforçar leitura categórica
 *
 * Não é um substituto do StatusAprovacaoBadge (que tem ícones próprios e
 * semântica de fluxo de aprovação) — é apenas o wrapper visual para
 * categorias simples.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PillTone =
  | "neutral"
  | "indigo"
  | "emerald"
  | "amber"
  | "rose"
  | "slate"
  | "primary";

const TONE_CLASSES: Record<PillTone, string> = {
  neutral:
    "bg-muted text-muted-foreground border border-border/50",
  slate:
    "bg-slate-500/10 text-slate-700 border border-slate-500/20 dark:text-slate-200 dark:bg-slate-400/15",
  indigo:
    "bg-indigo-500/10 text-indigo-700 border border-indigo-500/25 dark:text-indigo-200 dark:bg-indigo-400/15",
  emerald:
    "bg-emerald-500/10 text-emerald-700 border border-emerald-500/25 dark:text-emerald-200 dark:bg-emerald-400/15",
  amber:
    "bg-amber-500/15 text-amber-800 border border-amber-500/30 dark:text-amber-100 dark:bg-amber-400/20",
  rose:
    "bg-rose-500/10 text-rose-700 border border-rose-500/25 dark:text-rose-200 dark:bg-rose-400/15",
  primary:
    "bg-primary/10 text-primary border border-primary/25",
};

const DOT_TONE: Record<PillTone, string> = {
  neutral: "bg-muted-foreground/60",
  slate: "bg-slate-500",
  indigo: "bg-indigo-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  primary: "bg-primary",
};

interface StatusPillProps {
  tone?: PillTone;
  /** Mostra um ponto colorido à esquerda (útil para Origem). */
  dot?: boolean;
  /** Ícone opcional à esquerda. Tem prioridade sobre `dot`. */
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function StatusPill({
  tone = "neutral",
  dot = false,
  icon,
  className,
  children,
}: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 h-5 text-[10px] font-medium uppercase tracking-wide whitespace-nowrap",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {icon ? (
        <span className="inline-flex items-center [&>svg]:h-2.5 [&>svg]:w-2.5">
          {icon}
        </span>
      ) : dot ? (
        <span className={cn("h-1.5 w-1.5 rounded-full", DOT_TONE[tone])} />
      ) : null}
      <span className="leading-none">{children}</span>
    </span>
  );
}
