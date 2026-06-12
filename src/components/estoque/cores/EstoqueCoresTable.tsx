import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as ChevronRightSmall,
  Layers,
} from 'lucide-react';
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

function fmtN(n: number | null | undefined) {
  if (n == null) return '—';
  const v = Number(n);
  if (!isFinite(v)) return '—';
  if (v === 0) return '0';
  return Math.round(v).toLocaleString('pt-BR');
}

const CURVA_CLASS: Record<string, string> = {
  A: 'bg-success/15 text-success',
  B: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  C: 'bg-warning/15 text-warning',
  D: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  E: 'bg-destructive/15 text-destructive',
};

function Curva({ c, label }: { c: string | null; label: string }) {
  if (!c) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold',
        CURVA_CLASS[c] ?? 'bg-muted',
      )}
      title={`${label}: ${c}`}
    >
      <span className="opacity-70">{label}</span>
      {c}
    </span>
  );
}

function hasMemory(row: AnyRow): boolean {
  if ('por_empresa' in row) {
    return (
      Number(row.saldo_potencial_desmontagem ?? 0) > 0 ||
      (row.por_empresa ?? []).some((e) => (e.detalhe_desmontagem ?? []).length > 0)
    );
  }
  return Boolean(row.tem_composicao_pai) && Number(row.saldo_potencial_desmontagem ?? 0) > 0;
}

interface SortOpt {
  key: AnySortKey;
  label: string;
}
const SORT_OPTS_POR_EMPRESA: SortOpt[] = [
  { key: 'empresa_par', label: 'Empresa' },
  { key: 'nome_prod', label: 'Produto' },
  { key: 'saldo_total_disponivel', label: 'Total disponível' },
  { key: 'saldo_potencial_desmontagem', label: 'Potencial desm.' },
  { key: 'pedido_pendente', label: 'Pendente' },
];
const SORT_OPTS_CONSOLIDADO: SortOpt[] = [
  { key: 'nome_prod', label: 'Produto' },
  { key: 'saldo_total_disponivel', label: 'Total disponível' },
  { key: 'saldo_potencial_desmontagem', label: 'Potencial desm.' },
  { key: 'pedido_pendente', label: 'Pendente' },
];

export function EstoqueCoresTable(p: Props) {
  const totalPages = Math.max(1, Math.ceil(p.total / p.pageSize));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const sortOpts = p.variant === 'consolidado' ? SORT_OPTS_CONSOLIDADO : SORT_OPTS_POR_EMPRESA;

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

  const rowKey = (r: AnyRow): string => ('id' in r ? r.id : `c-${r.cod_produto}`);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const onSortChange = (val: string) => {
    (p as any).setSort(val as AnySortKey);
  };

  return (
    <div className="space-y-3">
      {/* Toolbar de ordenação compacta */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Ordenar por</span>
          <select
            className="h-7 rounded-md border border-input bg-background px-2 text-xs"
            value={p.sortBy}
            onChange={(e) => onSortChange(e.target.value)}
          >
            {sortOpts.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-input bg-background h-7 px-2 hover:bg-accent"
            onClick={() => onSortChange(p.sortBy)}
            title="Inverter direção"
          >
            {p.sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            <span className="text-[11px]">{p.sortDir === 'asc' ? 'Crescente' : 'Decrescente'}</span>
          </button>
        </div>
        <div className="text-[11px] text-muted-foreground">
          {p.total.toLocaleString('pt-BR')} {p.variant === 'consolidado' ? 'produtos' : 'unidades'}
        </div>
      </div>

      {/* Listbox */}
      <div
        role="listbox"
        aria-label="Estoque por cor"
        className="rounded-lg border bg-card divide-y overflow-hidden"
      >
        {p.loading && p.rows.length === 0 ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="p-3">
              <Skeleton className="h-10 w-full" />
            </div>
          ))
        ) : p.rows.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
            Nenhuma unidade encontrada.
          </div>
        ) : (
          p.rows.map((r) => {
            const key = rowKey(r);
            const isOpen = expanded.has(key);
            const memo = hasMemory(r);
            const codProduto = (r as any).cod_produto as number | null;
            const tags = (codProduto != null ? etiquetasMap?.get(codProduto) : undefined) ?? [];

            return (
              <div key={key}>
                <ListItem
                  row={r}
                  isOpen={isOpen}
                  memo={memo}
                  onToggle={() => memo && toggle(key)}
                  onSelect={
                    p.variant === 'por-empresa'
                      ? () => (p as PorEmpresaProps).onRowClick(r as EstoqueCorRow)
                      : undefined
                  }
                  variant={p.variant}
                  tags={tags as string[]}
                  etiquetaById={etiquetaById}
                />
                {isOpen && memo && (
                  <div className="bg-muted/20 border-t px-4 py-3">
                    <ExpandedMemory row={r} variant={p.variant} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Paginação */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="text-xs text-muted-foreground">
          Página {p.page + 1} de {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={p.pageSize}
            onChange={(e) => {
              p.setPageSize(Number(e.target.value));
              p.setPage(0);
            }}
          >
            {[50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {n}/pág
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => p.setPage(Math.max(0, p.page - 1))}
            disabled={p.page === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => p.setPage(Math.min(totalPages - 1, p.page + 1))}
            disabled={p.page >= totalPages - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ListItemProps {
  row: AnyRow;
  isOpen: boolean;
  memo: boolean;
  onToggle: () => void;
  onSelect?: () => void;
  variant: 'por-empresa' | 'consolidado';
  tags: string[];
  etiquetaById: Map<string, { nome: string; cor_hex: string }>;
}

function ListItem({ row, isOpen, memo, onToggle, onSelect, variant, tags, etiquetaById }: ListItemProps) {
  const r = row as any;
  const isCons = variant === 'consolidado';
  const codProduto = r.cod_produto as number | null;
  const total = Number(r.saldo_total_disponivel ?? r.saldo ?? 0);
  const proprio = Number(r.saldo_proprio ?? 0);
  const potencial = Number(r.saldo_potencial_desmontagem ?? 0);
  const pendente = Number(r.pedido_pendente ?? 0);

  return (
    <div
      role="option"
      aria-selected={false}
      className={cn(
        'group flex items-stretch gap-2 px-3 py-2 hover:bg-accent/40 transition-colors',
        onSelect && 'cursor-pointer',
      )}
      onClick={onSelect}
    >
      {/* Expand */}
      <div className="flex items-start pt-1.5">
        {memo ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            title={isOpen ? 'Ocultar memória de cálculo' : 'Ver memória de cálculo'}
          >
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRightSmall className="h-3.5 w-3.5" />
            )}
          </Button>
        ) : (
          <div className="w-6" />
        )}
      </div>

      {/* Identificação */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {isCons ? (
            <Badge variant="outline" className="font-normal text-[10px] h-5">
              {r.qtd_empresas ?? 0} {Number(r.qtd_empresas ?? 0) === 1 ? 'filial' : 'filiais'}
            </Badge>
          ) : (
            <Badge variant="outline" className="font-normal text-[10px] h-5">
              {r.abrev_par ?? r.empresa_par}
            </Badge>
          )}
          <span className="font-mono text-[11px] text-muted-foreground">{r.cod_produto}</span>
          <span className="text-sm font-medium truncate">{r.nome_prod ?? '(sem nome)'}</span>
          {r.cod_fabricante && (
            <span className="text-[10px] text-muted-foreground font-mono">· {r.cod_fabricante}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
          {r.nome_linha && (
            <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">{r.nome_linha}</span>
          )}
          <Curva c={r.curva_fisica} label="F" />
          <Curva c={r.curva_monetaria} label="M" />
          <div
            className="flex items-center gap-1 flex-wrap"
            onClick={(e) => e.stopPropagation()}
          >
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
            {codProduto != null && <EstoqueEtiquetaPopover codProduto={codProduto} asIcon />}
          </div>
        </div>
      </div>

      {/* Quantidades */}
      <div className="flex items-center gap-4 shrink-0 pl-2 text-right">
        <Metric label="Próprio" value={fmtN(proprio)} />
        <Metric
          label="Potencial"
          value={fmtN(potencial)}
          icon={potencial > 0 ? <Layers className="h-3 w-3" /> : null}
          accent={potencial > 0}
          onClick={
            potencial > 0
              ? (e) => {
                  e.stopPropagation();
                  onToggle();
                }
              : undefined
          }
        />
        <Metric label="Pendente" value={fmtN(pendente)} muted />
        <div className="text-right min-w-[80px]">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</div>
          <div className="text-base font-semibold tabular-nums leading-tight">{fmtN(total)}</div>
        </div>
      </div>

      {/* Memória expandida (rendered abaixo via overlay vertical) */}
      {isOpen && memo && (
        <div className="hidden" aria-hidden />
      )}
      {/* nota: a memória abre logo abaixo do item; ver wrapper */}
    </div>
  );
}

function Metric({
  label,
  value,
  muted,
  accent,
  icon,
  onClick,
}: {
  label: string;
  value: string;
  muted?: boolean;
  accent?: boolean;
  icon?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="text-right min-w-[72px]">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className={cn(
            'inline-flex items-center gap-1 text-sm tabular-nums leading-tight',
            accent ? 'text-primary hover:underline font-medium' : 'text-foreground',
            muted && 'text-muted-foreground',
          )}
        >
          {icon}
          {value}
        </button>
      ) : (
        <div
          className={cn(
            'text-sm tabular-nums leading-tight',
            muted && 'text-muted-foreground',
            accent && 'text-primary font-medium',
          )}
        >
          {value}
        </div>
      )}
    </div>
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
