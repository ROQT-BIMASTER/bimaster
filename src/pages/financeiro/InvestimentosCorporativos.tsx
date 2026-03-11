import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SmartValue } from "@/components/ui/smart-value";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  Wallet,
  RefreshCw,
  Loader2,
  Filter,
  PieChart as PieChartIcon,
  BarChart3,
  Calendar,
  Building2,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useConciliacaoBancaria } from "@/hooks/useConciliacaoBancaria";
import { useUserEmpresas } from "@/hooks/useUserEmpresas";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(142, 76%, 36%)",
  "hsl(48, 96%, 53%)",
  "hsl(0, 84%, 60%)",
  "hsl(262, 83%, 58%)",
  "hsl(199, 89%, 48%)",
  "hsl(24, 95%, 53%)",
  "hsl(330, 81%, 60%)",
];

export default function InvestimentosCorporativos() {
  const { data: userEmpresas } = useUserEmpresas();
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);
  const [syncingConn, setSyncingConn] = useState<string | null>(null);

  const { investments, investmentsLoading, connections, syncInvestments } = useConciliacaoBancaria(selectedEmpresaId);

  const handleSync = async (connectionId: string) => {
    setSyncingConn(connectionId);
    try {
      await syncInvestments(connectionId);
    } finally {
      setSyncingConn(null);
    }
  };

  const totalBalance = investments.reduce((sum: number, inv: any) => sum + (inv.balance || 0), 0);

  // Group by type for pie chart
  const byType = investments.reduce<Record<string, number>>((acc, inv: any) => {
    const type = inv.type || "Outros";
    acc[type] = (acc[type] || 0) + (inv.balance || 0);
    return acc;
  }, {});

  const pieData = Object.entries(byType).map(([name, value]) => ({ name, value }));

  // Group by empresa
  const byEmpresa = investments.reduce<Record<string, { nome: string; total: number; count: number }>>((acc, inv: any) => {
    const empresa = inv.bank_connections?.empresas?.nome || "Sem Filial";
    if (!acc[empresa]) acc[empresa] = { nome: empresa, total: 0, count: 0 };
    acc[empresa].total += inv.balance || 0;
    acc[empresa].count++;
    return acc;
  }, {});

  const activeInvestments = investments.filter((inv: any) => inv.status !== "REDEEMED");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Investimentos Corporativos</h1>
            <p className="text-muted-foreground">
              Patrimônio financeiro aplicado em todas as filiais
            </p>
          </div>
          <div className="flex items-center gap-2">
            {userEmpresas && userEmpresas.length > 1 && (
              <Select
                value={selectedEmpresaId?.toString() || "all"}
                onValueChange={(v) => setSelectedEmpresaId(v === "all" ? null : parseInt(v))}
              >
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="Filial" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Filiais</SelectItem>
                  {userEmpresas.map((ue) => (
                    <SelectItem key={ue.empresa_id} value={ue.empresa_id.toString()}>
                      {ue.empresa.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Patrimônio Total</CardTitle>
              <Wallet className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                <SmartValue value={totalBalance} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {activeInvestments.length} investimento{activeInvestments.length !== 1 ? "s" : ""} ativo{activeInvestments.length !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tipos de Aplicação</CardTitle>
              <PieChartIcon className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{Object.keys(byType).length}</div>
              <p className="text-xs text-muted-foreground mt-1">categorias diferentes</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Filiais com Investimentos</CardTitle>
              <Building2 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{Object.keys(byEmpresa).length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Sync per connection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Sincronizar Investimentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {connections.map((conn: any) => (
                <Button
                  key={conn.id}
                  size="sm"
                  variant="outline"
                  disabled={syncingConn === conn.id}
                  onClick={() => handleSync(conn.id)}
                >
                  {syncingConn === conn.id ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  {conn.banco} {conn.conta && `• ${conn.conta}`}
                </Button>
              ))}
              {connections.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma conta bancária conectada</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Chart + Table */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Pie Chart */}
          {pieData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Composição da Carteira
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((_, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) =>
                        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
                      }
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* By Empresa */}
          {Object.keys(byEmpresa).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Investimentos por Filial
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.values(byEmpresa).map((emp) => (
                    <div key={emp.nome} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <div>
                        <p className="text-sm font-medium">{emp.nome}</p>
                        <p className="text-xs text-muted-foreground">{emp.count} aplicação(ões)</p>
                      </div>
                      <p className="text-sm font-bold">
                        <SmartValue value={emp.total} />
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Investments Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Detalhamento dos Investimentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {investmentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : investments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum investimento encontrado. Sincronize suas contas bancárias.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Nome</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Tipo</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Emissor</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Saldo</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Taxa Anual</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Vencimento</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Banco</th>
                    </tr>
                  </thead>
                  <tbody>
                    {investments.map((inv: any) => (
                      <tr key={inv.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-3 font-medium">{inv.name || "—"}</td>
                        <td className="py-2 px-3">
                          <Badge variant="outline" className="text-[10px]">
                            {inv.subtype || inv.type || "—"}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">{inv.issuer || "—"}</td>
                        <td className="py-2 px-3 text-right font-bold">
                          <SmartValue value={inv.balance || 0} />
                        </td>
                        <td className="py-2 px-3 text-right text-muted-foreground">
                          {inv.annual_rate ? `${inv.annual_rate}%` : "—"}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {inv.due_date ? format(new Date(inv.due_date), "dd/MM/yyyy") : "—"}
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant={inv.status === "ACTIVE" ? "default" : "secondary"} className="text-[10px]">
                            {inv.status === "ACTIVE" ? "Ativo" : inv.status || "—"}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-muted-foreground text-xs">
                          {inv.bank_connections?.banco || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
