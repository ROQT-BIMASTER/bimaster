import { useState, useMemo, useEffect } from "react";
import { useSystemProfiles } from "@/hooks/useSystemProfiles";
import { formatRelativeTime } from "@/lib/formatters";
import { useUserRole } from "@/hooks/useUserRole";
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
import { Plus, Search, Package, Edit, Trash2, Upload, DollarSign, FileX, Filter, Layers, X, TrendingUp, ClipboardList, HelpCircle, LayoutGrid, TableIcon, BarChart3, ChevronDown, MessageSquare, Kanban, Link2, Eye, EyeOff, User, PanelLeftClose, PanelLeftOpen, Calendar } from "lucide-react";
import { formatLocalDate, parseLocalDate } from "@/utils/dateUtils";
import ProductThumbnail from "@/components/fabrica/ProductThumbnail";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ProdutoCard } from "@/components/fabrica/ProdutoCard";
import { ProdutoKanbanBoard } from "@/components/fabrica/ProdutoKanbanBoard";
import { ProdutosAcabadosAdminDashboard } from "@/components/fabrica/ProdutosAcabadosAdminDashboard";
import { StatusAprovacaoBadge } from "@/components/fabrica/FichaAprovacaoBanner";
import type { StatusAprovacao } from "@/hooks/useFichaRevisao";
import { Link, useNavigate } from "react-router-dom";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { NovoProdutoAcabadoDialog } from "@/components/fabrica/NovoProdutoAcabadoDialog";
import { toast } from "sonner";
import { useTour } from "@/components/tour/TourProvider";
import { FABRICA_PRODUTOS_ACABADOS_TOUR_ID, fabricaProdutosAcabadosTourSteps } from "@/components/tour/tours/fabricaProdutosAcabadosTour";
import { ManualFabricaDrawer } from "@/components/fabrica/ManualFabricaDrawer";

export default function FabricaProdutosAcabados() {
  const { hasPermission, loading: permLoading } = useScreenPermissions();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const { data: systemProfiles } = useSystemProfiles();
  const { startTour, hasSeenTour } = useTour();
  const [dialogNovo, setDialogNovo] = useState(false);
  const [produtoEdit, setProdutoEdit] = useState<any>(null);
  const [busca, setBusca] = useState("");
  const [filtroMarca, setFiltroMarca] = useState("none");
  const [filtroLinha, setFiltroLinha] = useState("none");
  const [filtroTipo, setFiltroTipo] = useState("none");
  const [agrupamentoAtivo, setAgrupamentoAtivo] = useState(false);
  const [viewMode, setViewMode] = useState<"tabela" | "cards" | "kanban">("tabela");
  const [agruparPor, setAgruparPor] = useState("marca");
  const [showAdminDash, setShowAdminDash] = useState(false);
  const [mostrarOcultos, setMostrarOcultos] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(true);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

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
        .in("tipo", ["ACABADO", "INTER", "DISPLAY"])
        .or('origem.is.null,origem.neq.importado')
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    {
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );

  // Buscar relacionamentos Kit → Filhos (grade de itens do Display)
  const { data: gradeItens } = useSupabaseQuery(
    ["fabrica-produto-grade-itens"],
    async () => {
      const { data, error } = await supabase
        .from("fabrica_produto_grade_itens")
        .select("produto_pai_id, produto_filho_id");
      if (error) throw error;
      return data;
    },
    { staleTime: 5 * 60 * 1000 }
  );

  // Mapas de relacionamento pai-filho
  const { filhoParaPaiMap, paiParaFilhosMap } = useMemo(() => {
    const filhoParaPai = new Map<string, string>();
    const paiParaFilhos = new Map<string, string[]>();
    gradeItens?.forEach((item) => {
      filhoParaPai.set(item.produto_filho_id, item.produto_pai_id);
      if (!paiParaFilhos.has(item.produto_pai_id)) paiParaFilhos.set(item.produto_pai_id, []);
      paiParaFilhos.get(item.produto_pai_id)!.push(item.produto_filho_id);
    });
    return { filhoParaPaiMap: filhoParaPai, paiParaFilhosMap: paiParaFilhos };
  }, [gradeItens]);

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
        .from("fabrica_ficha_custo_revisoes" as any)
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
        const custo = totais?.custoTotal ?? totais?.custoFinalTotal;
        if (custo) map.set(r.produto_id, Number(custo));
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

  const temFiltrosAtivos = filtroMarca !== "none" || filtroLinha !== "none" || filtroTipo !== "none";

  const limparFiltros = () => {
    setFiltroMarca("none");
    setFiltroLinha("none");
    setFiltroTipo("none");
  };

  const fichasMap = useMemo(() => {
    const map = new Map<string, string>();
    fichasConfig?.forEach((f) => map.set(f.produto_id, f.status_aprovacao || "rascunho"));
    return map;
  }, [fichasConfig]);

  const totalOcultos = useMemo(() => produtos?.filter(p => p.oculto).length || 0, [produtos]);

  const profilesMap = useMemo(() => {
    const map = new Map<string, string>();
    systemProfiles?.forEach((p) => map.set(p.id, p.nome));
    return map;
  }, [systemProfiles]);

  const produtosFiltrados = useMemo(() => {
    const filtered = produtos?.filter((p) => {
      const matchBusca =
        p.nome.toLowerCase().includes(busca.toLowerCase()) ||
        p.codigo.toLowerCase().includes(busca.toLowerCase());
      const matchMarca = filtroMarca === "none" || p.marca === filtroMarca;
      const matchLinha = filtroLinha === "none" || p.linha === filtroLinha;
      const matchTipo = filtroTipo === "none" || p.tipo === filtroTipo;
      const matchVisibilidade = mostrarOcultos || !p.oculto;
      return matchBusca && matchMarca && matchLinha && matchTipo && matchVisibilidade;
    });
    if (!filtered) return [];

    // Reordenar: posicionar filhos imediatamente após seus pais
    const filteredIds = new Set(filtered.map(p => p.id));
    const childrenPlaced = new Set<string>();
    const result: any[] = [];

    for (const p of filtered) {
      // Se é filho e o pai está na lista, pular (será inserido após o pai)
      if (filhoParaPaiMap.has(p.id) && filteredIds.has(filhoParaPaiMap.get(p.id)!)) {
        if (childrenPlaced.has(p.id)) continue;
        // Não adicionar agora, será adicionado quando o pai for processado
        continue;
      }
      if (childrenPlaced.has(p.id)) continue;
      result.push(p);
      // Se é pai (Display), inserir filhos logo após
      const childIds = paiParaFilhosMap.get(p.id);
      if (childIds) {
        for (const childId of childIds) {
          if (filteredIds.has(childId) && !childrenPlaced.has(childId)) {
            const child = filtered.find(c => c.id === childId);
            if (child) {
              result.push(child);
              childrenPlaced.add(childId);
            }
          }
        }
      }
    }
    // Adicionar filhos órfãos (cujo pai não está na lista filtrada)
    for (const p of filtered) {
      if (!childrenPlaced.has(p.id) && !result.includes(p)) {
        result.push(p);
      }
    }
    return result;
  }, [produtos, busca, filtroMarca, filtroLinha, filtroTipo, mostrarOcultos, paiParaFilhosMap]);

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

  const handleToggleOculto = async (produto: any) => {
    try {
      const novoValor = !produto.oculto;
      const { error } = await supabase
        .from("fabrica_produtos")
        .update({ oculto: novoValor } as any)
        .eq("id", produto.id);
      if (error) throw error;
      toast.success(novoValor ? "Produto ocultado" : "Produto visível novamente");
      refetch();
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    }
  };

  const tipoLabels: Record<string, string> = {
    ACABADO: "Acabado",
    INTER: "Intermediário",
    MP: "Matéria-Prima",
    DISPLAY: "Display",
  };

  const formatarMoeda = (valor: number) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const renderProdutoRow = (produto: any) => {
    const statusFicha = fichasMap.get(produto.id);
    const isEmRevisao = statusFicha === "revisao_solicitada" || statusFicha === "em_revisao";
    const custoTotal = custoTotalMap.get(produto.id);
    const temAumento = produtosComAumento.has(produto.id);

    const isDisplay = produto.tipo === "DISPLAY";

    const isChild = filhoParaPaiMap.has(produto.id);
    const parentId = filhoParaPaiMap.get(produto.id);
    const parentProduct = isChild && produtos ? produtos.find(p => p.id === parentId) : null;

    return (
      <TableRow key={produto.id} className={`${produto.oculto ? "opacity-50" : ""} ${isEmRevisao ? "bg-red-50 dark:bg-red-950/20" : isDisplay ? "bg-primary/5" : isChild ? "bg-blue-50/30 dark:bg-blue-950/20 border-l-2 border-l-blue-400" : ""}`}>
        <TableCell className="pr-0">
          <ProductThumbnail src={produto.foto_url} alt={produto.nome} size="sm" />
        </TableCell>
        <TableCell className="font-mono">{produto.codigo}</TableCell>
        <TableCell className="font-medium">
          <div className="flex items-center gap-1.5">
            {isDisplay && <Layers className="h-3.5 w-3.5 text-primary shrink-0" />}
            {isChild && (
              <span className="text-blue-500 shrink-0 flex items-center gap-1 mr-1">
                <span className="text-muted-foreground">↳</span>
                <Link2 className="h-3 w-3" />
              </span>
            )}
            <span className={isChild ? "pl-4" : ""}>{produto.nome}</span>
          </div>
          {isChild && parentProduct && (
            <div className="text-[10px] text-blue-500 mt-0.5 pl-9">
              Kit: {parentProduct.codigo}
            </div>
          )}
        </TableCell>
        <TableCell>
          <Badge variant={isDisplay ? "default" : "outline"} className={isDisplay ? "gap-1" : ""}>
            {isDisplay && <Layers className="h-3 w-3" />}
            {tipoLabels[produto.tipo] || produto.tipo}
            {isDisplay && produto.itens_display ? ` (${produto.itens_display} un.)` : ""}
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
          {produto.tipo === "DISPLAY" ? "Display" : (produto.unidade?.sigla || "-")}
        </TableCell>
        <TableCell>
          <Badge variant={produto.ativo ? "default" : "secondary"}>
            {produto.ativo ? "Ativo" : "Inativo"}
          </Badge>
        </TableCell>
        <TableCell>
          {(() => {
            const editadoPor = produto.updated_by ? profilesMap.get(produto.updated_by) : null;
            const criadoPor = produto.created_by ? profilesMap.get(produto.created_by) : null;
            const nome = editadoPor || criadoPor;
            const label = editadoPor ? "Editou" : "Criou";
            const data = editadoPor ? produto.updated_at : produto.created_at;
            if (!nome) return <span className="text-muted-foreground text-sm">—</span>;
            return (
              <div className="text-xs">
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate max-w-[120px]">{nome}</span>
                </div>
                <span className="text-muted-foreground">
                  {label} · {data ? formatRelativeTime(data) : ""}
                </span>
              </div>
            );
          })()}
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
              onClick={() => handleToggleOculto(produto)}
              title={produto.oculto ? "Tornar visível" : "Ocultar"}
            >
              {produto.oculto ? <Eye className="h-4 w-4 text-muted-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
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
            <ManualFabricaDrawer screen="produtos-acabados" />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => startTour(FABRICA_PRODUTOS_ACABADOS_TOUR_ID, fabricaProdutosAcabadosTourSteps)}
              title="Tour guiado"
            >
              <HelpCircle className="h-5 w-5" />
            </Button>
            <Button
              variant={showAdminDash ? "default" : "outline"}
              onClick={() => setShowAdminDash(!showAdminDash)}
              data-tour="pa-admin-dash-btn"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Painel Administrativo
              <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${showAdminDash ? "rotate-180" : ""}`} />
            </Button>
            <Button variant="outline" asChild data-tour="pa-revisao-btn">
              <Link to="/dashboard/fabrica/comunicacao-revisoes">
                <MessageSquare className="h-4 w-4 mr-2" />
                Comunicação de Revisões
              </Link>
            </Button>
            {isAdmin && (
              <Button variant="outline" asChild>
                <Link to="/dashboard/fabrica/produtos/importar">
                  <Upload className="h-4 w-4 mr-2" />
                  Importar em Massa
                </Link>
              </Button>
            )}
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

        {/* Dashboard Administrativo */}
        <Collapsible open={showAdminDash} onOpenChange={setShowAdminDash}>
          <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
            <ProdutosAcabadosAdminDashboard
              revisoes={revisoes}
              fichasConfig={fichasConfig}
              alertasAumento={alertasAumento}
              produtos={produtos}
            />
          </CollapsibleContent>
        </Collapsible>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-6" data-tour="pa-kpis">
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
              <CardTitle className="text-sm font-medium">Displays / Kits</CardTitle>
              <Layers className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {produtos?.filter((p) => p.tipo === "DISPLAY").length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {produtos?.filter((p) => p.tipo === "DISPLAY").reduce((s, p) => s + (p.itens_display || 0), 0) || 0} itens total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Nacionais</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {produtos?.filter((p) => p.origem === "nacional" || !p.origem).length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Importados</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
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

            {/* Filtro Tipo */}
            <div className="min-w-[160px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Tipo</Label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Todos</SelectItem>
                  <SelectItem value="ACABADO">Acabado</SelectItem>
                  <SelectItem value="DISPLAY">Display / Kit</SelectItem>
                  <SelectItem value="INTER">Intermediário</SelectItem>
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

            {/* Ocultos toggle */}
            <div className="flex items-center gap-2 border-l pl-4">
              <Switch
                id="mostrarOcultos"
                checked={mostrarOcultos}
                onCheckedChange={setMostrarOcultos}
              />
              <Label htmlFor="mostrarOcultos" className="text-sm cursor-pointer flex items-center gap-1.5">
                {mostrarOcultos ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                Ocultos
                {totalOcultos > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{totalOcultos}</Badge>
                )}
              </Label>
            </div>
            <div className="flex items-center gap-1 border-l pl-4">
              <Button
                variant={viewMode === "tabela" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("tabela")}
                title="Tabela"
              >
                <TableIcon className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "cards" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("cards")}
                title="Grade"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "kanban" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("kanban")}
                title="Kanban"
              >
                <Kanban className="h-4 w-4" />
              </Button>
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

        {/* Content */}
        <Card data-tour="pa-tabela">
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando produtos...
              </div>
            ) : viewMode === "kanban" ? (
              /* Kanban View */
              <ProdutoKanbanBoard
                produtos={produtosFiltrados || []}
                fichasMap={fichasMap}
                custoTotalMap={custoTotalMap}
                produtosComAumento={produtosComAumento}
                formatarMoeda={formatarMoeda}
                onProdutoClick={(p) => navigate(`/dashboard/fabrica/produtos/${p.id}/custos`)}
              />
            ) : produtosFiltrados?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum produto encontrado
              </div>
            ) : viewMode === "cards" ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {agrupamentoAtivo
                  ? Array.from(dadosAgrupados.entries()).map(([grupo, items]) => (
                      <div key={`group-${grupo}`} className="col-span-full space-y-3">
                        <div className="flex items-center gap-2 font-semibold text-sm border-b pb-2">
                          <Layers className="h-4 w-4 text-muted-foreground" />
                          {grupo}
                          <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {items.map((produto: any) => (
                            <ProdutoCard
                              key={produto.id}
                              produto={produto}
                              statusFicha={fichasMap.get(produto.id)}
                              custoTotal={custoTotalMap.get(produto.id)}
                              temAumento={produtosComAumento.has(produto.id)}
                              responsavelNome={produto.updated_by ? profilesMap.get(produto.updated_by) || profilesMap.get(produto.created_by) : profilesMap.get(produto.created_by)}
                              responsavelLabel={produto.updated_by && profilesMap.get(produto.updated_by) ? "Editou" : "Criou"}
                              responsavelData={produto.updated_by ? produto.updated_at : produto.created_at}
                              onEditar={handleEditar}
                              onExcluir={handleExcluir}
                              onFichaCustos={(p) => navigate(`/dashboard/fabrica/produtos/${p.id}/custos`)}
                              formatarMoeda={formatarMoeda}
                            />
                          ))}
                        </div>
                      </div>
                    ))
                  : produtosFiltrados?.map((produto: any) => (
                      <ProdutoCard
                        key={produto.id}
                        produto={produto}
                        statusFicha={fichasMap.get(produto.id)}
                        custoTotal={custoTotalMap.get(produto.id)}
                        temAumento={produtosComAumento.has(produto.id)}
                        responsavelNome={produto.updated_by ? profilesMap.get(produto.updated_by) || profilesMap.get(produto.created_by) : profilesMap.get(produto.created_by)}
                        responsavelLabel={produto.updated_by && profilesMap.get(produto.updated_by) ? "Editou" : "Criou"}
                        responsavelData={produto.updated_by ? produto.updated_at : produto.created_at}
                        onEditar={handleEditar}
                        onExcluir={handleExcluir}
                        onFichaCustos={(p) => navigate(`/dashboard/fabrica/produtos/${p.id}/custos`)}
                        formatarMoeda={formatarMoeda}
                      />
                    ))}
              </div>
            ) : (
              /* Table View */
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[52px]"></TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Ficha</TableHead>
                    <TableHead>Custo Total</TableHead>
                    <TableHead>Fórmula</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agrupamentoAtivo
                    ? Array.from(dadosAgrupados.entries()).map(([grupo, items]) => (
                        <>
                          <TableRow key={`group-${grupo}`} className="bg-muted/50 hover:bg-muted/50">
                            <TableCell colSpan={12} className="font-semibold text-sm py-2">
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
