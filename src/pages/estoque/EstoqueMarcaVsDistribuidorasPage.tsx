import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Search, RefreshCw } from 'lucide-react';
import {
  MARCA_VS_DIST_FILTROS_INICIAIS,
  coberturaPctOf,
  faixaOf,
  useEstoqueMarcaVsDistKpis,
  useEstoqueMarcaVsDistribuidorasQuery,
  type FaixaCobertura,
  type MarcaVsDistFiltros,
} from '@/hooks/estoque/useEstoqueMarcaVsDistQuery';
import { cn } from '@/lib/utils';

const numberFmt = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const pctFmt = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const PAGE_SIZE = 100;

const FAIXAS: { key: FaixaCobertura; label: string; cls: string }[] = [
  { key: 'critica', label: 'Cobertura crítica (<50%)', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
  { key: 'media', label: 'Cobertura média (50–100%)', cls: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30 dark:text-yellow-300' },
  { key: 'ok', label: 'Cobertura OK (≥100%)', cls: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300' },
  { key: 'sem_dist', label: 'Sem saldo nas distribuidoras', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
  { key: 'sem_marca', label: 'Sem saldo na marca', cls: 'bg-muted text-muted-foreground border-border' },
];

function CoberturaBadge({ pct, faixa }: { pct: number | null; faixa: FaixaCobertura }) {
  const meta = FAIXAS.find((f) => f.key === faixa)!;
  const label = pct == null ? meta.label : `${pctFmt.format(pct)}%`;
  return (
    <Badge variant="outline" className={cn('text-[11px]', meta.cls)}>
      {label}
    </Badge>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="bg-card/70 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export default function EstoqueMarcaVsDistribuidorasPage() {
  useEffect(() => {
    document.title = 'Marca × Distribuidoras · Estoque';
  }, []);

  const [filtros, setFiltros] = useState<MarcaVsDistFiltros>(MARCA_VS_DIST_FILTROS_INICIAIS);
  const [page, setPage] = useState(0);

  const { data, isLoading, isFetching, refetch } = useEstoqueMarcaVsDistribuidorasQuery({
    filtros,
    page,
    pageSize: PAGE_SIZE,
  });
  const { data: kpis, isLoading: kpisLoading } = useEstoqueMarcaVsDistKpis();

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE)),
    [data?.total],
  );

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Consolidado Marca × Distribuidoras
            </h1>
            <p className="text-sm text-muted-foreground">
              Confronto entre o saldo do fornecedor Futura (folhas de marca) e o saldo disponível nas distribuidoras,
              em unidades. Cobertura = distribuidoras ÷ marca.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isFetching && 'animate-spin')} />
            Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard
            label="Raízes monitoradas"
            value={kpisLoading ? '—' : numberFmt.format(kpis?.total_raizes ?? 0)}
          />
          <KpiCard
            label="Saldo marca (UN)"
            value={kpisLoading ? '—' : numberFmt.format(Math.round(kpis?.total_marca_un ?? 0))}
            sub="Folhas N3 do Futura"
          />
          <KpiCard
            label="Saldo distribuidoras (UN)"
            value={kpisLoading ? '—' : numberFmt.format(Math.round(kpis?.total_dist_un ?? 0))}
            sub="Cache unificado"
          />
          <KpiCard
            label="Cobertura geral"
            value={
              kpisLoading
                ? '—'
                : `${pctFmt.format(kpis?.cobertura_pct_geral ?? 0)}%`
            }
            sub="Distribuidoras ÷ marca"
          />
          <KpiCard
            label="Raízes descobertas"
            value={kpisLoading ? '—' : numberFmt.format(kpis?.gap_negativo ?? 0)}
            sub="Gap < 0"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[260px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por SKU master, chave raiz ou produto distribuidora..."
                  value={filtros.busca}
                  onChange={(e) => {
                    setFiltros({ ...filtros, busca: e.target.value });
                    setPage(0);
                  }}
                  className="pl-9 h-9"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {FAIXAS.map((f) => {
                  const active = filtros.faixas.includes(f.key);
                  return (
                    <Button
                      key={f.key}
                      variant={active ? 'default' : 'outline'}
                      size="sm"
                      className="h-9 text-xs"
                      onClick={() => {
                        const next = active
                          ? filtros.faixas.filter((x) => x !== f.key)
                          : [...filtros.faixas, f.key];
                        setFiltros({ ...filtros, faixas: next });
                        setPage(0);
                      }}
                    >
                      {f.label}
                    </Button>
                  );
                })}
              </div>

              {(filtros.busca || filtros.faixas.length) ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFiltros(MARCA_VS_DIST_FILTROS_INICIAIS);
                    setPage(0);
                  }}
                >
                  Limpar
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chave raiz</TableHead>
                    <TableHead>SKU master</TableHead>
                    <TableHead>Produto distribuidoras</TableHead>
                    <TableHead className="text-right">Marca UN</TableHead>
                    <TableHead className="text-right">Marca CX</TableHead>
                    <TableHead className="text-right">Distrib. UN</TableHead>
                    <TableHead className="text-right">Distrib. CX</TableHead>
                    <TableHead className="text-right">Gap UN</TableHead>
                    <TableHead>Cobertura</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 9 }).map((__, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : data?.rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                        Nenhuma raiz encontrada para os filtros atuais.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data?.rows.map((r) => {
                      const pct = coberturaPctOf(r);
                      const faixa = faixaOf(r);
                      const gap = Number(r.gap_unidades ?? 0);
                      return (
                        <TableRow key={r.chave_raiz ?? Math.random()}>
                          <TableCell className="font-mono text-xs">{r.chave_raiz ?? '—'}</TableCell>
                          <TableCell className="font-mono text-xs">{r.sku_master ?? '—'}</TableCell>
                          <TableCell
                            className="text-xs max-w-[260px] truncate"
                            title={r.produto_raiz_distribuidoras ?? undefined}
                          >
                            {r.produto_raiz_distribuidoras ?? '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.saldo_marca_un_folhas != null
                              ? numberFmt.format(Math.round(Number(r.saldo_marca_un_folhas)))
                              : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.saldo_marca_caixas != null
                              ? numberFmt.format(Math.round(Number(r.saldo_marca_caixas)))
                              : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.saldo_dist_unidades != null
                              ? numberFmt.format(Math.round(Number(r.saldo_dist_unidades)))
                              : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.saldo_dist_caixas != null
                              ? numberFmt.format(Math.round(Number(r.saldo_dist_caixas)))
                              : '—'}
                          </TableCell>
                          <TableCell
                            className={cn(
                              'text-right font-medium',
                              gap < 0 && 'text-destructive',
                              gap > 0 && 'text-emerald-600 dark:text-emerald-400',
                            )}
                          >
                            {numberFmt.format(Math.round(gap))}
                          </TableCell>
                          <TableCell>
                            <CoberturaBadge pct={pct} faixa={faixa} />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between p-3 border-t text-xs text-muted-foreground">
              <div>
                {numberFmt.format(data?.total ?? 0)} raízes · página {page + 1} de {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
