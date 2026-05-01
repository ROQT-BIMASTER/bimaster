import { ScrollArea } from "@/components/ui/scroll-area";
import { Ship, MapPin, Anchor, Clock } from "lucide-react";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ShipsgoShipmentEvent } from "@/hooks/useShipsgoShipments";

function fmtTs(ts: string) {
  try {
    return format(new Date(ts), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return ts;
  }
}

export function ContainerTimeline({ events }: { events: ShipsgoShipmentEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Nenhum evento registrado ainda.
      </div>
    );
  }
  return (
    <ScrollArea className="h-[420px] pr-3">
      <ol className="relative border-l border-border ml-3 space-y-4">
        {events.map((e) => (
          <li key={e.id} className="ml-4">
            <span className="absolute -left-[7px] mt-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary ring-4 ring-background">
              <Ship className="h-2.5 w-2.5 text-primary-foreground" />
            </span>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2 text-sm font-medium">
                {e.description ?? e.event_type ?? "Evento"}
                {!e.is_actual && (
                  <span className="text-[10px] uppercase text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    estimado
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {fmtTs(e.event_at)}
                </span>
                {e.location_name && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {e.location_name}
                  </span>
                )}
                {e.vessel_name && (
                  <span className="inline-flex items-center gap-1">
                    <Anchor className="h-3 w-3" /> {e.vessel_name}
                    {e.voyage_number ? ` · ${e.voyage_number}` : ""}
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </ScrollArea>
  );
}

// re-export para evitar warning de import não usado
export { parseLocalDate };
