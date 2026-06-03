import { Button } from '@/components/ui/button';
import { useEstoqueOptions } from '@/hooks/estoque/useEstoqueFiltrosOptions';
import { formatUnidadeMedidaShort } from '@/lib/estoque/unidadeMedida';

interface Props {
  selected: string[];
  onChange: (v: string[]) => void;
}

/**
 * Atalho rápido de filtro por unidade de venda (CX, UN, BX, ...).
 * Reflete e controla filtros.unidades — fica em sincronia com o painel de filtros.
 */
export function EstoqueUnidadeChips({ selected, onChange }: Props) {
  const { data } = useEstoqueOptions();
  const unidades = data?.unidades ?? [];
  if (unidades.length === 0) return null;

  const toggle = (u: string) =>
    selected.includes(u) ? onChange(selected.filter((x) => x !== u)) : onChange([...selected, u]);

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground mr-0.5">Unidade:</span>
      {unidades.map((u) => (
        <Button
          key={u}
          size="sm"
          variant={selected.includes(u) ? 'default' : 'outline'}
          className="h-8 px-2.5 font-mono"
          onClick={() => toggle(u)}
        >
          {u}
        </Button>
      ))}
    </div>
  );
}
