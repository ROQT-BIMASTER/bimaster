import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Plus, Trash2, GripVertical, Package, Barcode } from "lucide-react";
import { toast } from "sonner";

interface GradeItem {
  produto_filho_id: string;
  nome: string;
  codigo: string;
  codigo_barras_ean: string | null;
  quantidade: number;
  ordem: number;
}

interface ComposicaoGradeEditorProps {
  produtoPaiId?: string;
  items: GradeItem[];
  onChange: (items: GradeItem[]) => void;
}

export function ComposicaoGradeEditor({ produtoPaiId, items, onChange }: ComposicaoGradeEditorProps) {
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<any[]>([]);
  const [buscando, setBuscando] = useState(false);

  const buscarProdutos = useCallback(async (termo: string) => {
    if (termo.length < 2) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    const { data } = await supabase
      .from("fabrica_produtos")
      .select("id, nome, codigo, codigo_barras_ean, foto_url")
      .or(`nome.ilike.%${termo}%,codigo.ilike.%${termo}%`)
      .eq("ativo", true)
      .neq("tipo", "MP")
      .limit(10);

    // Filter out already-added items and the parent itself
    const ids = new Set(items.map(i => i.produto_filho_id));
    if (produtoPaiId) ids.add(produtoPaiId);
    setResultados((data || []).filter(p => !ids.has(p.id)));
    setBuscando(false);
  }, [items, produtoPaiId]);

  useEffect(() => {
    const timeout = setTimeout(() => buscarProdutos(busca), 300);
    return () => clearTimeout(timeout);
  }, [busca, buscarProdutos]);

  const adicionarItem = (produto: any) => {
    const novo: GradeItem = {
      produto_filho_id: produto.id,
      nome: produto.nome,
      codigo: produto.codigo,
      codigo_barras_ean: produto.codigo_barras_ean,
      quantidade: 1,
      ordem: items.length,
    };
    onChange([...items, novo]);
    setBusca("");
    setResultados([]);
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

  const totalItens = items.reduce((acc, i) => acc + i.quantidade, 0);

  return (
    <div className="space-y-3">
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Buscar produto para adicionar..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
        {resultados.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
            {resultados.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => adicionarItem(p)}
                className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-accent text-sm transition-colors"
              >
                <Plus className="h-3.5 w-3.5 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-xs">{p.nome}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{p.codigo}</p>
                </div>
                {p.codigo_barras_ean && (
                  <Badge variant="outline" className="text-[9px] shrink-0">
                    <Barcode className="h-2.5 w-2.5 mr-0.5" />
                    {p.codigo_barras_ean}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Items list */}
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <Package className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">
            Nenhum produto na grade. Busque e adicione produtos acima.
          </p>
        </div>
      ) : (
        <ScrollArea className="max-h-[240px]">
          <div className="space-y-1.5">
            {items.map((item, index) => (
              <div
                key={item.produto_filho_id}
                className="flex items-center gap-2 rounded-lg border bg-muted/20 px-2.5 py-2"
              >
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{item.nome}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-muted-foreground font-mono">{item.codigo}</span>
                    {item.codigo_barras_ean && (
                      <Badge variant="outline" className="text-[9px] py-0 px-1">
                        {item.codigo_barras_ean}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Input
                    type="number"
                    min={1}
                    value={item.quantidade}
                    onChange={(e) => atualizarQuantidade(index, parseInt(e.target.value) || 1)}
                    className="w-14 h-7 text-xs text-center"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removerItem(index)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
