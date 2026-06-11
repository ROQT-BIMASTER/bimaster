import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  selected: string[];
  onChange: (linhas: string[]) => void;
}

export function EstoqueLinhaTabs({ selected, onChange }: Props) {
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
      for (const r of (data ?? []) as { nome_linha: string }[]) if (r.nome_linha) set.add(r.nome_linha);
      return Array.from(set).sort();
    },
  });

  const toggle = (l: string) => {
    if (selected.includes(l)) onChange(selected.filter((x) => x !== l));
    else onChange([...selected, l]);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        size="sm"
        variant={selected.length === 0 ? 'default' : 'outline'}
        className="h-8 text-xs"
        onClick={() => onChange([])}
      >
        Todas as linhas
      </Button>
      {linhas.map((l) => {
        const active = selected.includes(l);
        return (
          <Button
            key={l}
            size="sm"
            variant={active ? 'default' : 'outline'}
            className={cn('h-8 text-xs', active && 'shadow-sm')}
            onClick={() => toggle(l)}
          >
            {l}
          </Button>
        );
      })}
    </div>
  );
}
