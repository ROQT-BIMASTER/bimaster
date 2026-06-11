import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Tag, X } from 'lucide-react';
import { useEstoqueEtiquetas } from '@/hooks/estoque/useEstoqueEtiquetas';

interface Props {
  selected: string[];
  onChange: (ids: string[]) => void;
}

export function EstoqueCampanhaFilter({ selected, onChange }: Props) {
  const { data: etiquetas = [] } = useEstoqueEtiquetas(true);
  const labels = etiquetas.filter((e) => selected.includes(e.id));

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <Tag className="h-3.5 w-3.5 mr-1.5" />
            Campanhas {selected.length > 0 && `(${selected.length})`}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2">
          {etiquetas.length === 0 && (
            <p className="text-xs text-muted-foreground p-2">Nenhuma etiqueta criada.</p>
          )}
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {etiquetas.map((e) => {
              const checked = selected.includes(e.id);
              return (
                <label key={e.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/40 rounded px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      onChange(checked ? selected.filter((x) => x !== e.id) : [...selected, e.id])
                    }
                  />
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: e.cor_hex }} />
                  <span className="flex-1">{e.nome}</span>
                </label>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      {labels.map((e) => (
        <Badge
          key={e.id}
          variant="outline"
          className="gap-1 cursor-pointer"
          style={{ borderColor: e.cor_hex, color: e.cor_hex }}
          onClick={() => onChange(selected.filter((x) => x !== e.id))}
        >
          {e.nome}
          <X className="h-3 w-3" />
        </Badge>
      ))}
    </div>
  );
}
