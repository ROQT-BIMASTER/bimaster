import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
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

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfYear() {
  return new Date(new Date().getFullYear(), 0, 1);
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function DateBtn({ value, onChange, placeholder }: { value: string | null; onChange: (v: string | null) => void; placeholder: string }) {
  const date = value ? parseLocalDate(value) : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("w-[140px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
          {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={(d) => onChange(d ? toISO(d) : null)} initialFocus className="pointer-events-auto p-3" />
      </PopoverContent>
    </Popover>
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

  const setRange = (de: Date, ate: Date) => set({ de: toISO(de), ate: toISO(ate) });

  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border py-3 -mx-4 px-4 md:-mx-6 md:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <DateBtn value={value.de} onChange={(v) => set({ de: v })} placeholder="Data inicial" />
          <span className="text-muted-foreground text-xs">até</span>
          <DateBtn value={value.ate} onChange={(v) => set({ ate: v })} placeholder="Data final" />
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setRange(startOfMonth(), new Date())}>Mês atual</Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setRange(daysAgo(90), new Date())}>Últimos 90 dias</Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setRange(startOfYear(), new Date())}>Ano</Button>
        </div>

        <Select value={value.empresa != null ? String(value.empresa) : SENTINEL} onValueChange={(v) => set({ empresa: v === SENTINEL ? null : Number(v) })}>
          <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder="Empresa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={SENTINEL}>Todas empresas</SelectItem>
            {(empresas.data || []).map((id) => <SelectItem key={id} value={String(id)}>Empresa {id}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={value.vendedor ?? SENTINEL} onValueChange={(v) => set({ vendedor: v === SENTINEL ? null : v })}>
          <SelectTrigger className="w-[220px] h-9 text-sm"><SelectValue placeholder="Vendedor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={SENTINEL}>Todos vendedores</SelectItem>
            {(vendedores.data || []).map((v) => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={value.coordenador ?? SENTINEL} onValueChange={(v) => set({ coordenador: v === SENTINEL ? null : v })}>
          <SelectTrigger className="w-[220px] h-9 text-sm"><SelectValue placeholder="Coordenador" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={SENTINEL}>Todos coordenadores</SelectItem>
            {(coordenadores.data || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>

        {(value.empresa != null || value.vendedor || value.coordenador) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => set({ empresa: null, vendedor: null, coordenador: null })}>
            <X className="h-3 w-3 mr-1" /> Limpar
          </Button>
        )}
      </div>
    </div>
  );
}
