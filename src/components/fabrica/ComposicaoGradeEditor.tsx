import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Plus, Trash2, Package, Filter, Loader2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { ColorPickerPopover } from "@/components/fabrica/ColorPickerPopover";
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface GradeItem {
  produto_filho_id: string;
  nome: string;
  codigo: string;
  codigo_barras_ean: string | null;
  quantidade: number;
  ordem: number;
  cor_numero?: string;
  cor_hex?: string;
  linha?: string;
  marca?: string;
}

interface ProdutoDisponivel {
  id: string;
  nome: string;
  codigo: string;
  codigo_barras_ean: string | null;
  foto_url: string | null;
  linha: string | null;
  marca: string | null;
  categoria: string | null;
}

interface ComposicaoGradeEditorProps {
  produtoPaiId?: string;
  items: GradeItem[];
  onChange: (items: GradeItem[]) => void;
}

interface SortableGradeRowProps {
  item: GradeItem;
  index: number;
  onUpdateQtd: (index: number, qty: number) => void;
  onUpdateCor: (index: number, cor: string) => void;
  onUpdateCorHex: (index: number, hex: string) => void;
  onRemove: (index: number) => void;
}

function SortableGradeRow({ item, index, onUpdateQtd, onUpdateCor, onUpdateCorHex, onRemove }: SortableGradeRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.produto_filho_id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="py-1 px-1">
        <button type="button" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground hover:text-foreground">
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </TableCell>
      <TableCell className="py-1 text-[11px] font-mono">{item.codigo}</TableCell>
      <TableCell className="py-1 text-[11px] truncate max-w-[160px]">{item.nome}</TableCell>
      <TableCell className="py-1">
        <div className="flex items-center gap-1">
          <ColorPickerPopover
            value={item.cor_hex || ""}
            onChange={(hex) => onUpdateCorHex(index, hex)}
          />
          <Input
            type="text"
            value={item.cor_numero || ""}
            onChange={(e) => onUpdateCor(index, e.target.value)}
            className="w-16 h-6 text-[10px] px-1"
            placeholder="Nome/Nº"
          />
        </div>
      </TableCell>
      <TableCell className="py-1">
        <Input
          type="number"
          min={1}
          value={item.quantidade}
          onChange={(e) => onUpdateQtd(index, parseInt(e.target.value) || 1)}
          className="w-14 h-6 text-[10px] text-center px-1"
        />
      </TableCell>
      <TableCell className="py-1">
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => onRemove(index)}>
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function ComposicaoGradeEditor({ produtoPaiId, items, onChange }: ComposicaoGradeEditorProps) {
  const [produtos, setProdutos] = useState<ProdutoDisponivel[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroMarca, setFiltroMarca] = useState("__ALL__");
  const [filtroLinha, setFiltroLinha] = useState("__ALL__");

  // Load all eligible products once
  useEffect(() => {
    const carregarProdutos = async () => {
      setCarregando(true);
      const { data, error } = await supabase
        .from("fabrica_produtos")
        .select("id, nome, codigo, codigo_barras_ean, foto_url, linha, marca, categoria")
        .eq("ativo", true)
        .neq("tipo", "MP")
        .neq("tipo", "DISPLAY")
        .order("nome");

      if (!error && data) {
        setProdutos(data);
      }
      setCarregando(false);
    };
    carregarProdutos();
  }, []);

  // Extract distinct brands and lines
  const marcas = useMemo(() => {
    const set = new Set(produtos.map(p => p.marca).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [produtos]);

  const linhas = useMemo(() => {
    let filtered = produtos;
    if (filtroMarca !== "__ALL__") {
      filtered = filtered.filter(p => p.marca === filtroMarca);
    }
    const set = new Set(filtered.map(p => p.linha).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [produtos, filtroMarca]);

  // Filter products
  const produtosFiltrados = useMemo(() => {
    const idsJaAdicionados = new Set(items.map(i => i.produto_filho_id));
    if (produtoPaiId) idsJaAdicionados.add(produtoPaiId);

    return produtos.filter(p => {
      if (idsJaAdicionados.has(p.id)) return false;
      if (filtroMarca !== "__ALL__" && p.marca !== filtroMarca) return false;
      if (filtroLinha !== "__ALL__" && p.linha !== filtroLinha) return false;
      if (busca.length >= 2) {
        const termo = busca.toLowerCase();
        const match =
          p.nome.toLowerCase().includes(termo) ||
          p.codigo.toLowerCase().includes(termo) ||
          (p.codigo_barras_ean && p.codigo_barras_ean.toLowerCase().includes(termo));
        if (!match) return false;
      }
      return true;
    });
  }, [produtos, items, produtoPaiId, filtroMarca, filtroLinha, busca]);

  const adicionarItem = (produto: ProdutoDisponivel) => {
    const novo: GradeItem = {
      produto_filho_id: produto.id,
      nome: produto.nome,
      codigo: produto.codigo,
      codigo_barras_ean: produto.codigo_barras_ean,
      quantidade: 1,
      ordem: items.length,
      cor_numero: "",
      linha: produto.linha || "",
      marca: produto.marca || "",
    };
    onChange([...items, novo]);
  };

  const removerItem = (index: number) => {
    const novos = items.filter((_, i) => i !== index).map((item, i) => ({ ...item, ordem: i }));
    onChange(novos);
  };

  const atualizarQuantidade = (index: number, quantidade: number) => {
    if (quantidade < 1) return;
    const novos = [...items];
    novos[index] = { ...novos[index], quantidade };
    onChange(novos);
  };

  const atualizarCorNumero = (index: number, cor_numero: string) => {
    const novos = [...items];
    novos[index] = { ...novos[index], cor_numero };
    onChange(novos);
  };

  const atualizarCorHex = (index: number, cor_hex: string) => {
    const novos = [...items];
    novos[index] = { ...novos[index], cor_hex };
    onChange(novos);
  };

  const totalItens = items.reduce((acc, i) => acc + i.quantidade, 0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex(i => i.produto_filho_id === active.id);
    const newIndex = items.findIndex(i => i.produto_filho_id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(items, oldIndex, newIndex).map((item, i) => ({ ...item, ordem: i }));
    onChange(reordered);
  };

  return (
    <div className="space-y-4">
      {/* Header with summary */}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Composição de Grade</Label>
        {items.length > 0 && (
          <div className="flex gap-2">
            <Badge variant="secondary" className="text-[10px]">
              {items.length} variante{items.length !== 1 ? "s" : ""}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {totalItens} un. total
            </Badge>
          </div>
        )}
      </div>

      {/* Filters bar */}
      <div className="flex items-center gap-2">
        <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <select
          value={filtroMarca}
          onChange={(e) => { setFiltroMarca(e.target.value); setFiltroLinha("__ALL__"); }}
          className="h-8 text-xs w-[130px] rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-2 focus:ring-ring/30"
        >
          <option value="__ALL__">Todas Marcas</option>
          {marcas.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={filtroLinha}
          onChange={(e) => setFiltroLinha(e.target.value)}
          className="h-8 text-xs w-[140px] rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-2 focus:ring-ring/30"
        >
          <option value="__ALL__">Todas Linhas</option>
          {linhas.map(l => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar nome, código ou EAN..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-7 h-8 text-xs"
          />
        </div>
      </div>

      {/* Products table */}
      <div className="border rounded-md">
        <ScrollArea className="h-[200px]">
          {carregando ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : produtosFiltrados.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">
              {produtos.length === 0 ? "Nenhum produto acabado cadastrado" : "Nenhum produto encontrado com esses filtros"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-8 text-[10px] w-[50px]"></TableHead>
                  <TableHead className="h-8 text-[10px] w-[90px]">Código</TableHead>
                  <TableHead className="h-8 text-[10px]">Nome</TableHead>
                  <TableHead className="h-8 text-[10px] w-[90px]">Linha</TableHead>
                  <TableHead className="h-8 text-[10px] w-[120px]">EAN</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtosFiltrados.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-accent/50" onClick={() => adicionarItem(p)}>
                    <TableCell className="py-1.5 px-2">
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); adicionarItem(p); }}>
                        <Plus className="h-3.5 w-3.5 text-primary" />
                      </Button>
                    </TableCell>
                    <TableCell className="py-1.5 text-[11px] font-mono">{p.codigo}</TableCell>
                    <TableCell className="py-1.5 text-[11px] font-medium truncate max-w-[180px]">{p.nome}</TableCell>
                    <TableCell className="py-1.5 text-[10px] text-muted-foreground">{p.linha || "—"}</TableCell>
                    <TableCell className="py-1.5 text-[10px] font-mono text-muted-foreground">{p.codigo_barras_ean || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </div>

      {/* Selected items */}
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <Package className="h-6 w-6 text-muted-foreground/30 mx-auto mb-1.5" />
          <p className="text-xs text-muted-foreground">
            Clique em <Plus className="inline h-3 w-3" /> na tabela acima para adicionar produtos ao kit.
          </p>
        </div>
      ) : (
        <div>
          <Label className="text-xs font-semibold text-muted-foreground mb-2 block">
            Itens selecionados <span className="font-normal">(arraste para reordenar)</span>
          </Label>
          <ScrollArea className="max-h-[200px]">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-7 text-[10px] w-[30px]"></TableHead>
                  <TableHead className="h-7 text-[10px] w-[80px]">Código</TableHead>
                  <TableHead className="h-7 text-[10px]">Nome</TableHead>
                  <TableHead className="h-7 text-[10px] w-[100px] text-center">Cor</TableHead>
                  <TableHead className="h-7 text-[10px] w-[65px] text-center">Qtd</TableHead>
                  <TableHead className="h-7 text-[10px] w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map(i => i.produto_filho_id)} strategy={verticalListSortingStrategy}>
                  <TableBody>
                    {items.map((item, index) => (
                      <SortableGradeRow
                        key={item.produto_filho_id}
                        item={item}
                        index={index}
                        onUpdateQtd={atualizarQuantidade}
                        onUpdateCor={atualizarCorNumero}
                        onUpdateCorHex={atualizarCorHex}
                        onRemove={removerItem}
                      />
                    ))}
                  </TableBody>
                </SortableContext>
              </DndContext>
            </Table>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
