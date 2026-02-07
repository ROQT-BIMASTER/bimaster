import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REGIOES, REGIOES_UFS } from "@/lib/constants/regioes";
import { MunicipiosFilters as FiltersType } from "@/hooks/useMunicipiosIntelligence";

interface MunicipiosFiltersProps {
  filters: FiltersType;
  onFilterChange: (key: keyof FiltersType, value: any) => void;
}

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "com_clientes", label: "Com Clientes" },
  { value: "sem_clientes", label: "Sem Clientes" },
  { value: "com_prospects", label: "Com Prospects" },
  { value: "virgem", label: "Virgem (Inexplorado)" },
];

export function MunicipiosFiltersBar({ filters, onFilterChange }: MunicipiosFiltersProps) {
  const ufs = filters.regiao ? REGIOES_UFS[filters.regiao] || [] : Object.values(REGIOES_UFS).flat().sort();

  const hasActiveFilters = filters.uf || filters.regiao || filters.status || filters.search;

  const clearAll = () => {
    onFilterChange('uf', null);
    onFilterChange('regiao', null);
    onFilterChange('microrregiao_id', null);
    onFilterChange('status', null);
    onFilterChange('search', '');
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Busca */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar município..."
          value={filters.search}
          onChange={(e) => onFilterChange('search', e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Região */}
      <Select
        value={filters.regiao || "all"}
        onValueChange={(v) => {
          onFilterChange('regiao', v === "all" ? null : v);
          onFilterChange('uf', null);
        }}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Região" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas Regiões</SelectItem>
          {REGIOES.map(r => (
            <SelectItem key={r} value={r}>{r}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* UF */}
      <Select
        value={filters.uf || "all"}
        onValueChange={(v) => onFilterChange('uf', v === "all" ? null : v)}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="UF" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas UFs</SelectItem>
          {ufs.map(uf => (
            <SelectItem key={uf} value={uf}>{uf}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status */}
      <Select
        value={filters.status || "todos"}
        onValueChange={(v) => onFilterChange('status', v === "todos" ? null : v)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map(s => (
            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="h-9 gap-1">
          <X className="h-3.5 w-3.5" />
          Limpar
        </Button>
      )}
    </div>
  );
}
