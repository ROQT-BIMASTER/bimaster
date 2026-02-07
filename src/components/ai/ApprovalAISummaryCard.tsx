import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useApprovalSummary } from "@/hooks/useExpenseAI";
import {
  Sparkles,
  AlertTriangle,
  AlertCircle,
  Info,
  RefreshCw,
  Loader2,
  Brain,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface ApprovalAISummaryCardProps {
  entityType: "event" | "department";
  entityId: string;
  autoLoad?: boolean;
}

export function ApprovalAISummaryCard({
  entityType,
  entityId,
  autoLoad = false,
}: ApprovalAISummaryCardProps) {
  const { generate, isLoading, summary } = useApprovalSummary();
  const [expanded, setExpanded] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (autoLoad && entityId && !hasLoaded) {
      generate(entityType, entityId);
      setHasLoaded(true);
    }
  }, [autoLoad, entityId, entityType]);

  const alertIcon = (type: string) => {
    switch (type) {
      case "danger":
        return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
      case "warning":
        return <AlertTriangle className="h-3.5 w-3.5 text-warning" />;
      default:
        return <Info className="h-3.5 w-3.5 text-primary" />;
    }
  };

  const alertColor = (type: string) => {
    switch (type) {
      case "danger":
        return "border-destructive/30 bg-destructive/5 text-destructive";
      case "warning":
        return "border-warning/30 bg-warning/5 text-warning";
      default:
        return "border-primary/30 bg-primary/5 text-primary";
    }
  };

  if (!summary && !isLoading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Análise IA das Despesas</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generate(entityType, entityId)}
            className="gap-1"
          >
            <Brain className="h-3.5 w-3.5" />
            Gerar Resumo IA
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="border-primary/20">
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm font-medium">Analisando despesas com IA...</span>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
      <CardContent className="py-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Resumo IA</span>
            {summary.alerts.length > 0 && (
              <Badge variant="outline" className="text-xs gap-1">
                {summary.alerts.length} alerta(s)
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => generate(entityType, entityId)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {expanded && (
          <>
            {/* Summary */}
            <p className="text-sm text-muted-foreground">{summary.summary}</p>

            {/* Alerts */}
            {summary.alerts.length > 0 && (
              <div className="space-y-1.5">
                {summary.alerts.map((alert, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 text-xs rounded-md px-3 py-2 border ${alertColor(alert.type)}`}
                  >
                    {alertIcon(alert.type)}
                    <span>{alert.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Recommendation */}
            {summary.recommendation && (
              <div className="flex items-start gap-2 text-xs rounded-md px-3 py-2 border border-muted bg-muted/50">
                <Brain className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{summary.recommendation}</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
