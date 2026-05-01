import { Card, CardContent } from "@/components/ui/card";
import { Activity, AlertTriangle, Anchor, CalendarClock, Webhook, Layers } from "lucide-react";
import type { DiffKpis } from "@/hooks/useShipsgoIntegration";

interface Props { kpis: DiffKpis | null }

const Item = ({ icon: Icon, label, value, tone }: any) => (
  <Card>
    <CardContent className="p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold">{value ?? "—"}</div>
      </div>
    </CardContent>
  </Card>
);

export function ShipsgoKpiCards({ kpis }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <Item icon={Layers} label="Embarques locais" value={kpis?.total_embarques} tone="bg-muted text-foreground" />
      <Item icon={Anchor} label="Trackings ShipsGo" value={kpis?.total_shipments} tone="bg-primary/10 text-primary" />
      <Item icon={Activity} label="Em trânsito" value={kpis?.em_transito} tone="bg-blue-500/10 text-blue-600" />
      <Item icon={AlertTriangle} label="Atrasados" value={kpis?.atrasados} tone="bg-amber-500/10 text-amber-600" />
      <Item icon={CalendarClock} label="Sem ETA" value={kpis?.sem_eta} tone="bg-muted text-foreground" />
      <Item icon={Webhook} label="Webhooks falhos 7d" value={kpis?.webhook_falhos_7d} tone="bg-destructive/10 text-destructive" />
    </div>
  );
}
