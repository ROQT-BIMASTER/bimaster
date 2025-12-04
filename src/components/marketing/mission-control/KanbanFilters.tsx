import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Filter, X, User, Tag, Rocket, Clock } from "lucide-react";

export interface KanbanFiltersState {
  search: string;
  tipo: string;
  responsavel: string;
  lancamento: string;
  prioridade: string;
}

interface KanbanFiltersProps {
  filters: KanbanFiltersState;
  onFiltersChange: (filters: KanbanFiltersState) => void;
  responsaveis: { id: string; nome: string }[];
  lancamentos: { id: string; nome: string }[];
}

const tipoOptions = [
  { value: 'all', label: 'Todos os tipos' },
  { value: 'post_instagram', label: 'Post Instagram' },
  { value: 'post_tiktok', label: 'Post TikTok' },
  { value: 'catalogo', label: 'Catálogo' },
  { value: 'video', label: 'Vídeo' },
  { value: 'email', label: 'Email Marketing' },
  { value: 'banner', label: 'Banner' },
  { value: 'arte', label: 'Arte Gráfica' }
];

const prioridadeOptions = [
  { value: 'all', label: 'Todas' },
  { value: 'gargalo', label: 'Com Gargalo' },
  { value: 'atrasadas', label: 'Atrasadas' },
  { value: 'urgentes', label: 'Urgentes (≤2 dias)' },
  { value: 'no_prazo', label: 'No Prazo' }
];

export function KanbanFilters({ 
  filters, 
  onFiltersChange, 
  responsaveis, 
  lancamentos 
}: KanbanFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const activeFiltersCount = [
    filters.tipo !== 'all' && filters.tipo,
    filters.responsavel !== 'all' && filters.responsavel,
    filters.lancamento !== 'all' && filters.lancamento,
    filters.prioridade !== 'all' && filters.prioridade,
    filters.search
  ].filter(Boolean).length;

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      tipo: 'all',
      responsavel: 'all',
      lancamento: 'all',
      prioridade: 'all'
    });
  };

  return (
    <div className="space-y-3">
      {/* Search bar and toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tarefas..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-8 h-9"
          />
        </div>
        
        <Button
          variant={isExpanded ? "secondary" : "outline"}
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="gap-1"
        >
          <Filter className="h-4 w-4" />
          Filtros
          {activeFiltersCount > 0 && (
            <Badge variant="default" className="h-5 w-5 p-0 justify-center text-[10px]">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>

        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-xs text-muted-foreground"
          >
            <X className="h-3 w-3 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* Expanded filters */}
      {isExpanded && (
        <div className="flex flex-wrap gap-3 p-3 rounded-lg bg-muted/30 border">
          {/* Tipo */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Tag className="h-3 w-3" />
              Tipo
            </label>
            <Select
              value={filters.tipo}
              onValueChange={(value) => onFiltersChange({ ...filters, tipo: value })}
            >
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tipoOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Responsável */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" />
              Responsável
            </label>
            <Select
              value={filters.responsavel}
              onValueChange={(value) => onFiltersChange({ ...filters, responsavel: value })}
            >
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos</SelectItem>
                {responsaveis.map(r => (
                  <SelectItem key={r.id} value={r.id} className="text-xs">
                    {r.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lançamento */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Rocket className="h-3 w-3" />
              Lançamento
            </label>
            <Select
              value={filters.lancamento}
              onValueChange={(value) => onFiltersChange({ ...filters, lancamento: value })}
            >
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos</SelectItem>
                {lancamentos.map(l => (
                  <SelectItem key={l.id} value={l.id} className="text-xs">
                    {l.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Prioridade */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Prioridade
            </label>
            <Select
              value={filters.prioridade}
              onValueChange={(value) => onFiltersChange({ ...filters, prioridade: value })}
            >
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {prioridadeOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}