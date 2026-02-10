import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseQuery } from "@/hooks/useSupabaseQuery";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Search, Package, Edit, Trash2, Upload, DollarSign, FileX, Filter, Layers, X, TrendingUp, ClipboardList, HelpCircle } from "lucide-react";
import { StatusAprovacaoBadge } from "@/components/fabrica/FichaAprovacaoBanner";
import type { StatusAprovacao } from "@/hooks/useFichaRevisao";
import { Link, useNavigate } from "react-router-dom";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { NovoProdutoAcabadoDialog } from "@/components/fabrica/NovoProdutoAcabadoDialog";
import { toast } from "sonner";
import { useTour } from "@/components/tour/TourProvider";
import { FABRICA_PRODUTOS_ACABADOS_TOUR_ID, fabricaProdutosAcabadosTourSteps } from "@/components/tour/tours/fabricaProdutosAcabadosTour";

export default function FabricaProdutosAcabados() {
  const { hasPermission, loading: permLoading } = useScreenPermissions();
  const navigate = useNavigate();
  const { startTour, hasSeenTour } = useTour();
  const [dialogNovo, setDialogNovo] = useState(false);
  const [produtoEdit, setProdutoEdit] = useState<any>(null);
  const [busca, setBusca] = useState("");
  const [filtroMarca, setFiltroMarca] = useState("none");
  const [filtroLinha, setFiltroLinha] = useState("none");
  const [agrupamentoAtivo, setAgrupamentoAtivo] = useState(false);
  const [agruparPor, setAgruparPor] = useState("marca");

  useEffect(() => {
    if (!permLoading && hasPermission && !hasSeenTour(FABRICA_PRODUTOS_ACABADOS_TOUR_ID)) {
      const timer = setTimeout(() => {
        startTour(FABRICA_PRODUTOS_ACABADOS_TOUR_ID, fabricaProdutosAcabadosTourSteps);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [permLoading, hasPermission]);

  const { data: produtos, isLoading, refetch } = useSupabaseQuery(
    ["fabrica-produtos-acabados"],
    async () => {
      const { data, error } = await supabase
        .from("fabrica_produtos")
        .select(`
          *,
          unidade:fabrica_unidades_medida(sigla, nome)
        `)
        .in("tipo", ["ACABADO", "INTER"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    {
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );

  const { data: fichasConfig } = useSupabaseQuery(
    ["fabrica-produtos-fichas-config"],
    async () => {
      const { data, error } = await supabase
        .from("fabrica_produto_custos_config")
        .select("produto_id, status_aprovacao");
      if (error) throw error;
      return data;
    },
    { staleTime: 0, refetchOnMount: "always" }
  );

  // Buscar snapshots de revisão para obter custo total
  const { data: revisoes } = useSupabaseQuery(
    ["fabrica-produtos-revisoes-custos"],
    async () => {
      const { data, error } = await supabase
        .from("fabrica_ficha_revisoes" as any)
        .select("produto_id, snapshot_totais, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    { staleTime: 0, refetchOnMount: "always" }
  );

  // Buscar alertas de aumento de custo recente
  const { data: alertasAumento } = useSupabaseQuery(
    ["fabrica-produtos-alertas-aumento"],
    async () => {
      const { data, error } = await supabase
        .from("fabrica_insumo_custo_historico" as any)
        .select("produto_id, valor_anterior, valor_novo, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as any[];
    },
    { staleTime: 30000 }
  );

  // Map de custo total por produto (da última revisão)
  const custoTotalMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!revisoes) return map;
    // Pegar a primeira revisão de cada produto (já está ordenada por created_at desc)
    revisoes.forEach((r: any) => {
      if (!map.has(r.produto_id) && r.snapshot_totais) {
        const totais = typeof r.snapshot_totais === 'string' ? JSON.parse(r.snapshot_totais) : r.snapshot_totais;
        if (totais?.custoTotal) map.set(r.produto_id, Number(totais.custoTotal));
      }
    });
    return map;
  }, [revisoes]);

  // Set de produtos com aumento recente (últimos 30 dias)
  const produtosComAumento = useMemo(() => {
    const set = new Set<string>();
    if (!alertasAumento) return set;
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
    alertasAumento.forEach((a: any) => {
      if (Number(a.valor_novo) > Number(a.valor_anterior) && new Date(a.created_at) >= trintaDiasAtras) {
        set.add(a.produto_id);
      }
    });
    return set;
  }, [alertasAumento]);

  const marcasUnicas = useMemo(() => {
    if (!produtos) return [];
    const marcas = [...new Set(produtos.map((p) => p.marca).filter(Boolean))].sort();
    return marcas as string[];
  }, [produtos]);

  const linhasUnicas = useMemo(() => {
    if (!produtos) return [];
    const linhas = [...new Set(produtos.map((p) => p.linha).filter(Boolean))].sort();
    return linhas as string[];
  }, [produtos]);

  const temFiltrosAtivos = filtroMarca !== "none" || filtroLinha !== "none";

  const limparFiltros = () => {
    setFiltroMarca("none");
    setFiltroLinha("none");
  };

  const fichasMap = useMemo(() => {
    const map = new Map<string, string>();
    fichasConfig?.forEach((f) => map.set(f.produto_id, f.status_aprovacao || "rascunho"));
    return map;
  }, [fichasConfig]);

  const produtosFiltrados = useMemo(() => {
    return produtos?.filter((p) => {
      const matchBusca =
        p.nome.toLowerCase().includes(busca.toLowerCase()) ||
        p.codigo.toLowerCase().includes(busca.toLowerCase());
      const matchMarca = filtroMarca === "none" || p.marca === filtroMarca;
      const matchLinha = filtroLinha === "none" || p.linha === filtroLinha;
      return matchBusca && matchMarca && matchLinha;
    });
  }, [produtos, busca, filtroMarca, filtroLinha]);

  const dadosAgrupados = useMemo(() => {
    if (!produtosFiltrados) return new Map<string, any[]>();
    if (!agrupamentoAtivo) {
      return new Map([["Todos", produtosFiltrados]]);
    }
    const campo = agruparPor === "marca" ? "marca" : "linha";
    const grouped = new Map<string, any[]>();
    produtosFiltrados.forEach((p) => {
      const key = (p[campo] as string) || "Sem Categoria";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(p);
    });
    return new Map([...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }, [produtosFiltrados, agrupamentoAtivo, agruparPor]);

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

  const handleEditar = (produto: any) => {
    setProdutoEdit(produto);
    setDialogNovo(true);
  };

  const handleExcluir = async (produto: any) => {
    if (!confirm(`Tem certeza que deseja excluir o produto "${produto.nome}"?`)) {
      return;
    }
    try {
      const { error } = await supabase
        .from("fabrica_produtos")
        .delete()
        .eq("id", produto.id);
      if (error) throw error;
      toast.success("Produto excluído com sucesso!");
      refetch();
    } catch (error: any) {
      console.error("Erro ao excluir produto:", error);
      toast.error("Erro ao excluir: " + error.message);
    }
  };

  const tipoLabels = {
    ACABADO: "Acabado",
    INTER: "Intermediário",
    MP: "Matéria-Prima",
  };

  const formatarMoeda = (valor: number) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const renderProdutoRow = (produto: any) => {
    const statusFicha = fichasMap.get(produto.id);
    const isEmRevisao = statusFicha === "revisao_solicitada" || statusFicha === "em_revisao";
    const custoTotal = custoTotalMap.get(produto.id);
    const temAumento = produtosComAumento.has(produto.id);

    return (
      <TableRow key={produto.id} className={isEmRevisao ? "bg-red-50 dark:bg-red-950/20" : ""}>
        <TableCell className="font-mono">{produto.codigo}</TableCell>
        <TableCell className="font-medium">{produto.nome}</TableCell>
        <TableCell>
          <Badge variant="outline">
            {tipoLabels[produto.tipo as keyof typeof tipoLabels]}
          </Badge>
        </TableCell>
        <TableCell>
          <Badge variant={produto.origem === 'importado' ? 'destructive' : 'secondary'}>
            {produto.origem === 'importado' ? 'Importado' : 'Nacional'}
          </Badge>
        </TableCell>
        <TableCell data-tour="pa-status-ficha">
          {fichasMap.has(produto.id) ? (
            <StatusAprovacaoBadge status={statusFicha as StatusAprovacao} />
          ) : (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <FileX className="h-3 w-3" />
              Sem Ficha
            </Badge>
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            {custoTotal != null ? (
              <>
                <span className="font-mono text-sm font-medium">{formatarMoeda(custoTotal)}</span>
                {temAumento && (
                  <Badge variant="destructive" className="gap-0.5 text-[10px] px-1 py-0">
                    <TrendingUp className="h-3 w-3" />
                  </Badge>
                )}
              </>
            ) : (
              <span className="text-muted-foreground text-sm">—</span>
            )}
          </div>
        </TableCell>
        <TableCell>
          {produto.formula_id ? (
            <Badge variant="secondary">Fórmula vinculada</Badge>
          ) : (
            <span className="text-muted-foreground text-sm">-</span>
          )}
        </TableCell>
        <TableCell>
          {produto.unidade?.sigla || "-"}
        </TableCell>
        <TableCell>
          <Badge variant={produto.ativo ? "default" : "secondary"}>
            {produto.ativo ? "Ativo" : "Inativo"}
          </Badge>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex gap-1 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/dashboard/fabrica/produtos/${produto.id}/custos`)}
              title="Ficha de Custos"
            >
              <DollarSign className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEditar(produto)}
              title="Editar"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleExcluir(produto)}
              className="text-destructive hover:text-destructive"
              title="Excluir"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between" data-tour="pa-header">
          <div>
            <h1 className="text-3xl font-bold">Produtos Acabados</h1>
            <p className="text-muted-foreground">
              Gerencie o catálogo de produtos fabricados
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => startTour(FABRICA_PRODUTOS_ACABADOS_TOUR_ID, fabricaProdutosAcabadosTourSteps)}
              title="Tour guiado"
            >
              <HelpCircle className="h-5 w-5" />
            </Button>
            <Button variant="outline" asChild data-tour="pa-revisao-btn">
              <Link to="/dashboard/fabrica/revisao-fichas">
                <ClipboardList className="h-4 w-4 mr-2" />
                Revisões Solicitadas
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/dashboard/fabrica/produtos/importar">
                <Upload className="h-4 w-4 mr-2" />
                Importar em Massa
              </Link>
            </Button>
            <Button
              onClick={() => {
                setProdutoEdit(null);
                setDialogNovo(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Produto
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-5" data-tour="pa-kpis">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{produtos?.length || 0}</div>
              <p className="text-xs text-muted-foreground">
                {produtos?.filter((p) => p.ativo).length || 0} ativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Acabados</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {produtos?.filter((p) => p.tipo === "ACABADO").length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Intermediários</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {produtos?.filter((p) => p.tipo === "INTER").length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Nacionais</CardTitle>
              <Package className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {produtos?.filter((p) => p.origem === "nacional" || !p.origem).length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Importados</CardTitle>
              <Package className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {produtos?.filter((p) => p.origem === "importado").length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Barra de Filtros */}
        <div className="bg-muted/30 rounded-lg border p-4 space-y-4" data-tour="pa-filtros">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" />
            Filtros
          </div>
          <div className="flex flex-wrap items-end gap-4">
            {/* Busca */}
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Código ou nome..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Filtro Marca */}
            <div className="min-w-[180px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Marca</Label>
              <Select value={filtroMarca} onValueChange={setFiltroMarca}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Todas</SelectItem>
                  {marcasUnicas.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro Linha */}
            <div className="min-w-[180px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Linha</Label>
              <Select value={filtroLinha} onValueChange={setFiltroLinha}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Todas</SelectItem>
                  {linhasUnicas.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Agrupamento */}
            <div className="flex items-center gap-3 border-l pl-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="agrupamento"
                  checked={agrupamentoAtivo}
                  onCheckedChange={setAgrupamentoAtivo}
                />
                <Label htmlFor="agrupamento" className="text-sm cursor-pointer flex items-center gap-1">
                  <Layers className="h-4 w-4" />
                  Agrupar
                </Label>
              </div>
              {agrupamentoAtivo && (
                <Select value={agruparPor} onValueChange={setAgruparPor}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="marca">Marca</SelectItem>
                    <SelectItem value="linha">Linha</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Limpar */}
            {temFiltrosAtivos && (
              <Button variant="ghost" size="sm" onClick={limparFiltros} className="text-muted-foreground">
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Tabela */}
        <Card data-tour="pa-tabela">
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando produtos...
              </div>
            ) : produtosFiltrados?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum produto encontrado
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Ficha</TableHead>
                    <TableHead>Custo Total</TableHead>
                    <TableHead>Fórmula</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agrupamentoAtivo
                    ? Array.from(dadosAgrupados.entries()).map(([grupo, items]) => (
                        <>
                          <TableRow key={`group-${grupo}`} className="bg-muted/50 hover:bg-muted/50">
                            <TableCell colSpan={10} className="font-semibold text-sm py-2">
                              <div className="flex items-center gap-2">
                                <Layers className="h-4 w-4 text-muted-foreground" />
                                {grupo}
                                <Badge variant="secondary" className="ml-1 text-xs">
                                  {items.length}
                                </Badge>
                              </div>
                            </TableCell>
                          </TableRow>
                          {items.map(renderProdutoRow)}
                        </>
                      ))
                    : produtosFiltrados?.map(renderProdutoRow)}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <NovoProdutoAcabadoDialog
        open={dialogNovo}
        onOpenChange={(open) => {
          setDialogNovo(open);
          if (!open) setProdutoEdit(null);
        }}
        produtoEdit={produtoEdit}
        onSuccess={() => {
          refetch();
          setProdutoEdit(null);
        }}
      />
    </DashboardLayout>
  );
}
