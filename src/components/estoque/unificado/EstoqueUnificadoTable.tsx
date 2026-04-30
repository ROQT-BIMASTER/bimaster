import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, ArrowUp, ArrowUpDown, Barcode, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import type { EstoqueUnificadoRow, UseEstoqueUnificadoOpts } from '@/hooks/estoque/useEstoqueUnificado';
import { converterParaModo, MODO_COL_LABEL, type ModoExibicao } from '@/lib/estoque/modoExibicao';

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

  const colspan = isFisico ? 8 : 6;

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
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
            <Th k="custo_total" label="Custo total" num />
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
            return (
              <TableRow
                key={`${r.empresa}-${r.produto_raiz}`}
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => p.onRowClick(r)}
              >
                <TableCell><Badge variant="outline">{r.raiz_abrev ?? r.empresa}</Badge></TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium leading-tight">{r.raiz_nome ?? `Produto ${r.produto_raiz}`}</span>
                    <span className="text-[11px] text-muted-foreground">Cód. {r.produto_raiz}</span>
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
                <TableCell className="text-right tabular-nums">{formatCurrency(Number(r.custo_total ?? 0))}</TableCell>
                <TableCell className="text-right tabular-nums">{r.skus_envolvidos}</TableCell>
              </TableRow>
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
  );
}
