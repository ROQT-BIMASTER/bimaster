import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function SecurityScoreGauge() {
  const { data, isLoading } = useQuery({
    queryKey: ["security-score-gauge"],
    queryFn: async () => {
      const now = new Date();
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [openIncidents, criticalEvents, riskScores] = await Promise.all([
        supabase
          .from("security_incidents")
          .select("*", { count: "exact", head: true })
          .in("status", ["open", "investigating"]),
        supabase
          .from("security_audit_log" as any)
          .select("*", { count: "exact", head: true })
          .eq("severity", "critical")
          .gte("created_at", last7d),
        supabase
          .from("security_user_risk_score")
          .select("score")
          .gte("score", 50),
      ]);

      // Calculate system score (inverse of risk)
      let score = 100;
      score -= Math.min((openIncidents.count ?? 0) * 5, 25); // -5 per open incident, max -25
      score -= Math.min((criticalEvents.count ?? 0) * 3, 20); // -3 per critical event, max -20
      score -= Math.min((riskScores.data?.length ?? 0) * 5, 15); // -5 per high-risk user, max -15
      score = Math.max(score, 0);

      return {
        score,
        openIncidents: openIncidents.count ?? 0,
        criticalEvents: criticalEvents.count ?? 0,
        highRiskUsers: riskScores.data?.length ?? 0,
      };
    },
    refetchInterval: 30000,
  });

  const score = data?.score ?? 0;
  const color = score >= 90 ? "text-success" : score >= 70 ? "text-warning" : "text-destructive";
  const bgColor = score >= 90 ? "stroke-success" : score >= 70 ? "stroke-warning" : "stroke-destructive";
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Skeleton className="h-32 w-32 rounded-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Security Score</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="relative w-32 h-32">
          <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" className="stroke-muted" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="45" fill="none"
              className={bgColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 0.5s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-3xl font-bold ${color}`}>{score}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 w-full text-center">
          <div>
            <p className="text-lg font-bold text-destructive">{data?.openIncidents}</p>
            <p className="text-xs text-muted-foreground">Incidentes</p>
          </div>
          <div>
            <p className="text-lg font-bold text-warning">{data?.criticalEvents}</p>
            <p className="text-xs text-muted-foreground">Críticos (7d)</p>
          </div>
          <div>
            <p className="text-lg font-bold text-primary">{data?.highRiskUsers}</p>
            <p className="text-xs text-muted-foreground">Risco Alto</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
