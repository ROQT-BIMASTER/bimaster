import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EstoqueFilialSelect } from '@/components/estoque/visao-geral/EstoqueFilialSelect';
import { EstoqueLinhaTabs } from '@/components/estoque/cores/EstoqueLinhaTabs';
import {
  useEstoqueReconciliacaoQuery,
  useEstoqueReconciliacaoKpis,
  RECON_FILTROS_INICIAIS,
  type ReconciliacaoFiltros,
  type ReconciliacaoRow,
  type ReconciliacaoSortKey,
} from '@/hooks/estoque/useEstoqueReconciliacao';

function useDebounce<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => { const id = setTimeout(() => setV(value), delay); return () => clearTimeout(id); }, [value, delay]);
  return v;
}

function fmtN(n: number | null | undefined, decimals = 0) {
  if (n == null || !isFinite(Number(n))) return '—';
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPct(n: number | null | undefined) {
  if (n == null || !isFinite(Number(n))) return '—';
  return `${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function StatusBadge({ status }: { status: ReconciliacaoRow['status'] }) {
  switch (status) {
    case 'ok':
      return <Badge variant="outline" className="border-success/40 text-success bg-success/10 gap-1"><CheckCircle2 className="h-3 w-3" />Bate</Badge>;
    case 'divergente':
      return <Badge variant="outline" className="border-destructive/40 text-destructive bg-destructive/10 gap-1"><AlertTriangle className="h-3 w-3" />Divergente</Badge>;
    case 'ausente_em_cores':
      return <Badge variant="outline" className="border-warning/40 text-warning bg-warning/10 gap-1"><HelpCircle className="h-3 w-3" />Só Unificado</Badge>;
    case 'ausente_em_unificado':
      return <Badge variant="outline" className="border-warning/40 text-warning bg-warning/10 gap-1"><HelpCircle className="h-3 w-3" />Só Cores</Badge>;
  }
}

function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'warn' | 'bad' }) {
  return (
    <Card className="p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn(
        'text-base font-semibold tabular-nums leading-tight mt-0.5',
        tone === 'ok' && 'text-success',
        tone === 'warn' && 'text-warning',
        tone === 'bad' && 'text-destructive',
      )}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </Card>
  );
}

const COLS: Array<{ key: string; label: string; sortable?: boolean; align?: 'left'|'right'|'center'; sortKey?: ReconciliacaoSortKey }> = [
  { key: 'empresa', label: 'Filial', sortable: true, sortKey: 'empresa' },
  { key: 'cod', label: 'Cód. raiz' },
  { key: 'nome', label: 'Produto-raiz', sortable: true, sortKey: 'nome_raiz' },
  { key: 'linha', label: 'Linha' },
  { key: 'qtd_cores', label: 'Cores', align: 'right' },
  { key: 'un_cores', label: 'UN (Cores)', align: 'right', sortable: true, sortKey: 'un_cores' },
  { key: 'un_unif', label: 'UN (Unificado)', align: 'right', sortable: true, sortKey: 'un_unificado' },
  { key: 'delta', label: 'Δ UN', align: 'right', sortable: true, sortKey: 'delta_abs' },
  { key: 'delta_pct', label: 'Δ %', align: 'right' },
  { key: 'cx_cores', label: 'CX (Cores)', align: 'right' },
  { key: 'cx_unif', label: 'CX (Unificado)', align: 'right' },
  { key: 'status', label: 'Status', align: 'center' },
];

function exportCsv(rows: ReconciliacaoRow[]) {
  const header = [
    'empresa','cod_raiz','nome_raiz','nome_linha','qtd_cores','skus_unificado',
    'un_cores','un_unificado','delta_un','delta_pct',
    'fator_cx_para_un','cx_cores','cx_unificado',
    'disponivel_un_unificado','bloqueado_un_unificado','status',
  ];
  const lines = [header.join(';')];
  for (const r of rows) {
    lines.push([
      r.empresa, r.cod_raiz, JSON.stringify(r.nome_raiz ?? ''), JSON.stringify(r.nome_linha ?? ''),
      r.qtd_cores, r.skus_unificado,
      r.un_cores, r.un_unificado, r.delta_un, r.delta_pct ?? '',
      r.fator_cx_para_un, r.cx_cores ?? '', r.cx_unificado ?? '',
      r.disponivel_un_unificado, r.bloqueado_un_unificado, r.status,
    ].join(';'));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reconciliacao-cores-unificado-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function EstoqueReconciliacaoCoresPage() {
  const [busca, setBusca] = useState('');
  const buscaD = useDebounce(busca, 300);
  const [base, setBase] = useState<ReconciliacaoFiltros>(RECON_FILTROS_INICIAIS);
  const filtros = useMemo<ReconciliacaoFiltros>(() => ({ ...base, busca: buscaD }), [base, buscaD]);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [sortBy, setSortBy] = useState<ReconciliacaoSortKey>('delta_abs');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const setF = (f: ReconciliacaoFiltros) => { setBase(f); setPage(0); };
  const toggleSort = (k: ReconciliacaoSortKey) => {
    if (sortBy === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(k); setSortDir('desc'); }
    setPage(0);
  };

  const query = useEstoqueReconciliacaoQuery({ filtros, page, pageSize, sortBy, sortDir });
  const kpis = useEstoqueReconciliacaoKpis(filtros);

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / pageSize));
  const rows = query.data?.rows ?? [];

  const k = kpis.data;
  const tone = k
    ? (k.raizes_divergentes === 0 && k.raizes_so_em_cores === 0 && k.raizes_so_em_unificado === 0
        ? 'ok' : k.raizes_divergentes > 0 ? 'bad' : 'warn')
    : undefined;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reconciliação Cores × Unificado</h1>
            <p className="text-sm text-muted-foreground">
              Compara, por produto-raiz e filial, o total em unidades segundo a tela <Link className="underline" to="/dashboard/estoque/cores">Por Cores</Link> e segundo a tela <Link className="underline" to="/dashboard/estoque/unificado">Unificado (3 níveis)</Link>. Os números <strong>devem bater</strong> — divergência indica problema de composição, fator ou sincronização.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => exportCsv(rows)} disabled={rows.length === 0}>
              <Download className="h-4 w-4 mr-2" /> Exportar página (CSV)
            </Button>
          </div>
        </div>

        {/* KPIs */}
        {kpis.isLoading || !k ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-3"><Skeleton className="h-12 w-full" /></Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard label="Raízes auditadas" value={fmtN(k.raizes_auditadas)} />
            <KpiCard label="Batendo" value={fmtN(k.raizes_ok)} tone="ok" sub={`${k.raizes_auditadas > 0 ? Math.round(k.raizes_ok / k.raizes_auditadas * 100) : 0}% do total`} />
            <KpiCard label="Divergentes" value={fmtN(k.raizes_divergentes)} tone={k.raizes_divergentes > 0 ? 'bad' : 'ok'} />
            <KpiCard label="Só num lado" value={fmtN(k.raizes_so_em_cores + k.raizes_so_em_unificado)} tone={(k.raizes_so_em_cores + k.raizes_so_em_unificado) > 0 ? 'warn' : 'ok'} sub={`Cores: ${k.raizes_so_em_cores} · Unif.: ${k.raizes_so_em_unificado}`} />
            <KpiCard label="Δ absoluto total" value={`${fmtN(k.delta_abs_total_un)} UN`} tone={tone} sub={`≈ ${fmtN(k.delta_abs_total_cx, 1)} CX máster`} />
          </div>
        )}

        {/* Filtros */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => { setBusca(e.target.value); setPage(0); }}
                placeholder="Buscar produto-raiz ou código..."
                className="pl-9 h-9"
              />
            </div>
            <EstoqueFilialSelect
              selected={base.empresas}
              onChange={(v) => setF({ ...base, empresas: v })}
            />
            <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-card">
              <Switch
                id="apenas-div"
                checked={base.apenas_divergentes}
                onCheckedChange={(v) => setF({ ...base, apenas_divergentes: v })}
              />
              <Label htmlFor="apenas-div" className="text-xs cursor-pointer">Apenas divergentes</Label>
            </div>
            <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-card">
              <Label htmlFor="tol" className="text-xs">Tolerância (UN)</Label>
              <Input
                id="tol"
                type="number"
                value={base.tolerancia}
                onChange={(e) => setF({ ...base, tolerancia: Number(e.target.value) || 0 })}
                className="h-7 w-20 text-xs"
                step="0.01"
                min="0"
              />
            </div>
          </div>

          <EstoqueLinhaTabs
            selected={base.linhas}
            onChange={(linhas) => setF({ ...base, linhas })}
          />
        </div>

        {/* Tabela */}
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table className="min-w-[1300px]">
            <TableHeader className="bg-muted/40">
              <TableRow>
                {COLS.map((c) => {
                  const isActive = c.sortKey && sortBy === c.sortKey;
                  return (
                    <TableHead
                      key={c.key}
                      className={cn(
                        'whitespace-nowrap text-xs font-semibold',
                        c.align === 'right' && 'text-right',
                        c.align === 'center' && 'text-center',
                        c.sortable && 'cursor-pointer select-none hover:text-foreground',
                      )}
                      onClick={() => c.sortKey && toggleSort(c.sortKey)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {c.label}
                        {c.sortable && (
                          isActive
                            ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
                            : <ArrowUpDown className="h-3 w-3 opacity-30" />
                        )}
                      </span>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isFetching && rows.length === 0 ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>{COLS.map((c) => (
                    <TableCell key={c.key}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}</TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLS.length} className="h-32 text-center text-muted-foreground">
                    Nenhum produto-raiz para reconciliar com os filtros atuais.
                  </TableCell>
                </TableRow>
              ) : rows.map((r, idx) => {
                const isDiv = r.status === 'divergente';
                const isAusente = r.status === 'ausente_em_cores' || r.status === 'ausente_em_unificado';
                return (
                  <TableRow key={`${r.empresa}-${r.cod_raiz}-${idx}`} className={cn(
                    isDiv && 'bg-destructive/5',
                    isAusente && 'bg-warning/5',
                  )}>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="font-normal">{r.abrev_empresa ?? r.empresa ?? '—'}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{r.cod_raiz ?? '—'}</TableCell>
                    <TableCell className="max-w-[280px]">
                      <div className="text-sm font-medium leading-tight truncate">{r.nome_raiz ?? '(sem nome)'}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[140px]">{r.nome_linha ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{r.qtd_cores}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtN(r.un_cores)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtN(r.un_unificado)}</TableCell>
                    <TableCell className={cn(
                      'text-right tabular-nums font-semibold',
                      Math.abs(r.delta_un) > 0.5 && (r.delta_un > 0 ? 'text-destructive' : 'text-warning'),
                    )}>
                      {r.delta_un > 0 ? '+' : ''}{fmtN(r.delta_un)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{fmtPct(r.delta_pct)}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{fmtN(r.cx_cores, 1)}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{fmtN(r.cx_unificado, 1)}</TableCell>
                    <TableCell className="text-center"><StatusBadge status={r.status} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="text-xs text-muted-foreground">
            Página {page + 1} de {totalPages} · {(query.data?.total ?? 0).toLocaleString('pt-BR')} raízes
          </div>
          <div className="flex items-center gap-2">
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
            >
              {[50, 100, 200].map((n) => <option key={n} value={n}>{n}/pág</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card className="p-4 text-xs text-muted-foreground space-y-2">
          <p className="font-semibold text-foreground">Como ler esta tela</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>UN (Cores)</strong> = soma de <em>saldo próprio + potencial de desmontagem</em> de todas as cores daquele produto-raiz, conforme a tela Por Cores.</li>
            <li><strong>UN (Unificado)</strong> = <em>saldo_total_em_unidades</em> do cache unificado (3 níveis CX → BX → UN convertidos a unidades).</li>
            <li><strong>Bate</strong>: diferença ≤ tolerância. <strong>Divergente</strong>: diferença acima da tolerância. <strong>Só num lado</strong>: produto existe em apenas uma das fontes.</li>
            <li><strong>CX</strong> = UN ÷ fator de caixa máster (do cache unificado). Quando o produto não tem fator, mostra "—".</li>
          </ul>
        </Card>
      </div>
    </DashboardLayout>
  );
}
