import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { EstoqueCorRow, EstoqueCoresSortKey } from '@/hooks/estoque/useEstoqueCoresQuery';
import { EstoqueEtiquetaPopover } from './EstoqueEtiquetaPopover';
import { useEtiquetaProdutosBatch, useEstoqueEtiquetas } from '@/hooks/estoque/useEstoqueEtiquetas';
import { useMemo } from 'react';

interface Props {
  rows: EstoqueCorRow[];
  total: number;
  loading: boolean;
  page: number;
  pageSize: number;
  setPage: (p: number) => void;
  setPageSize: (n: number) => void;
  sortBy: EstoqueCoresSortKey;
  sortDir: 'asc' | 'desc';
  setSort: (k: EstoqueCoresSortKey) => void;
  onRowClick: (r: EstoqueCorRow) => void;
}

interface ColDef {
  key: EstoqueCoresSortKey | string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
}

const COLUMNS: ColDef[] = [
  { key: 'empresa_par', label: 'Empresa', sortable: true },
  { key: 'cod_produto', label: 'Cód.' },
  { key: 'nome_prod', label: 'Produto (cor)', sortable: true },
  { key: 'nome_linha', label: 'Linha' },
  { key: 'campanhas', label: 'Campanhas' },
  { key: 'saldo', label: 'Saldo total', sortable: true, align: 'right' },
  { key: 'saldo_proprio', label: 'Próprio', align: 'right' },
  { key: 'saldo_potencial_desmontagem', label: 'Potencial desm.', sortable: true, align: 'right' },
  { key: 'pedido_pendente', label: 'Pendente', sortable: true, align: 'right' },
  { key: 'estoque_bloqueado_produto', label: 'Bloq. prod.', align: 'right' },
  { key: 'estoque_bloqueado_endereco', label: 'Bloq. ender.', align: 'right' },
  { key: 'estoque_endereco', label: 'Endereço', align: 'right' },
  { key: 'curva_fisica', label: 'Curva F', align: 'center' },
  { key: 'curva_monetaria', label: 'Curva M', align: 'center' },
  { key: 'custo_total', label: 'Custo total', sortable: true, align: 'right' },
];

function fmtN(n: number | null | undefined) {
  if (n == null) return '—';
  const v = Number(n);
  if (!isFinite(v) || v === 0) return v === 0 ? '0' : '—';
  return Math.round(v).toLocaleString('pt-BR');
}

const CURVA_CLASS: Record<string, string> = {
  A: 'bg-success/15 text-success',
  B: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  C: 'bg-warning/15 text-warning',
  D: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  E: 'bg-destructive/15 text-destructive',
};

function Curva({ c }: { c: string | null }) {
  if (!c) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn('inline-block rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold', CURVA_CLASS[c] ?? 'bg-muted')}>
      {c}
    </span>
  );
}

export function EstoqueCoresTable(p: Props) {
  const totalPages = Math.max(1, Math.ceil(p.total / p.pageSize));
  const codProdutos = useMemo(
    () => p.rows.map((r) => r.cod_produto).filter((x): x is number => x != null),
    [p.rows],
  );
  const { data: etiquetasMap } = useEtiquetaProdutosBatch(codProdutos);
  const { data: etiquetas = [] } = useEstoqueEtiquetas(true);
  const etiquetaById = useMemo(() => {
    const m = new Map<string, { nome: string; cor_hex: string }>();
    for (const e of etiquetas) m.set(e.id, { nome: e.nome, cor_hex: e.cor_hex });
    return m;
  }, [etiquetas]);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table className="min-w-[1400px]">
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
                  onClick={() => c.sortable && p.setSort(c.key as EstoqueCoresSortKey)}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    {c.sortable && (
                      p.sortBy === c.key
                        ? (p.sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
                        : <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {p.loading && p.rows.length === 0
              ? Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    {COLUMNS.map((c) => (
                      <TableCell key={c.key}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : p.rows.length === 0
              ? (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length} className="h-32 text-center text-muted-foreground">
                    Nenhuma unidade encontrada.
                  </TableCell>
                </TableRow>
              )
              : p.rows.map((r) => {
                  const tags = (r.cod_produto != null ? etiquetasMap?.get(r.cod_produto) : undefined) ?? [];
                  return (
                    <TableRow key={r.id} onClick={() => p.onRowClick(r)} className="cursor-pointer hover:bg-accent/30">
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="font-normal">{r.abrev_par ?? r.empresa_par}</Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{r.cod_produto}</TableCell>
                      <TableCell className="max-w-[300px]">
                        <div className="text-sm font-medium leading-tight truncate">{r.nome_prod ?? '(sem nome)'}</div>
                        {r.cod_fabricante && (
                          <div className="text-[10px] text-muted-foreground font-mono">{r.cod_fabricante}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[140px]">{r.nome_linha}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                          {tags.slice(0, 3).map((id) => {
                            const e = etiquetaById.get(id);
                            if (!e) return null;
                            return (
                              <span
                                key={id}
                                className="text-[10px] px-1.5 py-0.5 rounded border"
                                style={{ borderColor: e.cor_hex, color: e.cor_hex }}
                              >
                                {e.nome}
                              </span>
                            );
                          })}
                          {r.cod_produto != null && (
                            <EstoqueEtiquetaPopover codProduto={r.cod_produto} asIcon />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{fmtN(r.saldo)}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{fmtN(r.saldo_proprio)}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {Number(r.saldo_potencial_desmontagem ?? 0) > 0
                          ? <span className="text-primary">{fmtN(r.saldo_potencial_desmontagem)}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{fmtN(r.pedido_pendente)}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{fmtN(r.estoque_bloqueado_produto)}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{fmtN(r.estoque_bloqueado_endereco)}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{fmtN(r.estoque_endereco)}</TableCell>
                      <TableCell className="text-center"><Curva c={r.curva_fisica} /></TableCell>
                      <TableCell className="text-center"><Curva c={r.curva_monetaria} /></TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{formatCurrency(Number(r.custo_total ?? 0))}</TableCell>
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="text-xs text-muted-foreground">
          Página {p.page + 1} de {totalPages} · {p.total.toLocaleString('pt-BR')} unidades
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={p.pageSize}
            onChange={(e) => { p.setPageSize(Number(e.target.value)); p.setPage(0); }}
          >
            {[50, 100, 200].map((n) => <option key={n} value={n}>{n}/pág</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={() => p.setPage(Math.max(0, p.page - 1))} disabled={p.page === 0}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => p.setPage(Math.min(totalPages - 1, p.page + 1))} disabled={p.page >= totalPages - 1}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
