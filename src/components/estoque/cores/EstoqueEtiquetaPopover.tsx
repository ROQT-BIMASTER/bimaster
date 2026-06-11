import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tag, Plus } from 'lucide-react';
import { useState } from 'react';
import {
  useEstoqueEtiquetas,
  useEtiquetasDoProduto,
  useToggleEtiquetaProduto,
  useCreateEtiqueta,
} from '@/hooks/estoque/useEstoqueEtiquetas';

interface Props {
  codProduto: number;
  asIcon?: boolean;
}

export function EstoqueEtiquetaPopover({ codProduto, asIcon }: Props) {
  const { data: etiquetas = [] } = useEstoqueEtiquetas(true);
  const { data: vinculos = [] } = useEtiquetasDoProduto(codProduto);
  const toggle = useToggleEtiquetaProduto();
  const create = useCreateEtiqueta();
  const [novo, setNovo] = useState('');

  const marcadas = new Set(vinculos.map((v) => v.etiqueta_id));

  return (
    <Popover>
      <PopoverTrigger asChild>
        {asIcon ? (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
            <Tag className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-8">
            <Tag className="h-3.5 w-3.5 mr-1.5" />
            Campanhas ({marcadas.size})
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-semibold mb-2">Marcar este SKU em campanhas</p>
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {etiquetas.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhuma etiqueta criada ainda.</p>
          )}
          {etiquetas.map((e) => {
            const checked = marcadas.has(e.id);
            return (
              <label key={e.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/40 rounded px-1.5 py-1">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={toggle.isPending}
                  onChange={() => toggle.mutate({ etiquetaId: e.id, codProduto, marcar: !checked })}
                />
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ background: e.cor_hex }}
                />
                <span className="flex-1">{e.nome}</span>
              </label>
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t flex gap-2">
          <Input
            value={novo}
            onChange={(ev) => setNovo(ev.target.value)}
            placeholder="Nova campanha…"
            className="h-7 text-xs"
          />
          <Button
            size="sm"
            className="h-7 px-2"
            disabled={!novo.trim() || create.isPending}
            onClick={async () => {
              const created = await create.mutateAsync({ nome: novo.trim(), cor_hex: '#111827', ativo: true });
              await toggle.mutateAsync({ etiquetaId: created.id, codProduto, marcar: true });
              setNovo('');
            }}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
