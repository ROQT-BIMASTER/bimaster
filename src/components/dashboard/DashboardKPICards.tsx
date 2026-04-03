import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Receipt, Wallet, CheckCircle2 } from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";

interface DashboardKPIs {
  totalClientes: number;
  contasPagarPendentes: number;
  contasReceberAbertas: number;
  tarefasPendentes: number;
}

export function DashboardKPICards() {
  const { data, isLoading } = useQuery<DashboardKPIs>({
    queryKey: ["dashboard-home-kpis"],
    queryFn: async () => {
      const [clientesRes, apRes, arRes, tarefasRes] = await Promise.all([
        supabase.from("clientes").select("*", { count: "exact", head: true }),
        supabase.from("contas_pagar").select("*", { count: "exact", head: true }).eq("status", "pendente"),
        supabase.from("contas_receber").select("*", { count: "exact", head: true }).eq("status_recebimento", "pendente"),
        supabase.from("projeto_tarefas").select("*", { count: "exact", head: true }).in("status", ["todo", "in_progress"]),
      ]);

      return {
        totalClientes: clientesRes.count ?? 0,
        contasPagarPendentes: apRes.count ?? 0,
        contasReceberAbertas: arRes.count ?? 0,
        tarefasPendentes: tarefasRes.count ?? 0,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <KpiCard
        title="Clientes Ativos"
        value={data?.totalClientes.toLocaleString("pt-BR") ?? "—"}
        icon={Users}
        variant="info"
        loading={isLoading}
      />
      <KpiCard
        title="Contas a Pagar"
        value={data?.contasPagarPendentes.toLocaleString("pt-BR") ?? "—"}
        subtitle="Pendentes"
        icon={Receipt}
        variant="warning"
        loading={isLoading}
      />
      <KpiCard
        title="Contas a Receber"
        value={data?.contasReceberAbertas.toLocaleString("pt-BR") ?? "—"}
        subtitle="Em aberto"
        icon={Wallet}
        variant="success"
        loading={isLoading}
      />
      <KpiCard
        title="Tarefas Pendentes"
        value={data?.tarefasPendentes.toLocaleString("pt-BR") ?? "—"}
        icon={CheckCircle2}
        variant="default"
        loading={isLoading}
      />
    </div>
  );
}
