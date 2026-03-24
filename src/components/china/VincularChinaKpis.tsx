import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiData {
  total: number;
  enviados: number;
  emRevisao: number;
  aprovados: number;
  rejeitados: number;
  vinculados: number;
}

interface Props {
  data: KpiData;
}

export function VincularChinaKpis({ data }: Props) {
  const cards = [
    { label: "Total", value: data.total, icon: null, color: "text-foreground", bg: "bg-muted/30" },
    { label: "Enviados", value: data.enviados, icon: Clock, color: "text-primary", bg: "bg-primary/5" },
    { label: "Em Revisão", value: data.emRevisao, icon: AlertTriangle, color: "text-warning", bg: "bg-warning/5" },
    { label: "Aprovados", value: data.aprovados, icon: CheckCircle2, color: "text-success", bg: "bg-success/5" },
    { label: "Rejeitados", value: data.rejeitados, icon: XCircle, color: "text-destructive", bg: "bg-destructive/5" },
    { label: "Vinculados", value: data.vinculados, icon: null, color: "text-success", bg: "bg-success/5" },
  ];

  return (
    <div className="grid grid-cols-6 gap-2">
      {cards.map(c => {
        const Icon = c.icon;
        return (
          <Card key={c.label} className={cn("border shadow-none", c.bg)}>
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
