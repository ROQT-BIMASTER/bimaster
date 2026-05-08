import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { toneClasses, type DirectionInfo } from "@/lib/china/inboxDirection";

interface Props {
  info: DirectionInfo;
  /** Compacto = lista; expandido = painel. */
  size?: "sm" | "md";
  showAction?: boolean;
  className?: string;
}

export function InboxDirectionBadge({ info, size = "sm", showAction = true, className }: Props) {
  const tc = toneClasses(info.tone);
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      <Badge
        variant="outline"
        className={cn(
          "gap-1 font-medium tabular-nums",
          tc.badge,
          size === "sm" ? "h-4 px-1.5 text-[9.5px]" : "h-5 px-2 text-[11px]",
        )}
        title={`${info.label} / ${info.labelCn}`}
      >
        <span className="font-mono">{info.arrow}</span>
        <span className="truncate">{info.label}</span>
      </Badge>
      {showAction && info.action !== "—" && (
        <span
          className={cn(
            "inline-flex items-center gap-1 truncate",
            size === "sm" ? "text-[9.5px]" : "text-[11px]",
            "text-muted-foreground",
          )}
          title={`${info.action} / ${info.actionCn}`}
        >
          <span className={cn("h-1 w-1 rounded-full", tc.dot)} />
          {info.action}
        </span>
      )}
    </div>
  );
}

interface BandProps {
  info: DirectionInfo;
  className?: string;
}

/** Faixa de instrução em uma frase (PT + CN), usada no painel de leitura. */
export function InboxDirectionBand({ info, className }: BandProps) {
  const tc = toneClasses(info.tone);
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-xs leading-relaxed",
        tc.band,
        className,
      )}
    >
      <p className="font-medium text-foreground">
        <span className="mr-1 font-mono">{info.arrow}</span>
        {info.sentence}
      </p>
      <p className="mt-0.5 text-[11px] opacity-80">{info.sentenceCn}</p>
    </div>
  );
}
