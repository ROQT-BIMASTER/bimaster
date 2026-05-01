import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  PENDING:             { label: "Pendente",         cls: "bg-muted text-muted-foreground" },
  BOOKING_CONFIRMED:   { label: "Booking",          cls: "bg-blue-100 text-blue-700 border-blue-300" },
  GATE_IN:             { label: "Gate In",          cls: "bg-blue-100 text-blue-700 border-blue-300" },
  LOADED:              { label: "Embarcado",        cls: "bg-indigo-100 text-indigo-700 border-indigo-300" },
  EN_ROUTE:            { label: "Em trânsito",      cls: "bg-amber-100 text-amber-800 border-amber-300" },
  TRANSSHIPMENT:       { label: "Transbordo",       cls: "bg-amber-100 text-amber-800 border-amber-300" },
  DISCHARGED:          { label: "Descarregado",     cls: "bg-cyan-100 text-cyan-800 border-cyan-300" },
  GATE_OUT:            { label: "Liberado porto",   cls: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  DELIVERED:           { label: "Entregue",         cls: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  UNKNOWN:             { label: "Desconhecido",     cls: "bg-muted text-muted-foreground" },
};

export function ContainerStatusBadge({ status, className }: { status: string; className?: string }) {
  const info = STATUS_LABELS[status?.toUpperCase()] ?? STATUS_LABELS.UNKNOWN;
  return (
    <Badge variant="outline" className={cn("font-medium", info.cls, className)}>
      {info.label}
    </Badge>
  );
}
