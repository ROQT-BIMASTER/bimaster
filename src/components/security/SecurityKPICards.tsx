import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/ui/kpi-card";
import { ShieldAlert, ShieldCheck, Ban, Activity, AlertTriangle, Clock, Globe } from "lucide-react";

export function SecurityKPICards() {
  const { data, isLoading } = useQuery({
    queryKey: ["security-dashboard-kpis"],
    queryFn: async () => {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [failedLogins, blockedRequests, criticalEvents, totalEvents7d, openIncidents, resolvedIncidents, topIps] = await Promise.all([
        supabase
          .from("access_audit_log")
          .select("*", { count: "exact", head: true })
          .eq("action", "login_failed")
          .gte("created_at", last24h),
        supabase
          .from("api_rate_limit")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("security_audit_log" as any)
          .select("*", { count: "exact", head: true })
          .eq("severity", "critical")
          .gte("created_at", last24h),
        supabase
          .from("security_audit_log" as any)
          .select("*", { count: "exact", head: true })
          .gte("created_at", last7d),
        supabase
          .from("security_incidents")
          .select("*", { count: "exact", head: true })
          .in("status", ["open", "investigating"]),
        supabase
          .from("security_incidents")
          .select("created_at, resolved_at")
          .eq("status", "resolved")
          .not("resolved_at", "is", null)
          .gte("created_at", last7d)
          .limit(100),
        supabase
          .from("security_incidents")
          .select("source_ip")
          .not("source_ip", "is", null)
          .gte("created_at", last7d)
          .limit(500),
      ]);

      // Calculate MTTR (Mean Time To Resolve) in hours
      let mttrHours = 0;
      if (resolvedIncidents.data && resolvedIncidents.data.length > 0) {
        const totalMs = resolvedIncidents.data.reduce((sum, inc) => {
          const created = new Date(inc.created_at).getTime();
          const resolved = new Date(inc.resolved_at!).getTime();
          return sum + (resolved - created);
        }, 0);
        mttrHours = Math.round(totalMs / resolvedIncidents.data.length / (1000 * 60 * 60) * 10) / 10;
      }

      // Top suspicious IPs
      const ipCounts: Record<string, number> = {};
      if (topIps.data) {
        for (const row of topIps.data) {
          const ip = String(row.source_ip);
          ipCounts[ip] = (ipCounts[ip] || 0) + 1;
        }
      }
      const topSuspiciousIps = Object.entries(ipCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      return {
        failedLogins: failedLogins.count ?? 0,
        blockedRequests: blockedRequests.count ?? 0,
        criticalEvents: criticalEvents.count ?? 0,
        totalEvents7d: totalEvents7d.count ?? 0,
        openIncidents: openIncidents.count ?? 0,
        mttrHours,
        topSuspiciousIps,
      };
    },
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Logins Falhados (24h)"
          value={data?.failedLogins ?? 0}
          icon={ShieldAlert}
          variant={(data?.failedLogins ?? 0) > 5 ? "destructive" : "success"}
          loading={isLoading}
        />
        <KpiCard
          title="Eventos Críticos (24h)"
          value={data?.criticalEvents ?? 0}
          icon={ShieldCheck}
          variant={(data?.criticalEvents ?? 0) > 0 ? "destructive" : "success"}
          loading={isLoading}
        />
        <KpiCard
          title="Incidentes Abertos"
          value={data?.openIncidents ?? 0}
          icon={AlertTriangle}
          variant={(data?.openIncidents ?? 0) > 0 ? "warning" : "success"}
          loading={isLoading}
        />
        <KpiCard
          title="MTTR (horas)"
          value={data?.mttrHours ?? "—"}
          icon={Clock}
          variant="info"
          loading={isLoading}
        />
      </div>

      {/* Top Suspicious IPs */}
      {data?.topSuspiciousIps && data.topSuspiciousIps.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Globe className="h-3 w-3" /> Top IPs Suspeitos (7d)
          </p>
          <div className="flex flex-wrap gap-2">
            {data.topSuspiciousIps.map(([ip, count]) => (
              <span key={ip} className="text-xs font-mono bg-destructive/10 text-destructive px-2 py-1 rounded">
                {ip} ({count})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
