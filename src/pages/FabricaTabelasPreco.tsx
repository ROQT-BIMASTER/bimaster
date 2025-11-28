import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, DollarSign, Package, TrendingUp, Edit, Download } from "lucide-react";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { NovaTabelaPrecoDialog } from "@/components/fabrica/NovaTabelaPrecoDialog";
import { CadeiaPrecificacaoVisual } from "@/components/fabrica/CadeiaPrecificacaoVisual";
import { GeradorPrecosDialog } from "@/components/fabrica/GeradorPrecosDialog";
import { formatarMoeda } from "@/lib/fabrica/pricing-calculator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function FabricaTabelasPreco() {
  const { hasPermission, loading: permLoading } = useScreenPermissions();
  const [dialogNovaTabela, setDialogNovaTabela] = useState(false);
  const [dialogGerarPrecos, setDialogGerarPrecos] = useState(false);
  const [tabelaSelecionada, setTabelaSelecionada] = useState<any>(null);

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

  if (permLoading) {
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

  const tabelasAtivas = tabelas?.filter(t => t.ativo) || [];
  const totalProdutosPrecificados = tabelas?.reduce(
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Tabelas de Preço</h1>
            <p className="text-muted-foreground">
              Gerencie tabelas de preço encadeadas com markups personalizados
            </p>
          </div>
          <Button onClick={() => {
            setTabelaSelecionada(null);
            setDialogNovaTabela(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Tabela
          </Button>
        </div>

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
                {tabelas?.length || 0} no total
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
                {tabelas?.[0]?.updated_at
                  ? format(new Date(tabelas[0].updated_at), "dd/MM", { locale: ptBR })
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
              <DollarSign className="h-4 w-4 text-muted-foreground" />
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
            <CadeiaPrecificacaoVisual tabelas={tabelas || []} />
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
            ) : tabelas?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma tabela de preço cadastrada
              </div>
            ) : (
              <div className="space-y-4">
                {tabelas?.map((tabela) => (
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
                            {tabela.status === 'rejected' && (
                              <Badge variant="destructive">Rejeitada</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {tabela.descricao || "Sem descrição"}
                          </p>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1">
                              <strong>Base:</strong>{" "}
                              {tabela.tipo_base === "custo_producao" && "Custo de Produção"}
                              {tabela.tipo_base === "tabela_anterior" && tabela.tabela_base?.nome}
                              {tabela.tipo_base === "manual" && "Manual"}
                            </span>
                            <span className="flex items-center gap-1">
                              <strong>Markup:</strong>{" "}
                              {getTipoMarkupLabel(tabela.tipo_markup, tabela.valor_markup)}
                            </span>
                            <span className="flex items-center gap-1">
                              <strong>Produtos:</strong>{" "}
                              {tabela.precos_count?.[0]?.count || 0}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleGerarPrecos(tabela)}
                          >
                            <DollarSign className="h-4 w-4 mr-1" />
                            Preços
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditarTabela(tabela)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              toast.info("Exportação em desenvolvimento");
                            }}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Exportar
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
    </DashboardLayout>
  );
}
