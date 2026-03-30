import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

type KpiVariant = "default" | "success" | "warning" | "destructive" | "info" | "accent";

interface KpiTrend {
  value: number;     // e.g. 12.5 for +12.5%
  label?: string;    // e.g. "vs mês anterior"
}

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: KpiVariant;
  trend?: KpiTrend;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

const variantStyles: Record<KpiVariant, { text: string; bg: string; border: string }> = {
  default: {
    text: "text-foreground",
    bg: "bg-muted/50",
    border: "border-border",
  },
  success: {
    text: "text-success",
    bg: "bg-success/10",
    border: "border-success/30",
  },
  warning: {
    text: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/30",
  },
  destructive: {
    text: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/30",
  },
  info: {
    text: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
  },
  accent: {
    text: "text-accent",
    bg: "bg-accent/10",
    border: "border-accent/30",
  },
};

export function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
  trend,
  loading = false,
  onClick,
  className,
}: KpiCardProps) {
  const styles = variantStyles[variant];

  if (loading) {
    return (
      <Card className={cn("border", styles.border, className)}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const isPositive = trend && trend.value >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <Card
      className={cn(
        "border transition-all duration-200",
        styles.border,
        onClick && "cursor-pointer hover:shadow-soft-lg hover:-translate-y-0.5",
        className,
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-sm text-muted-foreground truncate">{title}</p>
            <p className={cn("text-2xl font-bold", styles.text)}>{value}</p>
            <div className="flex items-center gap-2">
              {trend && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 text-xs font-medium",
                    isPositive ? "text-success" : "text-destructive",
                  )}
                >
                  <TrendIcon className="h-3 w-3" />
                  {Math.abs(trend.value).toFixed(1)}%
                  {trend.label && (
                    <span className="text-muted-foreground font-normal ml-0.5">
                      {trend.label}
                    </span>
                  )}
                </span>
              )}
              {subtitle && !trend && (
                <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
              )}
            </div>
            {subtitle && trend && (
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
          {Icon && (
            <div className={cn("p-2 rounded-lg flex-shrink-0", styles.bg)}>
              <Icon className={cn("h-5 w-5", styles.text)} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
