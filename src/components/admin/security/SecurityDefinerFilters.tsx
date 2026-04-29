import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

export interface SecurityDefinerFiltersValue {
  search: string;
  status: "all" | "mantida" | "ajustada" | "revogada";
  usage: "all" | "used" | "unused";
  schema: string; // "all" ou nome
  reviewed: "all" | "yes" | "no";
}

export const DEFAULT_FILTERS: SecurityDefinerFiltersValue = {
  search: "",
  status: "all",
  usage: "all",
  schema: "all",
  reviewed: "all",
};

interface Props {
  value: SecurityDefinerFiltersValue;
  onChange: (v: SecurityDefinerFiltersValue) => void;
  schemas: string[];
}

export function SecurityDefinerFilters({ value, onChange, schemas }: Props) {
  const set = <K extends keyof SecurityDefinerFiltersValue>(k: K, v: SecurityDefinerFiltersValue[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={value.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Buscar por nome da função..."
          className="pl-8 h-9"
        />
      </div>

      <Select value={value.status} onValueChange={(v) => set("status", v as SecurityDefinerFiltersValue["status"])}>
        <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos status</SelectItem>
          <SelectItem value="mantida">Mantida</SelectItem>
          <SelectItem value="ajustada">Ajustada</SelectItem>
          <SelectItem value="revogada">Revogada</SelectItem>
        </SelectContent>
      </Select>

      <Select value={value.usage} onValueChange={(v) => set("usage", v as SecurityDefinerFiltersValue["usage"])}>
        <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Uso" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Qualquer uso</SelectItem>
          <SelectItem value="used">Usadas pelo frontend</SelectItem>
          <SelectItem value="unused">Não usadas</SelectItem>
        </SelectContent>
      </Select>

      <Select value={value.schema} onValueChange={(v) => set("schema", v)}>
        <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Schema" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos schemas</SelectItem>
          {schemas.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={value.reviewed} onValueChange={(v) => set("reviewed", v as SecurityDefinerFiltersValue["reviewed"])}>
        <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Revisão" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Revisão (todas)</SelectItem>
          <SelectItem value="yes">Já revisadas</SelectItem>
          <SelectItem value="no">Pendentes</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
