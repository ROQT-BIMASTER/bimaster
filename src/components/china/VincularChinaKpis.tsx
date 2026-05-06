import { AlertTriangle, CheckCircle2, Clock, XCircle, Truck, Link2, LayoutGrid, AlertCircle, Timer, ChevronDown, ChevronUp } from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface KpiData {
  total: number;
  enviados: number;
  emRevisao: number;
  aprovados: number;
  rejeitados: number;
  vinculados: number;
  enviadosBrasil: number;
  atrasados?: number;
  comPendencias?: number;
}

interface Props {
  data: KpiData;
  activeFilter?: string | null;
  onFilterClick?: (status: string) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

/**
 * KPIs da Mesa de Vínculo. Padronizados com `KpiCard` e adaptáveis à paleta
 * dinâmica de fundo (Projetos). Suporta colapso persistido e filtros clicáveis.
 */
export function VincularChinaKpis({ data, activeFilter, onFilterClick, collapsed, onToggleCollapsed }: Props) {
  const cards = [
    { label: "Total", value: data.total, filterKey: "todos", icon: LayoutGrid, variant: "default" as const },
    { label: "Enviados", value: data.enviados, filterKey: "enviado", icon: Clock, variant: "info" as const },
    { label: "Em Revisão", value: data.emRevisao, filterKey: "em_revisao", icon: AlertTriangle, variant: "warning" as const },
    { label: "Aprovados", value: data.aprovados, filterKey: "aprovado", icon: CheckCircle2, variant: "success" as const },
    { label: "Enviado Brasil", value: data.enviadosBrasil, filterKey: "enviado_brasil", icon: Truck, variant: "info" as const },
    { label: "Rejeitados", value: data.rejeitados, filterKey: "rejeitado", icon: XCircle, variant: "destructive" as const },
    { label: "Vinculados", value: data.vinculados, filterKey: "vinculados", icon: Link2, variant: "success" as const },
    { label: "Atrasados >48h", value: data.atrasados ?? 0, filterKey: "atrasados", icon: Timer, variant: "destructive" as const },
    { label: "Com Pendências", value: data.comPendencias ?? 0, filterKey: "com_pendencias", icon: AlertCircle, variant: "warning" as const },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Painel de monitoramento
        </span>
        {onToggleCollapsed && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expandir KPIs (atalho K)" : "Recolher KPIs (atalho K)"}
            title="Atalho: K"
          >
            {collapsed ? <ChevronDown className="h-3.5 w-3.5 mr-1" /> : <ChevronUp className="h-3.5 w-3.5 mr-1" />}
            {collapsed ? "Mostrar" : "Ocultar"}
          </Button>
        )}
      </div>
      {!collapsed && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
          {cards.map(c => {
            const isActive = activeFilter === c.filterKey;
            return (
              <KpiCard
                key={c.label}
                title={c.label}
                value={c.value}
                icon={c.icon}
                variant={c.variant}
                onClick={() => onFilterClick?.(isActive ? "todos" : c.filterKey)}
                className={cn(isActive && "ring-2 ring-primary ring-offset-1")}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
