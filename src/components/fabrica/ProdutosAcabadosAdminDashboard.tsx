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

interface Props {
  revisoes: any[] | undefined;
  fichasConfig: any[] | undefined;
  alertasAumento: any[] | undefined;
  produtos: any[] | undefined;
}

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

  // Alert data
  const alertas = useMemo(() => {
    const items: { tipo: "aumento" | "sem_ficha"; titulo: string; descricao: string }[] = [];

    // Products with cost increase in last 30 days
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

    // Products without cost config
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

      {/* Linha 2 + 3: Revisões Recentes + Alertas */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Painel de Revisões Solicitadas */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Revisões Solicitadas pela Diretoria
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

        {/* Alertas Rápidos */}
        <Card>
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
