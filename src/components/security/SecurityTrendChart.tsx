import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChartContainer } from "@/components/ui/chart-container";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ShieldCheck } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export function SecurityTrendChart() {
  const { data: chartData = [] } = useQuery({
    queryKey: ["security-trend-7d"],
    queryFn: async () => {
      const days: { date: string; label: string; critical: number; high: number; medium: number; low: number }[] = [];
      const now = new Date();

      for (let i = 6; i >= 0; i--) {
        const day = subDays(now, i);
        const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).toISOString();
        const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).toISOString();

        days.push({
          date: dayStart,
          label: format(day, "EEE dd", { locale: ptBR }),
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        });
      }

      const sevenDaysAgo = subDays(now, 7).toISOString();
      const { data: events } = await supabase
        .from("security_audit_log" as any)
        .select("severity, created_at")
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: true });

      if (events) {
        for (const ev of events as any[]) {
          const evDate = new Date(ev.created_at);
          const dayIndex = days.findIndex((d) => {
            const dDate = new Date(d.date);
            return evDate >= dDate && evDate < new Date(dDate.getTime() + 86400000);
          });
          if (dayIndex >= 0 && ev.severity in days[dayIndex]) {
            (days[dayIndex] as any)[ev.severity]++;
          }
        }
      }

      return days;
    },
    refetchInterval: 60000,
  });

  const chart = (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="label" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
        <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))" }} />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
          }}
        />
        <Bar dataKey="critical" name="Crítico" fill="hsl(var(--destructive))" radius={[2, 2, 0, 0]} />
        <Bar dataKey="high" name="Alto" fill="hsl(var(--warning))" radius={[2, 2, 0, 0]} />
        <Bar dataKey="medium" name="Médio" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
        <Bar dataKey="low" name="Baixo" fill="hsl(var(--muted-foreground))" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );

  return (
    <ChartContainer
      title="Tendência de Eventos (7 dias)"
      icon={<ShieldCheck className="h-4 w-4 text-primary" />}
      chart={chart}
      chartHeight="h-[300px]"
    />
  );
}
