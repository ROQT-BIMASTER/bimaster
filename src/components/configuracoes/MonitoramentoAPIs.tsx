import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, Area, AreaChart,
} from "recharts";
import { Activity, TrendingUp, AlertTriangle, Clock, Zap, Server, RefreshCw } from "lucide-react";
import { format, subDays, subHours, startOfDay, startOfHour, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(210, 70%, 55%)",
  "hsl(280, 60%, 55%)",
  "hsl(170, 60%, 45%)",
  "hsl(30, 80%, 55%)",
  "hsl(340, 65%, 50%)",
  "hsl(120, 50%, 45%)",
];

type Period = "24h" | "7d" | "30d" | "90d";

export function MonitoramentoAPIs() {
  const [period, setPeriod] = useState<Period>("7d");

  const dateFrom = useMemo(() => {
    switch (period) {
      case "24h": return subHours(new Date(), 24);
      case "7d": return subDays(new Date(), 7);
      case "30d": return subDays(new Date(), 30);
      case "90d": return subDays(new Date(), 90);
    }
  }, [period]);

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["api-monitoring-logs", period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_security_log")
        .select("*")
        .gte("created_at", dateFrom.toISOString())
        .order("created_at", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });

  // === Métricas calculadas ===
  const totalRequests = logs.length;
  const successCount = logs.filter((l) => l.success).length;
  const errorCount = totalRequests - successCount;
  const successRate = totalRequests > 0 ? ((successCount / totalRequests) * 100).toFixed(1) : "0";
  const avgResponseTime = totalRequests > 0
    ? Math.round(logs.reduce((sum, l) => sum + (l.response_time_ms || 0), 0) / totalRequests)
    : 0;

  // === Requisições por endpoint ===
  const byEndpoint = useMemo(() => {
    const map = new Map<string, { total: number; success: number; errors: number; avgTime: number }>();
    logs.forEach((l) => {
      const key = l.endpoint;
      const existing = map.get(key) || { total: 0, success: 0, errors: 0, avgTime: 0 };
      existing.total++;
      if (l.success) existing.success++;
      else existing.errors++;
      existing.avgTime += l.response_time_ms || 0;
      map.set(key, existing);
    });
    return Array.from(map.entries())
      .map(([endpoint, stats]) => ({
        endpoint: endpoint.length > 30 ? "..." + endpoint.slice(-27) : endpoint,
        fullEndpoint: endpoint,
        total: stats.total,
        success: stats.success,
        errors: stats.errors,
        avgTime: stats.total > 0 ? Math.round(stats.avgTime / stats.total) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);
  }, [logs]);

  // === Requisições por método ===
  const byMethod = useMemo(() => {
    const map = new Map<string, number>();
    logs.forEach((l) => {
      map.set(l.method, (map.get(l.method) || 0) + 1);
    });
    return Array.from(map.entries()).map(([method, count]) => ({ method, count }));
  }, [logs]);

  // === Requisições ao longo do tempo ===
  const timeline = useMemo(() => {
    const map = new Map<string, { date: string; success: number; errors: number }>();
    const granularity = period === "24h" ? "hour" : "day";

    logs.forEach((l) => {
      if (!l.created_at) return;
      const date = parseISO(l.created_at);
      const key = granularity === "hour"
        ? format(startOfHour(date), "HH:mm")
        : format(startOfDay(date), "dd/MM");

      const existing = map.get(key) || { date: key, success: 0, errors: 0 };
      if (l.success) existing.success++;
      else existing.errors++;
      map.set(key, existing);
    });

    return Array.from(map.values());
  }, [logs, period]);

  // === Top erros ===
  const topErrors = useMemo(() => {
    const map = new Map<string, { endpoint: string; count: number; lastError: string }>();
    logs
      .filter((l) => !l.success)
      .forEach((l) => {
        const existing = map.get(l.endpoint) || { endpoint: l.endpoint, count: 0, lastError: "" };
        existing.count++;
        if (l.error_message) existing.lastError = l.error_message;
        map.set(l.endpoint, existing);
      });
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [logs]);

  // === Tempo de resposta por endpoint ===
  const responseTimeByEndpoint = useMemo(() => {
    return byEndpoint
      .filter((e) => e.avgTime > 0)
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10);
  }, [byEndpoint]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border rounded-lg p-3 shadow-lg text-sm">
        <p className="font-medium mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} style={{ color: entry.color }}>
            {entry.name}: <strong>{entry.value}</strong>
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Monitoramento de APIs
          </h3>
          <p className="text-sm text-muted-foreground">
            Análise de uso, desempenho e erros das APIs do sistema
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Últimas 24h</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1">
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Server className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalRequests.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total de requisições</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{successRate}%</p>
                <p className="text-xs text-muted-foreground">Taxa de sucesso</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{errorCount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Erros</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgResponseTime}ms</p>
                <p className="text-xs text-muted-foreground">Tempo médio de resposta</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Carregando dados de monitoramento...
          </CardContent>
        </Card>
      ) : totalRequests === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma requisição registrada no período selecionado.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Timeline Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Requisições ao Longo do Tempo</CardTitle>
              <CardDescription>
                Distribuição de requisições com sucesso e erros por {period === "24h" ? "hora" : "dia"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="success"
                    name="Sucesso"
                    stackId="1"
                    stroke="hsl(var(--success))"
                    fill="hsl(var(--success))"
                    fillOpacity={0.3}
                  />
                  <Area
                    type="monotone"
                    dataKey="errors"
                    name="Erros"
                    stackId="1"
                    stroke="hsl(var(--destructive))"
                    fill="hsl(var(--destructive))"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* By Endpoint */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Requisições por Endpoint</CardTitle>
                <CardDescription>Top 15 endpoints mais utilizados</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={byEndpoint} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis
                      dataKey="endpoint"
                      type="category"
                      width={150}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="success" name="Sucesso" stackId="a" fill="hsl(var(--success))" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="errors" name="Erros" stackId="a" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* By Method + Response Time */}
            <div className="space-y-6">
              {/* By Method Pie */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Distribuição por Método HTTP</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={byMethod}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        dataKey="count"
                        nameKey="method"
                        label={({ method, count }) => `${method} (${count})`}
                      >
                        {byMethod.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Response Time */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Tempo de Resposta por Endpoint
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={responseTimeByEndpoint}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="endpoint"
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
                        angle={-35}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="avgTime" name="Tempo médio (ms)" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Top Errors Table */}
          {topErrors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Endpoints com Mais Erros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topErrors.map((err, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="space-y-1 min-w-0 flex-1">
                        <p className="font-mono text-sm truncate">{err.endpoint}</p>
                        {err.lastError && (
                          <p className="text-xs text-muted-foreground truncate">{err.lastError}</p>
                        )}
                      </div>
                      <Badge variant="destructive" className="ml-3 shrink-0">
                        {err.count} erro{err.count !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
