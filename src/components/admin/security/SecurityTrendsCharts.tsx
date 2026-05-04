import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { TrendingUp, ShieldCheck, Activity, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Point = {
  date: string;
  waf: number;
  anom_low: number;
  anom_med: number;
  anom_high: number;
  anom_critical: number;
  mfa_new: number;
  mfa_total: number;
  mfa_pct: number;
};

const DAYS_OPTIONS = [7, 14, 30] as const;

export function SecurityTrendsCharts() {
  const [days, setDays] = useState<number>(14);
  const [series, setSeries] = useState<Point[]>([]);
  const [mfaRequired, setMfaRequired] = useState(0);
  const [loading, setLoading] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = new URL("https://aokkyrgaqjarhlywhjju.functions.supabase.co/security-metrics-v2");
      url.searchParams.set("op", "trends");
      url.searchParams.set("days", String(days));
      const r = await fetch(url, { headers: { Authorization: `Bearer ${session?.access_token}` } });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      setSeries(
        (j.series ?? []).map((p: Point) => ({
          ...p,
          dateLabel: format(new Date(p.date), "dd/MM", { locale: ptBR }),
        })) as any
      );
      setMfaRequired(j.mfa_required ?? 0);
    } catch (e) {
      logger.error("trends load error", { error: e });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, [days]);

  const totalWaf = series.reduce((s, p) => s + p.waf, 0);
  const totalAnom = series.reduce((s, p) => s + p.anom_low + p.anom_med + p.anom_high + p.anom_critical, 0);
  const lastMfaPct = series[series.length - 1]?.mfa_pct ?? 0;
  const firstMfaPct = series[0]?.mfa_pct ?? 0;
  const mfaDelta = lastMfaPct - firstMfaPct;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Tendências de segurança ({days}d)</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted/50 rounded-md border border-border p-0.5">
            {DAYS_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                  days === d ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* MFA Coverage trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Cobertura MFA (% admins/gerentes)
              </span>
              <Badge variant={mfaDelta >= 0 ? "default" : "destructive"}>
                {mfaDelta >= 0 ? "+" : ""}{mfaDelta} pp
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="mfa-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: number, name: string) => [name === "mfa_pct" ? `${v}%` : v, name === "mfa_pct" ? "Cobertura" : name]}
                />
                <Area type="monotone" dataKey="mfa_pct" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#mfa-grad)" />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-2">
              Total alvo: <span className="font-mono">{mfaRequired}</span> usuários · Atual: <span className="font-mono">{lastMfaPct}%</span>
            </p>
          </CardContent>
        </Card>

        {/* WAF Shadow events */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-warning" />
                Eventos WAF Shadow (bloquearia em enforce)
              </span>
              <Badge variant="outline">{totalWaf} total</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                />
                <Line type="monotone" dataKey="waf" name="WAF shadow" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-2">
              Pico no período: <span className="font-mono">{Math.max(0, ...series.map((p) => p.waf))}</span> em 1 dia
            </p>
          </CardContent>
        </Card>

        {/* Anomalies stacked by severity */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-destructive" />
                Anomalias por severidade
              </span>
              <Badge variant="outline">{totalAnom} total</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={series}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="anom_low" name="Baixa" stackId="a" fill="hsl(var(--muted-foreground))" />
                <Bar dataKey="anom_med" name="Média" stackId="a" fill="hsl(var(--chart-1))" />
                <Bar dataKey="anom_high" name="Alta" stackId="a" fill="hsl(var(--warning))" />
                <Bar dataKey="anom_critical" name="Crítica" stackId="a" fill="hsl(var(--destructive))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
