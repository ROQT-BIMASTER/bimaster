import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Search, Filter, X, Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";

export interface LaunchFiltersState {
  search: string;
  status: string[];
  prioridade: string[];
  tipo: string[];
  responsavelId: string | null;
  dateRange: DateRange | undefined;
}

interface LaunchFiltersProps {
  filters: LaunchFiltersState;
  onFiltersChange: (filters: LaunchFiltersState) => void;
  responsaveis: { id: string; nome: string }[];
  totalCount: number;
  filteredCount: number;
}

const statusOptions = [
  { value: "planejado", label: "Planejado", color: "bg-blue-500" },
  { value: "em_preparacao", label: "Em Preparação", color: "bg-amber-500" },
  { value: "aprovado", label: "Aprovado", color: "bg-green-500" },
  { value: "lancado", label: "Lançado", color: "bg-purple-500" },
  { value: "cancelado", label: "Cancelado", color: "bg-red-500" },
];

const prioridadeOptions = [
  { value: "alta", label: "Alta", color: "bg-red-500" },
  { value: "media", label: "Média", color: "bg-amber-500" },
  { value: "baixa", label: "Baixa", color: "bg-green-500" },
];

const tipoOptions = [
  { value: "novo_produto", label: "Novo Produto", emoji: "✨" },
  { value: "reformulacao", label: "Reformulação", emoji: "🔄" },
  { value: "nova_versao", label: "Nova Versão", emoji: "📦" },
  { value: "promocional", label: "Promocional", emoji: "🎁" },
];

export default function LaunchFilters({
  filters,
  onFiltersChange,
  responsaveis,
  totalCount,
  filteredCount,
}: LaunchFiltersProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const toggleArrayFilter = (key: keyof Pick<LaunchFiltersState, 'status' | 'prioridade' | 'tipo'>, value: string) => {
    const current = filters[key];
    const newValue = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [key]: newValue });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: "",
      status: [],
      prioridade: [],
      tipo: [],
      responsavelId: null,
      dateRange: undefined,
    });
  };

  const hasActiveFilters = 
    filters.search ||
    filters.status.length > 0 ||
    filters.prioridade.length > 0 ||
    filters.tipo.length > 0 ||
    filters.responsavelId ||
    filters.dateRange;

  const activeFiltersCount = 
    (filters.status.length > 0 ? 1 : 0) +
    (filters.prioridade.length > 0 ? 1 : 0) +
    (filters.tipo.length > 0 ? 1 : 0) +
    (filters.responsavelId ? 1 : 0) +
    (filters.dateRange ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* Search and filter toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar lançamento ou produto..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-9 bg-background"
          />
          {filters.search && (
            <button
              onClick={() => onFiltersChange({ ...filters, search: "" })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 relative">
              <Filter className="h-4 w-4" />
              Filtros
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px]">
                  {activeFiltersCount}
                </Badge>
              )}
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4" align="end">
            <div className="space-y-4">
              {/* Status */}
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <div className="flex flex-wrap gap-1.5">
                  {statusOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => toggleArrayFilter('status', opt.value)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all",
                        filters.status.includes(opt.value)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80"
                      )}
                    >
                      <div className={cn("h-2 w-2 rounded-full", opt.color)} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prioridade */}
              <div>
                <label className="text-sm font-medium mb-2 block">Prioridade</label>
                <div className="flex flex-wrap gap-1.5">
                  {prioridadeOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => toggleArrayFilter('prioridade', opt.value)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all",
                        filters.prioridade.includes(opt.value)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80"
                      )}
                    >
                      <div className={cn("h-2 w-2 rounded-full", opt.color)} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tipo */}
              <div>
                <label className="text-sm font-medium mb-2 block">Tipo</label>
                <div className="flex flex-wrap gap-1.5">
                  {tipoOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => toggleArrayFilter('tipo', opt.value)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all",
                        filters.tipo.includes(opt.value)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80"
                      )}
                    >
                      <span>{opt.emoji}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Responsável */}
              <div>
                <label className="text-sm font-medium mb-2 block">Responsável</label>
                <Select
                  value={filters.responsavelId || "all"}
                  onValueChange={(v) => onFiltersChange({ ...filters, responsavelId: v === "all" ? null : v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {responsaveis.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div>
                <label className="text-sm font-medium mb-2 block">Período</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.dateRange?.from ? (
                        filters.dateRange.to ? (
                          <>
                            {format(filters.dateRange.from, "dd/MM/yy", { locale: ptBR })} -{" "}
                            {format(filters.dateRange.to, "dd/MM/yy", { locale: ptBR })}
                          </>
                        ) : (
                          format(filters.dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                        )
                      ) : (
                        <span className="text-muted-foreground">Selecionar período</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={filters.dateRange}
                      onSelect={(range) => onFiltersChange({ ...filters, dateRange: range })}
                      locale={ptBR}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Clear */}
              {hasActiveFilters && (
                <Button variant="ghost" className="w-full" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Limpar filtros
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* Active filters display + count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {filters.status.map(s => {
            const opt = statusOptions.find(o => o.value === s);
            return (
              <Badge key={s} variant="secondary" className="gap-1 pr-1">
                <div className={cn("h-2 w-2 rounded-full", opt?.color)} />
                {opt?.label}
                <button onClick={() => toggleArrayFilter('status', s)} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          {filters.prioridade.map(p => {
            const opt = prioridadeOptions.find(o => o.value === p);
            return (
              <Badge key={p} variant="secondary" className="gap-1 pr-1">
                {opt?.label}
                <button onClick={() => toggleArrayFilter('prioridade', p)} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          {filters.tipo.map(t => {
            const opt = tipoOptions.find(o => o.value === t);
            return (
              <Badge key={t} variant="secondary" className="gap-1 pr-1">
                {opt?.emoji} {opt?.label}
                <button onClick={() => toggleArrayFilter('tipo', t)} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          {filters.dateRange && (
            <Badge variant="secondary" className="gap-1 pr-1">
              <CalendarIcon className="h-3 w-3" />
              {format(filters.dateRange.from!, "dd/MM")} - {filters.dateRange.to ? format(filters.dateRange.to, "dd/MM") : "..."}
              <button onClick={() => onFiltersChange({ ...filters, dateRange: undefined })} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>

        {hasActiveFilters && (
          <span className="text-sm text-muted-foreground">
            {filteredCount} de {totalCount} lançamentos
          </span>
        )}
      </div>
    </div>
  );
}
