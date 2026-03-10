import { ShieldCheck, ShieldAlert, ShieldQuestion, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AuditChinaResult } from "@/hooks/useAuditChinaVinculo";

const AUDIT_CONFIG: Record<string, { icon: any; color: string; bgColor: string; label: string; variant: "success" | "warning" | "destructive"; pulse?: boolean }> = {
  alto: { icon: ShieldCheck, color: "text-success", bgColor: "bg-success/10", label: "Vínculo compatível", variant: "success" },
  medio: { icon: ShieldQuestion, color: "text-warning", bgColor: "bg-warning/10", label: "Verificar compatibilidade", variant: "warning" },
  baixo: { icon: ShieldAlert, color: "text-destructive", bgColor: "bg-destructive/10", label: "Possível incompatibilidade", variant: "destructive", pulse: true },
};

interface AuditChinaVinculoBadgeProps {
  result: AuditChinaResult | null;
  loading?: boolean;
  compact?: boolean;
}

export function AuditChinaVinculoBadge({ result, loading, compact }: AuditChinaVinculoBadgeProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {!compact && <span className="text-[10px]">Auditando IA...</span>}
      </div>
    );
  }

  if (!result) return null;

  const cfg = AUDIT_CONFIG[result.match];
  if (!cfg) return null;
  const Icon = cfg.icon;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("flex items-center gap-1 cursor-help", cfg.pulse && "animate-pulse")}>
              <Icon className={cn("h-4 w-4", cfg.color)} />
              <span className={cn("text-[10px] font-medium", cfg.color)}>{result.confianca}%</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="font-medium text-xs mb-1">{cfg.label}</p>
            <p className="text-[11px] text-muted-foreground">{result.motivo}</p>
            {result.alertas.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {result.alertas.map((a, i) => (
                  <li key={i} className="text-[10px] text-warning">⚠ {a}</li>
                ))}
              </ul>
            )}
            {result.sugestao && (
              <p className="mt-1.5 text-[10px] text-primary font-medium">💡 {result.sugestao}</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn("rounded-lg border p-3 space-y-2", cfg.bgColor, cfg.pulse && "animate-pulse")}>
      <div className="flex items-center gap-2">
        <Icon className={cn("h-5 w-5", cfg.color)} />
        <div className="flex-1">
          <p className={cn("text-sm font-semibold", cfg.color)}>{cfg.label}</p>
          <p className="text-xs text-muted-foreground">{result.motivo}</p>
        </div>
        <Badge variant={cfg.variant} className="text-[10px]">
          {result.confianca}% confiança
        </Badge>
      </div>
      {result.alertas.length > 0 && (
        <ul className="space-y-1 ml-7">
          {result.alertas.map((a, i) => (
            <li key={i} className="text-xs text-warning flex items-start gap-1">
              <span className="shrink-0">⚠</span> {a}
            </li>
          ))}
        </ul>
      )}
      {result.sugestao && (
        <p className="text-xs text-primary ml-7">💡 {result.sugestao}</p>
      )}
    </div>
  );
}
