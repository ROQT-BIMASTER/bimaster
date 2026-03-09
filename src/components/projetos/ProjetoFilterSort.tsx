import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, ArrowUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProjetoFilters {
  status: string[];
  prioridade: string[];
  estagio: string[];
  tipo: string[]; // 'padrao' | 'retrabalho'
  responsavelId: string | null;
  atrasadas: boolean;
}

export type SortField = "titulo" | "data_prazo" | "prioridade" | "created_at" | "status";
export type SortDirection = "asc" | "desc";

export interface ProjetoSort {
  field: SortField;
  direction: SortDirection;
}

export const EMPTY_FILTERS: ProjetoFilters = {
  status: [],
  prioridade: [],
  estagio: [],
  tipo: [],
  responsavelId: null,
  atrasadas: false,
};

export const DEFAULT_SORT: ProjetoSort = { field: "created_at", direction: "asc" };

const STATUS_OPTIONS = [
  { value: "pendente", label: "Não iniciado" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluida", label: "Concluído" },
  { value: "bloqueada", label: "Bloqueada" },
];

const PRIORIDADE_OPTIONS = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
];

const ESTAGIO_OPTIONS = [
  { value: "briefing", label: "Briefing" },
  { value: "em_criacao", label: "Em Criação" },
  { value: "revisao", label: "Revisão" },
  { value: "aprovado", label: "Aprovado" },
  { value: "producao", label: "Produção" },
  { value: "lancamento", label: "Lançamento" },
];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "created_at", label: "Data de criação" },
  { value: "data_prazo", label: "Data de prazo" },
  { value: "prioridade", label: "Prioridade" },
  { value: "titulo", label: "Nome" },
  { value: "status", label: "Status" },
];

interface FilterButtonProps {
  filters: ProjetoFilters;
  onFiltersChange: (filters: ProjetoFilters) => void;
  teamMembers?: { id: string; nome: string }[];
  btnClassName?: string;
}

export function FilterButton({ filters, onFiltersChange, teamMembers = [], btnClassName }: FilterButtonProps) {
  const [open, setOpen] = useState(false);
  const activeCount = filters.status.length + filters.prioridade.length + filters.estagio.length + filters.tipo.length + (filters.responsavelId ? 1 : 0) + (filters.atrasadas ? 1 : 0);

  const toggleArray = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("h-8 text-xs gap-1.5", btnClassName)}>
          <Filter className="h-3.5 w-3.5" />
          Filtrar
          {activeCount > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-0.5">{activeCount}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 space-y-3" align="end">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">Filtros</span>
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-muted-foreground" onClick={() => onFiltersChange(EMPTY_FILTERS)}>
              <X className="h-3 w-3" /> Limpar
            </Button>
          )}
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">Status</span>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map(s => (
              <label key={s.value} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <Checkbox
                  checked={filters.status.includes(s.value)}
                  onCheckedChange={() => onFiltersChange({ ...filters, status: toggleArray(filters.status, s.value) })}
                  className="h-3.5 w-3.5"
                />
                {s.label}
              </label>
            ))}
          </div>
        </div>

        {/* Prioridade */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">Prioridade</span>
          <div className="flex flex-wrap gap-1.5">
            {PRIORIDADE_OPTIONS.map(p => (
              <label key={p.value} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <Checkbox
                  checked={filters.prioridade.includes(p.value)}
                  onCheckedChange={() => onFiltersChange({ ...filters, prioridade: toggleArray(filters.prioridade, p.value) })}
                  className="h-3.5 w-3.5"
                />
                {p.label}
              </label>
            ))}
          </div>
        </div>

        {/* Estágio */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">Estágio</span>
          <div className="flex flex-wrap gap-1.5">
            {ESTAGIO_OPTIONS.map(e => (
              <label key={e.value} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <Checkbox
                  checked={filters.estagio.includes(e.value)}
                  onCheckedChange={() => onFiltersChange({ ...filters, estagio: toggleArray(filters.estagio, e.value) })}
                  className="h-3.5 w-3.5"
                />
                {e.label}
              </label>
            ))}
          </div>
        </div>

        {/* Tipo */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">Tipo</span>
          <div className="flex gap-3">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <Checkbox
                checked={filters.tipo.includes("retrabalho")}
                onCheckedChange={() => onFiltersChange({ ...filters, tipo: toggleArray(filters.tipo, "retrabalho") })}
                className="h-3.5 w-3.5"
              />
              Retrabalho
            </label>
          </div>
        </div>

        {/* Atrasadas */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <Checkbox
              checked={filters.atrasadas}
              onCheckedChange={(checked) => onFiltersChange({ ...filters, atrasadas: !!checked })}
              className="h-3.5 w-3.5"
            />
            Apenas atrasadas
          </label>
        </div>

        {/* Responsável */}
        {teamMembers.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">Responsável</span>
            <Select
              value={filters.responsavelId || "all"}
              onValueChange={v => onFiltersChange({ ...filters, responsavelId: v === "all" ? null : v })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sem_responsavel">Sem responsável</SelectItem>
                {teamMembers.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface SortButtonProps {
  sort: ProjetoSort;
  onSortChange: (sort: ProjetoSort) => void;
  btnClassName?: string;
}

export function SortButton({ sort, onSortChange, btnClassName }: SortButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("h-8 text-xs gap-1.5", btnClassName)}>
          <ArrowUpDown className="h-3.5 w-3.5" />
          Ordenar
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3 space-y-3" align="end">
        <span className="text-xs font-semibold">Ordenar por</span>
        <div className="space-y-1">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => {
                if (sort.field === opt.value) {
                  onSortChange({ ...sort, direction: sort.direction === "asc" ? "desc" : "asc" });
                } else {
                  onSortChange({ field: opt.value, direction: "asc" });
                }
              }}
              className={cn(
                "flex items-center justify-between w-full px-2 py-1.5 text-xs rounded hover:bg-muted/50 transition-colors",
                sort.field === opt.value && "bg-muted/30 font-medium"
              )}
            >
              {opt.label}
              {sort.field === opt.value && (
                <span className="text-[10px] text-muted-foreground">{sort.direction === "asc" ? "↑" : "↓"}</span>
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Utility: apply filters + sort to tarefa arrays
import { ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { isPast } from "date-fns";

export function applyFilters(tarefas: ProjetoTarefa[], filters: ProjetoFilters): ProjetoTarefa[] {
  return tarefas.filter(t => {
    if (filters.status.length > 0 && !filters.status.includes(t.status)) return false;
    if (filters.prioridade.length > 0 && !filters.prioridade.includes(t.prioridade)) return false;
    if (filters.estagio.length > 0 && !filters.estagio.includes(t.estagio || "")) return false;
    if (filters.tipo.length > 0 && !filters.tipo.includes((t as any).tipo_tarefa || "padrao")) return false;
    if (filters.responsavelId === "sem_responsavel" && t.responsavel_id) return false;
    if (filters.responsavelId && filters.responsavelId !== "sem_responsavel" && t.responsavel_id !== filters.responsavelId) return false;
    if (filters.atrasadas) {
      if (!t.data_prazo || !isPast(new Date(t.data_prazo)) || t.status === "concluida") return false;
    }
    return true;
  });
}

const PRIORIDADE_ORDER: Record<string, number> = { alta: 0, media: 1, baixa: 2 };

export function applySort(tarefas: ProjetoTarefa[], sort: ProjetoSort): ProjetoTarefa[] {
  const sorted = [...tarefas];
  const dir = sort.direction === "asc" ? 1 : -1;
  sorted.sort((a, b) => {
    switch (sort.field) {
      case "titulo": return dir * a.titulo.localeCompare(b.titulo);
      case "data_prazo": {
        if (!a.data_prazo && !b.data_prazo) return 0;
        if (!a.data_prazo) return 1;
        if (!b.data_prazo) return -1;
        return dir * a.data_prazo.localeCompare(b.data_prazo);
      }
      case "prioridade": return dir * ((PRIORIDADE_ORDER[a.prioridade] ?? 1) - (PRIORIDADE_ORDER[b.prioridade] ?? 1));
      case "status": return dir * a.status.localeCompare(b.status);
      case "created_at": return dir * a.created_at.localeCompare(b.created_at);
      default: return 0;
    }
  });
  return sorted;
}

export function hasActiveFilters(filters: ProjetoFilters): boolean {
  return filters.status.length > 0 || filters.prioridade.length > 0 || filters.estagio.length > 0 || filters.tipo.length > 0 || !!filters.responsavelId || filters.atrasadas;
}
