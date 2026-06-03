import { useState, type ReactNode } from 'react';
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Filter, ChevronDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { FILTROS_INICIAIS, FAIXA_LABELS, type EstoqueFiltros, type CurvaABC, type FaixaSaldo } from '@/lib/estoque/estoqueFilters';
import { useEstoqueOptions } from '@/hooks/estoque/useEstoqueFiltrosOptions';
import { formatUnidadeMedida } from '@/lib/estoque/unidadeMedida';
import { cn } from '@/lib/utils';

interface Props {
  filtros: EstoqueFiltros;
  setFiltros: (f: EstoqueFiltros) => void;
}

const CURVAS: CurvaABC[] = ['A', 'B', 'C', 'D', 'E'];
const FAIXAS: FaixaSaldo[] = ['sem_estoque', 'baixo', 'medio', 'alto', 'negativo'];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      {children}
    </div>
  );
}

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
    if (selected.includes(v)) onChange(selected.filter((x) => x !== v));
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
                  ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
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
                {options.map((o) => (
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
  const empresas = options?.empresas ?? [];

  const toggleEmpresa = (id: number) =>
    setFiltros({
      ...filtros,
      empresa_ids: filtros.empresa_ids.includes(id)
        ? filtros.empresa_ids.filter((x) => x !== id)
        : [...filtros.empresa_ids, id],
    });

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
    (filtros.sem_compra ? 1 : 0) +
    (filtros.validade_dias != null ? 1 : 0) +
    (filtros.vencidos ? 1 : 0);

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
          <div className="px-6 py-4 space-y-6">
            {/* FILIAL — destaque */}
            <Section title="Filial">
              <div className="rounded-lg border bg-primary/5 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {filtros.empresa_ids.length === 0 ? 'Todas as filiais' : `${filtros.empresa_ids.length} selecionada(s)`}
                  </span>
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() =>
                      setFiltros({
                        ...filtros,
                        empresa_ids: filtros.empresa_ids.length === empresas.length ? [] : empresas.map((e) => e.id),
                      })
                    }
                  >
                    {empresas.length > 0 && filtros.empresa_ids.length === empresas.length ? 'Limpar' : 'Selecionar todas'}
                  </button>
                </div>
                {empresas.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Carregando filiais…</span>
                ) : (
                  empresas.map((e) => (
                    <label key={e.id} className="flex items-center gap-2.5 cursor-pointer">
                      <Checkbox
                        checked={filtros.empresa_ids.includes(e.id)}
                        onCheckedChange={() => toggleEmpresa(e.id)}
                      />
                      <span className="text-sm">{e.nome}</span>
                    </label>
                  ))
                )}
              </div>
            </Section>

            {/* CLASSIFICAÇÃO */}
            <Section title="Classificação">
              <MultiSelect
                label="Linha"
                options={(options?.linhas ?? []).map((l) => ({ value: l, label: l }))}
                selected={filtros.linhas}
                onChange={(v) => setFiltros({ ...filtros, linhas: v })}
              />
              <MultiSelect
                label="Unidade de venda"
                options={(options?.unidades ?? []).map((u) => ({ value: u, label: formatUnidadeMedida(u) }))}
                selected={filtros.unidades}
                onChange={(v) => setFiltros({ ...filtros, unidades: v })}
              />
            </Section>

            {/* CURVA ABC */}
            <Section title="Curva ABC">
              <div className="grid grid-cols-2 gap-3">
                <MultiSelect
                  label="Curva Física"
                  options={CURVAS.map((c) => ({ value: c, label: c }))}
                  selected={filtros.curvas_fisicas}
                  onChange={(v) => setFiltros({ ...filtros, curvas_fisicas: v as CurvaABC[] })}
                />
                <MultiSelect
                  label="Curva Monetária"
                  options={CURVAS.map((c) => ({ value: c, label: c }))}
                  selected={filtros.curvas_monetarias}
                  onChange={(v) => setFiltros({ ...filtros, curvas_monetarias: v as CurvaABC[] })}
                />
              </div>
            </Section>

            {/* SALDO & VALOR */}
            <Section title="Saldo & Valor">
              <MultiSelect
                label="Faixa de saldo"
                options={FAIXAS.map((f) => ({ value: f, label: FAIXA_LABELS[f] }))}
                selected={filtros.faixas_saldo}
                onChange={(v) => setFiltros({ ...filtros, faixas_saldo: v as FaixaSaldo[] })}
              />
              <div className="space-y-1.5">
                <Label className="text-xs">Saldo (de–até)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" placeholder="Min" value={filtros.saldo_min ?? ''}
                    onChange={(e) => setFiltros({ ...filtros, saldo_min: e.target.value === '' ? null : Number(e.target.value) })} />
                  <Input type="number" placeholder="Max" value={filtros.saldo_max ?? ''}
                    onChange={(e) => setFiltros({ ...filtros, saldo_max: e.target.value === '' ? null : Number(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valor em estoque R$ (de–até)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" placeholder="Min" value={filtros.valor_min ?? ''}
                    onChange={(e) => setFiltros({ ...filtros, valor_min: e.target.value === '' ? null : Number(e.target.value) })} />
                  <Input type="number" placeholder="Max" value={filtros.valor_max ?? ''}
                    onChange={(e) => setFiltros({ ...filtros, valor_max: e.target.value === '' ? null : Number(e.target.value) })} />
                </div>
              </div>
            </Section>

            {/* VALIDADE / VENCIMENTO */}
            <Section title="Validade / Vencimento">
              <div className="grid grid-cols-4 gap-1.5">
                {[30, 60, 90].map((d) => (
                  <Button
                    key={d}
                    type="button"
                    size="sm"
                    variant={!filtros.vencidos && filtros.validade_dias === d ? 'default' : 'outline'}
                    onClick={() => setFiltros({ ...filtros, vencidos: false, validade_dias: filtros.validade_dias === d ? null : d })}
                  >
                    {d}d
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant={filtros.vencidos ? 'destructive' : 'outline'}
                  onClick={() => setFiltros({ ...filtros, vencidos: !filtros.vencidos, validade_dias: null })}
                >
                  Vencidos
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Usa validade/lote sincronizados do ERP.</p>
            </Section>

            {/* TEMPO */}
            <Section title="Tempo">
              <Label className="text-xs">Última compra</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {[30, 60, 90, 180].map((d) => (
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
            </Section>

            {/* OPÇÕES */}
            <Section title="Opções">
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Apenas com saldo {'>'} 0</Label>
                  <Switch checked={filtros.apenas_com_saldo} onCheckedChange={(v) => setFiltros({ ...filtros, apenas_com_saldo: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Com pedido pendente</Label>
                  <Switch checked={filtros.com_pedido_pendente} onCheckedChange={(v) => setFiltros({ ...filtros, com_pedido_pendente: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Sem compra há +180d</Label>
                  <Switch checked={filtros.sem_compra} onCheckedChange={(v) => setFiltros({ ...filtros, sem_compra: v })} />
                </div>
              </div>
            </Section>
          </div>
        </ScrollArea>
        <SheetFooter className="px-6 py-4 border-t flex-row gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setFiltros({ ...FILTROS_INICIAIS, busca: filtros.busca })}>
            Limpar tudo
          </Button>
          <SheetClose asChild>
            <Button className="flex-1">Aplicar filtros</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
