import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingDown, Truck, PackageCheck, Sparkles, X } from 'lucide-react';
import { FILTROS_INICIAIS, type EstoqueFiltros } from '@/lib/estoque/estoqueFilters';

interface Props {
  filtros: EstoqueFiltros;
  setFiltros: (f: EstoqueFiltros) => void;
}

export function EstoqueQuickChips({ filtros, setFiltros }: Props) {
  const apply = (patch: Partial<EstoqueFiltros>) => setFiltros({ ...filtros, ...patch });

  const chips = [
    {
      key: 'critico',
      label: 'Crítico (curva A baixo)',
      icon: AlertTriangle,
      active: filtros.curvas_monetarias.includes('A') && filtros.faixas_saldo.includes('baixo'),
      onClick: () => apply({
        curvas_monetarias: ['A'],
        faixas_saldo: ['baixo'],
        apenas_com_saldo: true,
      }),
    },
    {
      key: 'excesso',
      label: 'Excesso (curva D/E alto)',
      icon: TrendingDown,
      active: filtros.curvas_monetarias.some(c => c==='D'||c==='E') && filtros.faixas_saldo.includes('alto'),
      onClick: () => apply({ curvas_monetarias: ['D','E'], faixas_saldo: ['alto'] }),
    },
    {
      key: 'pendente',
      label: 'Pedidos pendentes',
      icon: Truck,
      active: filtros.com_pedido_pendente,
      onClick: () => apply({ com_pedido_pendente: !filtros.com_pedido_pendente }),
    },
    {
      key: 'sem-giro',
      label: 'Sem giro (>180d)',
      icon: PackageCheck,
      active: filtros.sem_compra,
      onClick: () => apply({ sem_compra: !filtros.sem_compra, apenas_com_saldo: true }),
    },
    {
      key: 'estrelas',
      label: 'Estrelas (AA)',
      icon: Sparkles,
      active: filtros.curvas_fisicas.length===1 && filtros.curvas_fisicas[0]==='A' && filtros.curvas_monetarias.length===1 && filtros.curvas_monetarias[0]==='A',
      onClick: () => apply({ curvas_fisicas: ['A'], curvas_monetarias: ['A'] }),
    },
  ];

  const hasFilters =
    filtros.busca || filtros.empresa_ids.length || filtros.linhas.length || filtros.unidades.length ||
    filtros.curvas_fisicas.length || filtros.curvas_monetarias.length || filtros.faixas_saldo.length ||
    filtros.apenas_com_saldo || filtros.com_pedido_pendente ||
    filtros.saldo_min != null || filtros.saldo_max != null ||
    filtros.valor_min != null || filtros.valor_max != null ||
    filtros.ultima_compra_dias != null || filtros.sem_compra ||
    filtros.validade_dias != null || filtros.vencidos;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map(c => (
        <Button
          key={c.key}
          size="sm"
          variant={c.active ? 'default' : 'outline'}
          onClick={c.onClick}
          className="h-8"
        >
          <c.icon className="h-3.5 w-3.5 mr-1.5" />
          {c.label}
        </Button>
      ))}
      {hasFilters && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setFiltros({ ...FILTROS_INICIAIS, busca: filtros.busca })}
          className="h-8 text-muted-foreground"
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
