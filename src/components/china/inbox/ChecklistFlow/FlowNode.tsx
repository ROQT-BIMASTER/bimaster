import { cn } from "@/lib/utils";
import {
  FLOW_TONE,
  bucketToTone,
  iconForBucket,
  type FlowBucket,
} from "@/lib/china/flowTones";

interface Props {
  label: string;
  labelCn?: string;
  bucket: FlowBucket;
  selected?: boolean;
  needsAction?: boolean;
  onClick?: () => void;
}

/**
 * FlowNode — círculo compacto (44px) que representa uma etapa do checklist.
 * Tonalizado por bucket (aprovado/em análise/enviado/pendente/rejeitado).
 * Mostra label abaixo (PT) com legenda CN opcional menor.
 */
export function FlowNode({ label, labelCn, bucket, selected, needsAction, onClick }: Props) {
  const tone = bucketToTone(bucket);
  const cfg = FLOW_TONE[tone];
  const Icon = iconForBucket(bucket);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex w-[88px] shrink-0 flex-col items-center gap-1 rounded-md p-1 -m-1 outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-primary/40",
        selected && "bg-primary/5 ring-1 ring-primary/30",
      )}
      title={`${label}${labelCn ? ` · ${labelCn}` : ""}`}
      aria-pressed={selected}
    >
      <span
        className={cn(
          "relative flex h-11 w-11 items-center justify-center rounded-full border-2 ring-4 shadow-sm transition-transform group-hover:scale-105",
          cfg.border,
          cfg.bg,
          cfg.ring,
          selected && "scale-105",
        )}
      >
        <Icon className={cn("h-5 w-5", cfg.text)} />
        {needsAction && (
          <span
            className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white shadow"
            aria-label="Ação necessária"
          >
            !
          </span>
        )}
      </span>
      <span className="line-clamp-2 w-full text-center text-[10px] font-medium leading-tight text-foreground/90">
        {label}
      </span>
      {labelCn && (
        <span className="line-clamp-1 w-full text-center text-[9px] leading-tight text-muted-foreground/70">
          {labelCn}
        </span>
      )}
    </button>
  );
}
