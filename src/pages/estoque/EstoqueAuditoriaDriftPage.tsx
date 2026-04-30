import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, ShieldCheck, AlertTriangle, RefreshCw } from 'lucide-react';
import { useDriftErp } from '@/hooks/estoque/useEstoqueMovimentos';
import { useEstoqueOptions } from '@/hooks/estoque/useEstoqueFiltrosOptions';

const fmt = (n: number | null | undefined) =>
  Math.round(Number(n ?? 0)).toLocaleString('pt-BR');

export default function EstoqueAuditoriaDriftPage() {
  const [busca, setBusca] = useState('');
  const [empresaIds, setEmpresaIds] = useState<number[]>([]);
  const { data: opts } = useEstoqueOptions();
  const { data, isFetching, refetch } = useDriftErp(empresaIds);

  const filtradas = useMemo(() => {
    const b = busca.trim().toLowerCase();
    if (!b) return data ?? [];
    return (data ?? []).filter(
      (r) =>
        String(r.cod_produto).includes(b) ||
        (r.nome_prod ?? '').toLowerCase().includes(b),
    );
  }, [data, busca]);

  const totalSkus = filtradas.length;
  const driftAbs = filtradas.reduce((s, r) => s + Math.abs(Number(r.drift || 0)), 0);
  const sobra = filtradas.filter((r) => r.drift > 0).length;
  const falta = filtradas.filter((r) => r.drift < 0).length;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Auditoria de Drift — Interno vs ERP</h1>
            <p className="text-sm text-muted-foreground">
              Diferença entre o saldo lógico interno (após desmontagens/remontagens) e o saldo do ERP, SKU a SKU.
              Use para identificar inconsistências e justificar ajustes.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">SKUs com drift</p>
            <p className="text-2xl font-bold tabular-nums">{fmt(totalSkus)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Drift absoluto (un)</p>
            <p className="text-2xl font-bold tabular-nums">{fmt(driftAbs)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Sobras (interno {'>'} ERP)</p>
            <p className="text-2xl font-bold tabular-nums text-emerald-600">{fmt(sobra)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Faltas (interno {'<'} ERP)</p>
            <p className="text-2xl font-bold tabular-nums text-amber-600">{fmt(falta)}</p>
          </Card>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por código ou nome do produto…"
              className="pl-9 h-9"
            />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {(opts?.empresas ?? []).slice(0, 8).map((e) => {
              const active = empresaIds.includes(e.id);
              return (
                <Button
                  key={e.id}
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    setEmpresaIds((prev) => (prev.includes(e.id) ? prev.filter((x) => x !== e.id) : [...prev, e.id]))
                  }
                >
                  {e.nome}
                </Button>
              );
            })}
            {empresaIds.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEmpresaIds([])}>
                Limpar
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Saldo interno</TableHead>
                <TableHead className="text-right">Saldo ERP</TableHead>
                <TableHead className="text-right">Drift</TableHead>
                <TableHead className="text-right">Drift %</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isFetching && filtradas.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Carregando…</TableCell></TableRow>
              )}
              {!isFetching && filtradas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ShieldCheck className="h-8 w-8 text-emerald-600" />
                      <p>Nenhuma divergência encontrada — estoque lógico está sincronizado com o ERP.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {filtradas.map((r) => {
                const positivo = Number(r.drift) > 0;
                return (
                  <TableRow key={`${r.empresa}-${r.cod_produto}`}>
                    <TableCell><Badge variant="outline">{r.empresa}</Badge></TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium leading-tight">{r.nome_prod ?? `Produto ${r.cod_produto}`}</span>
                        <span className="text-[11px] text-muted-foreground">Cód. {r.cod_produto}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.saldo_interno)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.saldo_erp)}</TableCell>
                    <TableCell className={`text-right tabular-nums font-semibold ${positivo ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {positivo ? '+' : ''}{fmt(r.drift)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{Number(r.drift_pct ?? 0).toFixed(2)}%</TableCell>
                    <TableCell>
                      <Badge variant={positivo ? 'secondary' : 'destructive'} className="text-[10px] uppercase">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {positivo ? 'sobra' : 'falta'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
