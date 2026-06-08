import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency } from '@/lib/formatters';
import { Boxes, Package, PackageOpen, Layers, Info } from 'lucide-react';
import type { EstoqueUnificadoRow } from '@/hooks/estoque/useEstoqueUnificado';
import { converterParaModo, equivalenteEmCaixas, formatCx, type ModoExibicao } from '@/lib/estoque/modoExibicao';

interface Props {
  rows: EstoqueUnificadoRow[];
  total: number;
  loading?: boolean;
  modo?: ModoExibicao;
}

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR');

export function EstoqueUnificadoKpis({ rows, total, loading, modo = 'fisico' }: Props) {
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

  let items: { icon: any; label: string; value: string; hint: string; tooltip?: string }[] = [];

  const tooltipEqUn = 'Soma de cada folha (UN) sob o produto-raiz, multiplicada pelo fator acumulado da BOM (Pai → Mãe → Filho). Para sortimentos heterogêneos, considera todas as ramificações: Σ (qtd_pai_mãe × qtd_mãe_filho).';

  if (modo === 'fisico') {
    items = [
      { icon: Boxes, label: 'Caixas Master', value: fmt(totals.cx), hint: 'CX físicas' },
      { icon: Package, label: 'Displays / Box', value: fmt(totals.bx), hint: 'BX físicos' },
      { icon: PackageOpen, label: 'Unidades', value: fmt(totals.un), hint: 'UN físicas' },
      { icon: Layers, label: 'Equivalente em UN', value: fmt(totals.un_eq), hint: 'Se tudo fosse desmontado', tooltip: tooltipEqUn },
      { icon: Layers, label: 'Custo total', value: formatCurrency(totals.custo), hint: `${total.toLocaleString('pt-BR')} produtos-raiz` },
    ];
  } else {
    let somaConv = 0;
    let semFator = 0;
    rows.forEach((r) => {
      const v = converterParaModo(r, modo);
      if (v == null) semFator += 1;
      else somaConv += v;
    });
    const labelMap = { cx: 'Total em Caixas (CX)', bx: 'Total em Displays (BX)', un: 'Total em Unidades (UN)' } as const;
    const iconMap = { cx: Boxes, bx: Package, un: PackageOpen } as const;
    items = [
      {
        icon: iconMap[modo],
        label: labelMap[modo],
        value: fmt(somaConv),
        hint: semFator
          ? `${semFator} produto(s) sem fator de conversão`
          : 'convertido a partir do equivalente em UN',
        tooltip: tooltipEqUn,
      },
      { icon: Layers, label: 'Equivalente em UN', value: fmt(totals.un_eq), hint: 'base da conversão', tooltip: tooltipEqUn },
      { icon: Layers, label: 'Custo total', value: formatCurrency(totals.custo), hint: `${total.toLocaleString('pt-BR')} produtos-raiz` },
    ];
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className={`grid grid-cols-2 md:grid-cols-3 ${modo === 'fisico' ? 'lg:grid-cols-5' : 'lg:grid-cols-3'} gap-3`}>
        {items.map((it) => (
          <Card key={it.label} className="p-3">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-muted p-2">
                <it.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-xs text-muted-foreground">{it.label}</p>
                  {it.tooltip && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        {it.tooltip}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <p className="text-lg font-bold leading-tight">{loading ? '—' : it.value}</p>
                <p className="text-[11px] text-muted-foreground truncate">{it.hint}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </TooltipProvider>
  );
}
