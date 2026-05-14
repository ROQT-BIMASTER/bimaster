import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { DiffBadge, computeDiff, type DiffState } from "./DiffBadge";

interface Props {
  label: string;
  china: React.ReactNode;
  brasil: React.ReactNode;
  /** Raw values used to compute diff (defaults to children). */
  chinaRaw?: unknown;
  brasilRaw?: unknown;
  /** Override diff calculation entirely. */
  state?: DiffState;
  /** Show "Copiar da China" CTA when faltando/divergente. */
  onCopiar?: () => void;
  className?: string;
}

export function ComparacaoRow({
  label,
  china,
  brasil,
  chinaRaw,
  brasilRaw,
  state,
  onCopiar,
  className,
}: Props) {
  const diff =
    state ?? computeDiff(chinaRaw ?? china, brasilRaw ?? brasil);
  const showCopy = onCopiar && (diff === "faltando" || diff === "divergente");

  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_auto_1fr] gap-3 items-start py-2 border-b border-border/40 last:border-0",
        className,
      )}
    >
      <div>
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
          {label}
        </div>
        <div className="text-sm text-foreground bg-muted/40 rounded px-2 py-1.5 min-h-[32px]">
          {china || <span className="text-muted-foreground italic">—</span>}
        </div>
      </div>

      <div className="flex flex-col items-center gap-1 pt-5">
        <DiffBadge state={diff} />
        {showCopy && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px]"
            onClick={onCopiar}
          >
            <Copy className="h-3 w-3 mr-1" />
            Copiar
          </Button>
        )}
      </div>

      <div>
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1 text-right">
          Brasil
        </div>
        <div
          className={cn(
            "text-sm text-foreground bg-card border border-border rounded px-2 py-1.5 min-h-[32px]",
            diff === "divergente" && "ring-2 ring-warning/40",
            diff === "faltando" && "ring-2 ring-destructive/40",
          )}
        >
          {brasil || <span className="text-muted-foreground italic">—</span>}
        </div>
      </div>
    </div>
  );
}
