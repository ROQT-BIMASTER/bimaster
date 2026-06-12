import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Check, ChevronDown, Layers3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  selected: string[];
  onChange: (linhas: string[]) => void;
}

export function EstoqueLinhaTabs({ selected, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const { data: linhas = [] } = useQuery({
    queryKey: ['estoque-linhas-distinct'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('erp_estoque_distribuidora')
        .select('nome_linha')
        .not('nome_linha', 'is', null)
        .limit(5000);
      if (error) throw error;
      const set = new Set<string>();
      for (const r of (data ?? []) as { nome_linha: string }[]) {
        if (r.nome_linha) set.add(r.nome_linha);
      }
      return Array.from(set).sort();
    },
  });

  const toggle = (l: string) =>
    selected.includes(l)
      ? onChange(selected.filter((x) => x !== l))
      : onChange([...selected, l]);

  const label =
    selected.length === 0
      ? 'Todas as linhas'
      : selected.length === 1
        ? selected[0]
        : `${selected.length} linhas`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9 gap-2 font-normal">
          <Layers3 className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">
            Linha: <span className="font-medium text-foreground">{label}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar linha..." className="h-9" />
          <CommandList className="max-h-[320px]">
            <CommandEmpty>Nenhuma linha.</CommandEmpty>
            <CommandGroup>
              {selected.length > 0 && (
                <CommandItem
                  onSelect={() => onChange([])}
                  className="text-muted-foreground"
                >
                  <Check className="h-4 w-4 mr-2 opacity-0" />
                  Limpar seleção ({selected.length})
                </CommandItem>
              )}
              {linhas.map((l) => (
                <CommandItem key={l} value={l} onSelect={() => toggle(l)}>
                  <Check
                    className={cn(
                      'h-4 w-4 mr-2',
                      selected.includes(l) ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {l}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
