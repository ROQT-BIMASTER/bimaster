import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, DollarSign, Package, TrendingUp, Edit, Eye, Trash2, BarChart3, List, Percent, Bell, Grid3X3, HelpCircle, Shield, ListTodo, Layers } from "lucide-react";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { useUserPriceTableAccess } from "@/hooks/useUserPriceTableAccess";
import { NovaTabelaPrecoDialog } from "@/components/fabrica/NovaTabelaPrecoDialog";
import { CadeiaPrecificacaoVisual } from "@/components/fabrica/CadeiaPrecificacaoVisual";
import { GeradorPrecosDialog } from "@/components/fabrica/GeradorPrecosDialog";
import { VisualizacaoPrecosDialog } from "@/components/fabrica/VisualizacaoPrecosDialog";
import { DashboardPrecosAnalytics } from "@/components/fabrica/DashboardPrecosAnalytics";
import { ReajusteEmLoteDialog } from "@/components/fabrica/ReajusteEmLoteDialog";
import { AlertasPrecos } from "@/components/fabrica/AlertasPrecos";
import { MatrizPrecosComparativa } from "@/components/fabrica/MatrizPrecosComparativa";
import { ManualTabelasPrecoDialog } from "@/components/fabrica/ManualTabelasPrecoDialog";
import { GerenciarLimitesPrecoDialog } from "@/components/fabrica/GerenciarLimitesPrecoDialog";
import { MarkupOverridesManager } from "@/components/fabrica/MarkupOverridesManager";
import { TarefasAjustePrecoPanel } from "@/components/fabrica/TarefasAjustePrecoPanel";
import { formatarMoeda } from "@/lib/fabrica/pricing-calculator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { TourButton } from "@/components/tour/TourButton";
import { FABRICA_TABELAS_PRECO_TOUR_ID, fabricaTabelasPrecoTourSteps } from "@/components/tour/tours/fabricaTabelasPrecoTour";

export default function FabricaTabelasPreco() {
  const { hasPermission, loading: permLoading } = useScreenPermissions();
  const { filterTablesByAccess, loading: accessLoading, canViewTable, canEditTable } = useUserPriceTableAccess();
  const [dialogNovaTabela, setDialogNovaTabela] = useState(false);
  const [dialogGerarPrecos, setDialogGerarPrecos] = useState(false);
  const [dialogVisualizacao, setDialogVisualizacao] = useState(false);
  const [dialogExcluir, setDialogExcluir] = useState(false);
  const [dialogReajuste, setDialogReajuste] = useState(false);
  const [dialogManual, setDialogManual] = useState(false);
  const [dialogLimites, setDialogLimites] = useState(false);
  const [dialogOverrides, setDialogOverrides] = useState(false);
  const [tabelaOverrides, setTabelaOverrides] = useState<any>(null);
  const [tabelaSelecionada, setTabelaSelecionada] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("lista");

  const { data: tabelas, isLoading, refetch } = useQuery({
    queryKey: ["fabrica-tabelas-preco"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_tabelas_preco")
        .select(`
          *,
          tabela_base:tabela_base_id(codigo, nome),
          precos_count:fabrica_precos_produtos(count)
        `)
        .order("ordem", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Buscar todos os preços para analytics
  const { data: todosPrecos } = useQuery({
    queryKey: ["fabrica-todos-precos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_precos_produtos")
        .select("*")
        .eq("ativo", true);

      if (error) throw error;
      return data || [];
    },
  });

  // Buscar contagem de tarefas pendentes
  const { data: tarefasPendentes } = useQuery({
    queryKey: ["fabrica-tarefas-pendentes-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("fabrica_tarefas_ajuste_preco")
        .select("*", { count: "exact", head: true })
        .eq("status", "pendente");

      if (error) throw error;
      return count || 0;
    },
  });

  const excluirTabelaMutation = useMutation({
    mutationFn: async (tabelaId: string) => {
      // Verificar se existem tabelas dependentes
      const { data: dependentes, error: errorDep } = await supabase
        .from("fabrica_tabelas_preco")
        .select("id, nome")
        .eq("tabela_base_id", tabelaId);

      if (errorDep) throw errorDep;

      if (dependentes && dependentes.length > 0) {
        throw new Error(
          `Não é possível excluir esta tabela pois existem ${dependentes.length} tabela(s) dependente(s): ${dependentes.map(d => d.nome).join(", ")}`
        );
      }

      // Excluir preços primeiro (cascade já deve fazer isso, mas garantimos)
      const { error: errorPrecos } = await supabase
        .from("fabrica_precos_produtos")
        .delete()
        .eq("tabela_id", tabelaId);

      if (errorPrecos) throw errorPrecos;

      // Excluir a tabela
      const { error } = await supabase
        .from("fabrica_tabelas_preco")
        .delete()
        .eq("id", tabelaId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tabela excluída com sucesso!");
      refetch();
      setDialogExcluir(false);
      setTabelaSelecionada(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao excluir tabela");
    },
  });

  if (permLoading || accessLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!hasPermission) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">
            Você não tem permissão para acessar esta página.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  // Filtrar tabelas baseado nas permissões do usuário
  const tabelasFiltradas = filterTablesByAccess(tabelas || []);
  const tabelasAtivas = tabelasFiltradas.filter(t => t.ativo);
  const totalProdutosPrecificados = tabelasFiltradas.reduce(
    (acc, t) => acc + (t.precos_count?.[0]?.count || 0),
    0
  ) || 0;

  const handleEditarTabela = (tabela: any) => {
    setTabelaSelecionada(tabela);
    setDialogNovaTabela(true);
  };

  const handleGerarPrecos = (tabela: any) => {
    setTabelaSelecionada(tabela);
    setDialogGerarPrecos(true);
  };

  const handleVisualizarPrecos = (tabela: any) => {
    setTabelaSelecionada(tabela);
    setDialogVisualizacao(true);
  };

  const handleExcluirTabela = (tabela: any) => {
    setTabelaSelecionada(tabela);
    setDialogExcluir(true);
  };

  const getTipoMarkupLabel = (tipo: string, valor: number) => {
    switch (tipo) {
      case 'percentual':
        return `+${valor}%`;
      case 'multiplicador':
        return `x${valor}`;
      case 'valor_fixo':
        return `+${formatarMoeda(valor)}`;
      default:
        return valor.toString();
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div data-tour="precos-header" className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Tabelas de Preço</h1>
            <p className="text-muted-foreground">
              Gerencie tabelas de preço encadeadas com markups personalizados
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setDialogLimites(true)}>
              <Shield className="h-4 w-4 mr-2" />
              Limites de Preço
            </Button>
            <Button variant="outline" onClick={() => setDialogManual(true)}>
              <HelpCircle className="h-4 w-4 mr-2" />
              Manual de Uso
            </Button>
            <Button onClick={() => {
              setTabelaSelecionada(null);
              setDialogNovaTabela(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Tabela
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="lista" className="gap-2">
              <List className="h-4 w-4" />
              Tabelas
            </TabsTrigger>
            <TabsTrigger value="tarefas" className="gap-2">
              <ListTodo className="h-4 w-4" />
              Tarefas de Ajuste
              {tarefasPendentes && tarefasPendentes > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {tarefasPendentes}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="matriz" className="gap-2">
              <Grid3X3 className="h-4 w-4" />
              Matriz Comparativa
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="alertas" className="gap-2">
              <Bell className="h-4 w-4" />
              Alertas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tarefas" className="mt-6">
            <TarefasAjustePrecoPanel />
          </TabsContent>

          <TabsContent value="matriz" className="mt-6">
            <MatrizPrecosComparativa />
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <DashboardPrecosAnalytics tabelas={tabelasFiltradas} precos={todosPrecos || []} />
          </TabsContent>

          <TabsContent value="alertas" className="mt-6">
            <AlertasPrecos />
          </TabsContent>

          <TabsContent value="lista" className="mt-6 space-y-6">
            {/* KPIs */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Tabelas</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{tabelasAtivas.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {tabelasFiltradas.length} no total
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Produtos Precificados</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalProdutosPrecificados}</div>
                  <p className="text-xs text-muted-foreground">
                    Em todas as tabelas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Última Atualização</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {tabelasFiltradas[0]?.updated_at
                      ? format(new Date(tabelasFiltradas[0].updated_at), "dd/MM", { locale: ptBR })
                      : "-"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Mais recente
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tabelas Ativas</CardTitle>
                  <Percent className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{tabelasAtivas.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Vigentes atualmente
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Visualização em Cascata */}
            <Card>
              <CardHeader>
                <CardTitle>Cadeia de Precificação</CardTitle>
              </CardHeader>
              <CardContent>
                <CadeiaPrecificacaoVisual tabelas={tabelasFiltradas} />
              </CardContent>
            </Card>

            {/* Lista de Tabelas */}
            <Card>
              <CardHeader>
                <CardTitle>Todas as Tabelas</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : tabelasFiltradas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma tabela de preço disponível
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tabelasFiltradas.map((tabela) => (
                      <Card key={tabela.id} className="border-l-4" style={{
                        borderLeftColor: tabela.ativo ? 'hsl(var(--primary))' : 'hsl(var(--muted))'
                      }}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold">{tabela.nome}</h3>
                                <Badge variant={tabela.ativo ? "default" : "secondary"}>
                                  {tabela.ativo ? "Ativa" : "Inativa"}
                                </Badge>
                                <Badge variant="outline">{tabela.codigo}</Badge>
                                {tabela.status === 'draft' && (
                                  <Badge variant="secondary">Rascunho</Badge>
                                )}
                                {tabela.status === 'pending_approval' && (
                                  <Badge className="bg-yellow-500">Aguardando Aprovação</Badge>
                                )}
                                {tabela.status === 'approved' && (
                                  <Badge className="bg-green-600">Aprovada</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {tabela.descricao || "Sem descrição"}
                              </p>
                              <div className="flex items-center gap-4 text-sm">
                                <span><strong>Base:</strong> {tabela.tipo_base === "custo_producao" ? "Custo de Produção" : tabela.tabela_base?.nome || "Manual"}</span>
                                <span><strong>Markup:</strong> {getTipoMarkupLabel(tabela.tipo_markup, tabela.valor_markup)}</span>
                                <span><strong>Produtos:</strong> {tabela.precos_count?.[0]?.count || 0}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="default" size="sm" onClick={() => handleVisualizarPrecos(tabela)}>
                                <Eye className="h-4 w-4 mr-1" />Ver Preços
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleGerarPrecos(tabela)}>
                                <DollarSign className="h-4 w-4 mr-1" />Gerar
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => { setTabelaOverrides(tabela); setDialogOverrides(true); }}>
                                <Layers className="h-4 w-4 mr-1" />Overrides
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleEditarTabela(tabela)}>
                                <Edit className="h-4 w-4 mr-1" />Editar
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleExcluirTabela(tabela)} className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4 mr-1" />Excluir
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <NovaTabelaPrecoDialog
        open={dialogNovaTabela}
        onOpenChange={(open) => {
          setDialogNovaTabela(open);
          if (!open) setTabelaSelecionada(null);
        }}
        tabelaEdit={tabelaSelecionada}
        onSuccess={() => {
          refetch();
          setDialogNovaTabela(false);
          setTabelaSelecionada(null);
        }}
      />

      <GeradorPrecosDialog
        open={dialogGerarPrecos}
        onOpenChange={(open) => {
          setDialogGerarPrecos(open);
          if (!open) setTabelaSelecionada(null);
        }}
        tabela={tabelaSelecionada}
        onSuccess={() => {
          refetch();
          setDialogGerarPrecos(false);
          setTabelaSelecionada(null);
        }}
      />

      <VisualizacaoPrecosDialog
        open={dialogVisualizacao}
        onOpenChange={(open) => {
          setDialogVisualizacao(open);
          if (!open) setTabelaSelecionada(null);
        }}
        tabela={tabelaSelecionada}
      />

      <ReajusteEmLoteDialog
        open={dialogReajuste}
        onOpenChange={(open) => {
          setDialogReajuste(open);
          if (!open) setTabelaSelecionada(null);
        }}
        tabela={tabelaSelecionada}
        onSuccess={() => refetch()}
      />

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={dialogExcluir} onOpenChange={setDialogExcluir}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a tabela de preços <strong>{tabelaSelecionada?.nome}</strong>?
              <br /><br />
              Esta ação não pode ser desfeita e todos os preços associados serão removidos.
              {tabelaSelecionada && (
                <div className="mt-2 text-sm">
                  <strong>Produtos precificados:</strong> {tabelaSelecionada.precos_count?.[0]?.count || 0}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTabelaSelecionada(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => tabelaSelecionada && excluirTabelaMutation.mutate(tabelaSelecionada.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={excluirTabelaMutation.isPending}
            >
              {excluirTabelaMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ManualTabelasPrecoDialog
        open={dialogManual}
        onOpenChange={setDialogManual}
      />

      <GerenciarLimitesPrecoDialog
        open={dialogLimites}
        onOpenChange={setDialogLimites}
      />
      
      {tabelaOverrides && (
        <MarkupOverridesManager
          open={dialogOverrides}
          onOpenChange={(open) => {
            setDialogOverrides(open);
            if (!open) setTabelaOverrides(null);
          }}
          tabelaId={tabelaOverrides.id}
          tabelaNome={tabelaOverrides.nome}
        />
      )}
      <TourButton 
        tourId={FABRICA_TABELAS_PRECO_TOUR_ID}
        tourSteps={fabricaTabelasPrecoTourSteps}
        title="Tour de Tabelas de Preço"
        description="Aprenda a gerenciar precificação e margens"
      />
    </DashboardLayout>
  );
}
