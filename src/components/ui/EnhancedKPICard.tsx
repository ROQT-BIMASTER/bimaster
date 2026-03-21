import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SmartValue } from "@/components/ui/smart-value";

interface EnhancedKPICardProps {
  title: string;
  value: number;
  isCurrency?: boolean;
  suffix?: string;
  icon: React.ElementType;
  iconColor?: string;
  trend?: number;
  meta?: number;
  metaLabel?: string;
  formatValue?: (v: number) => string;
}

function getAtingimentoColor(pct: number) {
  if (pct >= 100) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 80) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function getAtingimentoBg(pct: number) {
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 80) return "bg-amber-500";
  return "bg-red-500";
}

export function EnhancedKPICard({
  title,
  value,
  isCurrency = false,
  suffix,
  icon: Icon,
  iconColor = "text-primary",
  trend,
  meta,
  metaLabel,
  formatValue,
}: EnhancedKPICardProps) {
  const pctAtingimento = meta && meta > 0 ? (value / meta) * 100 : null;

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {title}
          </span>
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>

        {/* Value */}
        <div className="text-xl font-bold tracking-tight mb-1">
          {isCurrency ? (
            <SmartValue value={value} />
          ) : formatValue ? (
            formatValue(value)
          ) : (
            <>
              {value.toLocaleString("pt-BR")}
              {suffix && <span className="text-sm font-normal text-muted-foreground ml-1">{suffix}</span>}
            </>
          )}
        </div>

        {/* Trend */}
        {trend !== undefined && (
          <div className={cn(
            "flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full w-fit",
            trend >= 0
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          )}>
            {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend).toFixed(1)}% vs anterior
          </div>
        )}

        {/* Meta */}
        {meta != null && meta > 0 && pctAtingimento != null && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">{metaLabel || "Meta"}: {isCurrency ? `R$ ${(meta / 1000).toFixed(0)}k` : meta.toLocaleString("pt-BR")}</span>
              <span className={cn("font-bold", getAtingimentoColor(pctAtingimento))}>
                {pctAtingimento.toFixed(1)}%
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", getAtingimentoBg(pctAtingimento))}
                style={{ width: `${Math.min(pctAtingimento, 100)}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
