import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, PieChart, Trophy, TrendingUp } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface BrandShareKPIsProps {
  totalMeasurements: number;
  avgShare: number;
  leadingBrand: string;
  growth: number;
}

export function BrandShareKPIs({ totalMeasurements, avgShare, leadingBrand, growth }: BrandShareKPIsProps) {
  const { t } = useLanguage();

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t("brand.total_measurements")}</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalMeasurements}</div>
          <p className="text-xs text-muted-foreground">{t("brand.measurements_period")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t("brand.avg_share")}</CardTitle>
          <PieChart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{avgShare.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground">{t("brand.avg_share_desc")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t("brand.leading_brand")}</CardTitle>
          <Trophy className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold truncate">{leadingBrand}</div>
          <p className="text-xs text-muted-foreground">{t("brand.leading_brand_desc")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t("brand.growth")}</CardTitle>
          <TrendingUp className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {growth >= 0 ? "+" : ""}{growth.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground">{t("brand.growth_desc")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
