/**
 * DocStatusFilterBar — chips de contagem e filtro por situação administrativa
 * dos documentos da submissão China (Em análise, Pendente de aprovação,
 * Aprovado, Não aprovado).
 */
import { Check, Clock, FileWarning, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DECISAO_LABEL, type DocDecisao } from "@/lib/china/docStatus";

const ORDEM: DocDecisao[] = ["em_analise", "pendente", "aprovado", "rejeitado"];

const TONE: Record<DocDecisao, { on: string; off: string; icon: typeof Check }> = {
  em_analise: {
    on: "bg-amber-500/20 text-amber-700 dark:text-amber-200 border-amber-500/50",
    off: "border-border/60 text-muted-foreground hover:bg-amber-500/10",
    icon: Clock,
  },
  pendente: {
    on: "bg-muted text-foreground border-border",
    off: "border-border/60 text-muted-foreground hover:bg-muted/60",
    icon: FileWarning,
  },
  aprovado: {
    on: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-200 border-emerald-500/50",
    off: "border-border/60 text-muted-foreground hover:bg-emerald-500/10",
    icon: Check,
  },
  rejeitado: {
    on: "bg-rose-500/20 text-rose-700 dark:text-rose-200 border-rose-500/50",
    off: "border-border/60 text-muted-foreground hover:bg-rose-500/10",
    icon: XCircle,
  },
};

interface Props {
  counts: Partial<Record<DocDecisao, number>>;
  selected: DocDecisao[];
  onChange: (next: DocDecisao[]) => void;
  label?: string;
  className?: string;
  sort?: DocSortKey;
  onSortChange?: (next: DocSortKey) => void;
}

export function DocStatusFilterBar({
  counts,
  selected,
  onChange,
  label = "Documentos",
  className,
  sort,
  onSortChange,
}: Props) {
  const total = ORDEM.reduce((acc, d) => acc + (counts[d] || 0), 0);
  if (total === 0) return null;

  const toggle = (d: DocDecisao) => {
    onChange(selected.includes(d) ? selected.filter((x) => x !== d) : [...selected, d]);
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className="text-[11px] font-medium text-muted-foreground mr-0.5">{label}:</span>

      {ORDEM.map((d) => {
        const count = counts[d] || 0;
        if (count === 0) return null;
        const active = selected.includes(d);
        const tone = TONE[d];
        const Icon = tone.icon;
        return (
          <button
            key={d}
            type="button"
            onClick={() => toggle(d)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
              active ? tone.on : tone.off,
            )}
          >
            <Icon className="h-3 w-3" />
            {DECISAO_LABEL[d]}
            <span className="rounded bg-background/60 px-1 tabular-nums">{count}</span>
          </button>
        );
      })}
      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Limpar
        </button>
      )}
    </div>
  );
}
