import { useEffect, useMemo, useState } from "react";
import { Clock, Timer, AlarmClock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";

interface SLACountdownPillProps {
  /** ISO timestamp (preferido: `sla_limite`) ou data (YYYY-MM-DD do `data_prazo`). */
  deadline: string | Date | null | undefined;
  /** Densidade visual — `sm` para cards, `md` para header. */
  size?: "sm" | "md";
  /** Rótulo de origem exibido no tooltip. */
  sourceLabel?: string;
  /** Se true, oculta o pill quando não há prazo (padrão). Caso contrário mostra placeholder. */
  hideWhenEmpty?: boolean;
  /** Classe extra. */
  className?: string;
  /** Não mostrar a tarefa como "ao vivo" (tarefa concluída/arquivada). */
  frozen?: boolean;
  /** Data de conclusão da tarefa. Quando `frozen=true`, é usada como referência ("agora congelado") para decidir se foi entregue no prazo ou em atraso. */
  completedAt?: string | Date | null;
}

type Bucket = "distant" | "near" | "critical" | "overdue" | "empty";

function resolveDate(deadline: SLACountdownPillProps["deadline"]): Date | null {
  if (!deadline) return null;
  if (deadline instanceof Date) return isNaN(deadline.getTime()) ? null : deadline;
  // Se for YYYY-MM-DD puro (coluna DATE), parse local para evitar shift UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
    const d = parseLocalDate(deadline);
    if (!d) return null;
    // Considera fim do dia como limite para prazos em data pura.
    d.setHours(23, 59, 59, 999);
    return d;
  }
  const d = new Date(deadline);
  return isNaN(d.getTime()) ? null : d;
}

function bucketize(diffMs: number): Bucket {
  if (diffMs < 0) return "overdue";
  if (diffMs < 2 * 60 * 60 * 1000) return "critical";
  if (diffMs < 24 * 60 * 60 * 1000) return "near";
  return "distant";
}

function formatDelta(diffMs: number): string {
  const abs = Math.abs(diffMs);
  const s = Math.floor(abs / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);

  const prefix = diffMs < 0 ? "Atrasado " : "";

  if (d >= 1) {
    const restH = h - d * 24;
    return `${prefix}${d}d${restH > 0 ? ` ${restH}h` : ""}`;
  }
  if (h >= 1) {
    const restM = m - h * 60;
    return `${prefix}${h}h${restM > 0 ? ` ${restM}m` : ""}`;
  }
  if (m >= 1) {
    return `${prefix}${m}m`;
  }
  return `${prefix}${s}s`;
}

const BUCKET_STYLES: Record<
  Bucket,
  { className: string; Icon: typeof Clock; label?: string }
> = {
  distant: {
    className: "bg-muted/60 text-muted-foreground border border-border/60",
    Icon: Clock,
  },
  near: {
    className:
      "bg-primary/10 text-primary border border-primary/30",
    Icon: Timer,
  },
  critical: {
    className:
      "bg-warning/15 text-warning border border-warning/50 animate-pulse",
    Icon: AlarmClock,
  },
  overdue: {
    className:
      "bg-destructive/15 text-destructive border border-destructive/60 animate-pulse font-semibold shadow-[0_0_0_2px_hsl(var(--destructive)/0.15)]",
    Icon: AlertCircle,
  },
  empty: {
    className: "bg-muted/40 text-muted-foreground border border-dashed border-border/60",
    Icon: Clock,
  },
};

export function SLACountdownPill({
  deadline,
  size = "sm",
  sourceLabel,
  hideWhenEmpty = true,
  className,
  frozen = false,
}: SLACountdownPillProps) {
  const target = useMemo(() => resolveDate(deadline), [deadline]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target || frozen) return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [target, frozen]);

  if (!target) {
    if (hideWhenEmpty) return null;
    const styles = BUCKET_STYLES.empty;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full",
          size === "md" ? "text-xs h-6 px-2.5" : "text-[10px] h-5 px-1.5",
          styles.className,
          className,
        )}
      >
        <styles.Icon className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} />
        Sem prazo
      </span>
    );
  }

  const diffMs = target.getTime() - now;
  const bucket = bucketize(diffMs);
  const styles = BUCKET_STYLES[bucket];
  const text = formatDelta(diffMs);
  const absolute = format(target, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full whitespace-nowrap tabular-nums transition-colors",
              size === "md" ? "text-xs h-6 px-2.5" : "text-[10px] h-5 px-1.5",
              styles.className,
              className,
            )}
            aria-label={`Prazo: ${text} (${absolute})`}
          >
            <styles.Icon className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} />
            {text}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="whitespace-pre-line max-w-xs text-xs">
          <div className="font-semibold">
            {bucket === "overdue"
              ? "Prazo excedido"
              : bucket === "critical"
                ? "Prazo crítico"
                : bucket === "near"
                  ? "Prazo próximo"
                  : "Prazo em dia"}
          </div>
          <div>Limite: {absolute}</div>
          {sourceLabel && <div className="text-muted-foreground">{sourceLabel}</div>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
