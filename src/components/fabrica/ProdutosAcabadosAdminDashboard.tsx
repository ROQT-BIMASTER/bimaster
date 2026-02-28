import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSupabaseQuery } from "@/hooks/useSupabaseQuery";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import {
  Clock,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  FileX,
  ArrowRight,
  DollarSign,
  ClipboardList,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface Props {
  revisoes: any[] | undefined;
  fichasConfig: any[] | undefined;
  alertasAumento: any[] | undefined;
  produtos: any[] | undefined;
}

const CHART_COLORS = {
  pendentes: "hsl(0, 84%, 60%)",
  emAnalise: "hsl(217, 91%, 60%)",
  aprovadas: "hsl(142, 71%, 45%)",
  reprovadas: "hsl(25, 95%, 53%)",
};

export function ProdutosAcabadosAdminDashboard({
  revisoes,
  fichasConfig,
  alertasAumento,
  produtos,
}: Props) {
  const navigate = useNavigate();

  // Query for recent revisions with product name
  const { data: revisoesRecentes } = useSupabaseQuery(
    ["fabrica-revisoes-recentes-admin"],
    async () => {
      const { data, error } = await supabase
        .from("fabrica_ficha_custo_revisoes")
        .select(`
          id, config_id, produto_id, status, submetido_em, versao, parecer,
          produto:fabrica_produtos(id, nome, codigo)
        `)
        .in("status", ["pendente", "revisao_solicitada", "em_revisao"])
        .order("submetido_em", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as any[];
    },
    { staleTime: 0, refetchOnMount: "always" }
  );

  // KPI counts
  const kpis = useMemo(() => {
    if (!revisoes) return { pendentes: 0, emAnalise: 0, aprovadas: 0, reprovadas: 0 };
    const pendentes = revisoes.filter(
      (r: any) => r.status === "revisao_solicitada" || r.status === "pendente"
    ).length;
    const emAnalise = revisoes.filter((r: any) => r.status === "em_revisao").length;
    const aprovadas = revisoes.filter((r: any) => r.status === "aprovada").length;
    const reprovadas = revisoes.filter((r: any) => r.status === "reprovada").length;
    return { pendentes, emAnalise, aprovadas, reprovadas };
  }, [revisoes]);

  // Chart data
  const chartData = useMemo(() => {
    return [
      { name: "Pendentes", value: kpis.pendentes, color: CHART_COLORS.pendentes },
      { name: "Em Análise", value: kpis.emAnalise, color: CHART_COLORS.emAnalise },
      { name: "Aprovadas", value: kpis.aprovadas, color: CHART_COLORS.aprovadas },
      { name: "Reprovadas", value: kpis.reprovadas, color: CHART_COLORS.reprovadas },
    ].filter((d) => d.value > 0);
  }, [kpis]);

  const totalRevisoes = kpis.pendentes + kpis.emAnalise + kpis.aprovadas + kpis.reprovadas;

  // Alert data
  const alertas = useMemo(() => {
    const items: { tipo: "aumento" | "sem_ficha"; titulo: string; descricao: string }[] = [];

    if (alertasAumento && produtos) {
      const trintaDias = new Date();
      trintaDias.setDate(trintaDias.getDate() - 30);
      const produtosComAumento = new Set<string>();
      alertasAumento.forEach((a: any) => {
        if (
          Number(a.valor_novo) > Number(a.valor_anterior) &&
          new Date(a.created_at) >= trintaDias
        ) {
          produtosComAumento.add(a.produto_id);
        }
      });
      if (produtosComAumento.size > 0) {
        items.push({
          tipo: "aumento",
          titulo: `${produtosComAumento.size} produto(s) com aumento de custo`,
          descricao: "Nos últimos 30 dias",
        });
      }
    }

    if (produtos && fichasConfig) {
      const configuredIds = new Set(fichasConfig.map((f: any) => f.produto_id));
      const semFicha = produtos.filter((p: any) => !configuredIds.has(p.id));
      if (semFicha.length > 0) {
        items.push({
          tipo: "sem_ficha",
          titulo: `${semFicha.length} produto(s) sem ficha de custos`,
          descricao: "Configuração pendente",
        });
      }
    }

    return items;
  }, [alertasAumento, produtos, fichasConfig]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pendente":
        return <Badge variant="warning">Pendente</Badge>;
      case "revisao_solicitada":
        return <Badge variant="destructive">Revisão Solicitada</Badge>;
      case "em_revisao":
        return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">Em Análise</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-xl">
          <p className="font-medium">{data.name}</p>
          <p className="text-muted-foreground">{data.value} revisão(ões)</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Linha 1: KPIs de Revisão */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Revisões Pendentes</p>
                <p className="text-2xl font-bold text-red-600">{kpis.pendentes}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center">
                <Clock className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Em Análise</p>
                <p className="text-2xl font-bold text-blue-600">{kpis.emAnalise}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center">
                <Search className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Aprovadas</p>
                <p className="text-2xl font-bold text-green-600">{kpis.aprovadas}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Reprovadas</p>
                <p className="text-2xl font-bold text-orange-600">{kpis.reprovadas}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Linha 2: Revisões Recentes + Gráfico + Alertas */}
      <div className="grid gap-4 md:grid-cols-5">
        {/* Painel de Revisões Solicitadas */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Revisões Solicitadas
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dashboard/fabrica/revisao-fichas">
                  Ver todas <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!revisoesRecentes || revisoesRecentes.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <div className="text-center">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nenhuma revisão pendente</p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-[220px]">
                <div className="space-y-2">
                  {revisoesRecentes.map((rev: any) => (
                    <div
                      key={rev.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm truncate">
                            {rev.produto?.nome || "Produto"}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {rev.produto?.codigo}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(rev.status)}
                          <span className="text-xs text-muted-foreground">
                            {rev.submetido_em
                              ? format(new Date(rev.submetido_em), "dd/MM/yy HH:mm", {
                                  locale: ptBR,
                                })
                              : "—"}
                          </span>
                          <span className="text-xs text-muted-foreground">v{rev.versao}</span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-2 shrink-0"
                        onClick={() =>
                          navigate(`/dashboard/fabrica/produtos/${rev.produto_id}/custos`)
                        }
                      >
                        <DollarSign className="h-4 w-4 mr-1" />
                        Ficha
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de Distribuição */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-center">Distribuição</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            {totalRevisoes === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <div className="text-center">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Sem revisões</p>
                </div>
              </div>
            ) : (
              <>
                <div className="w-full h-[160px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={2}
                        stroke="hsl(var(--background))"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{totalRevisoes}</p>
                      <p className="text-[10px] text-muted-foreground">Total</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-xs w-full">
                  {chartData.map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5">
                      <div
                        className="h-2.5 w-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-muted-foreground truncate">{item.name}</span>
                      <span className="font-medium ml-auto">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Alertas Rápidos */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Alertas Rápidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alertas.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <div className="text-center">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nenhum alerta</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {alertas.map((alerta, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border ${
                      alerta.tipo === "aumento"
                        ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
                        : "border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {alerta.tipo === "aumento" ? (
                        <TrendingUp className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                      ) : (
                        <FileX className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{alerta.titulo}</p>
                        <p className="text-xs text-muted-foreground">{alerta.descricao}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
