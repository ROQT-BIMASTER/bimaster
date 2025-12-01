import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Download, Search, TrendingUp, TrendingDown, Minus, Package, DollarSign, Tag } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabela: any;
}

export function VisualizacaoPrecosDialog({ open, onOpenChange, tabela }: Props) {
  const [busca, setBusca] = useState("");

  const { data: precos, isLoading } = useQuery({
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

      // Combinar dados e ordenar
      const resultado = precosData
        .map(preco => ({
          ...preco,
          produto: produtosMap.get(preco.produto_id)
        }))
        .sort((a: any, b: any) => 
          (a.produto?.nome || '').localeCompare(b.produto?.nome || '')
        );

      return resultado;
    },
    enabled: open && !!tabela?.id,
  });

  const precosFiltrados = precos?.filter((preco) => {
    if (!busca) return true;
    const buscaLower = busca.toLowerCase();
    return (
      preco.produto?.nome?.toLowerCase().includes(buscaLower) ||
      preco.produto?.codigo?.toLowerCase().includes(buscaLower) ||
      preco.produto?.sku?.toLowerCase().includes(buscaLower) ||
      preco.produto?.categoria?.toLowerCase().includes(buscaLower) ||
      preco.produto?.marca?.toLowerCase().includes(buscaLower)
    );
  });

  const estatisticas = {
    totalProdutos: precosFiltrados?.length || 0,
    custoMedio: precosFiltrados?.reduce((acc, p) => acc + (p.custo_base || 0), 0) / (precosFiltrados?.length || 1),
    precoMedio: precosFiltrados?.reduce((acc, p) => acc + (p.preco_final || 0), 0) / (precosFiltrados?.length || 1),
    margemMedia: precosFiltrados?.reduce((acc, p) => acc + (p.margem_lucro_percentual || 0), 0) / (precosFiltrados?.length || 1),
  };

  const handleExportar = () => {
    if (!precosFiltrados || precosFiltrados.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }

    const dadosExportacao = precosFiltrados.map((preco) => ({
      "Código": preco.produto?.codigo || "",
      "SKU": preco.produto?.sku || "",
      "Produto": preco.produto?.nome || "",
      "Nome Comercial": preco.produto?.nome_comercial || "",
      "Categoria": preco.produto?.categoria || "",
      "Subcategoria": preco.produto?.subcategoria || "",
      "Marca": preco.produto?.marca || "",
      "Linha": preco.produto?.linha || "",
      "Modelo": preco.produto?.modelo || "",
      "Unidade": preco.produto?.unidade_medida?.sigla || "",
      "Custo Base": preco.custo_base || 0,
      "Preço Final": preco.preco_final || 0,
      "Margem (%)": preco.margem_lucro_percentual || 0,
      "Origem Custo": preco.custo_base_origem || "",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dadosExportacao);

    // Ajustar largura das colunas
    const colWidths = [
      { wch: 12 }, // Código
      { wch: 15 }, // SKU
      { wch: 35 }, // Produto
      { wch: 25 }, // Nome Comercial
      { wch: 15 }, // Categoria
      { wch: 15 }, // Subcategoria
      { wch: 15 }, // Marca
      { wch: 15 }, // Linha
      { wch: 15 }, // Modelo
      { wch: 8 },  // Unidade
      { wch: 12 }, // Custo Base
      { wch: 12 }, // Preço Final
      { wch: 10 }, // Margem
      { wch: 15 }, // Origem Custo
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "Preços");
    XLSX.writeFile(wb, `Tabela_Precos_${tabela?.codigo}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Tabela exportada com sucesso!");
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
            <Button onClick={handleExportar} size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
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
                  <p className="text-xs text-muted-foreground">Custo Médio</p>
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
                  <TableHead className="w-[110px] text-right">Custo Base</TableHead>
                  <TableHead className="w-[110px] text-right">Preço Final</TableHead>
                  <TableHead className="w-[100px] text-center">Margem</TableHead>
                  <TableHead className="w-[120px]">Origem</TableHead>
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
                      {formatarMoeda(preco.custo_base || 0)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">
                      {formatarMoeda(preco.preco_final || 0)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getMargemBadge(preco.margem_lucro_percentual || 0)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {preco.custo_base_origem === "ordem_producao" && "Ordem Produção"}
                        {preco.custo_base_origem === "custo_medio" && "Custo Médio"}
                        {preco.custo_base_origem === "manual" && "Manual"}
                        {preco.custo_base_origem === "tabela_anterior" && "Tabela Base"}
                      </Badge>
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
            {busca && ` encontrado${precosFiltrados?.length !== 1 ? 's' : ''}`}
          </span>
          <span>
            Tabela: <strong>{tabela.codigo}</strong>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
