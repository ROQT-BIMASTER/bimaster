import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  DollarSign, 
  Receipt, 
  TrendingUp, 
  Clock,
  Activity,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { fetchAllRows } from "@/lib/utils/fetchAllRows";
import { formatCurrency } from "@/lib/formatters";

export default function Financeiro() {
  const { user } = useAuth();

  // Fetch user name
  const { data: userName } = useQuery({
    queryKey: ["profile-name", user?.id],
    queryFn: async () => {
      if (!user?.id) return "";
      const { data } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", user.id)
        .single();
      return data?.nome?.split(" ")[0] || "";
    },
    enabled: !!user?.id,
  });

  // Fetch KPI data
  const { data: kpis } = useQuery({
    queryKey: ["financeiro-overview-kpis"],
    queryFn: async () => {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
      const startOfMonth = `${y}-${m}-01`;
      const endOfMonth = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
      const today = format(now, "yyyy-MM-dd");

      // Fetch contas_pagar via fetchAllRows (working)
      const pagar = await fetchAllRows(
        "contas_pagar",
        "valor_original, valor_pago, valor_aberto, status, data_vencimento",
        (q: any) => q.gte("data_vencimento", startOfMonth).lte("data_vencimento", endOfMonth)
      );

      // Fetch contas_receber manually with explicit error handling
      // fetchAllRows may silently fail for this table
      const receberAll: any[] = [];
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("contas_receber" as any)
          .select("valor_original, valor_recebido, valor_aberto, status, data_vencimento")
          .gte("data_vencimento", startOfMonth)
          .lte("data_vencimento", endOfMonth)
          .order("id" as any, { ascending: true })
          .range(offset, offset + batchSize - 1);

        if (error) {
          console.error('[Financeiro] Erro ao buscar contas_receber:', error);
          break;
        }
        if (data && data.length > 0) {
          receberAll.push(...data);
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      console.log('[Financeiro] contas_pagar:', pagar.length, '| contas_receber:', receberAll.length);

      const totalPagar = pagar.reduce((s: number, r: any) => s + (parseFloat(r.valor_aberto) || 0), 0);
      const totalReceber = receberAll.reduce((s: number, r: any) => s + (parseFloat(r.valor_aberto) || 0), 0);
      const saldo = totalReceber - totalPagar;
      const vencidasPagar = pagar.filter((r: any) => r.data_vencimento < today && r.status !== "pago" && r.status !== "cancelado").length;
      const vencidasReceber = receberAll.filter((r: any) => r.data_vencimento < today && r.status !== "recebido" && r.status !== "cancelado").length;
      const vencidas = vencidasPagar + vencidasReceber;

      console.log('[Financeiro] totalPagar:', totalPagar, '| totalReceber:', totalReceber);

      return { totalPagar, totalReceber, saldo, vencidas };
    },
  });

  // Fetch recent activities
  const { data: recentActivities = [] } = useQuery({
    queryKey: ["financeiro-recent-activities"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contas_pagar")
        .select("id, fornecedor_nome, valor_original, status, data_vencimento, updated_at")
        .order("updated_at", { ascending: false })
        .limit(8) as any;
      return data || [];
    },
  });

  const formatCurrency = (v: number) =>
    `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const statusColor: Record<string, string> = {
    pendente: "bg-yellow-100 text-yellow-800",
    parcial: "bg-blue-100 text-blue-800",
    pago: "bg-green-100 text-green-800",
    cancelado: "bg-muted text-muted-foreground",
    vencido: "bg-red-100 text-red-800",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold">
            {userName ? `Olá, ${userName} 👋` : "Visão Geral Financeira"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Resumo financeiro do mês atual. Use o menu lateral para acessar cada módulo.
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total a Pagar</CardTitle>
              <Receipt className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {formatCurrency(kpis?.totalPagar || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Neste mês</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total a Receber</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(kpis?.totalReceber || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Neste mês</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Saldo Consolidado</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(kpis?.saldo || 0) >= 0 ? "text-green-600" : "text-destructive"}`}>
                {formatCurrency(kpis?.saldo || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Receber - Pagar</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Títulos Vencidos</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {kpis?.vencidas || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">A pagar em atraso</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhuma atividade financeira recente.
              </p>
            ) : (
              <div className="divide-y">
                {recentActivities.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item.fornecedor_nome || "Sem fornecedor"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Venc: {item.data_vencimento ? format(new Date(item.data_vencimento), "dd/MM/yyyy") : "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={statusColor[item.status] || ""}>
                        {item.status}
                      </Badge>
                      <span className="text-sm font-semibold whitespace-nowrap">
                        {formatCurrency(parseFloat(item.valor_original) || 0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
