import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChevronDown, Filter, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FiltrosConsolidado } from "@/lib/fabrica/consolidado-utils";
import { FILTROS_DEFAULT } from "@/lib/fabrica/consolidado-utils";

interface Opt {
  value: string;
  label: string;
}

interface Props {
  filtros: FiltrosConsolidado;
  setFiltros: (f: FiltrosConsolidado) => void;
  grupos: Opt[];
  tipos: Opt[];
  marcas: Opt[];
  linhas: Opt[];
  fornecedores: Opt[];
  tiposInsumo: Opt[];
  totalGeral: number;
  totalFiltrado: number;
}

function MultiPicker({
  label,
  opts,
  value,
  onChange,
}: {
  label: string;
  opts: Opt[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const filtered = useMemo(
    () => opts.filter((o) => o.label.toLowerCase().includes(busca.toLowerCase())),
    [opts, busca],
  );
  function toggle(v: string) {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5">
          <span>{label}</span>
          {value.length > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{value.length}</Badge>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <Input
          autoFocus
          placeholder={`Buscar ${label.toLowerCase()}...`}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="h-8 mb-2"
        />
        <div className="max-h-64 overflow-auto space-y-1">
          {filtered.length === 0 && (
            <div className="text-xs text-muted-foreground py-2 text-center">Nenhum item</div>
          )}
          {filtered.map((o) => (
            <label
              key={o.value}
              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-sm"
            >
              <Checkbox checked={value.includes(o.value)} onCheckedChange={() => toggle(o.value)} />
              <span className="truncate" title={o.label}>{o.label}</span>
            </label>
          ))}
        </div>
        {value.length > 0 && (
          <Button variant="ghost" size="sm" className="w-full mt-2 h-7 text-xs" onClick={() => onChange([])}>
            Limpar seleção
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function FiltrosConsolidadoBar({
  filtros,
  setFiltros,
  grupos,
  tipos,
  marcas,
  linhas,
  fornecedores,
  tiposInsumo,
  totalGeral,
  totalFiltrado,
}: Props) {
  const update = (patch: Partial<FiltrosConsolidado>) => setFiltros({ ...filtros, ...patch });
  const hasFilters =
    filtros.busca ||
    filtros.grupos.length ||
    filtros.tipos.length ||
    filtros.marcas.length ||
    filtros.linhas.length ||
    filtros.fornecedores.length ||
    filtros.tiposInsumo.length ||
    filtros.status.length ||
    filtros.custoMin != null ||
    filtros.custoMax != null ||
    filtros.deltaMinPct != null ||
    filtros.deltaMaxPct != null ||
    filtros.somenteComMadeIn ||
    filtros.somenteComIpi ||
    filtros.periodoDias;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          Filtros
        </div>
        <Input
          placeholder="Buscar produto, insumo, fornecedor, NF..."
          value={filtros.busca}
          onChange={(e) => update({ busca: e.target.value })}
          className="h-9 max-w-xs"
        />
        <MultiPicker label="Grupo" opts={grupos} value={filtros.grupos} onChange={(v) => update({ grupos: v })} />
        <MultiPicker label="Tipo SKU" opts={tipos} value={filtros.tipos} onChange={(v) => update({ tipos: v })} />
        <MultiPicker label="Marca" opts={marcas} value={filtros.marcas} onChange={(v) => update({ marcas: v })} />
        <MultiPicker label="Linha" opts={linhas} value={filtros.linhas} onChange={(v) => update({ linhas: v })} />
        <MultiPicker
          label="Fornecedor"
          opts={fornecedores}
          value={filtros.fornecedores}
          onChange={(v) => update({ fornecedores: v })}
        />
        <MultiPicker
          label="Tipo de insumo"
          opts={tiposInsumo}
          value={filtros.tiposInsumo}
          onChange={(v) => update({ tiposInsumo: v })}
        />
        <MultiPicker
          label="Status"
          opts={[
            { value: "Aumentou", label: "Aumentou" },
            { value: "Reduziu", label: "Reduziu" },
            { value: "Igual", label: "Igual" },
            { value: "Novo", label: "Novo" },
            { value: "Só Oficial", label: "Só Oficial" },
          ]}
          value={filtros.status}
          onChange={(v) => update({ status: v })}
        />
        <Select
          value={filtros.periodoDias ? String(filtros.periodoDias) : "all"}
          onValueChange={(v) => update({ periodoDias: v === "all" ? null : Number(v) })}
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Qualquer período</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="365">Últimos 12 meses</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {totalFiltrado} de {totalGeral} produtos
        </span>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9 gap-1" onClick={() => setFiltros(FILTROS_DEFAULT)}>
            <X className="h-3.5 w-3.5" /> Limpar
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Custo R$</Label>
          <Input
            type="number"
            placeholder="min"
            value={filtros.custoMin ?? ""}
            onChange={(e) => update({ custoMin: e.target.value === "" ? null : Number(e.target.value) })}
            className="h-8 w-24 text-xs"
          />
          <Input
            type="number"
            placeholder="max"
            value={filtros.custoMax ?? ""}
            onChange={(e) => update({ custoMax: e.target.value === "" ? null : Number(e.target.value) })}
            className="h-8 w-24 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Δ % vs Sim01</Label>
          <Input
            type="number"
            placeholder="min %"
            value={filtros.deltaMinPct ?? ""}
            onChange={(e) => update({ deltaMinPct: e.target.value === "" ? null : Number(e.target.value) })}
            className="h-8 w-24 text-xs"
          />
          <Input
            type="number"
            placeholder="max %"
            value={filtros.deltaMaxPct ?? ""}
            onChange={(e) => update({ deltaMaxPct: e.target.value === "" ? null : Number(e.target.value) })}
            className="h-8 w-24 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="made-in"
            checked={filtros.somenteComMadeIn}
            onCheckedChange={(c) => update({ somenteComMadeIn: c })}
          />
          <Label htmlFor="made-in" className="text-xs cursor-pointer">Com Made In</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="ipi" checked={filtros.somenteComIpi} onCheckedChange={(c) => update({ somenteComIpi: c })} />
          <Label htmlFor="ipi" className="text-xs cursor-pointer">Com IPI</Label>
        </div>
      </div>
    </div>
  );
}
