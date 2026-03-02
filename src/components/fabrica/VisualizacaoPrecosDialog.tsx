import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { formatarMoeda, formatarPercentual } from "@/lib/fabrica/pricing-calculator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Search, TrendingUp, TrendingDown, Minus, Package, DollarSign, Tag, Edit, Trash2, FileText, History, Shield, AlertTriangle, Eye, X } from "lucide-react";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { EditarPrecosProdutoDialog } from "./EditarPrecosProdutoDialog";
import { ExportarTabelaPDF } from "./ExportarTabelaPDF";
import { HistoricoPrecoProduto } from "./HistoricoPrecoProduto";
import { ComposicaoCustoTooltip } from "./ComposicaoCustoTooltip";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabela: any;
}

export function VisualizacaoPrecosDialog({ open, onOpenChange, tabela }: Props) {
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("__all__");
  const [filtroMarca, setFiltroMarca] = useState<string>("__all__");
  const [filtroLinha, setFiltroLinha] = useState<string>("__all__");
  const [filtroDisplay, setFiltroDisplay] = useState<string>("__all__");
  const [produtoEditando, setProdutoEditando] = useState<string | null>(null);
  const [precoExcluindo, setPrecoExcluindo] = useState<any>(null);
  const [showExportPDF, setShowExportPDF] = useState(false);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [produtoHistorico, setProdutoHistorico] = useState<{id: string, nome: string} | null>(null);

  const { data: precos, isLoading, refetch } = useQuery({
    queryKey: ["visualizacao-precos", tabela?.id],
    queryFn: async () => {
      if (!tabela?.id) return [];

      // Buscar preços
      const { data: precosData, error: precosError } = await supabase
        .from("fabrica_precos_produtos")
        .select("*")
        .eq("tabela_id", tabela.id)
        .eq("ativo", true);

      if (precosError) throw precosError;
      if (!precosData || precosData.length === 0) return [];

      // Buscar IDs únicos de produtos
      const produtoIds = [...new Set(precosData.map(p => p.produto_id))];

      // Buscar dados dos produtos
      const { data: produtosData, error: produtosError } = await supabase
        .from("fabrica_produtos")
        .select(`
          id,
          codigo,
          sku,
          nome,
          nome_comercial,
          categoria,
          subcategoria,
          marca,
          linha,
          modelo,
          tipo,
          unidade_medida_id
        `)
        .in("id", produtoIds);

      if (produtosError) throw produtosError;

      // Buscar unidades de medida
      const unidadeIds = [...new Set(produtosData?.map(p => p.unidade_medida_id).filter(Boolean) || [])];
      const { data: unidadesData } = await supabase
        .from("fabrica_unidades_medida")
        .select("id, sigla")
        .in("id", unidadeIds);

      // Mapear unidades
      const unidadesMap = new Map(unidadesData?.map(u => [u.id, u]) || []);

      // Mapear produtos com unidades
      const produtosMap = new Map(
        produtosData?.map(p => [
          p.id,
          {
            ...p,
            unidade_medida: p.unidade_medida_id ? unidadesMap.get(p.unidade_medida_id) : null
          }
        ]) || []
      );

      // Se a tabela tem uma tabela base, buscar os preços da tabela base para calcular a margem
      let precosTabelaBaseMap = new Map<string, number>();
      if (tabela.tabela_base_id) {
        const { data: precosTabelaBase } = await supabase
          .from("fabrica_precos_produtos")
          .select("produto_id, preco_final")
          .eq("tabela_id", tabela.tabela_base_id)
          .eq("ativo", true)
          .in("produto_id", produtoIds);

        if (precosTabelaBase) {
          precosTabelaBaseMap = new Map(
            precosTabelaBase.map(p => [p.produto_id, p.preco_final])
          );
        }
      }

      // Combinar dados e calcular margem baseada na tabela anterior
      const resultado = precosData
        .map(preco => {
          const precoTabelaBase = precosTabelaBaseMap.get(preco.produto_id);
          // Calcular margem: se tem tabela base, usa o preço da tabela base como referência
          // Fórmula: ((preço_atual - preço_base) / preço_atual) * 100
          let margemCalculada = preco.margem_lucro_percentual || 0;
          if (tabela.tabela_base_id && precoTabelaBase && precoTabelaBase > 0 && preco.preco_final > 0) {
            margemCalculada = ((preco.preco_final - precoTabelaBase) / preco.preco_final) * 100;
          }
          
          return {
            ...preco,
            produto: produtosMap.get(preco.produto_id),
            preco_tabela_base: precoTabelaBase || null,
            margem_calculada: margemCalculada,
          };
        })
        .sort((a: any, b: any) => 
          (a.produto?.nome || '').localeCompare(b.produto?.nome || '')
        );

      return resultado;
    },
    enabled: open && !!tabela?.id,
  });

  const excluirPrecoMutation = useMutation({
    mutationFn: async (precoId: string) => {
      const { error } = await supabase
        .from("fabrica_precos_produtos")
        .delete()
        .eq("id", precoId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Preço excluído com sucesso!");
      refetch();
      setPrecoExcluindo(null);
    },
    onError: (error: any) => {
      toast.error("Erro ao excluir preço: " + error.message);
    },
  });

  // Extrair valores únicos para filtros
  const categoriasUnicas = [...new Set(precos?.map(p => p.produto?.categoria).filter(Boolean) || [])].sort();
  const marcasUnicas = [...new Set(precos?.map(p => p.produto?.marca).filter(Boolean) || [])].sort();
  const linhasUnicas = [...new Set(precos?.map(p => p.produto?.linha).filter(Boolean) || [])].sort();

  const temFiltrosAtivos = filtroCategoria !== "__all__" || filtroMarca !== "__all__" || filtroLinha !== "__all__" || filtroDisplay !== "__all__";

  const limparFiltros = () => {
    setFiltroCategoria("__all__");
    setFiltroMarca("__all__");
    setFiltroLinha("__all__");
    setFiltroDisplay("__all__");
  };

  const precosFiltrados = precos?.filter((preco) => {
    // Filtro por busca textual
    if (busca) {
      const buscaLower = busca.toLowerCase();
      const matchBusca =
        preco.produto?.nome?.toLowerCase().includes(buscaLower) ||
        preco.produto?.codigo?.toLowerCase().includes(buscaLower) ||
        preco.produto?.sku?.toLowerCase().includes(buscaLower) ||
        preco.produto?.categoria?.toLowerCase().includes(buscaLower) ||
        preco.produto?.marca?.toLowerCase().includes(buscaLower);
      if (!matchBusca) return false;
    }

    // Filtro por categoria
    if (filtroCategoria !== "__all__" && preco.produto?.categoria !== filtroCategoria) return false;

    // Filtro por marca
    if (filtroMarca !== "__all__" && preco.produto?.marca !== filtroMarca) return false;

    // Filtro por linha
    if (filtroLinha !== "__all__" && preco.produto?.linha !== filtroLinha) return false;

    // Filtro por display
    if (filtroDisplay === "apenas_display") {
      if (preco.produto?.tipo !== "DISPLAY") return false;
    } else if (filtroDisplay === "excluir_display") {
      if (preco.produto?.tipo === "DISPLAY") return false;
    }

    return true;
  });

  const estatisticas = {
    totalProdutos: precosFiltrados?.length || 0,
    custoMedio: precosFiltrados?.reduce((acc, p) => acc + (p.preco_tabela_base || p.custo_base || 0), 0) / (precosFiltrados?.length || 1),
    precoMedio: precosFiltrados?.reduce((acc, p) => acc + (p.preco_final || 0), 0) / (precosFiltrados?.length || 1),
    margemMedia: precosFiltrados?.reduce((acc, p) => acc + (p.margem_calculada || 0), 0) / (precosFiltrados?.length || 1),
    produtosLimitados: precosFiltrados?.filter(p => p.preco_limitado)?.length || 0,
  };

  const handleExportar = async () => {
    if (!precosFiltrados || precosFiltrados.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }

    const dadosExportacao = precosFiltrados.map((preco) => ({
      codigo: preco.produto?.codigo || "",
      sku: preco.produto?.sku || "",
      produto: preco.produto?.nome || "",
      nome_comercial: preco.produto?.nome_comercial || "",
      categoria: preco.produto?.categoria || "",
      subcategoria: preco.produto?.subcategoria || "",
      marca: preco.produto?.marca || "",
      linha: preco.produto?.linha || "",
      modelo: preco.produto?.modelo || "",
      unidade: preco.produto?.unidade_medida?.sigla || "",
      preco_tabela_base: preco.preco_tabela_base || preco.custo_base || 0,
      preco_final: preco.preco_final || 0,
      margem: preco.margem_calculada || 0,
      origem_custo: preco.custo_base_origem || "",
    }));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BiMaster';
    const worksheet = workbook.addWorksheet('Preços');
    worksheet.columns = [
      { header: 'Código', key: 'codigo', width: 12 },
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'Produto', key: 'produto', width: 35 },
      { header: 'Nome Comercial', key: 'nome_comercial', width: 25 },
      { header: 'Categoria', key: 'categoria', width: 15 },
      { header: 'Subcategoria', key: 'subcategoria', width: 15 },
      { header: 'Marca', key: 'marca', width: 15 },
      { header: 'Linha', key: 'linha', width: 15 },
      { header: 'Modelo', key: 'modelo', width: 15 },
      { header: 'Unidade', key: 'unidade', width: 8 },
      { header: 'Preço Tabela Base', key: 'preco_tabela_base', width: 12 },
      { header: 'Preço Final', key: 'preco_final', width: 12 },
      { header: 'Margem (%)', key: 'margem', width: 10 },
      { header: 'Origem Custo', key: 'origem_custo', width: 15 },
    ];
    dadosExportacao.forEach(row => worksheet.addRow(row));
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Tabela_Precos_${tabela?.codigo}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Tabela exportada com sucesso!");

    // Audit export
    import("@/lib/utils/sensitive-audit").then(({ auditExport }) =>
      auditExport("excel", "fabrica_tabela_precos", dadosExportacao.length, `Tabela_Precos_${tabela?.codigo}`)
    );
  };

  const getMargemBadge = (margem: number) => {
    if (margem >= 30) {
      return <Badge className="bg-green-600 gap-1"><TrendingUp className="h-3 w-3" /> {formatarPercentual(margem)}</Badge>;
    } else if (margem >= 15) {
      return <Badge className="bg-blue-600 gap-1"><Minus className="h-3 w-3" /> {formatarPercentual(margem)}</Badge>;
    } else {
      return <Badge variant="destructive" className="gap-1"><TrendingDown className="h-3 w-3" /> {formatarPercentual(margem)}</Badge>;
    }
  };

  if (!tabela) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl">{tabela.nome}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {tabela.descricao || "Visualização completa de preços"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowExportPDF(true)} variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
              <Button onClick={handleExportar} size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Estatísticas */}
        <div className="grid grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Package className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Total de Produtos</p>
                  <p className="text-xl font-bold">{estatisticas.totalProdutos}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-xs text-muted-foreground">{tabela.tabela_base_id ? "Preço Base Médio" : "Custo Médio"}</p>
                  <p className="text-xl font-bold">{formatarMoeda(estatisticas.custoMedio)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Tag className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Preço Médio</p>
                  <p className="text-xl font-bold">{formatarMoeda(estatisticas.precoMedio)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-8 w-8 text-orange-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Margem Média</p>
                  <p className="text-xl font-bold">{formatarPercentual(estatisticas.margemMedia)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {estatisticas.produtosLimitados > 0 && (
            <Card className="bg-yellow-500/10 border-yellow-500/30">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-8 w-8 text-yellow-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Preços Limitados</p>
                    <p className="text-xl font-bold text-yellow-700">{estatisticas.produtosLimitados}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, SKU, nome, categoria ou marca..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas Categorias</SelectItem>
              {categoriasUnicas.map((cat) => (
                <SelectItem key={cat} value={cat!}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroMarca} onValueChange={setFiltroMarca}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Marca" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas Marcas</SelectItem>
              {marcasUnicas.map((marca) => (
                <SelectItem key={marca} value={marca!}>{marca}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroLinha} onValueChange={setFiltroLinha}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Linha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas Linhas</SelectItem>
              {linhasUnicas.map((linha) => (
                <SelectItem key={linha} value={linha!}>{linha}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroDisplay} onValueChange={setFiltroDisplay}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Display" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              <SelectItem value="apenas_display">Apenas Displays</SelectItem>
              <SelectItem value="excluir_display">Excluir Displays</SelectItem>
            </SelectContent>
          </Select>

          {temFiltrosAtivos && (
            <Button variant="ghost" size="sm" onClick={limparFiltros} className="h-8 text-xs gap-1">
              <X className="h-3 w-3" />
              Limpar filtros
            </Button>
          )}
        </div>

        {/* Tabela de Preços */}
        <div className="flex-1 overflow-auto border rounded-lg">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Carregando preços...</p>
            </div>
          ) : precosFiltrados?.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">
                {busca ? "Nenhum produto encontrado" : "Nenhum preço cadastrado nesta tabela"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[100px]">Código</TableHead>
                  <TableHead className="w-[120px]">SKU</TableHead>
                  <TableHead className="min-w-[250px]">Produto</TableHead>
                  <TableHead className="w-[120px]">Categoria</TableHead>
                  <TableHead className="w-[100px]">Marca</TableHead>
                  <TableHead className="w-[80px]">Unid.</TableHead>
                  <TableHead className="w-[110px] text-right">{tabela.tabela_base_id ? "Preço Base" : "Custo Base"}</TableHead>
                  <TableHead className="w-[110px] text-right">Preço Final</TableHead>
                  <TableHead className="w-[100px] text-center">Margem</TableHead>
                  <TableHead className="w-[120px]">Origem</TableHead>
                  <TableHead className="w-[120px] text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {precosFiltrados?.map((preco) => (
                  <TableRow key={preco.id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-xs">
                      {preco.produto?.codigo || "-"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {preco.produto?.sku || "-"}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{preco.produto?.nome}</p>
                        {preco.produto?.nome_comercial && (
                          <p className="text-xs text-muted-foreground">
                            {preco.produto.nome_comercial}
                          </p>
                        )}
                        {preco.produto?.linha && (
                          <Badge variant="outline" className="text-xs mt-1">
                            {preco.produto.linha}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{preco.produto?.categoria || "-"}</p>
                        {preco.produto?.subcategoria && (
                          <p className="text-xs text-muted-foreground">
                            {preco.produto.subcategoria}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {preco.produto?.marca || "-"}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {preco.produto?.unidade_medida?.sigla || "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatarMoeda(preco.preco_tabela_base || preco.custo_base || 0)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1">
                          {formatarMoeda(preco.preco_final || 0)}
                          {preco.preco_limitado && (
                            <Shield className="h-3 w-3 text-yellow-600" />
                          )}
                        </div>
                        {preco.preco_limitado && preco.preco_original_calculado && (
                          <span className="text-xs text-muted-foreground line-through">
                            {formatarMoeda(preco.preco_original_calculado)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {getMargemBadge(preco.margem_calculada || 0)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-xs">
                          {preco.custo_base_origem === "ordem_producao" && "Ordem Produção"}
                          {preco.custo_base_origem === "custo_medio" && "Custo Médio"}
                          {preco.custo_base_origem === "manual" && "Manual"}
                          {preco.custo_base_origem === "tabela_anterior" && "Tabela Base"}
                          {preco.custo_base_origem === "ficha_custo" && "Ficha de Custos"}
                          {preco.custo_base_origem === "custo_origem" && "Custo Origem"}
                        </Badge>
                        {preco.custo_composicao && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Ver composição do custo">
                                <Eye className="h-4 w-4 text-orange-600" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-3" side="left" align="start">
                              <ComposicaoCustoTooltip composicao={preco.custo_composicao as any} />
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setProdutoHistorico({
                              id: preco.produto_id,
                              nome: preco.produto?.nome || "Produto"
                            });
                            setHistoricoOpen(true);
                          }}
                          className="h-8 w-8 p-0"
                          title="Ver histórico"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setProdutoEditando(preco.produto_id)}
                          className="h-8 w-8 p-0"
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPrecoExcluindo(preco)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Rodapé com contadores */}
        <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-3">
          <span>
            {precosFiltrados?.length} produto{precosFiltrados?.length !== 1 ? 's' : ''} 
            {(busca || temFiltrosAtivos) && ` encontrado${precosFiltrados?.length !== 1 ? 's' : ''}`}
          </span>
          <span>
            Tabela: <strong>{tabela.codigo}</strong>
          </span>
        </div>
      </DialogContent>

      {/* Dialog de Edição */}
      {produtoEditando && (
        <EditarPrecosProdutoDialog
          open={!!produtoEditando}
          onOpenChange={(open) => !open && setProdutoEditando(null)}
          produtoId={produtoEditando}
          onSuccess={() => {
            refetch();
            setProdutoEditando(null);
          }}
        />
      )}

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={!!precoExcluindo} onOpenChange={(open) => !open && setPrecoExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o preço do produto <strong>{precoExcluindo?.produto?.nome}</strong> desta tabela?
              <br /><br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => precoExcluindo && excluirPrecoMutation.mutate(precoExcluindo.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={excluirPrecoMutation.isPending}
            >
              {excluirPrecoMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Exportar PDF */}
      <ExportarTabelaPDF
        open={showExportPDF}
        onOpenChange={setShowExportPDF}
        tabela={tabela}
        precos={precosFiltrados || []}
      />

      {/* Dialog de Histórico */}
      {produtoHistorico && (
        <HistoricoPrecoProduto
          open={historicoOpen}
          onOpenChange={(open) => {
            setHistoricoOpen(open);
            if (!open) setProdutoHistorico(null);
          }}
          produtoId={produtoHistorico.id}
          produtoNome={produtoHistorico.nome}
        />
      )}
    </Dialog>
  );
}
