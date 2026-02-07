import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAnomalyDetection } from "@/hooks/useExpenseAI";
import { AlertTriangle, ShieldAlert, Loader2 } from "lucide-react";

interface ExpenseAnomalyBadgeProps {
  expenseData: Record<string, unknown>;
  autoCheck?: boolean;
}

export function ExpenseAnomalyBadge({
  expenseData,
  autoCheck = true,
}: ExpenseAnomalyBadgeProps) {
  const { detect, isChecking } = useAnomalyDetection();
  const [anomalies, setAnomalies] = useState<
    { type: string; severity: string; message: string }[]
  >([]);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (autoCheck && !checked && expenseData?.category) {
      setChecked(true);
      detect(expenseData).then((result) => {
        if (result?.has_anomaly) {
          setAnomalies(result.anomalies);
        }
      }).catch(() => {});
    }
  }, [autoCheck, expenseData?.category]);

  if (isChecking) {
    return (
      <Badge variant="outline" className="gap-1 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" />
        IA
      </Badge>
    );
  }

  if (anomalies.length === 0) return null;

  const highSeverity = anomalies.some((a) => a.severity === "high");
  const variant = highSeverity ? "destructive" : "secondary";
  const Icon = highSeverity ? ShieldAlert : AlertTriangle;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={variant} className="gap-1 text-xs cursor-help">
            <Icon className="h-3 w-3" />
            {anomalies.length} alerta(s)
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs" side="left">
          <div className="space-y-1">
            <p className="font-semibold text-xs">Alertas da IA:</p>
            {anomalies.map((a, i) => (
              <p key={i} className="text-xs">
                • {a.message}
              </p>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
