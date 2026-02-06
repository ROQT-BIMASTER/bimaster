import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Filter, Layers, X } from "lucide-react";
import { REGIOES_UFS, REGIOES } from "@/lib/constants/regioes";
import type { MapFilters as MapFiltersType } from "@/hooks/useCommercialMapData";

interface MapFiltersProps {
  filters: MapFiltersType;
  onFiltersChange: (filters: MapFiltersType) => void;
  empresas: { id: number; nome: string }[];
}

const RISCO_OPTIONS = [
  { value: "ativo", label: "Ativo", color: "bg-green-500" },
  { value: "atencao", label: "Atenção", color: "bg-yellow-500" },
  { value: "alerta", label: "Alerta", color: "bg-orange-500" },
  { value: "critico", label: "Crítico", color: "bg-red-500" },
  { value: "inativo", label: "Inativo", color: "bg-gray-500" },
];

const TICKET_OPTIONS = [
  { value: "ate_1k", label: "Até R$1k" },
  { value: "1k_5k", label: "R$1k - 5k" },
  { value: "5k_20k", label: "R$5k - 20k" },
  { value: "acima_20k", label: "> R$20k" },
];

export const MapFilters = ({ filters, onFiltersChange, empresas }: MapFiltersProps) => {
  const updateFilters = (partial: Partial<MapFiltersType>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  const updateLayers = (partial: Partial<MapFiltersType["layers"]>) => {
    onFiltersChange({ ...filters, layers: { ...filters.layers, ...partial } });
  };

  const toggleRisco = (risco: string) => {
    const current = filters.risco;
    const updated = current.includes(risco)
      ? current.filter(r => r !== risco)
      : [...current, risco];
    updateFilters({ risco: updated });
  };

  const handleRegiao = (regiao: string) => {
    if (regiao === "todas") {
      updateFilters({ ufs: [] });
    } else {
      const ufs = REGIOES_UFS[regiao] || [];
      updateFilters({ ufs });
    }
  };

  const clearFilters = () => {
    onFiltersChange({
      empresaId: null,
      ufs: [],
      risco: [],
      faixaTicket: null,
      layers: { clientesAtivos: true, clientesRisco: true, clientesInativos: false, prospects: true, heatmap: false },
    });
  };

  const hasActiveFilters = filters.empresaId || filters.ufs.length > 0 || filters.risco.length > 0 || filters.faixaTicket;

  return (
    <div className="space-y-4 p-4 bg-card rounded-lg border">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Filtros</h3>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
            <X className="h-3 w-3 mr-1" /> Limpar
          </Button>
        )}
      </div>

      {/* Filial */}
      <div>
        <Label className="text-xs text-muted-foreground">Filial</Label>
        <Select
          value={filters.empresaId?.toString() || "todas"}
          onValueChange={(v) => updateFilters({ empresaId: v === "todas" ? null : Number(v) })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as Filiais</SelectItem>
            {empresas.map(e => (
              <SelectItem key={e.id} value={e.id.toString()}>{e.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Região */}
      <div>
        <Label className="text-xs text-muted-foreground">Região</Label>
        <Select
          value={filters.ufs.length === 0 ? "todas" : "custom"}
          onValueChange={handleRegiao}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todo o Brasil</SelectItem>
            {REGIOES.map(r => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Faixa de Ticket */}
      <div>
        <Label className="text-xs text-muted-foreground">Ticket</Label>
        <Select
          value={filters.faixaTicket || "todos"}
          onValueChange={(v) => updateFilters({ faixaTicket: v === "todos" ? null : v })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {TICKET_OPTIONS.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Risco */}
      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">Nível de Risco</Label>
        <div className="flex flex-wrap gap-1.5">
          {RISCO_OPTIONS.map(r => (
            <Badge
              key={r.value}
              variant={filters.risco.includes(r.value) ? "default" : "outline"}
              className="cursor-pointer text-xs py-0.5"
              onClick={() => toggleRisco(r.value)}
            >
              <div className={`w-2 h-2 rounded-full mr-1 ${r.color}`} />
              {r.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Camadas */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <Label className="text-xs text-muted-foreground">Camadas</Label>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-xs">Ativos</span>
            </div>
            <Switch
              checked={filters.layers.clientesAtivos}
              onCheckedChange={(v) => updateLayers({ clientesAtivos: v })}
              className="scale-75"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span className="text-xs">Em Risco</span>
            </div>
            <Switch
              checked={filters.layers.clientesRisco}
              onCheckedChange={(v) => updateLayers({ clientesRisco: v })}
              className="scale-75"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-xs">Inativos</span>
            </div>
            <Switch
              checked={filters.layers.clientesInativos}
              onCheckedChange={(v) => updateLayers({ clientesInativos: v })}
              className="scale-75"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-xs">Prospects</span>
            </div>
            <Switch
              checked={filters.layers.prospects}
              onCheckedChange={(v) => updateLayers({ prospects: v })}
              className="scale-75"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span className="text-xs">Heatmap</span>
            </div>
            <Switch
              checked={filters.layers.heatmap}
              onCheckedChange={(v) => updateLayers({ heatmap: v })}
              className="scale-75"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
