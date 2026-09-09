import { useMemo, useState } from 'react';
import { Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface FilialOption {
  id: number;
  abrev: string;
  nome: string;
}

interface Props {
  distribuidoras: FilialOption[];
  /** IDs selecionados; lista vazia = todas as filiais visíveis */
  selecionadas: number[];
  onChange: (ids: number[]) => void;
}

export function FiliaisColunasMenu({ distribuidoras, selecionadas, onChange }: Props) {
  const [busca, setBusca] = useState('');

  const total = distribuidoras.length;
  const visiveis = selecionadas.length === 0 ? total : selecionadas.length;
  const label = selecionadas.length === 0
    ? 'Todas as filiais'
    : selecionadas.length === 1
      ? (distribuidoras.find((d) => d.id === selecionadas[0])?.abrev ?? `Filial ${selecionadas[0]}`)
      : `${visiveis} de ${total} filiais`;

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return distribuidoras;
    return distribuidoras.filter((d) =>
      d.abrev?.toLowerCase().includes(q) || d.nome?.toLowerCase().includes(q));
  }, [distribuidoras, busca]);

  const isChecked = (id: number) => selecionadas.length === 0 || selecionadas.includes(id);

  const toggle = (id: number, v: boolean) => {
    const base = selecionadas.length === 0 ? distribuidoras.map((d) => d.id) : selecionadas;
    const next = v ? Array.from(new Set([...base, id])) : base.filter((x) => x !== id);
    onChange(next.length === distribuidoras.length ? [] : next);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns3 className="mr-2 h-3.5 w-3.5" /> {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Filiais exibidas</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {total > 6 && (
          <div className="px-2 pb-2">
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar filial"
              className="h-8 text-xs"
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        )}
        <div className="max-h-64 overflow-y-auto">
          {filtradas.map((d) => (
            <DropdownMenuCheckboxItem
              key={d.id}
              checked={isChecked(d.id)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={(v) => toggle(d.id, !!v)}
            >
              {d.abrev} — {d.nome}
            </DropdownMenuCheckboxItem>
          ))}
          {filtradas.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma filial encontrada</div>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between gap-1 px-2 py-1">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onChange([])}>
            Selecionar todas
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onChange(distribuidoras.length ? [distribuidoras[0].id] : [])}
          >
            Limpar seleção
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
