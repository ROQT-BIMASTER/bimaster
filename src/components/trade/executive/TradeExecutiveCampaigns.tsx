import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, CheckCircle, DollarSign } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { CampaignSummary } from "@/hooks/useTradeExecutiveDashboard";

interface TradeExecutiveCampaignsProps {
  data?: CampaignSummary;
  isLoading: boolean;
}

const statusLabels: Record<string, string> = {
  active: "Ativas",
  in_progress: "Em Andamento",
  completed: "Concluídas",
  cancelled: "Canceladas",
  draft: "Rascunho",
};

export function TradeExecutiveCampaigns({ data, isLoading }: TradeExecutiveCampaignsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-[280px]" />
        <Skeleton className="h-[280px]" />
      </div>
    );
  }

  const pieData = data?.byStatus.map(s => ({
    name: statusLabels[s.status] || s.status,
    value: s.count,
    color: s.color,
  })) || [];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Resumo de Campanhas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Resumo de Campanhas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-green-600" />
                <span className="text-sm text-muted-foreground">Ativas</span>
              </div>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {data?.ativas || 0}
              </p>
            </div>
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                <span className="text-sm text-muted-foreground">Concluídas</span>
              </div>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {data?.concluidas || 0}
              </p>
            </div>
          </div>
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-amber-600" />
              <span className="text-sm text-muted-foreground">Valor Total Investido</span>
            </div>
            <p className="text-2xl font-bold text-amber-600 mt-1">
              {(data?.valorInvestido || 0).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Campanhas por Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Campanhas por Status</CardTitle>
        </CardHeader>
        <CardContent>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [value, "Quantidade"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => (
                    <span className="text-xs text-muted-foreground">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground">
              Nenhuma campanha encontrada
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
