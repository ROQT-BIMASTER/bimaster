import { useMemo, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useEmpresasResult, useVendedoresResult } from "@/hooks/vendas/useVendasResult";

export interface ResultFilters {
  ano: number;
  empresa: number | null;
  vendedorId: number | null;
}

interface Props {
  filters: ResultFilters;
  onChange: (f: ResultFilters) => void;
  anos: number[];
}

interface Opt<T> { value: T; label: string }

function EditorialCombo<T extends string | number>({
  label, placeholder, value, options, onChange, width = "min-w-[180px]",
}: {
  label: string;
  placeholder: string;
  value: T | null;
  options: Opt<T>[];
  onChange: (v: T | null) => void;
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-[0.18em] text-rv-text-suave">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`flex items-center justify-between gap-2 border border-rv-linha px-3 py-2 text-sm text-rv-ink hover:border-rv-ink transition-colors ${width}`}
          >
            <span className={selected ? "truncate" : "text-rv-muted"}>
              {selected ? selected.label : placeholder}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              {selected && (
                <X
                  className="w-3.5 h-3.5 text-rv-muted hover:text-rv-ink"
                  onClick={(e) => { e.stopPropagation(); onChange(null); }}
                />
              )}
              <ChevronDown className="w-3.5 h-3.5 text-rv-muted" />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="p-0 w-[260px] bg-rv-bg border border-rv-linha">
          <Command>
            <CommandInput placeholder="Buscar…" className="text-sm" />
            <CommandList className="max-h-[260px]">
              <CommandEmpty>Nada encontrado.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  onSelect={() => { onChange(null); setOpen(false); }}
                  className="text-sm text-rv-text-suave"
                >
                  <Check className={`w-3.5 h-3.5 mr-2 ${value == null ? "opacity-100" : "opacity-0"}`} />
                  Todos
                </CommandItem>
                {options.map((o) => (
                  <CommandItem
                    key={String(o.value)}
                    value={o.label}
                    onSelect={() => { onChange(o.value); setOpen(false); }}
                    className="text-sm text-rv-ink"
                  >
                    <Check className={`w-3.5 h-3.5 mr-2 ${value === o.value ? "opacity-100" : "opacity-0"}`} />
                    <span className="truncate">{o.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function FiltrosGlobaisResult({ filters, onChange, anos }: Props) {
  const empresas = useEmpresasResult();
  const vendedores = useVendedoresResult();
  const patch = (p: Partial<ResultFilters>) => onChange({ ...filters, ...p });

  const anoOpts: Opt<number>[] = anos.map((a) => ({ value: a, label: String(a) }));
  const hasAny = filters.empresa != null || filters.vendedorId != null || filters.ano !== anos[0];

  return (
    <div className="sticky top-0 z-30 -mx-6 md:-mx-10 px-6 md:px-10 py-4 bg-rv-bg/95 backdrop-blur border-b border-rv-linha">
      <div className="flex items-end gap-3 flex-wrap">
        <EditorialCombo
          label="Ano"
          placeholder="Ano"
          value={filters.ano}
          options={anoOpts}
          onChange={(v) => patch({ ano: v ?? anos[0] })}
          width="min-w-[120px]"
        />
        <EditorialCombo
          label="Empresa"
          placeholder="Todas"
          value={filters.empresa}
          options={empresas.data ?? []}
          onChange={(v) => patch({ empresa: v })}
          width="min-w-[220px]"
        />
        <EditorialCombo
          label="Vendedor"
          placeholder="Todos"
          value={filters.vendedorId}
          options={vendedores.data ?? []}
          onChange={(v) => patch({ vendedorId: v })}
          width="min-w-[220px]"
        />

        {hasAny && (
          <button
            type="button"
            onClick={() => onChange({ ano: anos[0], empresa: null, vendedorId: null })}
            className="h-[38px] px-4 text-[11px] uppercase tracking-wider text-rv-text-suave border border-rv-linha hover:text-rv-ink hover:border-rv-ink transition-colors self-end"
          >
            Limpar
          </button>
        )}
      </div>
    </div>
  );
}
