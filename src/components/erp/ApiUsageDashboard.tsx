import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, Activity, AlertTriangle, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface ErpApiKey {
  id: string;
  key_preview: string;
  empresa_id: string;
  request_count: number;
  max_requests: number;
  active: boolean;
  expires_at: string;
}

interface Props {
  keys: ErpApiKey[];
}

export default function ApiUsageDashboard({ keys }: Props) {
  const activeKeys = keys.filter(k => k.active);

  const totalUsed = activeKeys.reduce((s, k) => s + k.request_count, 0);
  const totalMax = activeKeys.reduce((s, k) => s + k.max_requests, 0);
  const usagePercent = totalMax > 0 ? Math.round((totalUsed / totalMax) * 100) : 0;

  // Fetch daily usage from erp_sync_log
  const { data: dailyData = [], isLoading } = useQuery({
    queryKey: ["api-usage-daily"],
    queryFn: async () => {
      const since = subDays(new Date(), 14).toISOString();
      const { data, error } = await supabase
        .from("erp_sync_log")
        .select("synced_at, status")
        .gte("synced_at", since)
        .order("synced_at", { ascending: true });

      if (error) return [];

      // Group by day
      const byDay: Record<string, { total: number; errors: number }> = {};
      (data || []).forEach((row: any) => {
        const day = format(new Date(row.synced_at), "dd/MM");
        if (!byDay[day]) byDay[day] = { total: 0, errors: 0 };
        byDay[day].total++;
        if (row.status === "error") byDay[day].errors++;
      });

      return Object.entries(byDay).map(([day, v]) => ({
        day,
        total: v.total,
        errors: v.errors,
        success: v.total - v.errors,
      }));
    },
  });

  const usageColor = usagePercent >= 90 ? "text-destructive" : usagePercent >= 70 ? "text-amber-600" : "text-emerald-600";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Meu Uso da API
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="border rounded-lg p-3 text-center">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Total Usado</p>
            <p className={`text-xl font-bold ${usageColor}`}>{totalUsed.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">de {totalMax.toLocaleString()}</p>
          </div>
          <div className="border rounded-lg p-3 text-center">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider">% Utilizado</p>
            <p className={`text-xl font-bold ${usageColor}`}>{usagePercent}%</p>
            {usagePercent >= 80 && (
              <Badge variant="destructive" className="text-[9px] mt-1">
                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Próximo do limite
              </Badge>
            )}
          </div>
          <div className="border rounded-lg p-3 text-center">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Chaves Ativas</p>
            <p className="text-xl font-bold text-foreground">{activeKeys.length}</p>
            <p className="text-[10px] text-muted-foreground">de {keys.length} total</p>
          </div>
        </div>

        {/* Usage Progress */}
        <div>
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Consumo total</span>
            <span>{usagePercent}%</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                usagePercent >= 90 ? "bg-destructive" : usagePercent >= 70 ? "bg-amber-500" : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Daily Chart */}
        <div>
          <h4 className="text-xs font-medium mb-2">Uso por dia (últimos 14 dias)</h4>
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Carregando...
            </div>
          ) : dailyData.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
              Nenhum dado de uso encontrado nos últimos 14 dias
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="success" stackId="a" fill="hsl(var(--primary))" name="Sucesso" radius={[2, 2, 0, 0]} />
                <Bar dataKey="errors" stackId="a" fill="hsl(var(--destructive))" name="Erros" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Per-key usage */}
        {activeKeys.length > 0 && (
          <div>
            <h4 className="text-xs font-medium mb-2">Uso por chave</h4>
            <div className="space-y-1.5">
              {activeKeys.map(k => {
                const pct = k.max_requests > 0 ? Math.round((k.request_count / k.max_requests) * 100) : 0;
                return (
                  <div key={k.id} className="flex items-center gap-2">
                    <code className="text-[10px] font-mono w-24 truncate text-muted-foreground">{k.key_preview}</code>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-16 text-right">
                      {k.request_count.toLocaleString()}/{k.max_requests.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
