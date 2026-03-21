import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDashboardFilterOptions } from "@/hooks/useDashboardFilterOptions";
import type { DashboardFilters as Filters } from "@/hooks/useDashboardKPIs";
import { Filter } from "lucide-react";

interface Props {
  filters: Filters;
  onChange: (f: Partial<Filters>) => void;
}

const MESES = [
  { value: "0", label: "Todos" },
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

const currentYear = new Date().getFullYear();
const ANOS = Array.from({ length: 5 }, (_, i) => currentYear - i);

export function DashboardFiltersBar({ filters, onChange }: Props) {
  const { supervisores, vendedores, ufs, marcas } = useDashboardFilterOptions();

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Filter className="h-4 w-4" />
        Filtros
      </div>

      {/* Ano */}
      <Select value={String(filters.ano)} onValueChange={(v) => onChange({ ano: Number(v) })}>
        <SelectTrigger className="w-[100px] h-9 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ANOS.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Mês */}
      <Select value={String(filters.mes || 0)} onValueChange={(v) => onChange({ mes: Number(v) || null })}>
        <SelectTrigger className="w-[130px] h-9 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MESES.map((m) => (
            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Supervisor */}
      <Select value={filters.supervisor || "__all__"} onValueChange={(v) => onChange({ supervisor: v === "__all__" ? null : v })}>
        <SelectTrigger className="w-[160px] h-9 text-sm">
          <SelectValue placeholder="Supervisor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos Supervisores</SelectItem>
          {(supervisores.data || []).map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Vendedor */}
      <Select value={filters.codVend ? String(filters.codVend) : "__all__"} onValueChange={(v) => onChange({ codVend: v === "__all__" ? null : Number(v) })}>
        <SelectTrigger className="w-[180px] h-9 text-sm">
          <SelectValue placeholder="Vendedor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos Vendedores</SelectItem>
          {(vendedores.data || []).map((v) => (
            <SelectItem key={v.cod_vend} value={String(v.cod_vend)}>{v.nome_vendedor}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* UF */}
      <Select value={filters.uf || "__all__"} onValueChange={(v) => onChange({ uf: v === "__all__" ? null : v })}>
        <SelectTrigger className="w-[100px] h-9 text-sm">
          <SelectValue placeholder="UF" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todas UFs</SelectItem>
          {(ufs.data || []).map((u) => (
            <SelectItem key={u} value={u}>{u}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Marca */}
      <Select value={filters.marca || "__all__"} onValueChange={(v) => onChange({ marca: v === "__all__" ? null : v })}>
        <SelectTrigger className="w-[150px] h-9 text-sm">
          <SelectValue placeholder="Marca" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todas Marcas</SelectItem>
          {(marcas.data || []).map((m) => (
            <SelectItem key={m} value={m}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
