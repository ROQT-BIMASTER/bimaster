import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
    { title: t("trade_exec.active_stores"), value: data?.pdvsAtivos || 0, format: (v: number) => v.toLocaleString("pt-BR"), icon: Store, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/50", borderColor: "border-l-blue-500" },
    { title: t("trade_exec.monthly_visits"), value: data?.visitasMes || 0, format: (v: number) => v.toLocaleString("pt-BR"), icon: Calendar, color: "text-green-600 dark:text-green-400", bgColor: "bg-green-100 dark:bg-green-900/50", borderColor: "border-l-green-500" },
    { title: t("trade_exec.monthly_photos"), value: data?.fotosMes || 0, format: (v: number) => v.toLocaleString("pt-BR"), icon: Camera, color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-100 dark:bg-purple-900/50", borderColor: "border-l-purple-500" },
    { title: t("trade_exec.avg_roi"), value: data?.roiMedio || 0, format: (v: number) => `${v.toFixed(1)}%`, icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-100 dark:bg-emerald-900/50", borderColor: "border-l-emerald-500" },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[120px]" />)}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <Card key={kpi.title} className={`border-l-4 ${kpi.borderColor}`}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className={`p-2.5 rounded-xl ${kpi.bgColor}`}>
                <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
              </div>
            </div>
            <div className="mt-4">
              <p className={`text-3xl font-bold ${kpi.color}`}>{kpi.format(kpi.value)}</p>
              <h3 className="text-sm font-medium text-foreground mt-1">{kpi.title}</h3>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
