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

const variantStyles: Record<KpiVariant, { text: string; bg: string; ring: string; accent: string }> = {
  default: {
    text: "text-foreground",
    bg: "bg-muted/60",
    ring: "ring-border/60",
    accent: "bg-muted-foreground/30",
  },
  success: {
    text: "text-success",
    bg: "bg-success/10",
    ring: "ring-success/20",
    accent: "bg-success/60",
  },
  warning: {
    text: "text-warning",
    bg: "bg-warning/10",
    ring: "ring-warning/20",
    accent: "bg-warning/60",
  },
  destructive: {
    text: "text-destructive",
    bg: "bg-destructive/10",
    ring: "ring-destructive/20",
    accent: "bg-destructive/60",
  },
  info: {
    text: "text-primary",
    bg: "bg-primary/10",
    ring: "ring-primary/20",
    accent: "bg-primary/60",
  },
  accent: {
    text: "text-accent",
    bg: "bg-accent/10",
    ring: "ring-accent/20",
    accent: "bg-accent/60",
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
      <Card className={cn("border min-h-[116px] overflow-hidden", className)}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2.5 flex-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-9 w-9 rounded-full" />
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
        "relative border border-border/60 min-h-[116px] overflow-hidden",
        "transition-all duration-200",
        onClick && "cursor-pointer hover:-translate-y-0.5",
        className,
      )}
      onClick={onClick}
    >
      {/* Accent bar */}
      <span
        aria-hidden
        className={cn("absolute left-0 top-0 h-full w-[3px]", styles.accent)}
      />
      <CardContent className="p-4 h-full flex">
        <div className="flex items-start justify-between gap-3 w-full">
          <div className="min-w-0 space-y-1.5 flex-1">
            <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground truncate">
              {title}
            </p>
            <p className={cn(
              "text-[28px] leading-none font-semibold tracking-tight font-display tabular-nums",
              styles.text,
            )}>
              {value}
            </p>
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {trend && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full",
                    isPositive
                      ? "bg-success/10 text-success"
                      : "bg-destructive/10 text-destructive",
                  )}
                >
                  <TrendIcon className="h-3 w-3" />
                  {Math.abs(trend.value).toFixed(1)}%
                </span>
              )}
              {subtitle && (
                <p className="text-[11px] text-muted-foreground truncate">
                  {trend?.label || subtitle}
                </p>
              )}
            </div>
          </div>
          {Icon && (
            <div
              className={cn(
                "h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ring-1",
                styles.bg,
                styles.ring,
              )}
            >
              <Icon className={cn("h-[18px] w-[18px]", styles.text)} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
