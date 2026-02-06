import { Building2, MapPin } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REGIOES } from "@/lib/constants/regioes";

export interface Empresa {
  id: number;
  nome: string;
}

interface ComercialFiltersProps {
  empresas: Empresa[];
  empresaFilter: number | null;
  onEmpresaChange: (id: number | null) => void;
  regiaoFilter: string | null;
  onRegiaoChange: (regiao: string | null) => void;
}

export function ComercialFilters({
  empresas,
  empresaFilter,
  onEmpresaChange,
  regiaoFilter,
  onRegiaoChange,
}: ComercialFiltersProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Filial */}
      <div className="flex items-center gap-1.5">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <Select
          value={empresaFilter?.toString() ?? "todas"}
          onValueChange={(v) => onEmpresaChange(v === "todas" ? null : Number(v))}
        >
          <SelectTrigger className="h-9 w-[200px]">
            <SelectValue placeholder="Todas as filiais" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as filiais</SelectItem>
            {empresas.map((e) => (
              <SelectItem key={e.id} value={e.id.toString()}>
                {e.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Região */}
      <div className="flex items-center gap-1.5">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <Select
          value={regiaoFilter ?? "todas"}
          onValueChange={(v) => onRegiaoChange(v === "todas" ? null : v)}
        >
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Todas as regiões" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as regiões</SelectItem>
            {REGIOES.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
