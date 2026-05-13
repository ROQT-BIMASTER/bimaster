import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, ChevronsUpDown, X, Pin } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProdutoOpt {
  id: string;
  nome: string;
  codigo?: string | null;
  tipo?: string | null;
}

interface Props {
  produtos: ProdutoOpt[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Combobox de seleção múltipla com:
 * - Busca por nome/código
 * - Itens selecionados FIXOS no topo (não somem ao buscar)
 * - Chips removíveis fora do popover para tratar produtos em ordem
 */
export function MultiSelectProdutos({
  produtos,
  selected,
  onChange,
  placeholder = "Selecionar produtos...",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedItems = useMemo(
    () => produtos.filter(p => selectedSet.has(p.id)),
    [produtos, selectedSet],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return produtos;
    return produtos.filter(
      p =>
        p.nome.toLowerCase().includes(q) ||
        (p.codigo || "").toLowerCase().includes(q),
    );
  }, [produtos, query]);

  // Fixos no topo + restantes filtrados (sem duplicar)
  const orderedList = useMemo(() => {
    const fixos = selectedItems;
    const restantes = filtered.filter(p => !selectedSet.has(p.id));
    return { fixos, restantes };
  }, [selectedItems, filtered, selectedSet]);

  const toggle = (id: string) => {
    if (selectedSet.has(id)) onChange(selected.filter(x => x !== id));
    else onChange([...selected, id]);
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="flex items-center gap-1.5 truncate">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              {selected.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : (
                <span className="text-sm">
                  {selected.length} produto{selected.length > 1 ? "s" : ""} selecionado
                  {selected.length > 1 ? "s" : ""}
                </span>
              )}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[360px] p-0" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar nome ou código..."
                className="pl-8 h-8 text-sm"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
              <span>
                {selected.length} fixos · {orderedList.restantes.length} disponíveis
              </span>
              {selected.length > 0 && (
                <button
                  type="button"
                  className="text-destructive hover:underline"
                  onClick={() => onChange([])}
                >
                  Limpar tudo
                </button>
              )}
            </div>
          </div>

          <ScrollArea className="max-h-[300px]">
            <div className="p-1">
              {orderedList.fixos.length > 0 && (
                <>
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase text-primary tracking-wider flex items-center gap-1">
                    <Pin className="h-3 w-3" /> Fixos
                  </p>
                  {orderedList.fixos.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggle(p.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm hover:bg-muted bg-primary/5"
                    >
                      <Checkbox checked readOnly className="pointer-events-none" />
                      <span className="flex-1 min-w-0 truncate">{p.nome}</span>
                      {p.codigo && (
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {p.codigo}
                        </span>
                      )}
                    </button>
                  ))}
                  <div className="my-1 border-t" />
                </>
              )}

              {orderedList.restantes.length === 0 && orderedList.fixos.length === 0 && (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                  Nenhum produto encontrado
                </p>
              )}

              {orderedList.restantes.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm hover:bg-muted"
                >
                  <Checkbox checked={false} className="pointer-events-none" />
                  <span className="flex-1 min-w-0 truncate">{p.nome}</span>
                  {p.codigo && (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {p.codigo}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedItems.map(p => (
            <Badge
              key={p.id}
              variant="secondary"
              className="gap-1 pr-1 max-w-[220px]"
              title={p.nome}
            >
              <span className="truncate text-[11px]">{p.nome}</span>
              <button
                type="button"
                onClick={() => toggle(p.id)}
                className="hover:bg-muted-foreground/20 rounded p-0.5"
                aria-label={`Remover ${p.nome}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
