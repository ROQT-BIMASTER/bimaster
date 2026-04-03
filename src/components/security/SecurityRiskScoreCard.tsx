import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const riskColors: Record<string, string> = {
  critical: "bg-destructive text-destructive-foreground",
  high: "bg-warning text-warning-foreground",
  medium: "bg-primary/20 text-primary",
  low: "bg-success/20 text-success",
};

export function SecurityRiskScoreCard() {
  const { data: topRisk, isLoading } = useQuery({
    queryKey: ["security-risk-top-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_user_risk_score")
        .select("*")
        .order("score", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Top Usuários em Risco
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : topRisk && topRisk.length > 0 ? (
          <div className="space-y-3">
            {topRisk.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-sm font-bold">{user.score}</span>
                  </div>
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">
                      {user.user_id.slice(0, 8)}...
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Atualizado: {new Date(user.last_calculated_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
                <Badge className={riskColors[user.risk_level] || ""}>
                  {user.risk_level}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum score calculado ainda
          </p>
        )}
      </CardContent>
    </Card>
  );
}
