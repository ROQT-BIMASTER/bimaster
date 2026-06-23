import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
import { Search, Layers, RefreshCw } from 'lucide-react';
import {
  MARCA_NIVEIS_FILTROS_INICIAIS,
  useEstoqueMarcaNiveisEmpresas,
  useEstoqueMarcaNiveisKpis,
  useEstoqueMarcaNiveisQuery,
  type EstoqueMarcaNiveisFiltros,
} from '@/hooks/estoque/useEstoqueMarcaNiveisQuery';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const numberFmt = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const decimalFmt = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PAGE_SIZE = 100;

function nivelBadge(n: number | null) {
  const label = n === 1 ? 'Caixa' : n === 2 ? 'Bandeja' : n === 3 ? 'Unidade' : '—';
  const cls =
    n === 1
      ? 'bg-primary/15 text-primary border-primary/30'
      : n === 2
        ? 'bg-secondary/30 text-secondary-foreground border-border'
        : n === 3
          ? 'bg-muted text-muted-foreground border-border'
          : '';
  return (
    <Badge variant="outline" className={cn('text-[10px]', cls)}>
      N{n ?? '?'} · {label}
    </Badge>
  );
}

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
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

export default function EstoqueMarcaNiveisPage() {
  useEffect(() => {
    document.title = 'Estoque Marca × 3 Níveis · Estoque';
  }, []);

  const [filtros, setFiltros] = useState<EstoqueMarcaNiveisFiltros>(MARCA_NIVEIS_FILTROS_INICIAIS);
  const [page, setPage] = useState(0);

  const { data: empresas } = useEstoqueMarcaNiveisEmpresas();
  const {
    data,
    isLoading,
    isFetching,
    refetch,
  } = useEstoqueMarcaNiveisQuery({ filtros, page, pageSize: PAGE_SIZE });
  const { data: kpis, isLoading: kpisLoading } = useEstoqueMarcaNiveisKpis(filtros);

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
              <Layers className="h-6 w-6 text-primary" />
              Estoque Marca × 3 Níveis
            </h1>
            <p className="text-sm text-muted-foreground">
              Posição do estoque do fornecedor Futura explodida em CX (N1) · BX (N2) · UN (N3) por marca/raiz,
              usando a composição cadastrada no ERP.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isFetching && 'animate-spin')} />
            Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard
            label="Marcas distintas"
            value={kpisLoading ? '—' : numberFmt.format(kpis?.marcas_distintas ?? 0)}
            sub="SKUs master únicos"
          />
          <KpiCard
            label="Empresas"
            value={kpisLoading ? '—' : numberFmt.format(kpis?.empresas_distintas ?? 0)}
            sub="Filiais com saldo"
          />
          <KpiCard
            label="Total CX (N1)"
            value={kpisLoading ? '—' : numberFmt.format(Math.round(kpis?.total_caixas ?? 0))}
            sub="Soma nível 1"
          />
          <KpiCard
            label="Total UN equiv."
            value={kpisLoading ? '—' : numberFmt.format(Math.round(kpis?.total_unidades ?? 0))}
            sub="Soma nível 3"
          />
          <KpiCard
            label="Última sincronia"
            value={
              kpisLoading
                ? '—'
                : kpis?.ultima_sync
                  ? new Date(kpis.ultima_sync).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                  : '—'
            }
            sub="Fornecedor Futura"
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
                  placeholder="Buscar por nome, SKU master ou EAN..."
                  value={filtros.busca}
                  onChange={(e) => {
                    setFiltros({ ...filtros, busca: e.target.value });
                    setPage(0);
                  }}
                  className="pl-9 h-9"
                />
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={filtros.empresas.length ? 'default' : 'outline'}
                    size="sm"
                    className="h-9 gap-1"
                  >
                    Empresa{filtros.empresas.length ? `: ${filtros.empresas.length}` : ''}
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[280px] p-2 max-h-[320px] overflow-auto z-[60]">
                  {(empresas ?? []).map((e) => {
                    const checked = filtros.empresas.includes(e.id);
                    return (
                      <label
                        key={e.id}
                        className="flex items-center gap-2 text-sm py-1.5 px-1 hover:bg-muted/50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? filtros.empresas.filter((x) => x !== e.id)
                              : [...filtros.empresas, e.id];
                            setFiltros({ ...filtros, empresas: next });
                            setPage(0);
                          }}
                        />
                        <span className="truncate">{e.nome}</span>
                      </label>
                    );
                  })}
                  {!empresas?.length && (
                    <div className="text-xs text-muted-foreground p-2">Sem empresas disponíveis.</div>
                  )}
                </PopoverContent>
              </Popover>

              <div className="flex items-center gap-1">
                {[1, 2, 3].map((n) => {
                  const active = filtros.niveis.includes(n);
                  return (
                    <Button
                      key={n}
                      variant={active ? 'default' : 'outline'}
                      size="sm"
                      className="h-9 text-xs"
                      onClick={() => {
                        const next = active
                          ? filtros.niveis.filter((x) => x !== n)
                          : [...filtros.niveis, n];
                        setFiltros({ ...filtros, niveis: next });
                        setPage(0);
                      }}
                    >
                      N{n}
                    </Button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="apenas-saldo"
                  checked={filtros.apenas_com_saldo}
                  onCheckedChange={(v) => {
                    setFiltros({ ...filtros, apenas_com_saldo: !!v });
                    setPage(0);
                  }}
                />
                <Label htmlFor="apenas-saldo" className="text-xs">
                  Apenas com saldo
                </Label>
              </div>

              {(filtros.busca ||
                filtros.empresas.length ||
                filtros.niveis.length ||
                !filtros.apenas_com_saldo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFiltros(MARCA_NIVEIS_FILTROS_INICIAIS);
                    setPage(0);
                  }}
                >
                  Limpar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>SKU master</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>EAN</TableHead>
                    <TableHead className="text-center">Nível</TableHead>
                    <TableHead className="text-right">Saldo CX</TableHead>
                    <TableHead className="text-right">Saldo UN</TableHead>
                    <TableHead>Origem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 8 }).map((__, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : data?.rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                        Nenhum item encontrado para os filtros atuais.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data?.rows.map((r, idx) => (
                      <TableRow key={`${r.empresa_id}-${r.master_id ?? r.cod_produto}-${r.nivel}-${idx}`}>
                        <TableCell className="text-xs">{r.empresa_nome ?? r.empresa_id ?? '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{r.sku_master ?? '—'}</TableCell>
                        <TableCell className="max-w-[280px] truncate" title={r.nome ?? undefined}>
                          {r.nome ?? '—'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.ean ?? '—'}</TableCell>
                        <TableCell className="text-center">{nivelBadge(r.nivel)}</TableCell>
                        <TableCell className="text-right">
                          {r.saldo_marca_caixas != null
                            ? decimalFmt.format(Number(r.saldo_marca_caixas))
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.saldo_marca_unidades != null
                            ? numberFmt.format(Math.round(Number(r.saldo_marca_unidades)))
                            : '—'}
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">
                          {r.origem_explosao ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between p-3 border-t text-xs text-muted-foreground">
              <div>
                {numberFmt.format(data?.total ?? 0)} linhas · página {page + 1} de {totalPages}
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
