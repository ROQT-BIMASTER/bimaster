import { AlertTriangle, CheckCircle2, Clock, XCircle, Truck, Link2, LayoutGrid } from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { cn } from "@/lib/utils";

interface KpiData {
  total: number;
  enviados: number;
  emRevisao: number;
  aprovados: number;
  rejeitados: number;
  vinculados: number;
  enviadosBrasil: number;
}

interface Props {
  data: KpiData;
  activeFilter?: string | null;
  onFilterClick?: (status: string) => void;
}

/**
 * KPIs da tela "Vincular China" padronizados com `KpiCard` (mesmo componente
 * usado em Central de Trabalho), garantindo:
 *  - Altura mínima uniforme (`min-h-[112px]`) — sem serrilha vertical.
 *  - Variantes semânticas (`info`, `warning`, `success`, `destructive`) que
 *    se adaptam à paleta dinâmica de `getBgPaletteVars` em qualquer cor de
 *    fundo escolhida no módulo Projetos.
 *  - Estado ativo via ring quando o KPI está filtrado.
 */
export function VincularChinaKpis({ data, activeFilter, onFilterClick }: Props) {
  const cards = [
    { label: "Total", value: data.total, filterKey: "todos", icon: LayoutGrid, variant: "default" as const },
    { label: "Enviados", value: data.enviados, filterKey: "enviado", icon: Clock, variant: "info" as const },
    { label: "Em Revisão", value: data.emRevisao, filterKey: "em_revisao", icon: AlertTriangle, variant: "warning" as const },
    { label: "Aprovados", value: data.aprovados, filterKey: "aprovado", icon: CheckCircle2, variant: "success" as const },
    { label: "Enviado Brasil", value: data.enviadosBrasil, filterKey: "enviado_brasil", icon: Truck, variant: "info" as const },
    { label: "Rejeitados", value: data.rejeitados, filterKey: "rejeitado", icon: XCircle, variant: "destructive" as const },
    { label: "Vinculados", value: data.vinculados, filterKey: "vinculados", icon: Link2, variant: "success" as const },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
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
  );
}
