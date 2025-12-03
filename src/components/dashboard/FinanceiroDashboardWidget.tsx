import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt, AlertCircle, Clock, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface FinanceiroStats {
  contasPendentes: number;
  contasVencidas: number;
  totalAPagar: number;
  totalVencido: number;
}

export const FinanceiroDashboardWidget = () => {
  const [stats, setStats] = useState<FinanceiroStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];

        const [pendentesResult, vencidasResult, totalPagarResult, totalVencidoResult] = await Promise.all([
          supabase
            .from("contas_pagar")
            .select("*", { count: "exact", head: true })
            .eq("status", "pendente")
            .gte("data_vencimento", today),
          supabase
            .from("contas_pagar")
            .select("*", { count: "exact", head: true })
            .eq("status", "pendente")
            .lt("data_vencimento", today),
          supabase
            .from("contas_pagar")
            .select("valor_aberto")
            .eq("status", "pendente")
            .gte("data_vencimento", today),
          supabase
            .from("contas_pagar")
            .select("valor_aberto")
            .eq("status", "pendente")
            .lt("data_vencimento", today),
        ]);

        const totalPagar = totalPagarResult.data?.reduce((sum, c) => sum + (c.valor_aberto || 0), 0) || 0;
        const totalVencido = totalVencidoResult.data?.reduce((sum, c) => sum + (c.valor_aberto || 0), 0) || 0;

        setStats({
          contasPendentes: pendentesResult.count || 0,
          contasVencidas: vencidasResult.count || 0,
          totalAPagar: totalPagar,
          totalVencido: totalVencido,
        });
      } catch (error) {
        console.error("Erro ao carregar stats financeiro:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: "Contas Pendentes",
      value: stats?.contasPendentes || 0,
      icon: Clock,
      description: "A vencer",
      format: "number",
      color: "text-blue-600",
    },
    {
      title: "Contas Vencidas",
      value: stats?.contasVencidas || 0,
      icon: AlertCircle,
      description: "Atenção necessária",
      format: "number",
      color: "text-red-600",
    },
    {
      title: "Total a Pagar",
      value: stats?.totalAPagar || 0,
      icon: Receipt,
      description: "Valor pendente",
      format: "currency",
      color: "text-amber-600",
    },
    {
      title: "Total Vencido",
      value: stats?.totalVencido || 0,
      icon: TrendingDown,
      description: "Valor em atraso",
      format: "currency",
      color: "text-red-600",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {statCards.map((stat, index) => (
        <Card key={index} className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stat.format === "currency"
                ? `R$ ${stat.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                : stat.value.toLocaleString("pt-BR")}
            </div>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
