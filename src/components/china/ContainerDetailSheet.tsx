import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Ship, Anchor, Calendar, AlertTriangle } from "lucide-react";
import { useShipsgoShipment, useSyncShipsgoShipment } from "@/hooks/useShipsgoShipments";
import { ContainerStatusBadge } from "./ContainerStatusBadge";
import { ContainerTimeline } from "./ContainerTimeline";
import { ContainerRouteMap } from "./ContainerRouteMap";
import { ChinaTimelineButton } from "@/components/china/timeline/ChinaTimelineButton";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  shipmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  try {
    return format(parseLocalDate(d), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return d;
  }
}

export function ContainerDetailSheet({ shipmentId, open, onOpenChange }: Props) {
  const { data, isLoading } = useShipsgoShipment(shipmentId ?? undefined);
  const sync = useSyncShipsgoShipment();
  const ship = data?.shipment;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Ship className="h-5 w-5" />
            {ship?.container_number || ship?.bl_number || ship?.booking_number || "Container"}
          </SheetTitle>
        </SheetHeader>

        {isLoading || !ship ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <ContainerStatusBadge status={ship.status} />
              <div className="flex items-center gap-2">
                <ChinaTimelineButton scope={{ containerId: ship.id }} variant="outline" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => sync.mutate(ship.id)}
                  disabled={sync.isPending}
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${sync.isPending ? "animate-spin" : ""}`} />
                Atualizar
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Armador" value={ship.carrier_name || ship.carrier_code || "—"} />
              <InfoRow label="BL" value={ship.bl_number || "—"} />
              <InfoRow label="Booking" value={ship.booking_number || "—"} />
              <InfoRow label="Container" value={ship.container_number || "—"} />
              <InfoRow
                label="POL · Origem"
                value={ship.pol_name ? `${ship.pol_name} (${ship.pol_country ?? ""})` : "—"}
                icon={<Anchor className="h-3.5 w-3.5" />}
              />
              <InfoRow
                label="POD · Destino"
                value={ship.pod_name ? `${ship.pod_name} (${ship.pod_country ?? ""})` : "—"}
                icon={<Anchor className="h-3.5 w-3.5" />}
              />
              <InfoRow label="Embarque" value={fmtDate(ship.data_embarque)} icon={<Calendar className="h-3.5 w-3.5" />} />
              <InfoRow label="ETA original" value={fmtDate(ship.eta_original)} icon={<Calendar className="h-3.5 w-3.5" />} />
              <InfoRow label="ETA atual" value={fmtDate(ship.eta_atual)} icon={<Calendar className="h-3.5 w-3.5" />} />
              <InfoRow label="Chegada (ATA)" value={fmtDate(ship.ata)} icon={<Calendar className="h-3.5 w-3.5" />} />
            </div>

            {typeof ship.dias_atraso === "number" && ship.dias_atraso > 0 && (
              <Card className="bg-amber-50 border-amber-300">
                <CardContent className="p-3 flex items-center gap-2 text-sm text-amber-900">
                  <AlertTriangle className="h-4 w-4" />
                  Container atrasado em <strong>{ship.dias_atraso} dia(s)</strong> em relação à ETA original.
                </CardContent>
              </Card>
            )}

            <Tabs defaultValue="timeline">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="rota">Rota</TabsTrigger>
              </TabsList>
              <TabsContent value="timeline" className="mt-3">
                <ContainerTimeline events={data?.events ?? []} />
              </TabsContent>
              <TabsContent value="rota" className="mt-3">
                <ContainerRouteMap geojson={ship.geojson} pol={ship.pol_name} pod={ship.pod_name} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
