import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { classificarFaixa, FAIXA_BADGE, FAIXA_LABELS, diasDesde } from '@/lib/estoque/estoqueFilters';
import { formatUnidadeMedida, siglaUnidadeMedida } from '@/lib/estoque/unidadeMedida';
import type { EstoqueRow, EstoqueSortKey } from '@/hooks/estoque/useEstoqueQuery';
import { cn } from '@/lib/utils';

interface Props {
  rows: EstoqueRow[];
  total: number;
  loading: boolean;
  page: number;
  pageSize: number;
  setPage: (p: number) => void;
  setPageSize: (n: number) => void;
  sortBy: EstoqueSortKey;
  sortDir: 'asc' | 'desc';
  setSort: (k: EstoqueSortKey) => void;
  onRowClick: (r: EstoqueRow) => void;
}

interface ColDef {
  key: EstoqueSortKey | string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

const CURVA_CLASS: Record<string, string> = {
  A: 'bg-success/15 text-success border-success/30',
  B: 'bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400',
  C: 'bg-warning/15 text-warning border-warning/30',
  D: 'bg-orange-500/15 text-orange-600 border-orange-500/30 dark:text-orange-400',
  E: 'bg-destructive/15 text-destructive border-destructive/30',
};

function CurvaBadge({ c }: { c: string | null }) {
  if (!c) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        'inline-block rounded border px-1.5 py-0.5 text-[10px] font-mono font-semibold',
        CURVA_CLASS[c] ?? 'bg-muted text-muted-foreground border-border',
      )}
    >
      {c}
    </span>
  );
}

const COLUMNS: ColDef[] = [
  { key: 'empresa_par', label: 'Empresa', sortable: true },
  { key: 'cod_produto', label: 'Cód. ERP', sortable: false },
  { key: 'nome_prod', label: 'Produto', sortable: true },
  { key: 'nome_linha', label: 'Linha' },
  { key: 'unidade_medida', label: 'UM', align: 'center' },
  { key: 'saldo', label: 'Saldo', sortable: true, align: 'right' },
  { key: 'pedido_pendente', label: 'Pendente', sortable: true, align: 'right' },
  { key: 'custo_unitario', label: 'Custo unit.', sortable: true, align: 'right' },
  { key: 'custo_total', label: 'Custo total', sortable: true, align: 'right' },
  { key: 'curva_fisica', label: 'Curva F', sortable: true, align: 'center' },
  { key: 'curva_monetaria', label: 'Curva M', sortable: true, align: 'center' },
  { key: 'data_ultima_compra', label: 'Últ. compra', sortable: true, align: 'right' },
];

export function EstoqueTable({
  rows, total, loading, page, pageSize, setPage, setPageSize,
  sortBy, sortDir, setSort, onRowClick,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table className="min-w-[1080px]">
          <TableHeader className="bg-muted/40">
            <TableRow>
              {COLUMNS.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn(
                    'whitespace-nowrap text-xs font-semibold',
                    c.align === 'right' && 'text-right',
                    c.align === 'center' && 'text-center',
                    c.sortable && 'cursor-pointer select-none hover:text-foreground',
                  )}
                  onClick={() => c.sortable && setSort(c.key as EstoqueSortKey)}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    {c.sortable && (
                      sortBy === c.key
                        ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
                        : <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  {COLUMNS.map((c) => (
                    <TableCell key={c.key}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNS.length} className="h-32 text-center text-muted-foreground">
                  Nenhum registro encontrado com os filtros aplicados.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const saldo = Number(r.saldo ?? 0);
                const faixa = classificarFaixa(saldo);
                const dias = diasDesde(r.data_ultima_compra);
                return (
                  <TableRow
                    key={r.id}
                    onClick={() => onRowClick(r)}
                    className="cursor-pointer hover:bg-accent/30"
                  >
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="font-normal">{r.abrev_par ?? r.empresa_par}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{r.cod_produto}</TableCell>
                    <TableCell className="max-w-[320px]">
                      <div className="text-sm font-medium leading-tight truncate">{r.nome_prod}</div>
                      {r.cod_fabricante && (
                        <div className="text-[10px] text-muted-foreground font-mono">{r.cod_fabricante}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[160px]">{r.nome_linha}</TableCell>
                    <TableCell className="text-xs text-center font-mono" title={formatUnidadeMedida(r.unidade_medida)}>{siglaUnidadeMedida(r.unidade_medida) ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <span className="font-semibold tabular-nums">
                          {saldo.toLocaleString('pt-BR')}
                        </span>
                        <span className={cn('text-[9px] px-1.5 py-0.5 rounded', FAIXA_BADGE[faixa])}>
                          {FAIXA_LABELS[faixa]}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {Number(r.pedido_pendente ?? 0) > 0 ? (
                        <span className="text-primary font-medium">{Number(r.pedido_pendente).toLocaleString('pt-BR')}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {formatCurrency(Number(r.custo_unitario ?? 0))}
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium tabular-nums">
                      {formatCurrency(Number(r.custo_total ?? 0))}
                    </TableCell>
                    <TableCell className="text-center">
                      <CurvaBadge c={r.curva_fisica} />
                    </TableCell>
                    <TableCell className="text-center">
                      <CurvaBadge c={r.curva_monetaria} />
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {dias != null ? `há ${dias}d` : '—'}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="text-xs text-muted-foreground">
          Página {page + 1} de {totalPages} · {total.toLocaleString('pt-BR')} registros
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
          >
            {[50, 100, 200].map(n => <option key={n} value={n}>{n}/pág</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
