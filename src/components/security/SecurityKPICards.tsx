import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/ui/kpi-card";
import { ShieldAlert, ShieldCheck, Ban, Activity, AlertTriangle } from "lucide-react";

export function SecurityKPICards() {
  const { data, isLoading } = useQuery({
    queryKey: ["security-dashboard-kpis"],
    queryFn: async () => {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [failedLogins, blockedRequests, criticalEvents, totalEvents7d, openIncidents] = await Promise.all([
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
      ]);

      return {
        failedLogins: failedLogins.count ?? 0,
        blockedRequests: blockedRequests.count ?? 0,
        criticalEvents: criticalEvents.count ?? 0,
        totalEvents7d: totalEvents7d.count ?? 0,
        openIncidents: openIncidents.count ?? 0,
      };
    },
    refetchInterval: 30000,
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <KpiCard
        title="Logins Falhados (24h)"
        value={data?.failedLogins ?? 0}
        icon={ShieldAlert}
        variant={(data?.failedLogins ?? 0) > 5 ? "destructive" : "success"}
        loading={isLoading}
      />
      <KpiCard
        title="IPs em Rate Limit"
        value={data?.blockedRequests ?? 0}
        icon={Ban}
        variant={(data?.blockedRequests ?? 0) > 0 ? "warning" : "success"}
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
        title="Total Eventos (7d)"
        value={data?.totalEvents7d ?? 0}
        icon={Activity}
        variant="info"
        loading={isLoading}
      />
    </div>
  );
}
