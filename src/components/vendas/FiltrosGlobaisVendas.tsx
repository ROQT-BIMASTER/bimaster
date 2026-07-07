import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { MESES_PT, type VendasGlobalFilters } from "@/hooks/vendas/vendasFilters";

const sb = supabase as any;

interface Props {
  filters: VendasGlobalFilters;
  onChange: (f: VendasGlobalFilters) => void;
  anos: number[];
}

interface Opt<T> { value: T; label: string; }

/* ---------- fontes de opções (queries leves, staleTime longo) ---------- */
function useTabelasOptions() {
  return useQuery({
    queryKey: ["opts_tabelas_preco"],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<Opt<number>[]> => {
      const { data, error } = await sb
        .from("v_vendas")
        .select("tabela_preco_id,tabela_preco_nome")
        .not("tabela_preco_id", "is", null)
        .limit(20000);
      if (error) throw error;
      const map = new Map<number, string>();
      (data || []).forEach((r: any) => {
        if (r.tabela_preco_id != null && !map.has(r.tabela_preco_id)) {
          map.set(r.tabela_preco_id, r.tabela_preco_nome ?? `Tabela ${r.tabela_preco_id}`);
        }
      });
      return [...map.entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    },
  });
}

function useUfOptions() {
  return useQuery({
    queryKey: ["opts_ufs_clientes"],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<Opt<string>[]> => {
      // v_vendas.cliente_uf ainda não é populado; a fonte de verdade da UF é a tabela clientes.
      const { data, error } = await sb
        .from("clientes")
        .select("uf")
        .not("uf", "is", null)
        .limit(50000);
      if (error) throw error;
      const set = new Set<string>();
      (data || []).forEach((r: any) => {
        const uf = (r.uf ?? "").toString().trim().toUpperCase();
        if (uf && uf !== "-" && uf.length === 2) set.add(uf);
      });
      return [...set].sort().map((uf) => ({ value: uf, label: uf }));
    },
  });
}

function useClientesOptions() {
  return useQuery({
    queryKey: ["opts_clientes_futura"],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<Opt<number>[]> => {
      const { data, error } = await sb
        .from("v_vendas")
        .select("cliente_futura_id,cliente_nome")
        .not("cliente_futura_id", "is", null)
        .limit(20000);
      if (error) throw error;
      const map = new Map<number, string>();
      (data || []).forEach((r: any) => {
        if (r.cliente_futura_id != null && !map.has(r.cliente_futura_id)) {
          map.set(r.cliente_futura_id, r.cliente_nome ?? `Cliente ${r.cliente_futura_id}`);
        }
      });
      return [...map.entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    },
  });
}

function useVendedoresOptions() {
  return useQuery({
    queryKey: ["opts_vendedores_futura"],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<Opt<number>[]> => {
      const { data, error } = await sb
        .from("vendedores")
        .select("futura_id,nome")
        .not("futura_id", "is", null)
        .order("nome");
      if (error) throw error;
      return (data || [])
        .filter((r: any) => r.futura_id != null)
        .map((r: any) => ({ value: r.futura_id as number, label: r.nome as string }));
    },
  });
}

/* ---------- Combobox editorial ---------- */
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

export function FiltrosGlobaisVendas({ filters, onChange, anos }: Props) {
  const tabelas = useTabelasOptions();
  const ufs = useUfOptions();
  const clientes = useClientesOptions();
  const vendedores = useVendedoresOptions();

  const patch = (p: Partial<VendasGlobalFilters>) => onChange({ ...filters, ...p });
  const hasAny =
    filters.tabelaPrecoId != null || filters.uf != null ||
    filters.clienteId != null || filters.vendedorId != null ||
    filters.mes != null ||
    filters.ano !== anos[0];

  const anoOpts: Opt<number>[] = anos.map((a) => ({ value: a, label: String(a) }));
  const mesOpts: Opt<number>[] = MESES_PT;

  return (
    <div className="sticky top-0 z-30 -mx-6 md:-mx-10 px-6 md:px-10 py-4 bg-rv-bg/95 backdrop-blur border-b border-rv-linha">
      <div className="flex items-end gap-3 flex-wrap">
        <EditorialCombo
          label="Período"
          placeholder="Ano"
          value={filters.ano}
          options={anoOpts}
          onChange={(v) => patch({ ano: v ?? anos[0] })}
          width="min-w-[120px]"
        />
        <EditorialCombo
          label="Mês"
          placeholder="Todos"
          value={filters.mes}
          options={mesOpts}
          onChange={(v) => patch({ mes: v })}
          width="min-w-[150px]"
        />
        <EditorialCombo
          label="Tabela de preço"
          placeholder="Todas"
          value={filters.tabelaPrecoId}
          options={tabelas.data ?? []}
          onChange={(v) => patch({ tabelaPrecoId: v })}
        />
        <EditorialCombo
          label="UF"
          placeholder="Todas"
          value={filters.uf}
          options={ufs.data ?? []}
          onChange={(v) => patch({ uf: v })}
          width="min-w-[110px]"
        />
        <EditorialCombo
          label="Cliente"
          placeholder="Todos"
          value={filters.clienteId}
          options={clientes.data ?? []}
          onChange={(v) => patch({ clienteId: v })}
          width="min-w-[240px]"
        />
        <EditorialCombo
          label="Vendedor"
          placeholder="Todos"
          value={filters.vendedorId}
          options={vendedores.data ?? []}
          onChange={(v) => patch({ vendedorId: v })}
          width="min-w-[200px]"
        />

        {hasAny && (
          <button
            type="button"
            onClick={() => onChange({
              ano: anos[0],
              mes: null,
              empresa: filters.empresa,
              tabelaPrecoId: null, uf: null, clienteId: null, vendedorId: null,
            })}
            className="h-[38px] px-4 text-[11px] uppercase tracking-wider text-rv-text-suave border border-rv-linha hover:text-rv-ink hover:border-rv-ink transition-colors self-end"
          >
            Limpar
          </button>
        )}
      </div>
    </div>
  );
}
