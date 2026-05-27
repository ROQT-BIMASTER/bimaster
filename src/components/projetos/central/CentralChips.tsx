import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MouseEventHandler, ReactNode } from "react";

interface CentralChipProps {
  label: ReactNode;
  /** Quando undefined, não renderiza badge de contagem. */
  count?: number;
  active?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** Variante visual opcional do badge (ex.: "destructive" para Atrasadas). */
  countVariant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
  title?: string;
}

/**
 * Chip de filtro padrão para o `chipsSlot` do CentralLayout.
 * Substitui os antigos KPI cards de cada aba por uma faixa compacta de
 * filtros clicáveis com contadores opcionais.
 */
export function CentralChip({
  label,
  count,
  active,
  onClick,
  countVariant,
  className,
  title,
}: CentralChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-card text-foreground border-border hover:bg-muted/60",
        className,
      )}
    >
      <span className="truncate">{label}</span>
      {typeof count === "number" && (
        <Badge
          variant={
            countVariant ??
            (active ? "secondary" : "outline")
          }
          className="h-4 px-1.5 text-[10px] font-semibold leading-none"
        >
          {count}
        </Badge>
      )}
    </button>
  );
}

/** Wrapper visual para uma faixa de chips (mantém gap/alinhamento). */
export function CentralChipsRow({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-1.5 flex-wrap">{children}</div>;
}
