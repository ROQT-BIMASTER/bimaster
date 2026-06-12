import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightSmall, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EstoqueCorRow, EstoqueCoresSortKey } from '@/hooks/estoque/useEstoqueCoresQuery';
import type {
  EstoqueCorConsolidadoRow,
  EstoqueCoresConsolidadoSortKey,
  DetalheDesmontagemItem,
} from '@/hooks/estoque/useEstoqueCoresConsolidadoQuery';
import { EstoqueEtiquetaPopover } from './EstoqueEtiquetaPopover';
import { useEtiquetaProdutosBatch, useEstoqueEtiquetas } from '@/hooks/estoque/useEstoqueEtiquetas';
import { useMemo, useState } from 'react';
import { EstoqueCoresMemoryBlock } from './EstoqueCoresMemoryBlock';
import { DivergenciaLinhaBadge } from './DivergenciaLinhaBadge';

type AnyRow = EstoqueCorRow | EstoqueCorConsolidadoRow;
type AnySortKey = EstoqueCoresSortKey | EstoqueCoresConsolidadoSortKey;

interface BaseProps {
  total: number;
  loading: boolean;
  page: number;
  pageSize: number;
  setPage: (p: number) => void;
  setPageSize: (n: number) => void;
  sortDir: 'asc' | 'desc';
}

interface PorEmpresaProps extends BaseProps {
  variant: 'por-empresa';
  rows: EstoqueCorRow[];
  sortBy: EstoqueCoresSortKey;
  setSort: (k: EstoqueCoresSortKey) => void;
  onRowClick: (r: EstoqueCorRow) => void;
}

interface ConsolidadoProps extends BaseProps {
  variant: 'consolidado';
  rows: EstoqueCorConsolidadoRow[];
  sortBy: EstoqueCoresConsolidadoSortKey;
  setSort: (k: EstoqueCoresConsolidadoSortKey) => void;
}

type Props = PorEmpresaProps | ConsolidadoProps;

interface ColDef {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  title?: string;
}

const COLUMNS_POR_EMPRESA: ColDef[] = [
  { key: '__exp', label: '' },
  { key: 'empresa_par', label: 'Empresa', sortable: true },
  { key: 'cod_produto', label: 'Cód.' },
  { key: 'nome_prod', label: 'Produto (cor)', sortable: true },
  { key: 'nome_linha', label: 'Linha' },
  { key: 'campanhas', label: 'Campanhas' },
  { key: 'saldo_total_disponivel', label: 'Total (próprio+pot.)', sortable: true, align: 'right' },
  { key: 'saldo_proprio', label: 'Próprio', align: 'right' },
  { key: 'saldo_potencial_desmontagem', label: 'Potencial desm.', sortable: true, align: 'right' },
  { key: 'pedido_pendente', label: 'Pendente', sortable: true, align: 'right' },
  { key: 'estoque_bloqueado_produto', label: 'Bloq. prod.', align: 'right' },
  { key: 'estoque_bloqueado_endereco', label: 'Bloq. ender.', align: 'right' },
  { key: 'estoque_endereco', label: 'Endereço', align: 'right' },
  { key: 'curva_fisica', label: 'Curva F', align: 'center' },
  { key: 'curva_monetaria', label: 'Curva M', align: 'center' },
];

const COLUMNS_CONSOLIDADO: ColDef[] = [
  { key: '__exp', label: '' },
  { key: 'filiais', label: 'Filiais' },
  { key: 'cod_produto', label: 'Cód.' },
  { key: 'nome_prod', label: 'Produto (cor)', sortable: true },
  { key: 'nome_linha', label: 'Linha' },
  { key: 'campanhas', label: 'Campanhas' },
  { key: 'saldo_total_disponivel', label: 'Total (próprio+pot.)', sortable: true, align: 'right' },
  { key: 'saldo_proprio', label: 'Próprio', align: 'right' },
  { key: 'saldo_potencial_desmontagem', label: 'Potencial desm.', sortable: true, align: 'right' },
  { key: 'pedido_pendente', label: 'Pendente', sortable: true, align: 'right' },
  { key: 'estoque_bloqueado_produto', label: 'Bloq. prod.', align: 'right' },
  { key: 'estoque_bloqueado_endereco', label: 'Bloq. ender.', align: 'right' },
  { key: 'estoque_endereco', label: 'Endereço', align: 'right' },
  { key: 'curva_fisica', label: 'Curva F', align: 'center' },
  { key: 'curva_monetaria', label: 'Curva M', align: 'center' },
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

function hasMemory(row: AnyRow): boolean {
  if ('por_empresa' in row) {
    return Number(row.saldo_potencial_desmontagem ?? 0) > 0 || (row.por_empresa ?? []).some(e => (e.detalhe_desmontagem ?? []).length > 0);
  }
  return Boolean(row.tem_composicao_pai) && Number(row.saldo_potencial_desmontagem ?? 0) > 0;
}

export function EstoqueCoresTable(p: Props) {
  const totalPages = Math.max(1, Math.ceil(p.total / p.pageSize));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const cols = p.variant === 'consolidado' ? COLUMNS_CONSOLIDADO : COLUMNS_POR_EMPRESA;
  const colSpan = cols.length;

  const codProdutos = useMemo(
    () => p.rows.map((r: any) => r.cod_produto).filter((x): x is number => x != null),
    [p.rows],
  );
  const { data: etiquetasMap } = useEtiquetaProdutosBatch(codProdutos);
  const { data: etiquetas = [] } = useEstoqueEtiquetas(true);
  const etiquetaById = useMemo(() => {
    const m = new Map<string, { nome: string; cor_hex: string }>();
    for (const e of etiquetas) m.set(e.id, { nome: e.nome, cor_hex: e.cor_hex });
    return m;
  }, [etiquetas]);

  const rowKey = (r: AnyRow): string => {
    if ('id' in r) return r.id;
    return `c-${r.cod_produto}`;
  };

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderHeader = (c: ColDef) => {
    const sortableKey = c.sortable ? (c.key as AnySortKey) : null;
    const isActive = sortableKey && p.sortBy === sortableKey;
    return (
      <TableHead
        key={c.key}
        className={cn(
          'whitespace-nowrap text-xs font-semibold',
          c.align === 'right' && 'text-right',
          c.align === 'center' && 'text-center',
          c.sortable && 'cursor-pointer select-none hover:text-foreground',
          c.key === '__exp' && 'w-8',
        )}
        onClick={() => sortableKey && (p as any).setSort(sortableKey)}
      >
        <span className="inline-flex items-center gap-1">
          {c.label}
          {c.sortable && (
            isActive
              ? (p.sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
              : <ArrowUpDown className="h-3 w-3 opacity-30" />
          )}
        </span>
      </TableHead>
    );
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table className="min-w-[1400px]">
          <TableHeader className="bg-muted/40">
            <TableRow>{cols.map(renderHeader)}</TableRow>
          </TableHeader>
          <TableBody>
            {p.loading && p.rows.length === 0 ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  {cols.map((c) => (
                    <TableCell key={c.key}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : p.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="h-32 text-center text-muted-foreground">
                  Nenhuma unidade encontrada.
                </TableCell>
              </TableRow>
            ) : (
              p.rows.map((r) => {
                const key = rowKey(r);
                const isOpen = expanded.has(key);
                const memo = hasMemory(r);
                const codProduto = (r as any).cod_produto as number | null;
                const tags = (codProduto != null ? etiquetasMap?.get(codProduto) : undefined) ?? [];

                return (
                  <RowGroup
                    key={key}
                    rowKey={key}
                    row={r}
                    cols={cols}
                    isOpen={isOpen}
                    memo={memo}
                    onToggle={() => memo && toggle(key)}
                    onMainClick={
                      p.variant === 'por-empresa'
                        ? () => (p as PorEmpresaProps).onRowClick(r as EstoqueCorRow)
                        : undefined
                    }
                    variant={p.variant}
                    tags={tags as string[]}
                    etiquetaById={etiquetaById}
                  />
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="text-xs text-muted-foreground">
          Página {p.page + 1} de {totalPages} · {p.total.toLocaleString('pt-BR')}{' '}
          {p.variant === 'consolidado' ? 'produtos' : 'unidades'}
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

interface RowGroupProps {
  rowKey: string;
  row: AnyRow;
  cols: ColDef[];
  isOpen: boolean;
  memo: boolean;
  onToggle: () => void;
  onMainClick?: () => void;
  variant: 'por-empresa' | 'consolidado';
  tags: string[];
  etiquetaById: Map<string, { nome: string; cor_hex: string }>;
}

function RowGroup({ rowKey, row, cols, isOpen, memo, onToggle, onMainClick, variant, tags, etiquetaById }: RowGroupProps) {
  const codProduto = (row as any).cod_produto as number | null;
  const isCons = variant === 'consolidado';
  const r = row as any;

  return (
    <>
      <TableRow
        className={cn('hover:bg-accent/30', onMainClick && 'cursor-pointer')}
        onClick={() => { if (onMainClick) onMainClick(); }}
      >
        <TableCell className="w-8 p-1">
          {memo ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              title={isOpen ? 'Ocultar memória de cálculo' : 'Ver memória de cálculo'}
            >
              {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRightSmall className="h-3.5 w-3.5" />}
            </Button>
          ) : null}
        </TableCell>

        {isCons ? (
          <TableCell className="text-xs">
            <Badge variant="outline" className="font-normal">
              {(r.qtd_empresas ?? 0)} {Number(r.qtd_empresas ?? 0) === 1 ? 'filial' : 'filiais'}
            </Badge>
          </TableCell>
        ) : (
          <TableCell className="text-xs">
            <Badge variant="outline" className="font-normal">{r.abrev_par ?? r.empresa_par}</Badge>
          </TableCell>
        )}

        <TableCell className="text-xs font-mono">{r.cod_produto}</TableCell>
        <TableCell className="max-w-[320px]">
          <div className="flex items-center gap-1.5">
            <div className="text-sm font-medium leading-tight truncate">{r.nome_prod ?? '(sem nome)'}</div>
            <DivergenciaLinhaBadge linhas={r.linhas_divergentes} compact />
          </div>
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
                  className="inline-flex items-center px-1.5 h-4 rounded text-[9px] font-semibold tracking-wide uppercase"
                  style={{ background: e.cor_hex, color: '#fff' }}
                  title={e.nome}
                >
                  {e.nome}
                </span>
              );
            })}
            {codProduto != null && (
              <EstoqueEtiquetaPopover codProduto={codProduto} asIcon />
            )}
          </div>
        </TableCell>
        <TableCell className="text-right tabular-nums font-semibold">{fmtN(r.saldo_total_disponivel ?? r.saldo)}</TableCell>
        <TableCell className="text-right text-xs tabular-nums">{fmtN(r.saldo_proprio)}</TableCell>
        <TableCell className="text-right text-xs tabular-nums">
          {Number(r.saldo_potencial_desmontagem ?? 0) > 0 ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-primary hover:underline"
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              title="Ver memória de cálculo"
            >
              <Layers className="h-3 w-3" />
              {fmtN(r.saldo_potencial_desmontagem)}
            </button>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="text-right text-xs tabular-nums">{fmtN(r.pedido_pendente)}</TableCell>
        <TableCell className="text-right text-xs tabular-nums">{fmtN(r.estoque_bloqueado_produto)}</TableCell>
        <TableCell className="text-right text-xs tabular-nums">{fmtN(r.estoque_bloqueado_endereco)}</TableCell>
        <TableCell className="text-right text-xs tabular-nums">{fmtN(r.estoque_endereco)}</TableCell>
        <TableCell className="text-center"><Curva c={r.curva_fisica} /></TableCell>
        <TableCell className="text-center"><Curva c={r.curva_monetaria} /></TableCell>
      </TableRow>

      {isOpen && memo && (
        <TableRow className="bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={cols.length} className="p-4">
            <ExpandedMemory row={row} variant={variant} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function ExpandedMemory({ row, variant }: { row: AnyRow; variant: 'por-empresa' | 'consolidado' }) {
  if (variant === 'consolidado') {
    const r = row as EstoqueCorConsolidadoRow;
    const empresas = r.por_empresa ?? [];
    return (
      <div className="space-y-4 max-w-5xl">
        <div className="text-[11px] text-muted-foreground">
          Detalhamento por filial e memória de cálculo da explosão. Confira contra o ERP por filial.
        </div>
        {empresas.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Sem detalhamento por filial.</p>
        ) : (
          empresas.map((e) => (
            <div key={e.empresa_par} className="rounded border bg-background p-3">
              <EstoqueCoresMemoryBlock
                empresa={{ empresa_par: e.empresa_par, abrev_par: e.abrev_par }}
                saldoProprio={Number(e.saldo_proprio ?? 0)}
                saldoPotencial={Number(e.saldo_potencial_desmontagem ?? 0)}
                detalhe={e.detalhe_desmontagem as DetalheDesmontagemItem[] | null}
                unidade={r.unidade_medida}
                compact
              />
            </div>
          ))
        )}
      </div>
    );
  }
  const r = row as EstoqueCorRow;
  return (
    <div className="max-w-3xl">
      <EstoqueCoresMemoryBlock
        saldoProprio={Number(r.saldo_proprio ?? 0)}
        saldoPotencial={Number(r.saldo_potencial_desmontagem ?? 0)}
        detalhe={r.detalhe_desmontagem as DetalheDesmontagemItem[] | null}
        unidade={r.unidade_medida}
      />
    </div>
  );
}
