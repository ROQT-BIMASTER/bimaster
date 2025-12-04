import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Search, Download, ArrowUpDown, Grid3X3 } from "lucide-react";
import { formatarMoeda } from "@/lib/fabrica/pricing-calculator";
import * as XLSX from "xlsx";
import { toast } from "sonner";

interface TabelaPreco {
  id: string;
  nome: string;
  codigo: string;
  ordem: number;
  ativo: boolean;
}

interface PrecoItem {
  produto_id: string;
  tabela_id: string;
  preco_final: number;
  custo_base: number;
  margem_lucro_percentual: number;
}

interface Produto {
  id: string;
  nome: string;
  codigo: string;
  categoria: string | null;
}

interface MatrizRow {
  produto: Produto;
  precos: Record<string, { preco: number; custo: number; margem: number } | null>;
}

export function MatrizPrecosComparativa() {
  const [busca, setBusca] = useState("");
  const [ordenarPor, setOrdenarPor] = useState<string>("produto");
  const [ordenarAsc, setOrdenarAsc] = useState(true);

  // Buscar tabelas ativas
  const { data: tabelas, isLoading: loadingTabelas } = useQuery({
    queryKey: ["fabrica-tabelas-preco-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_tabelas_preco")
        .select("id, nome, codigo, ordem, ativo")
        .eq("ativo", true)
        .order("ordem", { ascending: true });

      if (error) throw error;
      return data as TabelaPreco[];
    },
  });

  // Buscar todos os preços com produtos
  const { data: precosData, isLoading: loadingPrecos } = useQuery({
    queryKey: ["fabrica-matriz-precos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_precos_produtos")
        .select(`
          produto_id,
          tabela_id,
          preco_final,
          custo_base,
          margem_lucro_percentual,
          produto:fabrica_produtos!inner(id, nome, codigo, categoria)
        `)
        .eq("ativo", true);

      if (error) throw error;
      return data;
    },
  });

  // Transformar dados em formato matricial
  const matrizDados = useMemo(() => {
    if (!precosData || !tabelas) return [];

    // Agrupar por produto
    const produtosMap = new Map<string, MatrizRow>();

    precosData.forEach((preco: any) => {
      const produtoId = preco.produto_id;
      const produto = preco.produto as Produto;

      if (!produtosMap.has(produtoId)) {
        produtosMap.set(produtoId, {
          produto: {
            id: produto.id,
            nome: produto.nome,
            codigo: produto.codigo,
            categoria: produto.categoria,
          },
          precos: {},
        });
      }

      const row = produtosMap.get(produtoId)!;
      row.precos[preco.tabela_id] = {
        preco: preco.preco_final,
        custo: preco.custo_base,
        margem: preco.margem_lucro_percentual,
      };
    });

    let resultado = Array.from(produtosMap.values());

    // Filtrar por busca
    if (busca) {
      const termoBusca = busca.toLowerCase();
      resultado = resultado.filter(
        (row) =>
          row.produto.nome.toLowerCase().includes(termoBusca) ||
          row.produto.codigo.toLowerCase().includes(termoBusca) ||
          (row.produto.categoria?.toLowerCase().includes(termoBusca) ?? false)
      );
    }

    // Ordenar
    resultado.sort((a, b) => {
      let comparacao = 0;

      if (ordenarPor === "produto") {
        comparacao = a.produto.nome.localeCompare(b.produto.nome);
      } else {
        // Ordenar por preço de uma tabela específica
        const precoA = a.precos[ordenarPor]?.preco || 0;
        const precoB = b.precos[ordenarPor]?.preco || 0;
        comparacao = precoA - precoB;
      }

      return ordenarAsc ? comparacao : -comparacao;
    });

    return resultado;
  }, [precosData, tabelas, busca, ordenarPor, ordenarAsc]);

  const handleOrdenar = (coluna: string) => {
    if (ordenarPor === coluna) {
      setOrdenarAsc(!ordenarAsc);
    } else {
      setOrdenarPor(coluna);
      setOrdenarAsc(true);
    }
  };

  const getMargemColor = (margem: number) => {
    if (margem <= 0) return "text-destructive";
    if (margem < 15) return "text-yellow-600 dark:text-yellow-400";
    if (margem < 30) return "text-foreground";
    return "text-green-600 dark:text-green-400";
  };

  const exportarExcel = () => {
    if (!matrizDados.length || !tabelas) {
      toast.error("Não há dados para exportar");
      return;
    }

    const headers = ["Código", "Produto", "Categoria"];
    tabelas.forEach((t) => {
      headers.push(`${t.nome} (Preço)`);
      headers.push(`${t.nome} (Margem %)`);
    });

    const rows = matrizDados.map((row) => {
      const linha: (string | number)[] = [
        row.produto.codigo,
        row.produto.nome,
        row.produto.categoria || "-",
      ];

      tabelas.forEach((t) => {
        const preco = row.precos[t.id];
        linha.push(preco ? preco.preco : "-");
        linha.push(preco ? `${preco.margem.toFixed(1)}%` : "-");
      });

      return linha;
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Ajustar largura das colunas
    const colWidths = headers.map((h) => ({ wch: Math.max(h.length, 12) }));
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Matriz de Preços");
    XLSX.writeFile(wb, `matriz-precos-${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Arquivo exportado com sucesso!");
  };

  const isLoading = loadingTabelas || loadingPrecos;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5 text-primary" />
            <CardTitle>Matriz Comparativa de Preços</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Button variant="outline" onClick={exportarExcel}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Visualize todos os produtos e seus preços em cada tabela. Clique nos cabeçalhos para ordenar.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Carregando matriz de preços...</p>
          </div>
        ) : !tabelas?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhuma tabela de preços ativa encontrada
          </div>
        ) : !matrizDados.length ? (
          <div className="text-center py-12 text-muted-foreground">
            {busca ? "Nenhum produto encontrado para a busca" : "Nenhum produto com preços cadastrados"}
          </div>
        ) : (
          <ScrollArea className="w-full">
            <div className="min-w-max">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead
                      className="sticky left-0 z-20 bg-muted/95 backdrop-blur cursor-pointer hover:bg-muted min-w-[200px]"
                      onClick={() => handleOrdenar("produto")}
                    >
                      <div className="flex items-center gap-1">
                        Produto
                        <ArrowUpDown className="h-3 w-3" />
                        {ordenarPor === "produto" && (
                          <Badge variant="secondary" className="ml-1 text-xs">
                            {ordenarAsc ? "A-Z" : "Z-A"}
                          </Badge>
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="sticky left-[200px] z-20 bg-muted/95 backdrop-blur min-w-[100px]">
                      Código
                    </TableHead>
                    {tabelas.map((tabela) => (
                      <TableHead
                        key={tabela.id}
                        className="text-center cursor-pointer hover:bg-muted min-w-[140px]"
                        onClick={() => handleOrdenar(tabela.id)}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1">
                            {tabela.nome}
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                          <Badge variant="outline" className="text-xs font-normal">
                            {tabela.codigo}
                          </Badge>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TooltipProvider>
                    {matrizDados.map((row) => (
                      <TableRow key={row.produto.id} className="hover:bg-muted/30">
                        <TableCell className="sticky left-0 z-10 bg-background font-medium">
                          <div>
                            <span className="block">{row.produto.nome}</span>
                            {row.produto.categoria && (
                              <span className="text-xs text-muted-foreground">
                                {row.produto.categoria}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="sticky left-[200px] z-10 bg-background font-mono text-sm">
                          {row.produto.codigo}
                        </TableCell>
                        {tabelas.map((tabela) => {
                          const preco = row.precos[tabela.id];
                          return (
                            <TableCell key={tabela.id} className="text-center">
                              {preco ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="cursor-help">
                                      <div className="font-semibold">
                                        {formatarMoeda(preco.preco)}
                                      </div>
                                      <div className={`text-xs ${getMargemColor(preco.margem)}`}>
                                        {preco.margem.toFixed(1)}%
                                      </div>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="space-y-1 text-sm">
                                      <div><strong>Preço:</strong> {formatarMoeda(preco.preco)}</div>
                                      <div><strong>Custo Base:</strong> {formatarMoeda(preco.custo)}</div>
                                      <div><strong>Margem:</strong> {preco.margem.toFixed(2)}%</div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TooltipProvider>
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}

        {matrizDados.length > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>{matrizDados.length} produto(s) encontrado(s)</span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-destructive" /> Margem ≤ 0%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-yellow-500" /> Margem &lt; 15%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-green-500" /> Margem ≥ 30%
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
