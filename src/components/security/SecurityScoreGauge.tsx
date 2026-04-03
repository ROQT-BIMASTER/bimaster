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

      const [openIncidents, criticalEvents, riskScores, avgConfidence] = await Promise.all([
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
        supabase
          .from("security_incidents")
          .select("confidence_score")
          .in("status", ["open", "investigating"]),
      ]);

      // Calculate average confidence of open incidents
      let avgConf = 0;
      if (avgConfidence.data && avgConfidence.data.length > 0) {
        avgConf = avgConfidence.data.reduce((sum, r) => sum + (Number(r.confidence_score) || 0.8), 0) / avgConfidence.data.length;
      }

      // Calculate system score (inverse of risk), weighted by confidence
      let score = 100;
      const openCount = openIncidents.count ?? 0;
      const critCount = criticalEvents.count ?? 0;
      const highRiskCount = riskScores.data?.length ?? 0;

      score -= Math.min(Math.round(openCount * 5 * avgConf), 25);
      score -= Math.min(critCount * 3, 20);
      score -= Math.min(highRiskCount * 5, 15);
      score = Math.max(score, 0);

      return {
        score,
        openIncidents: openCount,
        criticalEvents: critCount,
        highRiskUsers: highRiskCount,
        avgConfidence: Math.round(avgConf * 100),
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

        <div className="grid grid-cols-2 gap-3 w-full text-center">
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
          <div>
            <p className="text-lg font-bold text-muted-foreground">{data?.avgConfidence}%</p>
            <p className="text-xs text-muted-foreground">Confiança</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
