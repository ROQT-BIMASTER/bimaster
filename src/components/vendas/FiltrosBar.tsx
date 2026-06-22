import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import type { VendasFilters } from "@/hooks/useVendasAnalise";
import {
  useEmpresasDistintas, useVendedoresLista, useCoordenadoresLista,
} from "@/hooks/useVendasAnalise";

const SENTINEL = "__all__";

function toISO(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-1.5">
      {children}
    </div>
  );
}

interface Props {
  value: VendasFilters;
  onChange: (v: VendasFilters) => void;
}

export function FiltrosBar({ value, onChange }: Props) {
  const empresas = useEmpresasDistintas();
  const vendedores = useVendedoresLista();
  const coordenadores = useCoordenadoresLista();

  const set = (patch: Partial<VendasFilters>) => onChange({ ...value, ...patch });

  const de = value.de ? parseLocalDate(value.de) : undefined;
  const ate = value.ate ? parseLocalDate(value.ate) : undefined;
  const periodoLabel =
    de && ate
      ? `${format(de, "dd/MM/yyyy", { locale: ptBR })} – ${format(ate, "dd/MM/yyyy", { locale: ptBR })}`
      : "Selecione";

  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm px-4 md:px-5 py-4">
      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-4 items-end">
        <div>
          <FieldLabel>Período</FieldLabel>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("w-full h-10 justify-start text-left font-normal bg-background")}>
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                {periodoLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{ from: de, to: ate }}
                onSelect={(r: any) => set({ de: r?.from ? toISO(r.from) : null, ate: r?.to ? toISO(r.to) : null })}
                numberOfMonths={2}
                initialFocus
                className="pointer-events-auto p-3"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <FieldLabel>Empresa</FieldLabel>
          <Select value={value.empresa != null ? String(value.empresa) : SENTINEL} onValueChange={(v) => set({ empresa: v === SENTINEL ? null : Number(v) })}>
            <SelectTrigger className="w-full h-10 bg-background"><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={SENTINEL}>Todas</SelectItem>
              {(empresas.data || []).map((id) => <SelectItem key={id} value={String(id)}>Empresa {id}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <FieldLabel>Vendedor</FieldLabel>
          <Select value={value.vendedor ?? SENTINEL} onValueChange={(v) => set({ vendedor: v === SENTINEL ? null : v })}>
            <SelectTrigger className="w-full h-10 bg-background"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={SENTINEL}>Todos</SelectItem>
              {(vendedores.data || []).map((v) => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <FieldLabel>Coordenador</FieldLabel>
          <Select value={value.coordenador ?? SENTINEL} onValueChange={(v) => set({ coordenador: v === SENTINEL ? null : v })}>
            <SelectTrigger className="w-full h-10 bg-background"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={SENTINEL}>Todos</SelectItem>
              {(coordenadores.data || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Button
          size="sm"
          className="h-10 px-6 rounded-full font-semibold text-white shadow-sm hover:opacity-90"
          style={{ background: "hsl(var(--vendas-accent))" }}
          onClick={() => onChange({ ...value })}
        >
          Aplicar
        </Button>
      </div>
    </div>
  );
}
