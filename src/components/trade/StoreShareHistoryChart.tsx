import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StoreShareHistoryChartProps {
  storeId: string;
  months?: number;
}

export const StoreShareHistoryChart = ({ storeId, months = 6 }: StoreShareHistoryChartProps) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [comparison, setComparison] = useState<any>(null);

  useEffect(() => {
    if (storeId) {
      fetchHistory();
    }
  }, [storeId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      const { data, error } = await supabase
        .from("shelf_share_history")
        .select("*")
        .eq("store_id", storeId)
        .gte("measurement_date", startDate.toISOString().split('T')[0])
        .order("measurement_date", { ascending: true });

      if (error) throw error;

      setHistory(data || []);

      // Calcular comparação com período anterior
      if (data && data.length >= 2) {
        const latest = data[data.length - 1];
        const previous = data[data.length - 2];

        setComparison({
          shelfShareChange: latest.shelf_share_percentage - previous.shelf_share_percentage,
          facingShareChange: latest.facing_share_percentage - previous.facing_share_percentage,
          latestShelfShare: latest.shelf_share_percentage,
          latestFacingShare: latest.facing_share_percentage,
        });
      }
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    } finally {
      setLoading(false);
    }
  };

  const chartData = history.map(item => ({
    date: format(new Date(item.measurement_date), "dd/MM", { locale: ptBR }),
    shelfShare: item.shelf_share_percentage,
    facingShare: item.facing_share_percentage,
  }));

  if (loading) {
    return <div className="text-center py-8">Carregando histórico...</div>;
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhum histórico de share disponível
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {comparison && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Share de Prateleira</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">
                  {comparison.latestShelfShare?.toFixed(1)}%
                </div>
                <Badge variant={comparison.shelfShareChange >= 0 ? "default" : "destructive"}>
                  {comparison.shelfShareChange >= 0 ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {Math.abs(comparison.shelfShareChange).toFixed(1)}%
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                vs. período anterior
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Share por Faces</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">
                  {comparison.latestFacingShare?.toFixed(1)}%
                </div>
                <Badge variant={comparison.facingShareChange >= 0 ? "default" : "destructive"}>
                  {comparison.facingShareChange >= 0 ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {Math.abs(comparison.facingShareChange).toFixed(1)}%
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                vs. período anterior
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Evolução do Share</CardTitle>
          <CardDescription>Últimos {months} meses</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip
                formatter={(value: any) => `${value?.toFixed(1)}%`}
                labelFormatter={(label) => `Data: ${label}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="shelfShare"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                name="Share de Prateleira"
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="facingShare"
                stroke="hsl(var(--secondary))"
                strokeWidth={2}
                name="Share por Faces"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};