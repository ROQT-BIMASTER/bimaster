import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, Clock, XCircle, Truck, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiData {
  total: number;
  enviados: number;
  emRevisao: number;
  aprovados: number;
  rejeitados: number;
  vinculados: number;
  enviadosBrasil: number;
}

interface Props {
  data: KpiData;
  activeFilter?: string | null;
  onFilterClick?: (status: string) => void;
}

export function VincularChinaKpis({ data, activeFilter, onFilterClick }: Props) {
  const cards = [
    { label: "Total", value: data.total, filterKey: "todos", icon: null, color: "text-foreground", bg: "bg-muted/30" },
    { label: "Enviados", value: data.enviados, filterKey: "enviado", icon: Clock, color: "text-primary", bg: "bg-primary/5" },
    { label: "Em Revisão", value: data.emRevisao, filterKey: "em_revisao", icon: AlertTriangle, color: "text-warning", bg: "bg-warning/5" },
    { label: "Aprovados", value: data.aprovados, filterKey: "aprovado", icon: CheckCircle2, color: "text-success", bg: "bg-success/5" },
    { label: "Enviado Brasil", value: data.enviadosBrasil, filterKey: "enviado_brasil", icon: Truck, color: "text-primary", bg: "bg-primary/5" },
    { label: "Rejeitados", value: data.rejeitados, filterKey: "rejeitado", icon: XCircle, color: "text-destructive", bg: "bg-destructive/5" },
    { label: "Vinculados", value: data.vinculados, filterKey: "vinculados", icon: Link2, color: "text-success", bg: "bg-success/5" },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
      {cards.map(c => {
        const Icon = c.icon;
        const isActive = activeFilter === c.filterKey;
        return (
          <Card
            key={c.label}
            className={cn(
              "border shadow-none transition-all cursor-pointer hover:shadow-sm",
              c.bg,
              isActive && "ring-2 ring-primary ring-offset-1"
            )}
            onClick={() => onFilterClick?.(isActive ? "todos" : c.filterKey)}
          >
            <CardContent className="p-3 flex flex-col items-center gap-1">
              <div className="flex items-center gap-1">
                {Icon && <Icon className={cn("h-3.5 w-3.5", c.color)} />}
                <span className={cn("text-lg font-bold", c.color)}>{c.value}</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">{c.label}</span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
