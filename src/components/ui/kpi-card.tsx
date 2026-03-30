import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

type KpiVariant = "default" | "success" | "warning" | "destructive" | "info";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: KpiVariant;
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
};

export function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
  className,
}: KpiCardProps) {
  const styles = variantStyles[variant];

  return (
    <Card className={cn("border", styles.border, className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground truncate">{title}</p>
            <p className={cn("text-2xl font-bold mt-1", styles.text)}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {subtitle}
              </p>
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
