import { memo, useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt, AlertCircle, Clock, TrendingDown, TrendingUp, CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface FinanceiroStats {
  // Contas a Pagar
  contasPagarPendentes: number;
  contasPagarVencidas: number;
  totalAPagar: number;
  totalPagarVencido: number;
  // Contas a Receber
  contasReceberPendentes: number;
  contasReceberVencidas: number;
  totalAReceber: number;
  totalReceberVencido: number;
}

export const FinanceiroDashboardWidget = memo(() => {
  const [stats, setStats] = useState<FinanceiroStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];

        const [
          // Contas a Pagar
          pagarPendentesResult,
          pagarVencidasResult,
          totalPagarResult,
          totalPagarVencidoResult,
          // Contas a Receber
          receberPendentesResult,
          receberVencidasResult,
          totalReceberResult,
          totalReceberVencidoResult,
        ] = await Promise.all([
          // Contas a Pagar - Pendentes (a vencer)
          supabase
            .from("contas_pagar")
            .select("*", { count: "exact", head: true })
            .eq("status", "pendente")
            .gte("data_vencimento", today),
          // Contas a Pagar - Vencidas
          supabase
            .from("contas_pagar")
            .select("*", { count: "exact", head: true })
            .eq("status", "pendente")
            .lt("data_vencimento", today),
          // Contas a Pagar - Total pendente
          supabase
            .from("contas_pagar")
            .select("valor_aberto")
            .eq("status", "pendente")
            .gte("data_vencimento", today),
          // Contas a Pagar - Total vencido
          supabase
            .from("contas_pagar")
            .select("valor_aberto")
            .eq("status", "pendente")
            .lt("data_vencimento", today),
          // Contas a Receber - Pendentes (a vencer) - status válidos: pendente, parcial
          supabase
            .from("contas_receber")
            .select("*", { count: "exact", head: true })
            .in("status", ["pendente", "parcial"])
            .gte("data_vencimento", today),
          // Contas a Receber - Vencidas (status vencido OU pendente/parcial com data passada)
          supabase
            .from("contas_receber")
            .select("*", { count: "exact", head: true })
            .in("status", ["vencido", "pendente", "parcial"])
            .lt("data_vencimento", today),
          // Contas a Receber - Total pendente (valor aberto de títulos a vencer)
          supabase
            .from("contas_receber")
            .select("valor_aberto")
            .in("status", ["pendente", "parcial"])
            .gte("data_vencimento", today),
          // Contas a Receber - Total vencido (valor aberto de títulos vencidos)
          supabase
            .from("contas_receber")
            .select("valor_aberto")
            .in("status", ["vencido", "pendente", "parcial"])
            .lt("data_vencimento", today),
        ]);

        const totalPagar = totalPagarResult.data?.reduce((sum, c) => sum + (c.valor_aberto || 0), 0) || 0;
        const totalPagarVencido = totalPagarVencidoResult.data?.reduce((sum, c) => sum + (c.valor_aberto || 0), 0) || 0;
        const totalReceber = totalReceberResult.data?.reduce((sum, c) => sum + (c.valor_aberto || 0), 0) || 0;
        const totalReceberVencido = totalReceberVencidoResult.data?.reduce((sum, c) => sum + (c.valor_aberto || 0), 0) || 0;

        setStats({
          contasPagarPendentes: pagarPendentesResult.count || 0,
          contasPagarVencidas: pagarVencidasResult.count || 0,
          totalAPagar: totalPagar,
          totalPagarVencido: totalPagarVencido,
          contasReceberPendentes: receberPendentesResult.count || 0,
          contasReceberVencidas: receberVencidasResult.count || 0,
          totalAReceber: totalReceber,
          totalReceberVencido: totalReceberVencido,
        });
      } catch (error) {
        console.error("Erro ao carregar stats financeiro:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = useMemo(() => [
    // Contas a Pagar
    {
      title: "A Pagar (Pendentes)",
      value: stats?.contasPagarPendentes || 0,
      icon: Clock,
      description: "Títulos a vencer",
      format: "number" as const,
      color: "text-blue-600",
      section: "pagar",
    },
    {
      title: "A Pagar (Vencidas)",
      value: stats?.contasPagarVencidas || 0,
      icon: AlertCircle,
      description: "Atenção necessária",
      format: "number" as const,
      color: "text-red-600",
      section: "pagar",
    },
    {
      title: "Total a Pagar",
      value: stats?.totalAPagar || 0,
      icon: TrendingDown,
      description: "Valor pendente",
      format: "currency" as const,
      color: "text-amber-600",
      section: "pagar",
    },
    {
      title: "Pagar Vencido",
      value: stats?.totalPagarVencido || 0,
      icon: AlertCircle,
      description: "Valor em atraso",
      format: "currency" as const,
      color: "text-red-600",
      section: "pagar",
    },
    // Contas a Receber
    {
      title: "A Receber (Pendentes)",
      value: stats?.contasReceberPendentes || 0,
      icon: Clock,
      description: "Títulos a vencer",
      format: "number" as const,
      color: "text-emerald-600",
      section: "receber",
    },
    {
      title: "A Receber (Vencidas)",
      value: stats?.contasReceberVencidas || 0,
      icon: AlertCircle,
      description: "Inadimplência",
      format: "number" as const,
      color: "text-red-600",
      section: "receber",
    },
    {
      title: "Total a Receber",
      value: stats?.totalAReceber || 0,
      icon: TrendingUp,
      description: "Valor pendente",
      format: "currency" as const,
      color: "text-emerald-600",
      section: "receber",
    },
    {
      title: "Receber Vencido",
      value: stats?.totalReceberVencido || 0,
      icon: AlertCircle,
      description: "Valor em atraso",
      format: "currency" as const,
      color: "text-red-600",
      section: "receber",
    },
  ], [stats]);

  if (loading) {
    return (
      <div className="space-y-4">
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
      </div>
    );
  }

  const pagarCards = statCards.filter(s => s.section === "pagar");
  const receberCards = statCards.filter(s => s.section === "receber");

  return (
    <div className="space-y-6">
      {/* Contas a Pagar */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <TrendingDown className="h-4 w-4" />
          Contas a Pagar
        </h3>
        <div className="grid gap-4 md:grid-cols-4">
          {pagarCards.map((stat, index) => (
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
      </div>

      {/* Contas a Receber */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Contas a Receber
        </h3>
        <div className="grid gap-4 md:grid-cols-4">
          {receberCards.map((stat, index) => (
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
      </div>
    </div>
  );
});

FinanceiroDashboardWidget.displayName = "FinanceiroDashboardWidget";
