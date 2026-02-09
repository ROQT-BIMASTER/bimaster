import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X, MapPin, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REGIOES, REGIOES_UFS } from "@/lib/constants/regioes";
import { MunicipiosFilters as FiltersType } from "@/hooks/useMunicipiosIntelligence";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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
  const [municipioOpen, setMunicipioOpen] = useState(false);
  const [municipioSearch, setMunicipioSearch] = useState("");

  const { data: municipios } = useQuery({
    queryKey: ['municipios-list-filter', filters.uf, filters.regiao],
    queryFn: async () => {
      let query = supabase
        .from('ibge_municipios')
        .select('id, nome, uf_sigla')
        .order('nome');

      if (filters.uf) {
        query = query.eq('uf_sigla', filters.uf);
      } else if (filters.regiao) {
        const regionUfs = REGIOES_UFS[filters.regiao] || [];
        if (regionUfs.length > 0) {
          query = query.in('uf_sigla', regionUfs);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const filteredMunicipios = useMemo(() => {
    if (!municipios) return [];
    if (!municipioSearch) return municipios.slice(0, 100);
    const term = municipioSearch.toLowerCase();
    return municipios.filter(m => m.nome.toLowerCase().includes(term)).slice(0, 100);
  }, [municipios, municipioSearch]);

  const selectedMunicipio = municipios?.find(m => m.nome === filters.search && filters.search);

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

      {/* Município Combobox */}
      <Popover open={municipioOpen} onOpenChange={setMunicipioOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={municipioOpen}
            className="w-[200px] justify-between font-normal"
          >
            <div className="flex items-center gap-2 truncate">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {selectedMunicipio
                  ? `${selectedMunicipio.nome} - ${selectedMunicipio.uf_sigla}`
                  : "Município"}
              </span>
            </div>
            <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar município..."
              value={municipioSearch}
              onValueChange={setMunicipioSearch}
            />
            <CommandList>
              <CommandEmpty>Nenhum município encontrado.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__all__"
                  onSelect={() => {
                    onFilterChange('search', '');
                    setMunicipioOpen(false);
                    setMunicipioSearch("");
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", !filters.search ? "opacity-100" : "opacity-0")} />
                  Todos os Municípios
                </CommandItem>
                {filteredMunicipios.map((m) => (
                  <CommandItem
                    key={m.id}
                    value={String(m.id)}
                    onSelect={() => {
                      onFilterChange('search', m.nome);
                      setMunicipioOpen(false);
                      setMunicipioSearch("");
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", filters.search === m.nome ? "opacity-100" : "opacity-0")} />
                    {m.nome} <span className="ml-1 text-muted-foreground text-xs">({m.uf_sigla})</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

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
