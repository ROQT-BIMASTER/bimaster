import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, AlertCircle, XCircle, UserX } from "lucide-react";
import type { ReativacaoKPI, RiskLevel } from "@/hooks/useClienteReativacao";

const riskConfig: Record<RiskLevel, { icon: typeof AlertTriangle; bgClass: string; textClass: string; borderClass: string; iconBgClass: string }> = {
  atencao: {
    icon: AlertTriangle,
    bgClass: "bg-amber-50 dark:bg-amber-950/30",
    textClass: "text-amber-700 dark:text-amber-400",
    borderClass: "border-l-amber-500",
    iconBgClass: "bg-amber-100 dark:bg-amber-900/50",
  },
  alerta: {
    icon: AlertCircle,
    bgClass: "bg-orange-50 dark:bg-orange-950/30",
    textClass: "text-orange-700 dark:text-orange-400",
    borderClass: "border-l-orange-500",
    iconBgClass: "bg-orange-100 dark:bg-orange-900/50",
  },
  critico: {
    icon: XCircle,
    bgClass: "bg-red-50 dark:bg-red-950/30",
    textClass: "text-red-700 dark:text-red-400",
    borderClass: "border-l-red-500",
    iconBgClass: "bg-red-100 dark:bg-red-900/50",
  },
  inativo: {
    icon: UserX,
    bgClass: "bg-gray-50 dark:bg-gray-900/30",
    textClass: "text-gray-700 dark:text-gray-400",
    borderClass: "border-l-gray-500",
    iconBgClass: "bg-gray-100 dark:bg-gray-800/50",
  },
};

const riskSubtitle: Record<RiskLevel, string> = {
  atencao: "31-60 dias sem compra",
  alerta: "61-90 dias sem compra",
  critico: "91-180 dias sem compra",
  inativo: "180+ dias sem compra",
};

interface Props {
  kpis: ReativacaoKPI[];
  onFilterClick?: (nivel: RiskLevel) => void;
  activeFilter?: RiskLevel | null;
}

export function ReactivationKPICards({ kpis, onFilterClick, activeFilter }: Props) {
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => {
        const config = riskConfig[kpi.nivel];
        const Icon = config.icon;
        const isActive = activeFilter === kpi.nivel;

        return (
          <Card
            key={kpi.nivel}
            className={`cursor-pointer transition-all duration-200 border-l-4 ${config.borderClass} ${isActive ? "ring-2 ring-primary shadow-lg" : "hover:shadow-md"}`}
            onClick={() => onFilterClick?.(kpi.nivel)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg ${config.iconBgClass}`}>
                  <Icon className={`h-4 w-4 ${config.textClass}`} />
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.bgClass} ${config.textClass}`}>
                  {kpi.label}
                </span>
              </div>
              <p className={`text-2xl font-bold ${config.textClass}`}>{kpi.quantidade}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{riskSubtitle[kpi.nivel]}</p>
              <p className={`text-sm font-semibold mt-1 ${config.textClass}`}>
                {formatCurrency(kpi.valor_total)}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
