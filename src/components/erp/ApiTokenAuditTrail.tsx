import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KpiCard } from "@/components/ui/kpi-card";
import { DateRangeFilter, filterByDateRange } from "@/components/shared/DateRangeFilter";
import { RefreshCw, Shield, AlertTriangle, Activity, Globe, Search, ChevronLeft, ChevronRight, ShieldAlert } from "lucide-react";
import { format, subHours, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface AuditLog {
  id: string;
  endpoint: string;
  method: string;
  ip_address: string;
  user_agent: string | null;
  api_key_used: boolean;
  user_id: string | null;
  success: boolean;
  error_message: string | null;
  key_preview: string | null;
  response_time_ms: number | null;
  created_at: string;
}

const PAGE_SIZE = 50;

export default function ApiTokenAuditTrail() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [searchEndpoint, setSearchEndpoint] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterToken, setFilterToken] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const fetchLogs = async (pageNum = 0) => {
    setLoading(true);
    let query = supabase
      .from("api_security_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

    if (filterStatus === "success") query = query.eq("success", true);
    if (filterStatus === "error") query = query.eq("success", false);
    if (searchEndpoint) query = query.ilike("endpoint", `%${searchEndpoint}%`);
    if (filterToken !== "all") query = query.eq("key_preview", filterToken);
    if (dateFrom) query = query.gte("created_at", dateFrom.toISOString());
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      query = query.lte("created_at", end.toISOString());
    }

    const { data, count, error } = await query;
    if (!error && data) {
      setLogs(data as AuditLog[]);
      setTotalCount(count || 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs(page);
  }, [page, filterStatus, filterToken, searchEndpoint, dateFrom, dateTo]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => fetchLogs(page), 30000);
    return () => clearInterval(interval);
  }, [page, filterStatus, filterToken, searchEndpoint, dateFrom, dateTo]);

  // Unique tokens for filter
  const uniqueTokens = useMemo(() => {
    const tokens = new Set(logs.map(l => l.key_preview).filter(Boolean));
    return Array.from(tokens) as string[];
  }, [logs]);

  // KPIs (from current page data — for real stats we'd need a separate query)
  const last24h = useMemo(() => {
    const cutoff = subHours(new Date(), 24);
    return logs.filter(l => new Date(l.created_at) >= cutoff);
  }, [logs]);

  const totalCalls = totalCount;
  const errorCount = logs.filter(l => !l.success).length;
  const uniqueIps = new Set(logs.map(l => l.ip_address)).size;
  const activeTokens = new Set(logs.filter(l => l.success && l.key_preview).map(l => l.key_preview)).size;

  // Anomaly detection: multiple IPs per token
  const tokenIpMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    logs.forEach(l => {
      if (l.key_preview) {
        if (!map.has(l.key_preview)) map.set(l.key_preview, new Set());
        map.get(l.key_preview)!.add(l.ip_address);
      }
    });
    return map;
  }, [logs]);

  // Brute force detection: IPs with 50+ failed unauthenticated attempts in last hour
  const bruteForceIps = useMemo(() => {
    const oneHourAgo = subHours(new Date(), 1);
    const ipFailCount = new Map<string, number>();
    logs.forEach(l => {
      if (!l.success && !l.api_key_used && !l.key_preview && new Date(l.created_at) >= oneHourAgo) {
        ipFailCount.set(l.ip_address, (ipFailCount.get(l.ip_address) || 0) + 1);
      }
    });
    const suspicious = new Map<string, number>();
    ipFailCount.forEach((count, ip) => {
      if (count >= 50) suspicious.set(ip, count);
    });
    return suspicious;
  }, [logs]);

  // Hourly chart data
  const hourlyData = useMemo(() => {
    const hours: Record<string, { hour: string; total: number; errors: number }> = {};
    for (let i = 23; i >= 0; i--) {
      const h = subHours(new Date(), i);
      const key = format(h, "HH:00");
      hours[key] = { hour: key, total: 0, errors: 0 };
    }
    logs.forEach(l => {
      const key = format(new Date(l.created_at), "HH:00");
      if (hours[key]) {
        hours[key].total++;
        if (!l.success) hours[key].errors++;
      }
    });
    return Object.values(hours);
  }, [logs]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const methodColor = (m: string) => {
    switch (m) {
      case "GET": return "bg-primary/15 text-primary border-primary/30";
      case "POST": return "bg-success/15 text-success border-success/30";
      case "PUT": return "bg-warning/15 text-warning border-warning/30";
      case "DELETE": return "bg-destructive/15 text-destructive border-destructive/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total de Chamadas" value={totalCalls.toLocaleString()} icon={Activity} variant="info" />
        <KpiCard title="Tokens Ativos" value={activeTokens} icon={Shield} variant="success" />
        <KpiCard title="Erros" value={errorCount} icon={AlertTriangle} variant={errorCount > 0 ? "destructive" : "default"} />
        <KpiCard title="IPs Unicos" value={uniqueIps} icon={Globe} variant="default" />
      </div>

      {/* Brute Force Alert */}
      {bruteForceIps.size > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-destructive">
                  ⚠️ Possível ataque de força bruta detectado
                </p>
                <p className="text-xs text-muted-foreground">
                  {bruteForceIps.size === 1 ? "O IP abaixo" : `${bruteForceIps.size} IPs`} realizou mais de 50 tentativas sem autenticação na última hora:
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {Array.from(bruteForceIps.entries()).map(([ip, count]) => (
                    <Badge key={ip} variant="destructive" className="font-mono text-xs gap-1.5">
                      {ip} — {count} tentativas
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hourly Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Volume de Chamadas por Hora</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                  labelFormatter={(v) => `Hora: ${v}`}
                />
                <Bar dataKey="total" name="Total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="errors" name="Erros" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base">Trilha de Auditoria</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => fetchLogs(page)} disabled={loading} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filtrar endpoint..."
                value={searchEndpoint}
                onChange={(e) => { setSearchEndpoint(e.target.value); setPage(0); }}
                className="h-9 w-48 pl-8 text-xs"
              />
            </div>
            <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(0); }}>
              <SelectTrigger className="h-9 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="success">Sucesso</SelectItem>
                <SelectItem value="error">Erros</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterToken} onValueChange={(v) => { setFilterToken(v); setPage(0); }}>
              <SelectTrigger className="h-9 w-44 text-xs">
                <SelectValue placeholder="Token" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tokens</SelectItem>
                {uniqueTokens.map(t => (
                  <SelectItem key={t} value={t} className="font-mono text-xs">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={(d) => { setDateFrom(d); setPage(0); }} onDateToChange={(d) => { setDateTo(d); setPage(0); }} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Data/Hora</TableHead>
                  <TableHead className="text-xs">Token</TableHead>
                  <TableHead className="text-xs">Endpoint</TableHead>
                  <TableHead className="text-xs">Metodo</TableHead>
                  <TableHead className="text-xs">IP</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Tempo</TableHead>
                  <TableHead className="text-xs">Alerta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                      {loading ? "Carregando..." : "Nenhum registro de auditoria encontrado."}
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => {
                    const multiIp = log.key_preview && tokenIpMap.get(log.key_preview)?.size! > 1;
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.key_preview || (log.user_id ? "JWT" : "-")}
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate" title={log.endpoint}>
                          {log.endpoint}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${methodColor(log.method)}`}>
                            {log.method}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{log.ip_address}</TableCell>
                        <TableCell>
                          {log.success ? (
                            <Badge className="bg-success/15 text-success border-success/30 text-xs">OK</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">{log.error_message?.substring(0, 20) || "Erro"}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {log.response_time_ms ? `${log.response_time_ms}ms` : "-"}
                        </TableCell>
                        <TableCell>
                          {multiIp && (
                            <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30 text-xs gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Multi-IP
                            </Badge>
                          )}
                          {!log.success && (
                            <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30 text-xs gap-1 ml-1">
                              Falha
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                {totalCount} registro(s) - Pagina {page + 1} de {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="gap-1">
                  <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="gap-1">
                  Proxima <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
