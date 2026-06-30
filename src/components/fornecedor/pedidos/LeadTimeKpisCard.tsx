import { Clock, Truck, Gauge } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useRubyspLeadTime, type RubyspLeadTimeRow } from "@/hooks/fornecedor/useRubyspLeadTime";

function fmtMin(min: number | null | undefined): string {
  if (min == null || Number.isNaN(min) || min <= 0) return "—";
  if (min < 60) return `${Math.round(min)}min`;
  const horas = min / 60;
  if (horas < 24) return `${horas.toFixed(1)}h`;
  const dias = horas / 24;
  return `${dias.toFixed(1)}d`;
}

interface MiniProps {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}

function MiniKpi({ label, value, hint, className }: MiniProps) {
  return (
    <div className={cn("rounded-md border border-border bg-muted/20 px-3 py-2", className)}>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-foreground tabular-nums">{value}</div>
      {hint ? <div className="text-[10px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export function LeadTimeKpisCard() {
  const { data, isLoading, error } = useRubyspLeadTime();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return null;
  }

  const row: RubyspLeadTimeRow = data;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Lead time porta-a-porta (últimos 30 dias)
            </h2>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Base: {row.n_liberacao ?? 0} pedidos liberados
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Truck className="h-3 w-3" /> Porta-a-porta médio
            </div>
            <div className="text-lg font-bold text-foreground tabular-nums">
              {fmtMin(row.media_lead_time_entrega_min)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              p50: {fmtMin(row.p50_lead_time_entrega_min)}
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/20 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" /> Até faturamento (médio)
            </div>
            <div className="text-lg font-bold text-foreground tabular-nums">
              {fmtMin(row.media_lead_time_min)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              p50: {fmtMin(row.p50_lead_time_min)}
            </div>
          </div>

          <MiniKpi
            label="Em trânsito (p50)"
            value={fmtMin(row.p50_entrega_transito_min)}
            hint="Faturado → Entregue"
          />
          <MiniKpi
            label="Até liberação (p50)"
            value={fmtMin(row.p50_ate_liberacao_min)}
            hint="Digitação → Liberação"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <MiniKpi label="Aguard. separação (p50)" value={fmtMin(row.p50_aguard_separacao_min)} />
          <MiniKpi label="Separação (p50)" value={fmtMin(row.p50_separacao_min)} />
          <MiniKpi label="Aguard. expedição (p50)" value={fmtMin(row.p50_aguard_expedicao_min)} />
          <MiniKpi label="Faturamento (p50)" value={fmtMin(row.p50_faturamento_min)} />
        </div>
      </CardContent>
    </Card>
  );
}
