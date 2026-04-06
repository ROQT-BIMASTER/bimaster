import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, AlertTriangle, ShieldAlert, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const severityConfig: Record<string, { color: string; icon: typeof Info }> = {
  critical: { color: "destructive", icon: ShieldAlert },
  high: { color: "destructive", icon: AlertTriangle },
  medium: { color: "default", icon: Info },
  low: { color: "secondary", icon: Info },
};

export function SecurityActivityFeed() {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["security-activity-feed"],
    queryFn: async () => {
      const { data } = await supabase
        .from("security_audit_log" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      return (data as any[]) ?? [];
    },
    refetchInterval: 30000,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Atividades Recentes de Segurança
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
          ) : (
            <div className="space-y-3">
              {events.map((event: any) => {
                const config = severityConfig[event.severity] ?? severityConfig.low;
                const Icon = config.icon;
                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <Icon className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">
                          {event.action === "project_access_denied" || event.action === "project_access_denied_client"
                            ? "🚫 Acesso negado a projeto"
                            : event.action}
                        </span>
                        <Badge variant={config.color as any} className="text-[10px] px-1.5 py-0">
                          {event.severity}
                        </Badge>
                      </div>
                      {(event.action === "project_access_denied" || event.action === "project_access_denied_client") && event.metadata?.projeto_id && (
                        <p className="text-xs text-destructive mt-0.5">
                          Projeto: {String(event.metadata.projeto_id).slice(0, 8)}…
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(event.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
