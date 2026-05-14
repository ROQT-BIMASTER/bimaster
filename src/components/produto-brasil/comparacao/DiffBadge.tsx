import { Badge } from "@/components/ui/badge";
import { Check, AlertTriangle, AlertCircle, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type DiffState = "igual" | "divergente" | "faltando" | "apenas_brasil" | "vazio";

export function computeDiff(china: unknown, brasil: unknown): DiffState {
  const c = normalize(china);
  const b = normalize(brasil);
  if (!c && !b) return "vazio";
  if (c && !b) return "faltando";
  if (!c && b) return "apenas_brasil";
  return c === b ? "igual" : "divergente";
}

function normalize(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  return String(v).trim().toLowerCase();
}

const META: Record<DiffState, { label: string; cls: string; Icon: typeof Check }> = {
  igual: { label: "Igual", cls: "bg-muted text-muted-foreground border-border", Icon: Check },
  divergente: {
    label: "Divergente",
    cls: "bg-warning/10 text-warning-foreground border-warning/40",
    Icon: AlertTriangle,
  },
  faltando: {
    label: "Faltando no Brasil",
    cls: "bg-destructive/10 text-destructive border-destructive/40",
    Icon: AlertCircle,
  },
  apenas_brasil: {
    label: "Apenas Brasil",
    cls: "bg-primary/10 text-primary border-primary/30",
    Icon: Check,
  },
  vazio: { label: "—", cls: "bg-muted/40 text-muted-foreground border-border", Icon: Minus },
};

interface Props {
  state: DiffState;
  className?: string;
}

export function DiffBadge({ state, className }: Props) {
  const { label, cls, Icon } = META[state];
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 text-[10px] h-5 px-1.5 font-medium", cls, className)}
    >
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}
