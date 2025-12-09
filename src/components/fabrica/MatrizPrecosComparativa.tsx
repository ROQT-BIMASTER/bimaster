import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { 
  Search, 
  Download, 
  ArrowUpDown, 
  Grid3X3, 
  GripVertical, 
  Palette, 
  Filter,
  X,
  Layers,
  AlertTriangle,
  History
} from "lucide-react";
import { formatarMoeda } from "@/lib/fabrica/pricing-calculator";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { HistoricoPrecoProduto } from "./HistoricoPrecoProduto";

// Keys para localStorage
const STORAGE_KEY_COLUMN_ORDER = "fabrica-matriz-column-order";
const STORAGE_KEY_COLUMN_COLORS = "fabrica-matriz-column-colors";

// Cores predefinidas para colunas
const COLUMN_COLORS = [
  { name: "Padrão", value: "default", bg: "bg-background", header: "bg-muted/50" },
  { name: "Azul", value: "blue", bg: "bg-blue-50 dark:bg-blue-950/30", header: "bg-blue-100 dark:bg-blue-900/50" },
  { name: "Verde", value: "green", bg: "bg-green-50 dark:bg-green-950/30", header: "bg-green-100 dark:bg-green-900/50" },
  { name: "Amarelo", value: "yellow", bg: "bg-yellow-50 dark:bg-yellow-950/30", header: "bg-yellow-100 dark:bg-yellow-900/50" },
  { name: "Roxo", value: "purple", bg: "bg-purple-50 dark:bg-purple-950/30", header: "bg-purple-100 dark:bg-purple-900/50" },
  { name: "Rosa", value: "pink", bg: "bg-pink-50 dark:bg-pink-950/30", header: "bg-pink-100 dark:bg-pink-900/50" },
  { name: "Laranja", value: "orange", bg: "bg-orange-50 dark:bg-orange-950/30", header: "bg-orange-100 dark:bg-orange-900/50" },
  { name: "Ciano", value: "cyan", bg: "bg-cyan-50 dark:bg-cyan-950/30", header: "bg-cyan-100 dark:bg-cyan-900/50" },
];

interface TabelaPreco {
  id: string;
  nome: string;
  codigo: string;
  ordem: number;
  ativo: boolean;
  tabela_base_id: string | null;
  updated_at: string;
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
  marca: string | null;
  linha: string | null;
}

interface MatrizRow {
  produto: Produto;
  precos: Record<string, { preco: number; custo: number; margem: number } | null>;
}

interface SortableColumnHeaderProps {
  tabela: TabelaPreco;
  color: string;
  onColorChange: (tabelaId: string, color: string) => void;
  onSort: (id: string) => void;
  ordenarPor: string;
  ordenarAsc: boolean;
  pendente: boolean;
  baseNome: string | null;
}

function SortableColumnHeader({ 
  tabela, 
  color, 
  onColorChange, 
  onSort,
  ordenarPor,
  ordenarAsc,
  pendente,
  baseNome
}: SortableColumnHeaderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tabela.id });

  const colorConfig = COLUMN_COLORS.find(c => c.value === color) || COLUMN_COLORS[0];

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      className={`text-center min-w-[140px] ${colorConfig.header}`}
    >
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted/50 rounded"
          >
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          </button>
          <button
            onClick={() => onSort(tabela.id)}
            className="flex items-center gap-1 hover:text-primary"
          >
            {tabela.nome}
            <ArrowUpDown className="h-3 w-3" />
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button className="p-1 hover:bg-muted/50 rounded">
                <Palette className="h-3 w-3 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="center">
              <div className="grid grid-cols-4 gap-1">
                {COLUMN_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => onColorChange(tabela.id, c.value)}
                    className={`w-8 h-8 rounded border-2 ${c.header} ${
                      color === c.value ? "border-primary" : "border-transparent"
                    }`}
                    title={c.name}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
          {pendente && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="p-1 text-yellow-600 dark:text-yellow-400 animate-pulse">
                  <AlertTriangle className="h-4 w-4" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px]">
                <p className="text-sm font-medium">Pendência de Atualização</p>
                <p className="text-xs text-muted-foreground">
                  A tabela base "{baseNome}" foi alterada. Recalcule os preços desta tabela.
                </p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-xs font-normal">
            {tabela.codigo}
          </Badge>
          {ordenarPor === tabela.id && (
            <Badge variant="secondary" className="text-xs">
              {ordenarAsc ? "↑" : "↓"}
            </Badge>
          )}
        </div>
      </div>
    </TableHead>
  );
}

export function MatrizPrecosComparativa() {
  const [busca, setBusca] = useState("");
  const [ordenarPor, setOrdenarPor] = useState<string>("produto");
  const [ordenarAsc, setOrdenarAsc] = useState(true);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnColors, setColumnColors] = useState<Record<string, string>>({});
  const [initialized, setInitialized] = useState(false);
  
  // Estado do histórico
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [historicoData, setHistoricoData] = useState<{
    produtoId: string;
    produtoNome: string;
    tabelaId: string;
    tabelaNome: string;
  } | null>(null);
  
  // Filtros avançados
  const [filtroMarca, setFiltroMarca] = useState<string>("all");
  const [filtroLinha, setFiltroLinha] = useState<string>("all");
  const [filtroTabela, setFiltroTabela] = useState<string>("all");
  
  // Agrupamento
  const [agruparHabilitado, setAgruparHabilitado] = useState(false);
  const [agruparPor, setAgruparPor] = useState<"marca" | "linha">("marca");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Carregar configurações do localStorage
  useEffect(() => {
    try {
      const savedOrder = localStorage.getItem(STORAGE_KEY_COLUMN_ORDER);
      const savedColors = localStorage.getItem(STORAGE_KEY_COLUMN_COLORS);
      
      if (savedOrder) {
        setColumnOrder(JSON.parse(savedOrder));
      }
      if (savedColors) {
        setColumnColors(JSON.parse(savedColors));
      }
    } catch (e) {
      console.error("Erro ao carregar configurações da matriz:", e);
    }
    setInitialized(true);
  }, []);

  // Salvar ordem das colunas no localStorage
  useEffect(() => {
    if (initialized && columnOrder.length > 0) {
      localStorage.setItem(STORAGE_KEY_COLUMN_ORDER, JSON.stringify(columnOrder));
    }
  }, [columnOrder, initialized]);

  // Salvar cores das colunas no localStorage
  useEffect(() => {
    if (initialized && Object.keys(columnColors).length > 0) {
      localStorage.setItem(STORAGE_KEY_COLUMN_COLORS, JSON.stringify(columnColors));
    }
  }, [columnColors, initialized]);

  // Buscar tabelas ativas ordenadas por código numérico
  const { data: tabelas, isLoading: loadingTabelas } = useQuery({
    queryKey: ["fabrica-tabelas-preco-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_tabelas_preco")
        .select("id, nome, codigo, ordem, ativo, tabela_base_id, updated_at")
        .eq("ativo", true)
        .order("codigo", { ascending: true });

      if (error) throw error;
      return data as TabelaPreco[];
    },
  });

  // Inicializar ordem das colunas quando tabelas carregam (se não houver ordem salva)
  useEffect(() => {
    if (tabelas && initialized && columnOrder.length === 0) {
      setColumnOrder(tabelas.map(t => t.id));
    }
  }, [tabelas, initialized, columnOrder.length]);

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
          produto:fabrica_produtos!inner(id, nome, codigo, categoria, marca, linha)
        `)
        .eq("ativo", true);

      if (error) throw error;
      return data;
    },
  });

  // Extrair marcas e linhas únicas para filtros
  const { marcas, linhas } = useMemo(() => {
    if (!precosData) return { marcas: [], linhas: [] };
    
    const marcasSet = new Set<string>();
    const linhasSet = new Set<string>();
    
    precosData.forEach((preco: any) => {
      if (preco.produto?.marca) marcasSet.add(preco.produto.marca);
      if (preco.produto?.linha) linhasSet.add(preco.produto.linha);
    });
    
    return {
      marcas: Array.from(marcasSet).sort(),
      linhas: Array.from(linhasSet).sort(),
    };
  }, [precosData]);

  // Tabelas ordenadas conforme drag-and-drop (filtrando IDs inexistentes)
  const tabelasOrdenadas = useMemo(() => {
    if (!tabelas) return [];
    if (columnOrder.length === 0) return tabelas;
    
    // Usar ordem salva, filtrando IDs que não existem mais
    const ordenadas = columnOrder
      .map(id => tabelas.find(t => t.id === id))
      .filter((t): t is TabelaPreco => t !== undefined);
    
    // Adicionar novas tabelas que não estão na ordem salva
    const idsNaOrdem = new Set(columnOrder);
    const novasTabelas = tabelas.filter(t => !idsNaOrdem.has(t.id));
    
    return [...ordenadas, ...novasTabelas];
  }, [tabelas, columnOrder]);

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
            marca: produto.marca || null,
            linha: produto.linha || null,
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

    // Filtrar por marca
    if (filtroMarca !== "all") {
      resultado = resultado.filter(row => row.produto.marca === filtroMarca);
    }

    // Filtrar por linha
    if (filtroLinha !== "all") {
      resultado = resultado.filter(row => row.produto.linha === filtroLinha);
    }

    // Filtrar por tabela (mostrar apenas produtos que têm preço na tabela selecionada)
    if (filtroTabela !== "all") {
      resultado = resultado.filter(row => row.precos[filtroTabela] !== undefined);
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
  }, [precosData, tabelas, busca, ordenarPor, ordenarAsc, filtroMarca, filtroLinha, filtroTabela]);

  // Agrupar dados se habilitado
  const dadosAgrupados = useMemo(() => {
    if (!agruparHabilitado) return null;

    const grupos = new Map<string, MatrizRow[]>();
    
    matrizDados.forEach(row => {
      const chave = agruparPor === "marca" 
        ? (row.produto.marca || "Sem Marca")
        : (row.produto.linha || "Sem Linha");
      
      if (!grupos.has(chave)) {
        grupos.set(chave, []);
      }
      grupos.get(chave)!.push(row);
    });

    return Array.from(grupos.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [matrizDados, agruparHabilitado, agruparPor]);

  const handleOrdenar = (coluna: string) => {
    if (ordenarPor === coluna) {
      setOrdenarAsc(!ordenarAsc);
    } else {
      setOrdenarPor(coluna);
      setOrdenarAsc(true);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setColumnOrder((items) => {
        const currentItems = items.length > 0 ? items : tabelasOrdenadas.map(t => t.id);
        const oldIndex = currentItems.indexOf(active.id as string);
        const newIndex = currentItems.indexOf(over.id as string);
        const newOrder = arrayMove(currentItems, oldIndex, newIndex);
        return newOrder;
      });
      toast.success("Ordem das colunas atualizada");
    }
  };

  const handleColorChange = (tabelaId: string, color: string) => {
    setColumnColors(prev => {
      const newColors = { ...prev, [tabelaId]: color };
      return newColors;
    });
    toast.success("Cor da coluna atualizada");
  };

  const getColumnColor = (tabelaId: string) => {
    return columnColors[tabelaId] || "default";
  };

  const getMargemColor = (margem: number) => {
    if (margem <= 0) return "text-destructive";
    if (margem < 15) return "text-yellow-600 dark:text-yellow-400";
    if (margem < 30) return "text-foreground";
    return "text-green-600 dark:text-green-400";
  };

  const limparFiltros = () => {
    setBusca("");
    setFiltroMarca("all");
    setFiltroLinha("all");
    setFiltroTabela("all");
  };

  const temFiltrosAtivos = busca || filtroMarca !== "all" || filtroLinha !== "all" || filtroTabela !== "all";

  const handlePrecoClick = (produtoId: string, produtoNome: string, tabelaId: string, tabelaNome: string) => {
    setHistoricoData({ produtoId, produtoNome, tabelaId, tabelaNome });
    setHistoricoOpen(true);
  };

  const exportarExcel = () => {
    if (!matrizDados.length || !tabelasOrdenadas.length) {
      toast.error("Não há dados para exportar");
      return;
    }

    const headers = ["Código", "Produto", "Categoria", "Marca", "Linha"];
    tabelasOrdenadas.forEach((t) => {
      headers.push(`${t.nome} (Preço)`);
      headers.push(`${t.nome} (Margem %)`);
    });

    const rows = matrizDados.map((row) => {
      const linha: (string | number)[] = [
        row.produto.codigo,
        row.produto.nome,
        row.produto.categoria || "-",
        row.produto.marca || "-",
        row.produto.linha || "-",
      ];

      tabelasOrdenadas.forEach((t) => {
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

  const renderTableRows = (rows: MatrizRow[]) => {
    return rows.map((row) => (
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
        {tabelasOrdenadas.map((tabela) => {
          const preco = row.precos[tabela.id];
          const colorConfig = COLUMN_COLORS.find(c => c.value === getColumnColor(tabela.id)) || COLUMN_COLORS[0];
          return (
            <TableCell key={tabela.id} className={`text-center ${colorConfig.bg}`}>
              {preco ? (
                <button
                  onClick={() => handlePrecoClick(row.produto.id, row.produto.nome, tabela.id, tabela.nome)}
                  className="w-full cursor-pointer hover:bg-muted/50 rounded p-1 transition-colors group"
                >
                  <div className="font-semibold group-hover:text-primary">
                    {formatarMoeda(preco.preco)}
                  </div>
                  <div className={`text-xs ${getMargemColor(preco.margem)} flex items-center justify-center gap-1`}>
                    {preco.margem.toFixed(1)}%
                    <History className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
          );
        })}
      </TableRow>
    ));
  };

  return (
    <>
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Grid3X3 className="h-5 w-5 text-primary" />
              <CardTitle>Matriz Comparativa de Preços</CardTitle>
            </div>
            <Button variant="outline" onClick={exportarExcel}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Arraste as colunas para reordenar. Clique no ícone de paleta para mudar a cor. Clique em um preço para ver o histórico.
          </p>

          {/* Filtros avançados */}
          <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/30 rounded-lg border">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtros:</span>
            </div>

            <div className="relative flex-1 min-w-[200px] max-w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filtroMarca} onValueChange={setFiltroMarca}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Marca" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Marcas</SelectItem>
                {marcas.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroLinha} onValueChange={setFiltroLinha}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Linha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Linhas</SelectItem>
                {linhas.map(l => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroTabela} onValueChange={setFiltroTabela}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tabela" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Tabelas</SelectItem>
                {tabelas?.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {temFiltrosAtivos && (
              <Button variant="ghost" size="sm" onClick={limparFiltros}>
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}

            <div className="ml-auto flex items-center gap-3 pl-4 border-l">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <Switch
                  id="agrupar"
                  checked={agruparHabilitado}
                  onCheckedChange={setAgruparHabilitado}
                />
                <Label htmlFor="agrupar" className="text-sm">Agrupar</Label>
              </div>
              
              {agruparHabilitado && (
                <Select value={agruparPor} onValueChange={(v) => setAgruparPor(v as "marca" | "linha")}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="marca">Por Marca</SelectItem>
                    <SelectItem value="linha">Por Linha</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
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
              {temFiltrosAtivos ? "Nenhum produto encontrado com os filtros aplicados" : "Nenhum produto com preços cadastrados"}
            </div>
          ) : (
            <ScrollArea className="w-full">
              <div className="min-w-max">
                <TooltipProvider>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
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
                        <SortableContext
                          items={tabelasOrdenadas.map(t => t.id)}
                          strategy={horizontalListSortingStrategy}
                        >
                          {tabelasOrdenadas.map((tabela) => {
                            // Verificar pendência: tabela tem base e foi atualizada ANTES da base
                            const tabelaBase = tabela.tabela_base_id
                              ? tabelas?.find(t => t.id === tabela.tabela_base_id)
                              : null;
                            const pendente = tabelaBase
                              ? new Date(tabela.updated_at) < new Date(tabelaBase.updated_at)
                              : false;
                            
                            return (
                              <SortableColumnHeader
                                key={tabela.id}
                                tabela={tabela}
                                color={getColumnColor(tabela.id)}
                                onColorChange={handleColorChange}
                                onSort={handleOrdenar}
                                ordenarPor={ordenarPor}
                                ordenarAsc={ordenarAsc}
                                pendente={pendente}
                                baseNome={tabelaBase?.nome || null}
                              />
                            );
                          })}
                        </SortableContext>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agruparHabilitado && dadosAgrupados ? (
                        dadosAgrupados.map(([grupo, rows]) => (
                          <>
                            <TableRow key={`group-${grupo}`} className="bg-muted/70">
                              <TableCell
                                colSpan={2 + tabelasOrdenadas.length}
                                className="sticky left-0 font-semibold text-primary"
                              >
                                <div className="flex items-center gap-2">
                                  <Layers className="h-4 w-4" />
                                  {agruparPor === "marca" ? "Marca" : "Linha"}: {grupo}
                                  <Badge variant="secondary" className="ml-2">
                                    {rows.length} produto(s)
                                  </Badge>
                                </div>
                              </TableCell>
                            </TableRow>
                            {renderTableRows(rows)}
                          </>
                        ))
                      ) : (
                        renderTableRows(matrizDados)
                      )}
                    </TableBody>
                  </Table>
                </DndContext>
              </TooltipProvider>
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

      {/* Dialog de Histórico */}
      {historicoData && (
        <HistoricoPrecoProduto
          open={historicoOpen}
          onOpenChange={setHistoricoOpen}
          produtoId={historicoData.produtoId}
          produtoNome={`${historicoData.produtoNome} - ${historicoData.tabelaNome}`}
        />
      )}
    </>
  );
}
