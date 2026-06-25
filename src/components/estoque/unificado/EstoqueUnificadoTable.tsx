import { Fragment, useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Barcode, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, Info } from 'lucide-react';

import type { EstoqueUnificadoRow } from '@/hooks/estoque/useEstoqueUnificado';
import { converterParaModo, disponivelEmCaixas, formatCx, MODO_COL_LABEL, type ModoExibicao } from '@/lib/estoque/modoExibicao';
import { EstoqueUnificadoSkuBreakdown } from './EstoqueUnificadoSkuBreakdown';
import { resumirValidacao, useEstoqueValidacaoErp, type ValidacaoErpRow } from '@/hooks/estoque/useEstoqueValidacaoErp';
import {
  BACKEND_SORT_KEYS,
  type EstoqueUnifColId,
} from '@/hooks/estoque/useEstoqueUnificadoTablePrefs';
import { useEtiquetaProdutosBatch, useEstoqueEtiquetas } from '@/hooks/estoque/useEstoqueEtiquetas';

interface Props {
  rows: EstoqueUnificadoRow[];
  total: number;
  loading?: boolean;
  page: number;
  pageSize: number;
  sortBy: EstoqueUnifColId;
  sortDir: 'asc' | 'desc';
  setPage: (n: number) => void;
  setSort: (key: EstoqueUnifColId) => void;
  isHidden: (id: EstoqueUnifColId) => boolean;
  onRowClick: (r: EstoqueUnificadoRow) => void;
  modo?: ModoExibicao;
  consolidado?: boolean;
  /** Mapa opcional produto_raiz (string) → soma de fornecedor_caixas. */
  fornecedorCxByRaiz?: Map<string, number>;
}

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : Math.round(Number(n)).toLocaleString('pt-BR');

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ArrowUpDown className="ml-1 h-3 w-3 inline opacity-40" />;
  return dir === 'asc' ? <ArrowUp className="ml-1 h-3 w-3 inline" /> : <ArrowDown className="ml-1 h-3 w-3 inline" />;
}

// Acessores para sort client-side em colunas não suportadas pelo backend.
function clientSortValue(r: EstoqueUnificadoRow, id: EstoqueUnifColId): string | number {
  switch (id) {
    case 'empresa':
      return r.filial_nome ?? r.raiz_abrev ?? `Empresa ${r.empresa}`;
    case 'produto_raiz':
      return r.raiz_nome ?? r.produto_raiz ?? '';
    case 'ean_raiz':
      return r.ean_raiz ?? '';
    case 'bloqueado_total_em_unidades':
      return Number(r.bloqueado_total_em_unidades ?? 0);
    case 'disponivel_total_em_unidades':
      return Number(r.disponivel_total_em_unidades ?? 0);
    case 'pendente_total_em_unidades':
      return Number(r.pendente_total_em_unidades ?? 0);
    case 'em_cx': {
      const cx = disponivelEmCaixas(r);
      return cx == null ? -Infinity : Number(cx);
    }
    case 'skus_envolvidos':
      return Number(r.skus_envolvidos ?? 0);
    default:
      return 0;
  }
}

export function EstoqueUnificadoTable(p: Props) {
  const totalPages = Math.max(1, Math.ceil(p.total / p.pageSize));
  const modo: ModoExibicao = p.modo ?? 'fisico';
  const isFisico = modo === 'fisico';
  const consolidado = !!p.consolidado;
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Validação cache vs ERP — só roda em modo consolidado, para os SKUs visíveis.
  const raizesVisiveis = useMemo(
    () => (consolidado ? p.rows.map((r) => r.produto_raiz) : []),
    [consolidado, p.rows],
  );
  const { data: validacaoMap } = useEstoqueValidacaoErp(raizesVisiveis, undefined, consolidado);

  // Sort client-side se a coluna não for suportada pelo backend.
  const displayRows = useMemo(() => {
    if (BACKEND_SORT_KEYS.has(p.sortBy)) return p.rows;
    const dir = p.sortDir === 'asc' ? 1 : -1;
    const copy = [...p.rows];
    const fornMap = p.fornecedorCxByRaiz;
    copy.sort((a, b) => {
      const get = (r: EstoqueUnificadoRow): string | number => {
        if (p.sortBy === 'fornecedor_cx') {
          const v = fornMap?.get(String(r.produto_raiz));
          return v == null ? -Infinity : Number(v);
        }
        return clientSortValue(r, p.sortBy);
      };
      const va = get(a);
      const vb = get(b);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'pt-BR') * dir;
    });
    return copy;
  }, [p.rows, p.sortBy, p.sortDir, p.fornecedorCxByRaiz]);

  // Etiquetas (Black etc.) aplicadas aos produtos-raiz visíveis.
  const codProdutosVisiveis = useMemo(
    () => displayRows.map((r) => r.produto_raiz).filter((v): v is number => v != null),
    [displayRows],
  );
  const { data: etiquetasMap } = useEtiquetaProdutosBatch(codProdutosVisiveis);
  const { data: etiquetasAtivas = [] } = useEstoqueEtiquetas(true);
  const etiquetaById = useMemo(() => {
    const m = new Map<string, { nome: string; cor_hex: string }>();
    for (const e of etiquetasAtivas) m.set(e.id, { nome: e.nome, cor_hex: e.cor_hex });
    return m;
  }, [etiquetasAtivas]);

  const H = (id: EstoqueUnifColId) => p.sortBy === id;

  // Helper para cabeçalho ordenável
  const SortHead = ({
    id,
    label,
    num,
    extra,
    className,
  }: {
    id: EstoqueUnifColId;
    label: React.ReactNode;
    num?: boolean;
    extra?: React.ReactNode;
    className?: string;
  }) => (
    <TableHead className={`${num ? 'text-right' : ''} ${className ?? ''}`}>
      <button
        onClick={() => p.setSort(id)}
        className="inline-flex items-center gap-1 font-medium hover:text-foreground"
      >
        {label}
        {extra}
        <SortIcon active={H(id)} dir={p.sortDir} />
      </button>
    </TableHead>
  );

  // Contagem dinâmica do colspan (1 chevron + visíveis).
  const visibleCount =
    1 +
    (p.isHidden('empresa') ? 0 : 1) +
    1 + // produto_raiz fixa
    (p.isHidden('ean_raiz') ? 0 : 1) +
    (isFisico
      ? (p.isHidden('saldo_em_caixas') ? 0 : 1) +
        (p.isHidden('saldo_em_displays') ? 0 : 1) +
        (p.isHidden('saldo_em_unidades') ? 0 : 1) +
        (p.isHidden('saldo_total_em_unidades') ? 0 : 1)
      : (p.isHidden('saldo_total_em_unidades') ? 0 : 1)) +
    (p.isHidden('bloqueado_total_em_unidades') ? 0 : 1) +
    (p.isHidden('disponivel_total_em_unidades') ? 0 : 1) +
    (p.isHidden('pendente_total_em_unidades') ? 0 : 1) +
    (p.isHidden('pedidos_count') ? 0 : 1) +
    (p.isHidden('em_cx') ? 0 : 1) +
    (p.isHidden('fornecedor_cx') ? 0 : 1) +
    (p.isHidden('skus_envolvidos') ? 0 : 1);

  return (
    <TooltipProvider delayDuration={150}>
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            {!p.isHidden('empresa') && <SortHead id="empresa" label="Empresa" />}
            <SortHead id="produto_raiz" label="Produto-raiz" />
            {!p.isHidden('ean_raiz') && (
              <SortHead id="ean_raiz" label="EAN raiz" className="hidden md:table-cell" />
            )}
            {isFisico ? (
              <>
                {!p.isHidden('saldo_em_caixas') && <SortHead id="saldo_em_caixas" label="Caixas" num />}
                {!p.isHidden('saldo_em_displays') && <SortHead id="saldo_em_displays" label="Displays" num />}
                {!p.isHidden('saldo_em_unidades') && <SortHead id="saldo_em_unidades" label="Unidades" num />}
                {!p.isHidden('saldo_total_em_unidades') && <SortHead id="saldo_total_em_unidades" label="≡ Total em UN" num />}
              </>
            ) : (
              !p.isHidden('saldo_total_em_unidades') && <SortHead id="saldo_total_em_unidades" label={MODO_COL_LABEL[modo]} num />
            )}
            {!p.isHidden('bloqueado_total_em_unidades') && (
              <SortHead
                id="bloqueado_total_em_unidades"
                label="Bloqueado"
                num
              />
            )}
            {!p.isHidden('disponivel_total_em_unidades') && (
              <TableHead className="text-right">
                <button
                  onClick={() => p.setSort('disponivel_total_em_unidades')}
                  className="inline-flex items-center gap-1 font-medium text-success hover:opacity-80"
                  title="Disponível para venda = Saldo − Bloqueado"
                >
                  Disponível
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-success/70 cursor-help" onClick={(e) => e.stopPropagation()} />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Disponível para venda = Saldo total em UN − Bloqueado (avaria/quarentena/endereço travado). Não abate pedido pendente, pois esse já foi reservado mas ainda não saiu fisicamente.
                    </TooltipContent>
                  </Tooltip>
                  <SortIcon active={H('disponivel_total_em_unidades')} dir={p.sortDir} />
                </button>
              </TableHead>
            )}
            {!p.isHidden('pendente_total_em_unidades') && (
              <TableHead className="text-right">
                <button
                  onClick={() => p.setSort('pendente_total_em_unidades')}
                  className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                  title="Quantidade comprometida em pedidos de venda em aberto, ainda não faturados"
                >
                  Pendente
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" onClick={(e) => e.stopPropagation()} />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Pedidos de venda em aberto (ainda não faturados). Informativo — não abate do Disponível porque o saldo ainda existe fisicamente.
                    </TooltipContent>
                  </Tooltip>
                  <SortIcon active={H('pendente_total_em_unidades')} dir={p.sortDir} />
                </button>
              </TableHead>
            )}
            {!p.isHidden('pedidos_count') && (
              <TableHead className="text-right">
                <button
                  onClick={() => p.setSort('pedidos_count')}
                  className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                >
                  Pedidos
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" onClick={(e) => e.stopPropagation()} />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Quantidade de pedidos em aberto (distintos) que contêm SKUs deste produto-raiz.
                    </TooltipContent>
                  </Tooltip>
                  <SortIcon active={H('pedidos_count')} dir={p.sortDir} />
                </button>
              </TableHead>
            )}
            {!p.isHidden('em_cx') && (
              <TableHead className="text-right">
                <button
                  onClick={() => p.setSort('em_cx')}
                  className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                >
                  ≡ em CX
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" onClick={(e) => e.stopPropagation()} />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Equivalente em caixas máster do <strong>Disponível</strong>: Disponível em UN ÷ fator CX. Pode ser fracionário — base para decisão de compras.
                    </TooltipContent>
                  </Tooltip>
                  <SortIcon active={H('em_cx')} dir={p.sortDir} />
                </button>
              </TableHead>
            )}
            {!p.isHidden('fornecedor_cx') && (
              <TableHead className="text-right">
                <button
                  onClick={() => p.setSort('fornecedor_cx')}
                  className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                >
                  Estoque forn. (CX)
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" onClick={(e) => e.stopPropagation()} />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Soma das caixas em estoque no fornecedor (Futura), agregada por produto-raiz.
                    </TooltipContent>
                  </Tooltip>
                  <SortIcon active={H('fornecedor_cx')} dir={p.sortDir} />
                </button>
              </TableHead>
            )}
            {!p.isHidden('skus_envolvidos') && <SortHead id="skus_envolvidos" label="SKUs" num />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {p.loading && displayRows.length === 0 && (
            <TableRow><TableCell colSpan={visibleCount} className="text-center py-10 text-muted-foreground">Carregando…</TableCell></TableRow>
          )}
          {!p.loading && displayRows.length === 0 && (
            <TableRow><TableCell colSpan={visibleCount} className="text-center py-10 text-muted-foreground">Nenhum produto encontrado.</TableCell></TableRow>
          )}
          {displayRows.map((r) => {
            const conv = isFisico ? null : converterParaModo(r, modo);
            const key = consolidado ? `c-${r.produto_raiz}` : `${r.empresa}-${r.produto_raiz}`;
            const isExpanded = expandedKey === key;
            return (
              <Fragment key={key}>
                <TableRow
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => p.onRowClick(r)}
                  data-state={isExpanded ? 'selected' : undefined}
                  data-produto-raiz={r.produto_raiz}
                  data-marca={r.marca ?? ''}
                  data-linha={r.linha ?? ''}
                  data-empresa={r.empresa}
                  data-filiais-count={r.filiais_count ?? 1}
                >
                  <TableCell
                    className="w-8 p-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedKey(isExpanded ? null : key);
                    }}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      aria-label={isExpanded ? 'Recolher SKUs' : 'Expandir SKUs'}
                      title={isExpanded ? 'Recolher' : consolidado ? 'Ver detalhamento por filial' : 'Ver SKUs e regra de cálculo'}
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </TableCell>
                  {!p.isHidden('empresa') && (
                    <TableCell>
                      {consolidado ? (
                        (() => {
                          const count = r.filiais_count ?? 1;
                          const first = (r.filiais ?? [])[0];
                          const firstLabel =
                            first?.filial_nome ?? first?.abrev ?? r.filial_nome ?? r.raiz_abrev ?? null;
                          const label =
                            count > 1
                              ? `${count} filiais`
                              : firstLabel
                                ? `${firstLabel} · 1 filial`
                                : '1 filial';
                          return (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="secondary" className="cursor-help">
                                  {label}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs text-xs">
                                {(r.filiais ?? [])
                                  .map((f) => f.filial_nome || f.abrev || `Empresa ${f.empresa}`)
                                  .join(' · ')}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })()
                      ) : (
                        <Badge variant="outline">{r.filial_nome ?? r.raiz_abrev ?? `Empresa ${r.empresa}`}</Badge>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium leading-tight truncate">{r.raiz_nome ?? `Produto ${r.produto_raiz}`}</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] text-muted-foreground">Cód. {r.produto_raiz}</span>
                          {(() => {
                            const tagIds = etiquetasMap?.get(r.produto_raiz) ?? [];
                            if (tagIds.length === 0) return null;
                            return tagIds.map((id) => {
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
                            });
                          })()}
                        </div>
                      </div>
                      {consolidado && validacaoMap && (
                        <ValidacaoBadge validacao={validacaoMap.get(r.produto_raiz)} />
                      )}
                    </div>
                  </TableCell>
                  {!p.isHidden('ean_raiz') && (
                    <TableCell className="hidden md:table-cell">
                      {r.ean_raiz ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                          <Barcode className="h-3 w-3" />
                          {r.ean_raiz}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/60">—</span>
                      )}
                    </TableCell>
                  )}
                  {isFisico ? (
                    <>
                      {!p.isHidden('saldo_em_caixas') && (
                        <TableCell className="text-right tabular-nums">{fmt(r.saldo_em_caixas)}</TableCell>
                      )}
                      {!p.isHidden('saldo_em_displays') && (
                        <TableCell className="text-right tabular-nums">{fmt(r.saldo_em_displays)}</TableCell>
                      )}
                      {!p.isHidden('saldo_em_unidades') && (
                        <TableCell className="text-right tabular-nums">{fmt(r.saldo_em_unidades)}</TableCell>
                      )}
                      {!p.isHidden('saldo_total_em_unidades') && (
                        <TableCell className="text-right tabular-nums font-semibold">{fmt(r.saldo_total_em_unidades)}</TableCell>
                      )}
                    </>
                  ) : (
                    !p.isHidden('saldo_total_em_unidades') && (
                      <TableCell className="text-right tabular-nums font-semibold">{fmt(conv)}</TableCell>
                    )
                  )}
                  {!p.isHidden('bloqueado_total_em_unidades') && (
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {fmt(r.bloqueado_total_em_unidades)}
                    </TableCell>
                  )}
                  {!p.isHidden('disponivel_total_em_unidades') && (
                    <TableCell className="text-right tabular-nums font-semibold text-success bg-success/5">
                      {fmt(r.disponivel_total_em_unidades)}
                    </TableCell>
                  )}
                  {!p.isHidden('pendente_total_em_unidades') && (
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {fmt(r.pendente_total_em_unidades)}
                    </TableCell>
                  )}
                  {!p.isHidden('pedidos_count') && (
                    <TableCell className="text-right tabular-nums">
                      {r.pedidos_count && r.pedidos_count > 0 ? (
                        <span className="font-medium">{r.pedidos_count.toLocaleString('pt-BR')}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  )}
                  {!p.isHidden('em_cx') && (
                    <TableCell className="text-right tabular-nums text-primary font-semibold bg-primary/5">
                      {(() => {
                        const cx = disponivelEmCaixas(r);
                        if (cx == null) {
                          return (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help text-muted-foreground">—</span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                Sem fator de conversão CX
                              </TooltipContent>
                            </Tooltip>
                          );
                        }
                        return <span>{formatCx(cx)} <span className="text-[10px] opacity-70">CX</span></span>;
                      })()}
                    </TableCell>
                  )}
                  {!p.isHidden('fornecedor_cx') && (
                    <TableCell className="text-right tabular-nums">
                      {(() => {
                        const v = p.fornecedorCxByRaiz?.get(String(r.produto_raiz));
                        if (v == null || v === 0) {
                          return <span className="text-muted-foreground">—</span>;
                        }
                        return (
                          <span>
                            {Math.round(v).toLocaleString('pt-BR')}{' '}
                            <span className="text-[10px] opacity-70">CX</span>
                          </span>
                        );
                      })()}
                    </TableCell>
                  )}
                  {!p.isHidden('skus_envolvidos') && (
                    <TableCell className="text-right tabular-nums">{r.skus_envolvidos}</TableCell>
                  )}
                </TableRow>
                {isExpanded && (
                  <TableRow key={`${key}-expanded`} className="hover:bg-transparent bg-muted/20">
                    <TableCell colSpan={visibleCount} className="p-0">
                      {consolidado ? (
                        <div className="p-3 space-y-1">
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground px-1">
                            Detalhamento por filial
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Filial</TableHead>
                                <TableHead className="text-right">Caixas</TableHead>
                                <TableHead className="text-right">Displays</TableHead>
                                <TableHead className="text-right">Unidades</TableHead>
                                <TableHead className="text-right">≡ Total UN</TableHead>
                                <TableHead className="text-right">Bloqueado</TableHead>
                                <TableHead className="text-right text-success">Disponível</TableHead>
                                <TableHead className="text-right">Pendente</TableHead>
                                <TableHead className="text-right">Pedidos</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(r.filiais_rows ?? []).map((f) => (
                                <TableRow key={`${key}-f-${f.empresa}`}>
                                  <TableCell>
                                    <Badge variant="outline">{f.filial_nome ?? f.raiz_abrev ?? `Empresa ${f.empresa}`}</Badge>
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">{fmt(f.saldo_em_caixas)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{fmt(f.saldo_em_displays)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{fmt(f.saldo_em_unidades)}</TableCell>
                                  <TableCell className="text-right tabular-nums font-semibold">{fmt(f.saldo_total_em_unidades)}</TableCell>
                                  <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(f.bloqueado_total_em_unidades)}</TableCell>
                                  <TableCell className="text-right tabular-nums font-semibold text-success">{fmt(f.disponivel_total_em_unidades)}</TableCell>
                                  <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(f.pendente_total_em_unidades)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{f.pedidos_count && f.pedidos_count > 0 ? f.pedidos_count.toLocaleString('pt-BR') : <span className="text-muted-foreground">—</span>}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <EstoqueUnificadoSkuBreakdown row={r} />
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between p-3 border-t text-sm">
        <span className="text-muted-foreground">
          {p.total.toLocaleString('pt-BR')} produtos-raiz · página {p.page + 1}/{totalPages}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => p.setPage(Math.max(0, p.page - 1))} disabled={p.page === 0}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => p.setPage(Math.min(totalPages - 1, p.page + 1))} disabled={p.page >= totalPages - 1}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}

function pctFmt(v: number) {
  return `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function ValidacaoBadge({ validacao }: { validacao: ValidacaoErpRow | undefined }) {
  if (!validacao) return null;
  const resumo = resumirValidacao(validacao);

  const Icon =
    resumo.status === 'divergente' ? AlertTriangle :
    resumo.status === 'defasado' ? Clock :
    CheckCircle2;

  const colorCls =
    resumo.status === 'divergente' ? 'text-destructive' :
    resumo.status === 'defasado' ? 'text-warning' :
    'text-success/70';

  const label =
    resumo.status === 'divergente' ? `Divergência ERP ${pctFmt(resumo.pior_desvio_rel)}` :
    resumo.status === 'defasado' ? `${validacao.filiais_defasadas} filial(is) defasada(s)` :
    'Conferido com ERP';

  const isOk = resumo.status === 'ok';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`shrink-0 inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium cursor-help ${
            isOk ? 'opacity-40 hover:opacity-100' : `${colorCls} bg-current/10`
          }`}
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
        >
          <Icon className={`h-3 w-3 ${colorCls}`} />
          {!isOk && <span className={colorCls}>{resumo.status === 'divergente' ? pctFmt(resumo.pior_desvio_rel) : 'sync'}</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-sm text-xs space-y-2">
        <div className="font-medium">{label}</div>
        <table className="w-full text-[11px] tabular-nums">
          <thead className="text-muted-foreground">
            <tr>
              <th className="text-left font-normal">Métrica</th>
              <th className="text-right font-normal">Cache</th>
              <th className="text-right font-normal">ERP</th>
              <th className="text-right font-normal">Δ</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Total UN</td>
              <td className="text-right">{Math.round(validacao.cache_saldo_total_em_unidades).toLocaleString('pt-BR')}</td>
              <td className="text-right">{Math.round(validacao.erp_saldo_total_em_unidades).toLocaleString('pt-BR')}</td>
              <td className={`text-right ${resumo.rel_saldo > 0 ? 'text-destructive font-medium' : ''}`}>
                {Math.round(validacao.delta_saldo_total_em_unidades).toLocaleString('pt-BR')}
              </td>
            </tr>
            <tr>
              <td>Bloqueado</td>
              <td className="text-right">{Math.round(validacao.cache_bloqueado_total_em_unidades).toLocaleString('pt-BR')}</td>
              <td className="text-right">{Math.round(validacao.erp_bloqueado_total_em_unidades).toLocaleString('pt-BR')}</td>
              <td className={`text-right ${resumo.rel_bloqueado > 0 ? 'text-destructive font-medium' : ''}`}>
                {Math.round(validacao.delta_bloqueado_total_em_unidades).toLocaleString('pt-BR')}
              </td>
            </tr>
            <tr>
              <td>Disponível</td>
              <td className="text-right">{Math.round(validacao.cache_disponivel_total_em_unidades).toLocaleString('pt-BR')}</td>
              <td className="text-right">{Math.round(validacao.erp_disponivel_total_em_unidades).toLocaleString('pt-BR')}</td>
              <td className={`text-right ${resumo.rel_disponivel > 0 ? 'text-destructive font-medium' : ''}`}>
                {Math.round(validacao.delta_disponivel_total_em_unidades).toLocaleString('pt-BR')}
              </td>
            </tr>
          </tbody>
        </table>
        <div className="border-t pt-1 space-y-0.5">
          <div className="text-muted-foreground">Sincronização por filial:</div>
          {validacao.filiais_sync.map((f) => {
            const idade = f.idade_horas ?? 0;
            const stale = idade > 24;
            return (
              <div key={f.empresa} className="flex justify-between gap-2">
                <span>{f.abrev || `Empresa ${f.empresa}`}</span>
                <span className={stale ? 'text-warning' : 'text-muted-foreground'}>
                  {idade < 1 ? `${Math.round(idade * 60)} min` : `${Math.round(idade)}h`} atrás
                </span>
              </div>
            );
          })}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
