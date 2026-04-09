import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Shield, ShieldAlert, Globe, Activity, AlertTriangle } from "lucide-react";
import { chartColors } from "@/lib/chart-colors";
import { format, subHours, startOfHour } from "date-fns";
import { ptBR } from "date-fns/locale";
import SecuritySentinelPanel from "./SecuritySentinelPanel";

export default function ApiSecurityDashboard() {
  const since24h = useMemo(() => subHours(new Date(), 24).toISOString(), []);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["api-security-logs-24h"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_security_log")
        .select("*")
        .gte("created_at", since24h)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60_000,
  });

  // --- KPIs ---
  const total = logs.length;
  const blocked = logs.filter((l) => !l.success).length;
  const authorized = total - blocked;
  const blockRate = total > 0 ? ((blocked / total) * 100).toFixed(1) : "0";
  const uniqueIps = new Set(logs.map((l) => String(l.ip_address))).size;

  // --- Chart data: hourly buckets ---
  const hourlyData = useMemo(() => {
    const buckets = new Map<string, { hour: string; authorized: number; blocked: number }>();
    for (let i = 23; i >= 0; i--) {
      const h = startOfHour(subHours(new Date(), i));
      const key = h.toISOString();
      buckets.set(key, { hour: format(h, "HH:mm"), authorized: 0, blocked: 0 });
    }
    logs.forEach((l) => {
      const h = startOfHour(new Date(l.created_at!)).toISOString();
      const bucket = buckets.get(h);
      if (bucket) {
        if (l.success) bucket.authorized++;
        else bucket.blocked++;
      }
    });
    return Array.from(buckets.values());
  }, [logs]);

  // --- Top IPs ---
  const topIps = useMemo(() => {
    const map = new Map<string, { ip: string; total: number; blocked: number; authorized: number; keys: Set<string> }>();
    logs.forEach((l) => {
      const ip = String(l.ip_address);
      if (!map.has(ip)) map.set(ip, { ip, total: 0, blocked: 0, authorized: 0, keys: new Set() });
      const entry = map.get(ip)!;
      entry.total++;
      if (l.success) entry.authorized++;
      else entry.blocked++;
      if (l.key_preview) entry.keys.add(l.key_preview);
    });
    return Array.from(map.values())
      .sort((a, b) => b.blocked - a.blocked)
      .slice(0, 10);
  }, [logs]);

  // --- Top Endpoints ---
  const topEndpoints = useMemo(() => {
    const map = new Map<string, { endpoint: string; total: number; blocked: number; authorized: number }>();
    logs.forEach((l) => {
      const ep = l.endpoint;
      if (!map.has(ep)) map.set(ep, { endpoint: ep, total: 0, blocked: 0, authorized: 0 });
      const entry = map.get(ep)!;
      entry.total++;
      if (l.success) entry.authorized++;
      else entry.blocked++;
    });
    return Array.from(map.values())
      .sort((a, b) => b.blocked - a.blocked)
      .slice(0, 10);
  }, [logs]);

  const getIpStatus = (entry: { blocked: number; total: number }) => {
    const rate = entry.total > 0 ? entry.blocked / entry.total : 0;
    if (entry.blocked >= 50) return <Badge variant="destructive">Bloqueado</Badge>;
    if (rate > 0.5 || entry.blocked >= 10) return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">Suspeito</Badge>;
    return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Normal</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Activity className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Activity className="h-4 w-4" />
              Total 24h
            </div>
            <p className="text-2xl font-bold">{total.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              Bloqueadas
            </div>
            <p className="text-2xl font-bold text-destructive">{blocked.toLocaleString()} <span className="text-sm font-normal">({blockRate}%)</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Shield className="h-4 w-4 text-emerald-600" />
              Autorizadas
            </div>
            <p className="text-2xl font-bold text-emerald-600">{authorized.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Globe className="h-4 w-4" />
              IPs Únicos
            </div>
            <p className="text-2xl font-bold">{uniqueIps}</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Tentativas por Hora (24h)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData} barGap={0}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="hour" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--popover-foreground))" }}
                />
                <Legend />
                <Bar dataKey="authorized" name="Autorizadas" fill={chartColors.success} stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="blocked" name="Bloqueadas" fill={chartColors.destructive} stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tables */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Top IPs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Top 10 IPs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Bloq.</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topIps.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sem dados</TableCell></TableRow>
                  ) : topIps.map((ip) => (
                    <TableRow key={ip.ip}>
                      <TableCell className="font-mono text-xs">{ip.ip}</TableCell>
                      <TableCell className="text-right">{ip.total}</TableCell>
                      <TableCell className="text-right text-destructive">{ip.blocked}</TableCell>
                      <TableCell>{getIpStatus(ip)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Top Endpoints */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Top 10 Endpoints
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Endpoint</TableHead>
                    <TableHead className="text-right">OK</TableHead>
                    <TableHead className="text-right">Bloq.</TableHead>
                    <TableHead className="text-right">Taxa Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topEndpoints.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sem dados</TableCell></TableRow>
                  ) : topEndpoints.map((ep) => (
                    <TableRow key={ep.endpoint}>
                      <TableCell className="font-mono text-xs max-w-[200px] truncate">{ep.endpoint}</TableCell>
                      <TableCell className="text-right text-emerald-600">{ep.authorized}</TableCell>
                      <TableCell className="text-right text-destructive">{ep.blocked}</TableCell>
                      <TableCell className="text-right">
                        {ep.total > 0 ? ((ep.blocked / ep.total) * 100).toFixed(1) : "0"}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sentinel Panel */}
      <SecuritySentinelPanel />
    </div>
  );
}
