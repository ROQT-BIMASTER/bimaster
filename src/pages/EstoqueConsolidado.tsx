import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Search, Filter, Building2, ChevronDown, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";

export default function EstoqueConsolidado() {
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState<string>("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data: consolidado, isLoading } = useQuery({
    queryKey: ['estoque-consolidado'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_estoque_consolidado_por_produto_master');
      if (error) throw error;
      return data;
    }
  });

  const { data: categorias } = useQuery({
    queryKey: ['estoque-categorias'],
    queryFn: async () => {
      const { data } = await supabase
        .from('estoque_produtos_master')
        .select('categoria')
        .not('categoria', 'is', null);
      
      const unique = [...new Set(data?.map(p => p.categoria).filter(Boolean))];
      return unique as string[];
    }
  });

  const filteredData = consolidado?.filter((item: any) => {
    const matchSearch = !search || 
      item.nome_produto?.toLowerCase().includes(search.toLowerCase()) ||
      item.sku_master?.toLowerCase().includes(search.toLowerCase());
    
    const matchCategoria = categoria === "all" || item.categoria === categoria;
    
    return matchSearch && matchCategoria;
  });

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  // Calcular totais
  const totalGeral = filteredData?.reduce((acc: number, item: any) => acc + Number(item.total_quantidade || 0), 0) || 0;
  const totalProdutos = filteredData?.length || 0;
  const totalDistribuidoras = new Set(filteredData?.flatMap((item: any) => 
    item.distribuidoras?.map((d: any) => d.distribuidora_id) || []
  )).size;

  // Encontrar o máximo para a barra de progresso
  const maxQuantidade = Math.max(...(filteredData?.map((item: any) => Number(item.total_quantidade || 0)) || [1]));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Visão Consolidada de Estoque
            </h1>
            <p className="text-muted-foreground">Estoque total por produto master em todas as distribuidoras</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total em Estoque</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalGeral.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-muted-foreground">Unidades consolidadas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Produtos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalProdutos}</div>
              <p className="text-xs text-muted-foreground">Produtos master ativos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Distribuidoras</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalDistribuidoras}</div>
              <p className="text-xs text-muted-foreground">Com estoque registrado</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por produto ou SKU..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {categorias?.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30px]"></TableHead>
                    <TableHead>SKU Master</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Total Consolidado</TableHead>
                    <TableHead>Distribuidoras</TableHead>
                    <TableHead className="w-[200px]">Distribuição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData?.map((item: any) => (
                    <Collapsible key={item.produto_master_id} asChild>
                      <>
                        <TableRow className="cursor-pointer hover:bg-muted/50">
                          <TableCell>
                            <CollapsibleTrigger asChild onClick={() => toggleRow(item.produto_master_id)}>
                              <button className="p-1">
                                {expandedRows.has(item.produto_master_id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                            </CollapsibleTrigger>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{item.sku_master}</TableCell>
                          <TableCell className="font-medium">{item.nome_produto}</TableCell>
                          <TableCell>{item.unidade_medida}</TableCell>
                          <TableCell>
                            {item.categoria ? (
                              <Badge variant="outline">{item.categoria}</Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-bold text-lg">
                            {Number(item.total_quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {item.total_distribuidoras} dist.
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Progress 
                              value={(Number(item.total_quantidade) / maxQuantidade) * 100} 
                              className="h-2"
                            />
                          </TableCell>
                        </TableRow>
                        <CollapsibleContent asChild>
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={8} className="p-0">
                              <div className="p-4 space-y-2">
                                <h4 className="font-medium text-sm flex items-center gap-2">
                                  <Building2 className="h-4 w-4" />
                                  Detalhamento por Distribuidora
                                </h4>
                                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                                  {item.distribuidoras?.map((dist: any) => (
                                    <Card key={dist.distribuidora_id} className="p-3">
                                      <div className="flex justify-between items-center">
                                        <span className="font-medium text-sm">{dist.distribuidora_nome}</span>
                                        <span className="font-bold">
                                          {Number(dist.quantidade_convertida).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                      <div className="text-xs text-muted-foreground mt-1">
                                        Original: {Number(dist.quantidade).toLocaleString('pt-BR')}
                                      </div>
                                    </Card>
                                  ))}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  ))}
                  {filteredData?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nenhum produto encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
