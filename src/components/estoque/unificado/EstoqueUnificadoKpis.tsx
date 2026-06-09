import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency } from '@/lib/formatters';
import { Boxes, Package, PackageOpen, Layers, Info, ShieldCheck, Lock, Clock } from 'lucide-react';
import type { EstoqueUnificadoRow } from '@/hooks/estoque/useEstoqueUnificado';
import { converterParaModo, disponivelEmCaixas, formatCx, type ModoExibicao } from '@/lib/estoque/modoExibicao';

interface Props {
  rows: EstoqueUnificadoRow[];
  total: number;
  loading?: boolean;
  modo?: ModoExibicao;
}

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR');

type Variant = 'default' | 'primary' | 'success';

interface KpiItem {
  icon: any;
  label: string;
  value: string;
  hint: string;
  tooltip?: string;
  variant?: Variant;
}

export function EstoqueUnificadoKpis({ rows, total, loading, modo = 'fisico' }: Props) {
  const totals = rows.reduce(
    (acc, r) => {
      acc.cx += Number(r.saldo_em_caixas || 0);
      acc.bx += Number(r.saldo_em_displays || 0);
      acc.un += Number(r.saldo_em_unidades || 0);
      acc.un_eq += Number(r.saldo_total_em_unidades || 0);
      acc.bloq += Number(r.bloqueado_total_em_unidades || 0);
      acc.disp += Number(r.disponivel_total_em_unidades || 0);
      acc.pend += Number(r.pendente_total_em_unidades || 0);
      acc.custo += Number(r.custo_total || 0);
      return acc;
    },
    { cx: 0, bx: 0, un: 0, un_eq: 0, bloq: 0, disp: 0, pend: 0, custo: 0 },
  );

  // Disponível em CX (apoio a vendas/compras)
  let cxDisp = 0;
  let semFatorCx = 0;
  rows.forEach((r) => {
    const v = disponivelEmCaixas(r);
    if (v == null) semFatorCx += 1;
    else cxDisp += v;
  });

  const cxDispHint = semFatorCx
    ? `${semFatorCx} produto(s) sem fator de CX`
    : 'caixas vendáveis (sobras viram CX parcial)';
  const tooltipCxDisp = 'Soma de (Disponível em UN ÷ fator CX) por produto-raiz. Reflete quantas caixas máster estão realmente livres para venda, abatendo o estoque bloqueado.';
  const tooltipEqUn = 'Soma de cada folha (UN) sob o produto-raiz, multiplicada pelo fator acumulado da BOM (Pai → Mãe → Filho).';
  const tooltipDisp = 'Disponível para venda = Saldo total em UN − Bloqueado. Não abate pedido pendente (o saldo ainda existe fisicamente).';
  const tooltipBloq = 'Estoque travado por avaria, quarentena ou endereço bloqueado — somado por SKU e convertido a UN.';
  const tooltipPend = 'Pedidos de venda em aberto, ainda não faturados — informativo, não abate do Disponível.';

  let items: KpiItem[] = [];

  if (modo === 'fisico') {
    items = [
      { icon: Boxes, label: 'Caixas Master', value: fmt(totals.cx), hint: 'CX físicas' },
      { icon: Package, label: 'Displays / Box', value: fmt(totals.bx), hint: 'BX físicos' },
      { icon: PackageOpen, label: 'Unidades', value: fmt(totals.un), hint: 'UN físicas' },
      { icon: Layers, label: 'Total em UN', value: fmt(totals.un_eq), hint: 'saldo bruto desmontado', tooltip: tooltipEqUn },
      { icon: Lock, label: 'Bloqueado em UN', value: fmt(totals.bloq), hint: 'avaria · quarentena · endereço', tooltip: tooltipBloq },
      { icon: ShieldCheck, label: 'Disponível em UN', value: fmt(totals.disp), hint: 'pronto para venda', tooltip: tooltipDisp, variant: 'success' },
      { icon: Clock, label: 'Pendente em UN', value: fmt(totals.pend), hint: 'pedidos em aberto', tooltip: tooltipPend },
      { icon: Boxes, label: 'Disponível em CX', value: formatCx(cxDisp), hint: cxDispHint, tooltip: tooltipCxDisp, variant: 'primary' },
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
        hint: semFator ? `${semFator} produto(s) sem fator de conversão` : 'convertido do equivalente em UN',
        tooltip: tooltipEqUn,
      },
      { icon: Lock, label: 'Bloqueado em UN', value: fmt(totals.bloq), hint: 'travado em estoque', tooltip: tooltipBloq },
      { icon: ShieldCheck, label: 'Disponível em UN', value: fmt(totals.disp), hint: 'pronto para venda', tooltip: tooltipDisp, variant: 'success' },
      { icon: Clock, label: 'Pendente em UN', value: fmt(totals.pend), hint: 'pedidos em aberto', tooltip: tooltipPend },
      { icon: Boxes, label: 'Disponível em CX', value: formatCx(cxDisp), hint: cxDispHint, tooltip: tooltipCxDisp, variant: 'primary' },
      { icon: Layers, label: 'Custo total', value: formatCurrency(totals.custo), hint: `${total.toLocaleString('pt-BR')} produtos-raiz` },
    ];
  }

  const cardCls = (v: Variant | undefined) => {
    if (v === 'primary') return 'p-3 border-primary/40 bg-primary/5 ring-1 ring-primary/30 shadow-sm';
    if (v === 'success') return 'p-3 border-success/40 bg-success/5 ring-1 ring-success/30 shadow-sm';
    return 'p-3';
  };
  const iconWrapCls = (v: Variant | undefined) => {
    if (v === 'primary') return 'rounded-md bg-primary/15 p-1.5 shrink-0';
    if (v === 'success') return 'rounded-md bg-success/15 p-1.5 shrink-0';
    return 'rounded-md bg-muted p-1.5 shrink-0';
  };
  const iconCls = (v: Variant | undefined) => {
    if (v === 'primary') return 'h-4 w-4 text-primary';
    if (v === 'success') return 'h-4 w-4 text-success';
    return 'h-4 w-4 text-muted-foreground';
  };
  const labelCls = (v: Variant | undefined) => {
    if (v === 'primary') return 'text-xs font-medium text-primary truncate';
    if (v === 'success') return 'text-xs font-medium text-success truncate';
    return 'text-xs text-muted-foreground truncate';
  };
  const valueCls = (v: Variant | undefined) => {
    const base = 'font-bold leading-tight tabular-nums truncate text-base xl:text-[15px] 2xl:text-lg';
    if (v === 'primary') return `${base} text-primary`;
    if (v === 'success') return `${base} text-success`;
    return base;
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className={`grid grid-cols-2 md:grid-cols-3 ${modo === 'fisico' ? 'lg:grid-cols-5 xl:grid-cols-9' : 'lg:grid-cols-3 xl:grid-cols-6'} gap-3`}>
        {items.map((it) => (
          <Card key={it.label} className={cardCls(it.variant)}>
            <div className="flex items-start gap-2">
              <div className={iconWrapCls(it.variant)}>
                <it.icon className={iconCls(it.variant)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                  <p className={labelCls(it.variant)}>{it.label}</p>
                  {it.tooltip && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground/60 cursor-help shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        {it.tooltip}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <p className={valueCls(it.variant)} title={it.value}>{loading ? '—' : it.value}</p>
                <p className="text-[11px] text-muted-foreground truncate">{it.hint}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </TooltipProvider>
  );
}
