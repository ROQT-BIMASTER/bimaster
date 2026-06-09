import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Columns3, RotateCcw } from 'lucide-react';
import {
  ESTOQUE_UNIF_COLUMNS,
  type EstoqueUnifColId,
} from '@/hooks/estoque/useEstoqueUnificadoTablePrefs';

interface Props {
  isHidden: (id: EstoqueUnifColId) => boolean;
  toggle: (id: EstoqueUnifColId) => void;
  reset: () => void;
}

export function EstoqueUnificadoColumnsMenu({ isHidden, toggle, reset }: Props) {
  const hideableCount = ESTOQUE_UNIF_COLUMNS.filter((c) => c.hideable).length;
  const hiddenCount = ESTOQUE_UNIF_COLUMNS.filter((c) => c.hideable && isHidden(c.id)).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
          <Columns3 className="h-3.5 w-3.5" />
          Colunas
          {hiddenCount > 0 && (
            <span className="ml-1 rounded bg-muted px-1 text-[10px] text-muted-foreground">
              {hideableCount - hiddenCount}/{hideableCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs">Colunas visíveis</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ESTOQUE_UNIF_COLUMNS.filter((c) => c.hideable).map((c) => (
          <DropdownMenuCheckboxItem
            key={c.id}
            checked={!isHidden(c.id)}
            onCheckedChange={() => toggle(c.id)}
            onSelect={(e) => e.preventDefault()}
            className="text-xs"
          >
            {c.label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => reset()} className="text-xs">
          <RotateCcw className="h-3 w-3 mr-2" />
          Restaurar padrão
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
