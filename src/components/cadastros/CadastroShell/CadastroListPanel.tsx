import { Search, SlidersHorizontal, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BatchAction, ColumnDef, FilterDef } from "./types";

interface Props<T> {
  items: T[];
  getId: (item: T) => string;
  isLoading?: boolean;
  columns: ColumnDef<T>[];
  search: { value: string; onChange: (v: string) => void; placeholder?: string };
  filters?: FilterDef[];
  batchActions?: BatchAction[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  emptyMessage?: string;
}

export function CadastroListPanel<T>({
  items,
  getId,
  isLoading,
  columns,
  search,
  filters,
  batchActions,
  selectedId,
  onSelect,
  selectedIds,
  onToggle,
  onToggleAll,
  emptyMessage = "Nenhum registro encontrado.",
}: Props<T>) {
  const activeFiltersCount = filters?.filter(f => f.value && f.value !== "todos" && f.value !== "todas").length ?? 0;
  const allSelected = items.length > 0 && items.every(i => selectedIds.has(getId(i)));

  return (
    <div className="flex-1 min-w-0 flex flex-col border-r border-border/60">
      {/* Toolbar */}
      <div className="p-3 flex items-center gap-2 border-b border-border/60 bg-background shrink-0">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder ?? "Buscar..."}
            className="pl-9"
          />
          {search.value && (
            <button
              onClick={() => search.onChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        {filters && filters.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="h-5 min-w-5 px-1 text-[10px]">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-3">
              {filters.map((f) => (
                <div key={f.key} className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
                  <Select value={f.value} onValueChange={f.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {f.options.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Batch action bar */}
      {selectedIds.size > 0 && batchActions && batchActions.length > 0 && (
        <div className="px-4 py-2 bg-primary/5 border-b border-primary/20 flex items-center justify-between shrink-0">
          <span className="text-xs font-medium">
            {selectedIds.size} selecionado{selectedIds.size > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-1">
            {batchActions.map((a) => {
              const Icon = a.icon;
              return (
                <Button
                  key={a.key}
                  size="sm"
                  variant={a.variant ?? "outline"}
                  onClick={() => a.onClick(Array.from(selectedIds))}
                  className="h-7 gap-1.5 text-xs"
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {a.label}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Column headers */}
      <div className="px-4 py-2 bg-muted/40 border-b border-border/60 flex items-center gap-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
        {batchActions && batchActions.length > 0 && (
          <Checkbox
            checked={allSelected}
            onCheckedChange={onToggleAll}
            aria-label="Selecionar todos"
          />
        )}
        {columns.map((c) => (
          <div
            key={c.key}
            className={cn(
              "flex-1 min-w-0",
              c.align === "right" && "text-right",
              c.align === "center" && "text-center",
              c.className,
            )}
          >
            {c.header}
          </div>
        ))}
      </div>

      {/* List */}
      <div
        role="listbox"
        className="flex-1 overflow-y-auto divide-y divide-border/40"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">{emptyMessage}</div>
        ) : (
          items.map((item) => {
            const id = getId(item);
            const isActive = selectedId === id;
            const isChecked = selectedIds.has(id);
            return (
              <div
                key={id}
                role="option"
                aria-selected={isActive}
                onClick={() => onSelect(id)}
                className={cn(
                  "px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors border-l-4",
                  isActive
                    ? "bg-primary/5 border-l-primary"
                    : "border-l-transparent hover:bg-muted/50",
                )}
              >
                {batchActions && batchActions.length > 0 && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => onToggle(id)}
                      aria-label="Selecionar"
                    />
                  </div>
                )}
                {columns.map((c) => (
                  <div
                    key={c.key}
                    className={cn(
                      "flex-1 min-w-0 text-sm",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                      c.className,
                    )}
                  >
                    {c.render(item)}
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
