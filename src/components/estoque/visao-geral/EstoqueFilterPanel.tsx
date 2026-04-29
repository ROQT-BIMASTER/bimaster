import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Filter, ChevronDown } from 'lucide-react';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check } from 'lucide-react';
import type { EstoqueFiltros, CurvaABC, FaixaSaldo } from '@/lib/estoque/estoqueFilters';
import { FAIXA_LABELS } from '@/lib/estoque/estoqueFilters';
import { useEstoqueOptions } from '@/hooks/estoque/useEstoqueFiltrosOptions';
import { cn } from '@/lib/utils';

interface Props {
  filtros: EstoqueFiltros;
  setFiltros: (f: EstoqueFiltros) => void;
}

const CURVAS: CurvaABC[] = ['A','B','C','D','E'];
const FAIXAS: FaixaSaldo[] = ['sem_estoque','baixo','medio','alto','negativo'];

function MultiSelect({
  label, options, selected, onChange, placeholder,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (v: string) => {
    if (selected.includes(v)) onChange(selected.filter(x => x !== v));
    else onChange([...selected, v]);
  };
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-between h-9 font-normal">
            <span className="truncate">
              {selected.length === 0
                ? placeholder ?? 'Todos'
                : selected.length === 1
                  ? options.find(o => o.value === selected[0])?.label ?? selected[0]
                  : `${selected.length} selecionado(s)`}
            </span>
            <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar..." className="h-9" />
            <CommandList>
              <CommandEmpty>Nada encontrado.</CommandEmpty>
              <CommandGroup>
                {options.map(o => (
                  <CommandItem key={o.value} onSelect={() => toggle(o.value)}>
                    <Check className={cn('h-4 w-4 mr-2', selected.includes(o.value) ? 'opacity-100' : 'opacity-0')} />
                    {o.label}
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

export function EstoqueFilterPanel({ filtros, setFiltros }: Props) {
  const { data: options } = useEstoqueOptions();

  const activeCount =
    (filtros.empresa_ids.length ? 1 : 0) +
    (filtros.linhas.length ? 1 : 0) +
    (filtros.unidades.length ? 1 : 0) +
    (filtros.curvas_fisicas.length ? 1 : 0) +
    (filtros.curvas_monetarias.length ? 1 : 0) +
    (filtros.faixas_saldo.length ? 1 : 0) +
    (filtros.apenas_com_saldo ? 1 : 0) +
    (filtros.com_pedido_pendente ? 1 : 0) +
    (filtros.saldo_min != null ? 1 : 0) +
    (filtros.saldo_max != null ? 1 : 0) +
    (filtros.valor_min != null ? 1 : 0) +
    (filtros.valor_max != null ? 1 : 0) +
    (filtros.ultima_compra_dias != null ? 1 : 0) +
    (filtros.sem_compra ? 1 : 0);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          <Filter className="h-4 w-4 mr-2" />
          Filtros
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 px-1.5">{activeCount}</Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>Filtros de Estoque</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-5">
            <MultiSelect
              label="Empresa / Filial"
              options={(options?.empresas ?? []).map(e => ({ value: String(e.id), label: e.nome }))}
              selected={filtros.empresa_ids.map(String)}
              onChange={v => setFiltros({ ...filtros, empresa_ids: v.map(Number) })}
            />

            <MultiSelect
              label="Linha / Marca"
              options={(options?.linhas ?? []).map(l => ({ value: l, label: l }))}
              selected={filtros.linhas}
              onChange={v => setFiltros({ ...filtros, linhas: v })}
            />

            <MultiSelect
              label="Unidade de medida"
              options={(options?.unidades ?? []).map(u => ({ value: u, label: u }))}
              selected={filtros.unidades}
              onChange={v => setFiltros({ ...filtros, unidades: v })}
            />

            <div className="grid grid-cols-2 gap-3">
              <MultiSelect
                label="Curva Física"
                options={CURVAS.map(c => ({ value: c, label: c }))}
                selected={filtros.curvas_fisicas}
                onChange={v => setFiltros({ ...filtros, curvas_fisicas: v as CurvaABC[] })}
              />
              <MultiSelect
                label="Curva Monetária"
                options={CURVAS.map(c => ({ value: c, label: c }))}
                selected={filtros.curvas_monetarias}
                onChange={v => setFiltros({ ...filtros, curvas_monetarias: v as CurvaABC[] })}
              />
            </div>

            <MultiSelect
              label="Faixa de saldo"
              options={FAIXAS.map(f => ({ value: f, label: FAIXA_LABELS[f] }))}
              selected={filtros.faixas_saldo}
              onChange={v => setFiltros({ ...filtros, faixas_saldo: v as FaixaSaldo[] })}
            />

            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Apenas com saldo {'>'} 0</Label>
                <Switch
                  checked={filtros.apenas_com_saldo}
                  onCheckedChange={v => setFiltros({ ...filtros, apenas_com_saldo: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Com pedido pendente</Label>
                <Switch
                  checked={filtros.com_pedido_pendente}
                  onCheckedChange={v => setFiltros({ ...filtros, com_pedido_pendente: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Sem compra há +180d</Label>
                <Switch
                  checked={filtros.sem_compra}
                  onCheckedChange={v => setFiltros({ ...filtros, sem_compra: v })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Saldo (de–até)</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filtros.saldo_min ?? ''}
                  onChange={e => setFiltros({ ...filtros, saldo_min: e.target.value === '' ? null : Number(e.target.value) })}
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={filtros.saldo_max ?? ''}
                  onChange={e => setFiltros({ ...filtros, saldo_max: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Valor em estoque R$ (de–até)</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filtros.valor_min ?? ''}
                  onChange={e => setFiltros({ ...filtros, valor_min: e.target.value === '' ? null : Number(e.target.value) })}
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={filtros.valor_max ?? ''}
                  onChange={e => setFiltros({ ...filtros, valor_max: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Última compra</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {[30, 60, 90, 180].map(d => (
                  <Button
                    key={d}
                    type="button"
                    size="sm"
                    variant={filtros.ultima_compra_dias === d ? 'default' : 'outline'}
                    onClick={() => setFiltros({ ...filtros, ultima_compra_dias: filtros.ultima_compra_dias === d ? null : d })}
                  >
                    {d}d
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
