import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Building2, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEstoqueOptions } from '@/hooks/estoque/useEstoqueFiltrosOptions';

interface Props {
  selected: number[];
  onChange: (v: number[]) => void;
}

export function EstoqueFilialSelect({ selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const { data } = useEstoqueOptions();
  const empresas = data?.empresas ?? [];

  const toggle = (id: number) =>
    selected.includes(id)
      ? onChange(selected.filter((x) => x !== id))
      : onChange([...selected, id]);

  const label =
    selected.length === 0
      ? 'Todas as filiais'
      : selected.length === 1
        ? empresas.find((e) => e.id === selected[0])?.nome ?? '1 filial'
        : `${selected.length} filiais`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9 gap-2 font-normal">
          <Building2 className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">
            Filial: <span className="font-medium text-foreground">{label}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar filial..." className="h-9" />
          <CommandList>
            <CommandEmpty>Nenhuma filial.</CommandEmpty>
            <CommandGroup>
              {selected.length > 0 && (
                <CommandItem onSelect={() => onChange([])} className="text-muted-foreground">
                  <Check className="h-4 w-4 mr-2 opacity-0" />
                  Limpar seleção
                </CommandItem>
              )}
              {empresas.map((e) => (
                <CommandItem key={e.id} onSelect={() => toggle(e.id)}>
                  <Check className={cn('h-4 w-4 mr-2', selected.includes(e.id) ? 'opacity-100' : 'opacity-0')} />
                  {e.nome}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
