/**
 * ChinaStatusFilterChips — filtro rápido (multi-seleção) por estágio do fluxo
 * China → Brasil. Mesma paleta das etiquetas (`DocStatusTag`), bilíngue,
 * com contadores e botão "Limpar".
 *
 * O estado é local por tela; use `useChinaStatusFilter` para persistir em
 * `localStorage`.
 */
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import {
  checklistStatusTexto,
  docStatusIconComponent,
  docStatusVisual,
  formatarLabelBilingue,
  type DocStatusIdioma,
} from "@/lib/china/docStatus";
import type { FlowBucket } from "@/lib/china/flowTones";

/** Ordem canônica e status representativo de cada estágio (para cor/ícone/rótulo). */
export const FILTER_BUCKETS: Array<{ bucket: FlowBucket; statusRef: string }> = [
  { bucket: "em_analise", statusRef: "em_analise" },
  { bucket: "aprovado", statusRef: "aprovado" },
  { bucket: "rejeitado", statusRef: "rejeitado" },
  { bucket: "enviado", statusRef: "enviado_brasil" },
  { bucket: "pendente", statusRef: "pendente" },
  { bucket: "nao_criado", statusRef: "nao_criado" },
];

interface Props {
  counts: Partial<Record<FlowBucket, number>>;
  selected: FlowBucket[];
  onChange: (next: FlowBucket[]) => void;
  idioma?: DocStatusIdioma;
  /** Esconde chips com contagem zero (padrão: true). */
  hideEmpty?: boolean;
  label?: string;
  className?: string;
}

export function ChinaStatusFilterChips({
  counts,
  selected,
  onChange,
  idioma = "bi",
  hideEmpty = true,
  label,
  className,
}: Props) {
  const toggle = (b: FlowBucket) =>
    onChange(selected.includes(b) ? selected.filter((x) => x !== b) : [...selected, b]);

  const visiveis = FILTER_BUCKETS.filter(
    ({ bucket }) => !hideEmpty || (counts[bucket] || 0) > 0,
  );
  if (visiveis.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {label && (
        <span className="mr-0.5 text-[10px] font-medium text-muted-foreground">{label}:</span>
      )}
      {visiveis.map(({ bucket, statusRef }) => {
        const active = selected.includes(bucket);
        const visual = docStatusVisual(statusRef);
        const Icon = docStatusIconComponent(statusRef);
        const texto = checklistStatusTexto(statusRef);
        return (
          <button
            key={bucket}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(bucket)}
            title={`${texto.pt} / ${texto.zh}`}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
              active
                ? cn(visual.badge, "ring-1 ring-inset ring-current/40")
                : "border-border/60 text-muted-foreground hover:bg-muted/50",
            )}
          >
            <Icon className={cn("h-2.5 w-2.5", active ? "" : "opacity-70")} />
            <span className="truncate">{formatarLabelBilingue(texto, idioma)}</span>
            <span className="rounded bg-background/70 px-1 tabular-nums">
              {counts[bucket] || 0}
            </span>
          </button>
        );
      })}
      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Limpar 清除
        </button>
      )}
    </div>
  );
}

/** Filtro por estágio persistido em localStorage (por tela). */
export function useChinaStatusFilter(storageKey: string) {
  const [selected, setSelected] = useState<FlowBucket[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) ? (parsed as FlowBucket[]) : [];
    } catch {
      return [];
    }
  });

  const update = useCallback(
    (next: FlowBucket[]) => {
      setSelected(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* storage indisponível — filtro segue apenas em memória */
      }
    },
    [storageKey],
  );

  const matches = useCallback(
    (bucket: FlowBucket) => selected.length === 0 || selected.includes(bucket),
    [selected],
  );

  return { selected, setSelected: update, matches };
}
