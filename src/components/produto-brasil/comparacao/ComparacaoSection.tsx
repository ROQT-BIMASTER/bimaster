import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  icon?: React.ReactNode;
  countDivergencias?: number;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export function ComparacaoSection({
  title,
  icon,
  countDivergencias = 0,
  children,
  className,
  action,
}: Props) {
  return (
    <Card className={cn("border-border", className)}>
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {icon}
          {title}
          {countDivergencias > 0 && (
            <Badge
              variant="outline"
              className="ml-1 text-[10px] h-5 bg-warning/10 text-warning-foreground border-warning/40"
            >
              {countDivergencias} ponto{countDivergencias > 1 ? "s" : ""} a revisar
            </Badge>
          )}
          {action && <div className="ml-auto">{action}</div>}
        </CardTitle>
        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide pt-1">
          <div className="flex items-center gap-1">
            <span>China</span>
            <span className="text-base leading-none">🇨🇳</span>
          </div>
          <div className="w-[88px] text-center">Status</div>
          <div className="text-right flex items-center gap-1 justify-end">
            <span className="text-base leading-none">🇧🇷</span>
            <span>Brasil</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}
