import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { FILTROS_INICIAIS, FAIXA_LABELS, type EstoqueFiltros } from '@/lib/estoque/estoqueFilters';
import { useEstoqueOptions } from '@/hooks/estoque/useEstoqueFiltrosOptions';
import { formatUnidadeMedidaShort } from '@/lib/estoque/unidadeMedida';

interface Props {
  filtros: EstoqueFiltros;
  setFiltros: (f: EstoqueFiltros) => void;
}

interface Chip {
  key: string;
  label: string;
  clear: () => void;
}

export function EstoqueActiveFilters({ filtros, setFiltros }: Props) {
  const { data: options } = useEstoqueOptions();
  const nomeEmpresa = (id: number) =>
    options?.empresas.find((e) => e.id === id)?.nome ?? `Empresa ${id}`;

  const patch = (p: Partial<EstoqueFiltros>) => setFiltros({ ...filtros, ...p });
  const chips: Chip[] = [];

  filtros.empresa_ids.forEach((id) =>
    chips.push({ key: `emp-${id}`, label: `Filial: ${nomeEmpresa(id)}`, clear: () => patch({ empresa_ids: filtros.empresa_ids.filter((x) => x !== id) }) }));
  filtros.linhas.forEach((l) =>
    chips.push({ key: `lin-${l}`, label: `Linha: ${l}`, clear: () => patch({ linhas: filtros.linhas.filter((x) => x !== l) }) }));
  filtros.unidades.forEach((u) =>
    chips.push({ key: `um-${u}`, label: `Unidade: ${u}`, clear: () => patch({ unidades: filtros.unidades.filter((x) => x !== u) }) }));
  filtros.curvas_fisicas.forEach((c) =>
    chips.push({ key: `cf-${c}`, label: `Curva F: ${c}`, clear: () => patch({ curvas_fisicas: filtros.curvas_fisicas.filter((x) => x !== c) }) }));
  filtros.curvas_monetarias.forEach((c) =>
    chips.push({ key: `cm-${c}`, label: `Curva M: ${c}`, clear: () => patch({ curvas_monetarias: filtros.curvas_monetarias.filter((x) => x !== c) }) }));
  filtros.faixas_saldo.forEach((f) =>
    chips.push({ key: `fx-${f}`, label: `Faixa: ${FAIXA_LABELS[f]}`, clear: () => patch({ faixas_saldo: filtros.faixas_saldo.filter((x) => x !== f) }) }));
  if (filtros.apenas_com_saldo) chips.push({ key: 'saldo', label: 'Com saldo', clear: () => patch({ apenas_com_saldo: false }) });
  if (filtros.com_pedido_pendente) chips.push({ key: 'pend', label: 'Com pendente', clear: () => patch({ com_pedido_pendente: false }) });
  if (filtros.sem_compra) chips.push({ key: 'semgiro', label: 'Sem giro +180d', clear: () => patch({ sem_compra: false }) });
  if (filtros.saldo_min != null) chips.push({ key: 'smin', label: `Saldo ≥ ${filtros.saldo_min}`, clear: () => patch({ saldo_min: null }) });
  if (filtros.saldo_max != null) chips.push({ key: 'smax', label: `Saldo ≤ ${filtros.saldo_max}`, clear: () => patch({ saldo_max: null }) });
  if (filtros.valor_min != null) chips.push({ key: 'vmin', label: `Valor ≥ ${filtros.valor_min}`, clear: () => patch({ valor_min: null }) });
  if (filtros.valor_max != null) chips.push({ key: 'vmax', label: `Valor ≤ ${filtros.valor_max}`, clear: () => patch({ valor_max: null }) });
  if (filtros.ultima_compra_dias != null) chips.push({ key: 'uc', label: `Compra ≤ ${filtros.ultima_compra_dias}d`, clear: () => patch({ ultima_compra_dias: null }) });
  if (filtros.vencidos) chips.push({ key: 'venc', label: 'Vencidos', clear: () => patch({ vencidos: false }) });
  else if (filtros.validade_dias != null) chips.push({ key: 'val', label: `A vencer ${filtros.validade_dias}d`, clear: () => patch({ validade_dias: null }) });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">Filtros ativos:</span>
      {chips.map((c) => (
        <button
          key={c.key}
          onClick={c.clear}
          className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
        >
          {c.label}
          <X className="h-3 w-3" />
        </button>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs text-muted-foreground"
        onClick={() => setFiltros({ ...FILTROS_INICIAIS, busca: filtros.busca })}
      >
        Limpar filtros
      </Button>
    </div>
  );
}
