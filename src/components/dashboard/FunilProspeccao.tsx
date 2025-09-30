import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FunnelChart, Funnel, LabelList, Tooltip, ResponsiveContainer } from "recharts";

interface FunnelData {
  stage: string;
  count: number;
  percentage: number;
  fill: string;
}

interface FunilProspeccaoProps {
  data: FunnelData[];
}

export const FunilProspeccao = ({ data }: FunilProspeccaoProps) => {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border rounded-lg p-3 shadow-lg">
          <p className="font-semibold">{data.stage}</p>
          <p className="text-sm">Prospects: {data.count}</p>
          <p className="text-sm">Percentual: {data.percentage}%</p>
        </div>
      );
    }
    return null;
  };

  const CustomLabel = (props: any) => {
    const { x, y, width, value, stage, count } = props;
    return (
      <g>
        <text
          x={x + width / 2}
          y={y + 20}
          fill="#fff"
          textAnchor="middle"
          dominantBaseline="middle"
          className="font-semibold text-sm"
        >
          {stage}
        </text>
        <text
          x={x + width / 2}
          y={y + 40}
          fill="#fff"
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-xs"
        >
          {count} prospects ({value}%)
        </text>
      </g>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil de Prospecção</CardTitle>
        <CardDescription>Taxa de conversão por etapa do processo</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <FunnelChart>
            <Tooltip content={<CustomTooltip />} />
            <Funnel
              dataKey="percentage"
              data={data}
              isAnimationActive
            >
              <LabelList
                position="center"
                content={<CustomLabel />}
              />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
        
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {data.map((stage, index) => (
            <div
              key={index}
              className="flex flex-col items-center p-3 rounded-lg border"
              style={{ borderColor: stage.fill }}
            >
              <div
                className="w-3 h-3 rounded-full mb-2"
                style={{ backgroundColor: stage.fill }}
              />
              <p className="text-xs font-medium text-center">{stage.stage}</p>
              <p className="text-lg font-bold">{stage.count}</p>
              <p className="text-xs text-muted-foreground">{stage.percentage}%</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
