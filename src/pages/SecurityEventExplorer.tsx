import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, Shield, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EventDetailDrawer } from "@/components/security/EventDetailDrawer";
import { SecurityIncidentPanel } from "@/components/security/SecurityIncidentPanel";

const SecurityEventExplorer = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [tab, setTab] = useState<"events" | "incidents">("events");
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const { data: events, isLoading } = useQuery({
    queryKey: ["security-events", search, severityFilter, page],
    queryFn: async () => {
      let query = supabase
        .from("security_audit_log" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (severityFilter !== "all") {
        query = query.eq("severity", severityFilter);
      }
      if (search) {
        query = query.or(`action.ilike.%${search}%,metadata::text.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 15000,
  });

  const { data: accessEvents } = useQuery({
    queryKey: ["access-events", search, page],
    queryFn: async () => {
      let query = supabase
        .from("access_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (search) {
        query = query.or(`action.ilike.%${search}%,user_id.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: tab === "events",
  });

  const severityColor = (s: string) => {
    switch (s) {
      case "critical": return "bg-destructive text-destructive-foreground";
      case "high": return "bg-warning text-warning-foreground";
      case "medium": return "bg-primary/20 text-primary";
      case "low": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Event Explorer (SIEM)
            </h1>
            <p className="text-sm text-muted-foreground">
              Investigação e correlação de eventos de segurança
            </p>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2">
        <Button variant={tab === "events" ? "default" : "outline"} onClick={() => setTab("events")}>
          Eventos
        </Button>
        <Button variant={tab === "incidents" ? "default" : "outline"} onClick={() => setTab("incidents")}>
          Incidentes
        </Button>
      </div>

      {tab === "incidents" ? (
        <SecurityIncidentPanel />
      ) : (
        <>
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por ação, IP, usuário..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                    className="pl-9"
                  />
                </div>
                <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setPage(0); }}>
                  <SelectTrigger className="w-[160px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Severidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="critical">Crítica</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="low">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Security Audit Events */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Security Audit Log</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Severidade</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : events && events.length > 0 ? (
                    events.map((event: any) => (
                      <TableRow
                        key={event.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedEvent(event)}
                      >
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(event.created_at).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{event.action}</TableCell>
                        <TableCell>
                          <Badge className={severityColor(event.severity)}>{event.severity}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate text-xs text-muted-foreground">
                          {event.metadata ? JSON.stringify(event.metadata).slice(0, 80) : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum evento encontrado</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="flex justify-between items-center mt-4">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">Página {page + 1}</span>
                <Button variant="outline" size="sm" disabled={!events || events.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>
                  Próxima
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Access Audit Events */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Access Audit Log</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Sucesso</TableHead>
                    <TableHead>User ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accessEvents && accessEvents.length > 0 ? (
                    accessEvents.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(event.created_at!).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{event.action}</TableCell>
                        <TableCell>
                          <Badge className={event.success ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}>
                            {event.success ? "Sim" : "Não"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {event.user_id ? event.user_id.slice(0, 8) + "..." : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum evento</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <EventDetailDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
};

export default SecurityEventExplorer;
