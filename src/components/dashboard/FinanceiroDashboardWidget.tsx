import { memo, useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt, AlertCircle, Clock, TrendingDown, TrendingUp, CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatCurrency } from "@/lib/formatters";

interface FinanceiroStats {
  contasPagarPendentes: number;
  contasPagarVencidas: number;
  totalAPagar: number;
  totalPagarVencido: number;
  contasReceberPendentes: number;
  contasReceberVencidas: number;
  totalAReceber: number;
  totalReceberVencido: number;
}

export const FinanceiroDashboardWidget = memo(() => {
  const [stats, setStats] = useState<FinanceiroStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];

        // Contas a Pagar: queries com count (head:true) são OK — não retornam rows
        // Valores: também usam head queries, volumes menores que CR
        const [
          pagarPendentesResult,
          pagarVencidasResult,
          totalPagarResult,
          totalPagarVencidoResult,
          crTotais,
        ] = await Promise.all([
          supabase.from("contas_pagar").select("*", { count: "exact", head: true }).eq("status", "pendente").gte("data_vencimento", today),
          supabase.from("contas_pagar").select("*", { count: "exact", head: true }).eq("status", "pendente").lt("data_vencimento", today),
          supabase.from("contas_pagar").select("valor_aberto").eq("status", "pendente").gte("data_vencimento", today),
          supabase.from("contas_pagar").select("valor_aberto").eq("status", "pendente").lt("data_vencimento", today),
          // Contas a Receber: usa RPC server-side para agregar 470k+ registros
          supabase.rpc("get_financeiro_dashboard_totais"),
        ]);

        const totalPagar = totalPagarResult.data?.reduce((sum, c) => sum + (c.valor_aberto || 0), 0) || 0;
        const totalPagarVencido = totalPagarVencidoResult.data?.reduce((sum, c) => sum + (c.valor_aberto || 0), 0) || 0;

        const cr = crTotais.data as Record<string, number> | null;

        setStats({
          contasPagarPendentes: pagarPendentesResult.count || 0,
          contasPagarVencidas: pagarVencidasResult.count || 0,
          totalAPagar: totalPagar,
          totalPagarVencido: totalPagarVencido,
          contasReceberPendentes: (cr?.count_pendente || 0) + (cr?.count_parcial || 0),
          contasReceberVencidas: cr?.count_vencido || 0,
          totalAReceber: (cr?.total_pendente || 0) + (cr?.total_parcial || 0) + (cr?.total_vencido || 0),
          totalReceberVencido: cr?.total_vencido || 0,
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
    { title: t("fin_w.payable_pending"), value: stats?.contasPagarPendentes || 0, icon: Clock, description: t("fin_w.titles_due"), format: "number" as const, color: "text-blue-600", section: "pagar" },
    { title: t("fin_w.payable_overdue"), value: stats?.contasPagarVencidas || 0, icon: AlertCircle, description: t("fin_w.attention_needed"), format: "number" as const, color: "text-red-600", section: "pagar" },
    { title: t("fin_w.total_payable"), value: stats?.totalAPagar || 0, icon: TrendingDown, description: t("fin_w.pending_value"), format: "currency" as const, color: "text-amber-600", section: "pagar" },
    { title: t("fin_w.payable_overdue_val"), value: stats?.totalPagarVencido || 0, icon: AlertCircle, description: t("fin_w.overdue_value"), format: "currency" as const, color: "text-red-600", section: "pagar" },
    { title: t("fin_w.receivable_pending"), value: stats?.contasReceberPendentes || 0, icon: Clock, description: t("fin_w.titles_due"), format: "number" as const, color: "text-emerald-600", section: "receber" },
    { title: t("fin_w.receivable_overdue"), value: stats?.contasReceberVencidas || 0, icon: AlertCircle, description: t("fin_w.delinquency"), format: "number" as const, color: "text-red-600", section: "receber" },
    { title: t("fin_w.total_receivable"), value: stats?.totalAReceber || 0, icon: TrendingUp, description: t("fin_w.pending_value"), format: "currency" as const, color: "text-emerald-600", section: "receber" },
    { title: t("fin_w.receivable_overdue_val"), value: stats?.totalReceberVencido || 0, icon: AlertCircle, description: t("fin_w.overdue_value"), format: "currency" as const, color: "text-red-600", section: "receber" },
  ], [stats, t]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardHeader className="pb-2"><Skeleton className="h-4 w-32" /></CardHeader><CardContent><Skeleton className="h-8 w-24" /></CardContent></Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardHeader className="pb-2"><Skeleton className="h-4 w-32" /></CardHeader><CardContent><Skeleton className="h-8 w-24" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  const pagarCards = statCards.filter(s => s.section === "pagar");
  const receberCards = statCards.filter(s => s.section === "receber");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <TrendingDown className="h-4 w-4" />
          {t("fin_w.section_payable")}
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
                  {stat.format === "currency" ? formatCurrency(stat.value) : stat.value.toLocaleString("pt-BR")}
                </div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          {t("fin_w.section_receivable")}
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
                  {stat.format === "currency" ? formatCurrency(stat.value) : stat.value.toLocaleString("pt-BR")}
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
