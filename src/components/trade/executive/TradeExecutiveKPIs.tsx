import { KpiCard } from "@/components/ui/kpi-card";
import { Store, Calendar, Camera, TrendingUp } from "lucide-react";
import type { ExecutiveKPIs } from "@/hooks/useTradeExecutiveDashboard";
import { useLanguage } from "@/contexts/LanguageContext";

interface TradeExecutiveKPIsProps {
  data?: ExecutiveKPIs;
  isLoading: boolean;
}

export function TradeExecutiveKPIs({ data, isLoading }: TradeExecutiveKPIsProps) {
  const { t } = useLanguage();

  const kpis = [
    { title: t("trade_exec.active_stores"), value: (data?.pdvsAtivos || 0).toLocaleString("pt-BR"), icon: Store, variant: "info" as const },
    { title: t("trade_exec.monthly_visits"), value: (data?.visitasMes || 0).toLocaleString("pt-BR"), icon: Calendar, variant: "success" as const },
    { title: t("trade_exec.monthly_photos"), value: (data?.fotosMes || 0).toLocaleString("pt-BR"), icon: Camera, variant: "accent" as const },
    { title: t("trade_exec.avg_roi"), value: `${(data?.roiMedio || 0).toFixed(1)}%`, icon: TrendingUp, variant: "success" as const },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <KpiCard
          key={kpi.title}
          title={kpi.title}
          value={kpi.value}
          icon={kpi.icon}
          variant={kpi.variant}
          loading={isLoading}
        />
      ))}
    </div>
  );
}
