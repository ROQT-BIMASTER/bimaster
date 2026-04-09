import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Shield, ShieldAlert, Globe, Activity, AlertTriangle, Network, Ban } from "lucide-react";
import { chartColors } from "@/lib/chart-colors";
import { format, subHours, startOfHour } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import SecuritySentinelPanel from "./SecuritySentinelPanel";

interface SubnetEntry {
  prefix: string;
  uniqueIps: number;
  totalFailed: number;
  totalRequests: number;
  endpoints: number;
  ips: string[];
}

export default function ApiSecurityDashboard() {
  const since24h = useMemo(() => subHours(new Date(), 24).toISOString(), []);
  const [blockingSubnet, setBlockingSubnet] = useState<string | null>(null);

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

  // --- Subnet detection ---
  const suspectSubnets = useMemo<SubnetEntry[]>(() => {
    const map = new Map<string, { ips: Set<string>; failed: number; total: number; endpoints: Set<string>; ipList: string[] }>();
    logs.forEach((l) => {
      const ip = String(l.ip_address || "");
      const parts = ip.split(".");
      if (parts.length !== 4) return;
      const prefix = `${parts[0]}.${parts[1]}`;
      if (!map.has(prefix)) map.set(prefix, { ips: new Set(), failed: 0, total: 0, endpoints: new Set(), ipList: [] });
      const entry = map.get(prefix)!;
      if (!entry.ips.has(ip)) {
        entry.ips.add(ip);
        entry.ipList.push(ip);
      }
      entry.total++;
      if (!l.success) entry.failed++;
      entry.endpoints.add(l.endpoint);
    });
    return Array.from(map.entries())
      .filter(([, v]) => v.ips.size >= 3 && v.failed >= 5)
      .map(([prefix, v]) => ({
        prefix: `${prefix}.x.x`,
        uniqueIps: v.ips.size,
        totalFailed: v.failed,
        totalRequests: v.total,
        endpoints: v.endpoints.size,
        ips: v.ipList,
      }))
      .sort((a, b) => b.totalFailed - a.totalFailed);
  }, [logs]);

  const distributedAttack = suspectSubnets.filter(s => s.uniqueIps >= 5 && s.totalFailed >= 10);

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

  const handleBlockSubnet = async (subnet: SubnetEntry) => {
    setBlockingSubnet(subnet.prefix);
    try {
      let count = 0;
      for (const ip of subnet.ips) {
        const { error } = await supabase.from("security_ip_blocklist").upsert(
          {
            ip_address: ip,
            reason: `Manual Subnet Block [${subnet.prefix}]: ${subnet.uniqueIps} IPs, ${subnet.totalFailed} falhas`,
            blocked_by: "admin_manual",
            block_level: "soft",
            is_active: true,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
          { onConflict: "ip_address" }
        );
        if (!error) count++;
      }
      toast.success(`Subnet ${subnet.prefix} bloqueado`, {
        description: `${count} IPs adicionados ao blocklist por 24h.`,
      });
    } catch (err: any) {
      toast.error("Erro ao bloquear subnet", { description: err.message });
    } finally {
      setBlockingSubnet(null);
    }
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
      {/* Distributed Attack Alert */}
      {distributedAttack.length > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <Network className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div className="flex-1">
                <h4 className="text-sm font-bold text-destructive mb-1">
                  ⚠️ Ataque Distribuído Detectado
                </h4>
                <p className="text-sm text-muted-foreground mb-2">
                  {distributedAttack.length} subnet(s) com padrão de varredura coordenada detectado nas últimas 24h.
                  Múltiplos IPs do mesmo bloco realizando tentativas de acesso simultâneas.
                </p>
                <div className="flex flex-wrap gap-2">
                  {distributedAttack.map((s) => (
                    <Badge key={s.prefix} variant="destructive" className="gap-1 text-xs">
                      <Network className="h-3 w-3" />
                      {s.prefix}: {s.uniqueIps} IPs, {s.totalFailed} falhas
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Suspect Subnets */}
      {suspectSubnets.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Network className="h-4 w-4" />
              Subnets Suspeitos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subnet</TableHead>
                    <TableHead className="text-right">IPs Únicos</TableHead>
                    <TableHead className="text-right">Falhas</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Endpoints</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suspectSubnets.map((s) => {
                    const isDangerous = s.uniqueIps >= 5 && s.totalFailed >= 10;
                    return (
                      <TableRow key={s.prefix}>
                        <TableCell className="font-mono text-xs">{s.prefix}</TableCell>
                        <TableCell className="text-right">{s.uniqueIps}</TableCell>
                        <TableCell className="text-right text-destructive font-semibold">{s.totalFailed}</TableCell>
                        <TableCell className="text-right">{s.totalRequests}</TableCell>
                        <TableCell className="text-right">{s.endpoints}</TableCell>
                        <TableCell>
                          {isDangerous ? (
                            <Badge variant="destructive" className="gap-1 text-xs">
                              <AlertTriangle className="h-3 w-3" /> Ataque
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-xs">Suspeito</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {isDangerous && (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="gap-1 text-xs h-7"
                              disabled={blockingSubnet === s.prefix}
                              onClick={() => handleBlockSubnet(s)}
                            >
                              <Ban className="h-3 w-3" />
                              {blockingSubnet === s.prefix ? "Bloqueando..." : "Bloquear"}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

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
