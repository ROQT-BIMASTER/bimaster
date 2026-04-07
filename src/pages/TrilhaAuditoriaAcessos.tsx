import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangeFilter, filterByDateRange } from "@/components/shared/DateRangeFilter";
import { Footprints, Search, AlertTriangle, ChevronDown, ChevronRight, Monitor } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AccessLog {
  id: string;
  user_id: string | null;
  tela_codigo: string | null;
  modulo_codigo: string | null;
  action: string;
  success: boolean;
  ip_address: unknown;
  user_agent: string | null;
  created_at: string | null;
  user_name?: string;
}

interface MultiIpUser {
  user_id: string;
  user_name: string;
  ip_count: number;
  ips: { ip: string; last_seen: string; user_agent: string | null }[];
  last_access: string;
}

export default function TrilhaAuditoriaAcessos() {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Footprints className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">Trilha de Auditoria de Acessos</h1>
          <p className="text-sm text-muted-foreground">Rastreamento completo de acessos e detecção de múltiplos IPs</p>
        </div>
      </div>

      <Tabs defaultValue="trilha">
        <TabsList>
          <TabsTrigger value="trilha"><Footprints className="h-4 w-4 mr-1.5" />Trilha Completa</TabsTrigger>
          <TabsTrigger value="multi-ip"><Monitor className="h-4 w-4 mr-1.5" />Múltiplos IPs</TabsTrigger>
        </TabsList>
        <TabsContent value="trilha"><TrilhaCompleta /></TabsContent>
        <TabsContent value="multi-ip"><MultiplosIPs /></TabsContent>
      </Tabs>
    </div>
  );
}

function TrilhaCompleta() {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [page, setPage] = useState(0);
  const pageSize = 30;

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-trail-logs"],
    queryFn: async () => {
      const { data: accessLogs, error } = await supabase
        .from("access_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;

      const userIds = [...new Set((accessLogs || []).map(l => l.user_id).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
        .select("id, nome")
        .in("id", userIds as string[]);
      profileMap = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p.nome || "—" }), {} as Record<string, string>);
      }

      return (accessLogs || []).map(l => ({
        ...l,
        user_name: l.user_id ? (profileMap[l.user_id] || "Desconhecido") : "—",
      })) as AccessLog[];
    },
  });

  const filtered = useMemo(() => {
    let items = filterByDateRange(logs, "created_at", dateFrom, dateTo);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(l =>
        (l.user_name || "").toLowerCase().includes(q) ||
        (l.tela_codigo || "").toLowerCase().includes(q) ||
        (l.modulo_codigo || "").toLowerCase().includes(q) ||
        (l.action || "").toLowerCase().includes(q) ||
        String(l.ip_address || "").toLowerCase().includes(q)
      );
    }
    return items;
  }, [logs, search, dateFrom, dateTo]);

  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm">{filtered.length.toLocaleString("pt-BR")} registros</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo} />
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar usuário, tela, IP..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9 w-[220px] text-sm" />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-auto">
        <div className="max-h-[500px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Tela</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>User-Agent</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : paged.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado.</TableCell></TableRow>
              ) : paged.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm font-medium">{log.user_name}</TableCell>
                  <TableCell className="text-sm">{log.action}</TableCell>
                  <TableCell className="text-sm">{log.tela_codigo || "—"}</TableCell>
                  <TableCell className="text-sm">{log.modulo_codigo || "—"}</TableCell>
                  <TableCell className="text-sm font-mono text-xs">{String(log.ip_address || "—")}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate text-muted-foreground" title={log.user_agent || ""}>{log.user_agent || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{log.created_at ? format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }) : "—"}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={log.success ? "default" : "destructive"} className="text-[10px]">{log.success ? "OK" : "Falha"}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <span>Página {page + 1} de {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Próxima</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MultiplosIPs() {
  const [periodo, setPeriodo] = useState("30");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: multiIpUsers = [], isLoading } = useQuery({
    queryKey: ["multi-ip-users", periodo],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - Number(periodo));

      const { data: logs, error } = await supabase
        .from("access_audit_log")
        .select("user_id, ip_address, user_agent, created_at")
        .gte("created_at", since.toISOString())
        .not("user_id", "is", null)
        .not("ip_address", "is", null)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;

      // Group by user
      const userMap: Record<string, { ips: Map<string, { last_seen: string; user_agent: string | null }>; last_access: string }> = {};
      for (const l of logs || []) {
        if (!l.user_id) continue;
        const ip = String(l.ip_address);
        if (!userMap[l.user_id]) {
          userMap[l.user_id] = { ips: new Map(), last_access: l.created_at || "" };
        }
        const entry = userMap[l.user_id];
        if (!entry.ips.has(ip)) {
          entry.ips.set(ip, { last_seen: l.created_at || "", user_agent: l.user_agent });
        }
      }

      // Filter users with 2+ IPs
      const multiIpUserIds = Object.entries(userMap).filter(([, v]) => v.ips.size > 1);
      if (multiIpUserIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", multiIpUserIds.map(([id]) => id));
      const profileMap = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p.nome || "Desconhecido" }), {} as Record<string, string>);

      return multiIpUserIds
        .map(([userId, data]) => ({
          user_id: userId,
          user_name: profileMap[userId] || "Desconhecido",
          ip_count: data.ips.size,
          ips: Array.from(data.ips.entries()).map(([ip, info]) => ({ ip, ...info })),
          last_access: data.last_access,
        }))
        .sort((a, b) => b.ip_count - a.ip_count) as MultiIpUser[];
    },
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Usuários com Múltiplos IPs ({multiIpUsers.length})
          </CardTitle>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead className="text-center">IPs Distintos</TableHead>
              <TableHead>Último Acesso</TableHead>
              <TableHead className="text-center">Risco</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : multiIpUsers.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum usuário com múltiplos IPs no período.</TableCell></TableRow>
            ) : multiIpUsers.map(user => (
              <>
                <TableRow key={user.user_id} className="cursor-pointer hover:bg-muted/50" onClick={() => setExpanded(expanded === user.user_id ? null : user.user_id)}>
                  <TableCell>
                    {expanded === user.user_id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </TableCell>
                  <TableCell className="font-medium text-sm">{user.user_name}</TableCell>
                  <TableCell className="text-center text-sm font-mono">{user.ip_count}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(user.last_access), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                  <TableCell className="text-center">
                    {user.ip_count >= 5 ? (
                      <Badge variant="destructive" className="text-[10px] gap-1"><AlertTriangle className="h-3 w-3" />Alto</Badge>
                    ) : user.ip_count >= 3 ? (
                      <Badge variant="secondary" className="text-[10px]">Médio</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Baixo</Badge>
                    )}
                  </TableCell>
                </TableRow>
                {expanded === user.user_id && (
                  <TableRow key={`${user.user_id}-detail`}>
                    <TableCell colSpan={5} className="bg-muted/30 p-3">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">IPs utilizados:</p>
                        {user.ips.map((ipInfo, idx) => (
                          <div key={idx} className="flex items-center gap-4 text-xs py-1 border-b border-border/50 last:border-0">
                            <span className="font-mono text-foreground min-w-[120px]">{ipInfo.ip}</span>
                            <span className="text-muted-foreground">Último uso: {format(new Date(ipInfo.last_seen), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                            <span className="text-muted-foreground truncate max-w-[300px]" title={ipInfo.user_agent || ""}>{ipInfo.user_agent || "—"}</span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
