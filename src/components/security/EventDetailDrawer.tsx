import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface EventDetailDrawerProps {
  event: any;
  onClose: () => void;
}

export function EventDetailDrawer({ event, onClose }: EventDetailDrawerProps) {
  if (!event) return null;

  const severityColor = (s: string) => {
    switch (s) {
      case "critical": return "bg-destructive text-destructive-foreground";
      case "high": return "bg-warning text-warning-foreground";
      case "medium": return "bg-primary/20 text-primary";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Sheet open={!!event} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Detalhes do Evento
            {event.severity && (
              <Badge className={severityColor(event.severity)}>{event.severity}</Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Ação</p>
            <p className="font-mono text-sm">{event.action}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground">Data/Hora</p>
            <p className="text-sm">{new Date(event.created_at).toLocaleString("pt-BR")}</p>
          </div>

          {event.user_id && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">User ID</p>
              <p className="font-mono text-xs break-all">{event.user_id}</p>
            </div>
          )}

          {event.ip_address && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">IP Address</p>
              <p className="font-mono text-sm">{String(event.ip_address)}</p>
            </div>
          )}

          {event.user_agent && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">User Agent</p>
              <p className="text-xs text-muted-foreground break-all">{event.user_agent}</p>
            </div>
          )}

          <Separator />

          {event.metadata && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Metadata</p>
              <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-[300px]">
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            </div>
          )}

          {event.old_data && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Dados Anteriores</p>
              <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-[200px]">
                {JSON.stringify(event.old_data, null, 2)}
              </pre>
            </div>
          )}

          {event.new_data && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Dados Novos</p>
              <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-[200px]">
                {JSON.stringify(event.new_data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
