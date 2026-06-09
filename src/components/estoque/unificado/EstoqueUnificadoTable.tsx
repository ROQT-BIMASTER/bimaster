import { Fragment, useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Barcode, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, Info } from 'lucide-react';

import type { EstoqueUnificadoRow, UseEstoqueUnificadoOpts } from '@/hooks/estoque/useEstoqueUnificado';
import { converterParaModo, disponivelEmCaixas, formatCx, MODO_COL_LABEL, type ModoExibicao } from '@/lib/estoque/modoExibicao';
import { EstoqueUnificadoSkuBreakdown } from './EstoqueUnificadoSkuBreakdown';
import { resumirValidacao, useEstoqueValidacaoErp, type ValidacaoErpRow } from '@/hooks/estoque/useEstoqueValidacaoErp';

interface Props {
  rows: EstoqueUnificadoRow[];
  total: number;
  loading?: boolean;
  page: number;
  pageSize: number;
  sortBy: UseEstoqueUnificadoOpts['sortBy'];
  sortDir: 'asc' | 'desc';
  setPage: (n: number) => void;
  setSort: (key: UseEstoqueUnificadoOpts['sortBy']) => void;
  onRowClick: (r: EstoqueUnificadoRow) => void;
  modo?: ModoExibicao;
  consolidado?: boolean;
}

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : Math.round(Number(n)).toLocaleString('pt-BR');

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ArrowUpDown className="ml-1 h-3 w-3 inline opacity-40" />;
  return dir === 'asc' ? <ArrowUp className="ml-1 h-3 w-3 inline" /> : <ArrowDown className="ml-1 h-3 w-3 inline" />;
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

  const Th = ({ k, label, num }: { k: Props['sortBy']; label: string; num?: boolean }) => (
    <TableHead className={num ? 'text-right' : ''}>
      <button
        onClick={() => p.setSort(k)}
        className="inline-flex items-center font-medium hover:text-foreground"
      >
        {label}
        <SortIcon active={p.sortBy === k} dir={p.sortDir} />
      </button>
    </TableHead>
  );

  // +1 chevron, +3 colunas novas (Bloqueado, Disponível, Pendente) +1 "≡ em CX"
  const colspan = (isFisico ? 8 : 6) + 1 + 3 + 1;

  return (
    <TooltipProvider delayDuration={150}>
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Empresa</TableHead>
            <TableHead>Produto-raiz</TableHead>
            <TableHead className="hidden md:table-cell">EAN raiz</TableHead>
            {isFisico ? (
              <>
                <Th k="saldo_em_caixas" label="Caixas" num />
                <Th k="saldo_em_displays" label="Displays" num />
                <Th k="saldo_em_unidades" label="Unidades" num />
                <Th k="saldo_total_em_unidades" label="≡ Total em UN" num />
              </>
            ) : (
              <Th k="saldo_total_em_unidades" label={MODO_COL_LABEL[modo]} num />
            )}
            <TableHead className="text-right">
              <span className="inline-flex items-center gap-1 font-medium" title="Saldo bloqueado em estoque (avaria, quarentena, endereço travado)">
                Bloqueado
              </span>
            </TableHead>
            <TableHead className="text-right">
              <span className="inline-flex items-center gap-1 font-medium text-success" title="Disponível para venda = Saldo − Bloqueado">
                Disponível
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-success/70 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    Disponível para venda = Saldo total em UN − Bloqueado (avaria/quarentena/endereço travado). Não abate pedido pendente, pois esse já foi reservado mas ainda não saiu fisicamente.
                  </TooltipContent>
                </Tooltip>
              </span>
            </TableHead>
            <TableHead className="text-right">
              <span className="inline-flex items-center gap-1 font-medium" title="Quantidade comprometida em pedidos de venda em aberto, ainda não faturados">
                Pendente
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    Pedidos de venda em aberto (ainda não faturados). Informativo — não abate do Disponível porque o saldo ainda existe fisicamente.
                  </TooltipContent>
                </Tooltip>
              </span>
            </TableHead>
            <TableHead className="text-right">
              <span className="inline-flex items-center gap-1 font-medium">
                ≡ em CX
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    Equivalente em caixas máster do <strong>Disponível</strong>: Disponível em UN ÷ fator CX. Pode ser fracionário — base para decisão de compras.
                  </TooltipContent>
                </Tooltip>
              </span>
            </TableHead>
            
            <TableHead className="text-right">SKUs</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {p.loading && p.rows.length === 0 && (
            <TableRow><TableCell colSpan={colspan} className="text-center py-10 text-muted-foreground">Carregando…</TableCell></TableRow>
          )}
          {!p.loading && p.rows.length === 0 && (
            <TableRow><TableCell colSpan={colspan} className="text-center py-10 text-muted-foreground">Nenhum produto encontrado.</TableCell></TableRow>
          )}
          {p.rows.map((r) => {
            const conv = isFisico ? null : converterParaModo(r, modo);
            const key = consolidado ? `c-${r.produto_raiz}` : `${r.empresa}-${r.produto_raiz}`;
            const isExpanded = expandedKey === key;
            return (
              <Fragment key={key}>
                <TableRow
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => p.onRowClick(r)}
                  data-state={isExpanded ? 'selected' : undefined}
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
                  <TableCell>
                    {consolidado ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="cursor-help">
                            {(r.filiais_count ?? 1)} filia{(r.filiais_count ?? 1) > 1 ? 'is' : 'l'}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs">
                          {(r.filiais ?? []).map((f) => f.abrev || `Empresa ${f.empresa}`).join(' · ')}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Badge variant="outline">{r.raiz_abrev ?? r.empresa}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium leading-tight truncate">{r.raiz_nome ?? `Produto ${r.produto_raiz}`}</span>
                        <span className="text-[11px] text-muted-foreground">Cód. {r.produto_raiz}</span>
                      </div>
                      {consolidado && validacaoMap && (
                        <ValidacaoBadge validacao={validacaoMap.get(r.produto_raiz)} />
                      )}
                    </div>
                  </TableCell>
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
                  {isFisico ? (
                    <>
                      <TableCell className="text-right tabular-nums">{fmt(r.saldo_em_caixas)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.saldo_em_displays)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.saldo_em_unidades)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{fmt(r.saldo_total_em_unidades)}</TableCell>
                    </>
                  ) : (
                    <TableCell className="text-right tabular-nums font-semibold">{fmt(conv)}</TableCell>
                  )}
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {fmt(r.bloqueado_total_em_unidades)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-success bg-success/5">
                    {fmt(r.disponivel_total_em_unidades)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {fmt(r.pendente_total_em_unidades)}
                  </TableCell>
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
                  
                  <TableCell className="text-right tabular-nums">{r.skus_envolvidos}</TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow key={`${key}-expanded`} className="hover:bg-transparent bg-muted/20">
                    <TableCell colSpan={colspan} className="p-0">
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
                                
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(r.filiais_rows ?? []).map((f) => (
                                <TableRow key={`${key}-f-${f.empresa}`}>
                                  <TableCell>
                                    <Badge variant="outline">{f.raiz_abrev ?? f.empresa}</Badge>
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">{fmt(f.saldo_em_caixas)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{fmt(f.saldo_em_displays)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{fmt(f.saldo_em_unidades)}</TableCell>
                                  <TableCell className="text-right tabular-nums font-semibold">{fmt(f.saldo_total_em_unidades)}</TableCell>
                                  <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(f.bloqueado_total_em_unidades)}</TableCell>
                                  <TableCell className="text-right tabular-nums font-semibold text-success">{fmt(f.disponivel_total_em_unidades)}</TableCell>
                                  <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(f.pendente_total_em_unidades)}</TableCell>
                                  
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

  // Em status "ok" exibimos somente um ícone discreto ao passar o mouse — sem badge ruidoso.
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
