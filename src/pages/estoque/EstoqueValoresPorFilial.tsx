import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/components/ui/kpi-card';
import {
  Building2, DollarSign, Boxes, PackageCheck, PackageX,
  ArrowDown, ArrowUp, ArrowUpDown, AlertTriangle, Search, Info,
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { FILTROS_INICIAIS, type EstoqueFiltros } from '@/lib/estoque/estoqueFilters';
import {
  useEstoqueValoresPorFilial, type EstoqueFilialRow,
} from '@/hooks/estoque/useEstoqueValoresPorFilial';
import { EstoqueFilialSelect } from '@/components/estoque/visao-geral/EstoqueFilialSelect';
import { EstoqueUnidadeChips } from '@/components/estoque/visao-geral/EstoqueUnidadeChips';
import { EstoqueFilterPanel } from '@/components/estoque/visao-geral/EstoqueFilterPanel';
import { EstoqueActiveFilters } from '@/components/estoque/visao-geral/EstoqueActiveFilters';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const FATOR_NOTA_BAIXA = 3.5;
const FATOR_TOOLTIP =
  'Valor bruto do ERP multiplicado por 3,5 para compensar a prática de nota baixa do cliente. Aplica-se somente a esta tela.';

function FatorBadge({ className }: { className?: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className={cn('gap-1 font-medium cursor-help', className)}>
            <Info className="h-3 w-3" />
            ×3,5
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {FATOR_TOOLTIP}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function useDebounce<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

type SortKey = 'valor_total' | 'unidades_total' | 'skus_ativos' | 'skus_negativos' | 'abrev_par';

const COLUMNS: { key: SortKey; label: string; align?: 'right' | 'left' | 'center' }[] = [
  { key: 'abrev_par', label: 'Filial', align: 'left' },
  { key: 'valor_total', label: 'Valor em estoque', align: 'right' },
  { key: 'unidades_total', label: 'Unidades', align: 'right' },
  { key: 'skus_ativos', label: 'SKUs ativos', align: 'right' },
  { key: 'skus_negativos', label: 'Negativos', align: 'right' },
];

export default function EstoqueValoresPorFilial() {
  const [filtrosBase, setFiltrosBase] = useState<EstoqueFiltros>(FILTROS_INICIAIS);
  const [buscaTxt, setBuscaTxt] = useState('');
  const buscaDebounced = useDebounce(buscaTxt, 300);
  const [sortBy, setSortBy] = useState<SortKey>('valor_total');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filtros: EstoqueFiltros = useMemo(
    () => ({ ...filtrosBase, busca: buscaDebounced }),
    [filtrosBase, buscaDebounced],
  );

  const { data: rowsRaw, isLoading } = useEstoqueValoresPorFilial(filtros);

  const rows = useMemo(
    () =>
      (rowsRaw ?? []).map((r) => ({
        ...r,
        valor_total: r.valor_total * FATOR_NOTA_BAIXA,
      })),
    [rowsRaw],
  );

  const totais = useMemo(() => {
    const list = rows ?? [];
    return {
      valor: list.reduce((a, r) => a + r.valor_total, 0),
      unidades: list.reduce((a, r) => a + r.unidades_total, 0),
      filiais: list.length,
      skusAtivos: list.reduce((a, r) => a + r.skus_ativos, 0),
      negativos: list.reduce((a, r) => a + r.skus_negativos, 0),
      maxValor: Math.max(1, ...list.map((r) => r.valor_total)),
    };
  }, [rows]);

  const sorted = useMemo(() => {
    const list = [...(rows ?? [])];
    list.sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      let cmp: number;
      if (typeof av === 'string' || typeof bv === 'string') {
        cmp = String(av).localeCompare(String(bv));
      } else {
        cmp = (av as number) - (bv as number);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [rows, sortBy, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setSortDir(key === 'abrev_par' ? 'asc' : 'desc');
    }
  };

  const share = (v: number) => (totais.valor > 0 ? (v / totais.valor) * 100 : 0);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              Valores de Estoque por Filial
            </h1>
            <p className="text-sm text-muted-foreground">
              Valor financeiro e cobertura de estoque consolidados por filial (dados do ERP).
            </p>
          </div>
          <EstoqueFilterPanel filtros={filtrosBase} setFiltros={setFiltrosBase} showValidade={false} />
        </div>

        {/* KPIs consolidados */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <KpiCard
            title="Valor total em estoque"
            value={formatCurrency(totais.valor)}
            subtitle={`${totais.filiais} filial(is)`}
            icon={DollarSign}
            variant="info"
            loading={isLoading}
          />
          <KpiCard
            title="Unidades"
            value={totais.unidades.toLocaleString('pt-BR')}
            icon={Boxes}
            variant="default"
            loading={isLoading}
          />
          <KpiCard
            title="Filiais"
            value={totais.filiais.toLocaleString('pt-BR')}
            icon={Building2}
            variant="accent"
            loading={isLoading}
          />
          <KpiCard
            title="SKUs ativos"
            value={totais.skusAtivos.toLocaleString('pt-BR')}
            icon={PackageCheck}
            variant="success"
            loading={isLoading}
          />
          <KpiCard
            title="SKUs negativos"
            value={totais.negativos.toLocaleString('pt-BR')}
            icon={PackageX}
            variant={totais.negativos > 0 ? 'destructive' : 'default'}
            loading={isLoading}
          />
        </div>

        {/* Filtros */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={buscaTxt}
                onChange={(e) => setBuscaTxt(e.target.value)}
                placeholder="Buscar por produto, código ERP ou fabricante..."
                className="pl-9 h-9"
              />
            </div>
            <EstoqueFilialSelect
              selected={filtrosBase.empresa_ids}
              onChange={(v) => setFiltrosBase({ ...filtrosBase, empresa_ids: v })}
            />
            <EstoqueUnidadeChips
              selected={filtrosBase.unidades}
              onChange={(v) => setFiltrosBase({ ...filtrosBase, unidades: v })}
            />
          </div>
          <EstoqueActiveFilters filtros={filtrosBase} setFiltros={setFiltrosBase} />
        </div>

        {/* Ranking visual por valor */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">Ranking por valor em estoque</h2>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : sorted.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum dado de estoque encontrado.</p>
            ) : (
              <div className="space-y-2.5">
                {[...sorted]
                  .sort((a, b) => b.valor_total - a.valor_total)
                  .map((r) => (
                    <div key={r.empresa_par} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate">{r.abrev_par}</span>
                        <span className="tabular-nums font-semibold">
                          {formatCurrency(r.valor_total)}
                          <span className="text-muted-foreground font-normal ml-2">{share(r.valor_total).toFixed(1)}%</span>
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${(r.valor_total / totais.maxValor) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabela detalhada */}
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader className="bg-muted/40">
              <TableRow>
                {COLUMNS.map((c) => (
                  <TableHead
                    key={c.key}
                    onClick={() => handleSort(c.key)}
                    className={cn(
                      'text-xs font-semibold cursor-pointer select-none hover:text-foreground whitespace-nowrap',
                      c.align === 'right' && 'text-right',
                    )}
                  >
                    <span className={cn('inline-flex items-center gap-1', c.align === 'right' && 'flex-row-reverse')}>
                      {c.label}
                      {sortBy === c.key
                        ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
                        : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                    </span>
                  </TableHead>
                ))}
                <TableHead className="text-right text-xs font-semibold whitespace-nowrap">Pendentes</TableHead>
                <TableHead className="text-right text-xs font-semibold whitespace-nowrap">% do total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    Nenhum dado de estoque encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((r: EstoqueFilialRow) => (
                  <TableRow key={r.empresa_par} className="hover:bg-accent/30">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{r.abrev_par}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(r.valor_total)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.unidades_total.toLocaleString('pt-BR')}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.skus_ativos.toLocaleString('pt-BR')}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.skus_negativos > 0 ? (
                        <Badge variant="destructive" className="gap-1 font-normal">
                          <AlertTriangle className="h-3 w-3" />
                          {r.skus_negativos}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {r.pedidos_pendentes_qtd > 0
                        ? <span className="text-primary font-medium">{r.pedidos_pendentes_qtd.toLocaleString('pt-BR')}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                      {share(r.valor_total).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
