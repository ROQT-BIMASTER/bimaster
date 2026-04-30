import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';
import { Boxes, Package, PackageOpen, Layers } from 'lucide-react';
import type { EstoqueUnificadoRow } from '@/hooks/estoque/useEstoqueUnificado';

interface Props {
  rows: EstoqueUnificadoRow[];
  total: number;
  loading?: boolean;
}

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR');

export function EstoqueUnificadoKpis({ rows, total, loading }: Props) {
  const totals = rows.reduce(
    (acc, r) => {
      acc.cx += Number(r.saldo_em_caixas || 0);
      acc.bx += Number(r.saldo_em_displays || 0);
      acc.un += Number(r.saldo_em_unidades || 0);
      acc.un_eq += Number(r.saldo_total_em_unidades || 0);
      acc.custo += Number(r.custo_total || 0);
      return acc;
    },
    { cx: 0, bx: 0, un: 0, un_eq: 0, custo: 0 },
  );

  const items = [
    { icon: Boxes, label: 'Caixas Master', value: fmt(totals.cx), hint: 'CX físicas' },
    { icon: Package, label: 'Displays / Box', value: fmt(totals.bx), hint: 'BX físicos' },
    { icon: PackageOpen, label: 'Unidades', value: fmt(totals.un), hint: 'UN físicas' },
    { icon: Layers, label: 'Equivalente em UN', value: fmt(totals.un_eq), hint: 'Se tudo fosse desmontado' },
    { icon: Layers, label: 'Custo total', value: formatCurrency(totals.custo), hint: `${total.toLocaleString('pt-BR')} produtos-raiz` },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((it) => (
        <Card key={it.label} className="p-3">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-muted p-2">
              <it.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{it.label}</p>
              <p className="text-lg font-bold leading-tight">{loading ? '—' : it.value}</p>
              <p className="text-[11px] text-muted-foreground truncate">{it.hint}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
