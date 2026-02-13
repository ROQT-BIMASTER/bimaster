import { memo, useMemo, useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FunnelChart, Funnel, LabelList, Tooltip, ResponsiveContainer } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";

interface FunnelData {
  stage: string;
  count: number;
  percentage: number;
  fill: string;
}

interface FunilProspeccaoProps {
  data: FunnelData[];
}

export const FunilProspeccao = memo(({ data }: FunilProspeccaoProps) => {
  const [hasAnimated, setHasAnimated] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const timer = setTimeout(() => setHasAnimated(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const CustomTooltip = useCallback(({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const tooltipData = payload[0].payload;
      return (
        <div className="bg-card border rounded-lg p-3 shadow-lg">
          <p className="font-semibold">{tooltipData.stage}</p>
          <p className="text-sm">{t("funnel.prospects_label")}: {tooltipData.count}</p>
          <p className="text-sm">{t("funnel.percentage_label")}: {tooltipData.percentage}%</p>
        </div>
      );
    }
    return null;
  }, [t]);

  const CustomLabel = useCallback((props: any) => {
    const { x, y, width, value, stage, count } = props;
    return (
      <g>
        <text x={x + width / 2} y={y + 20} fill="#fff" textAnchor="middle" dominantBaseline="middle" className="font-semibold text-sm">
          {stage}
        </text>
        <text x={x + width / 2} y={y + 40} fill="#fff" textAnchor="middle" dominantBaseline="middle" className="text-xs">
          {count} prospects ({value}%)
        </text>
      </g>
    );
  }, []);

  const stageCards = useMemo(() => (
    data.map((stage, index) => (
      <div key={index} className="flex flex-col items-center p-3 rounded-lg border" style={{ borderColor: stage.fill }}>
        <div className="w-3 h-3 rounded-full mb-2" style={{ backgroundColor: stage.fill }} />
        <p className="text-xs font-medium text-center">{stage.stage}</p>
        <p className="text-lg font-bold">{stage.count}</p>
        <p className="text-xs text-muted-foreground">{stage.percentage}%</p>
      </div>
    ))
  ), [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("funnel.title")}</CardTitle>
        <CardDescription>{t("funnel.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <FunnelChart>
            <Tooltip content={CustomTooltip} />
            <Funnel dataKey="percentage" data={data} isAnimationActive={!hasAnimated}>
              <LabelList position="center" content={CustomLabel} />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
        
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {stageCards}
        </div>
      </CardContent>
    </Card>
  );
});

FunilProspeccao.displayName = "FunilProspeccao";
