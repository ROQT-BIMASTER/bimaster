import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Search, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useEstoqueOptions } from '@/hooks/estoque/useEstoqueFiltrosOptions';
import {
  useEstoqueUnificado,
  type EstoqueUnificadoRow,
  type UseEstoqueUnificadoOpts,
} from '@/hooks/estoque/useEstoqueUnificado';
import { EstoqueUnificadoKpis } from '@/components/estoque/unificado/EstoqueUnificadoKpis';
import { EstoqueUnificadoTable } from '@/components/estoque/unificado/EstoqueUnificadoTable';
import { EstoqueUnificadoDrawer } from '@/components/estoque/unificado/EstoqueUnificadoDrawer';
import { DriftErpKpi } from '@/components/estoque/unificado/DriftErpKpi';
import { Badge } from '@/components/ui/badge';

function useDebounce<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export default function EstoqueUnificadoPage() {
  const [busca, setBusca] = useState('');
  const buscaDeb = useDebounce(busca, 300);
  const [empresaIds, setEmpresaIds] = useState<number[]>([]);
  const [somenteComSaldo, setSomenteComSaldo] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(50);
  const [sortBy, setSortBy] = useState<UseEstoqueUnificadoOpts['sortBy']>('saldo_total_em_unidades');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [selected, setSelected] = useState<EstoqueUnificadoRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [recalculando, setRecalculando] = useState(false);

  const { data: opts } = useEstoqueOptions();
  const { data, isFetching, refetch } = useEstoqueUnificado({
    empresaIds, busca: buscaDeb, somenteComSaldo, page, pageSize, sortBy, sortDir,
  });

  const handleSort = (k: UseEstoqueUnificadoOpts['sortBy']) => {
    if (sortBy === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(k); setSortDir('desc'); }
    setPage(0);
  };

  const recalcular = async () => {
    setRecalculando(true);
    try {
      const { error: e1 } = await supabase.rpc('sincronizar_bom_edges_from_erp' as any);
      if (e1) throw e1;
      const { error: e2 } = await supabase.rpc('recalcular_estoque_niveis' as any);
      if (e2) throw e2;
      toast.success('Composição e níveis recalculados.');
      refetch();
    } catch (err: any) {
      toast.error('Falha ao recalcular: ' + (err?.message ?? 'erro desconhecido'));
    } finally {
      setRecalculando(false);
    }
  };

  const empresasSelecionadasLabel = useMemo(() => {
    if (!empresaIds.length) return 'Todas as empresas';
    return `${empresaIds.length} empresa(s)`;
  }, [empresaIds]);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Estoque Unificado — 3 Níveis</h1>
            <p className="text-sm text-muted-foreground">
              Visão consolidada por produto-raiz com saldos físicos em <strong>caixa</strong>, <strong>display</strong> e <strong>unidade</strong>, e equivalência matemática total.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={recalcular} disabled={recalculando}>
            <RefreshCw className={`h-4 w-4 mr-2 ${recalculando ? 'animate-spin' : ''}`} />
            Recalcular níveis
          </Button>
        </div>

        <EstoqueUnificadoKpis rows={data?.rows ?? []} total={data?.total ?? 0} loading={isFetching} />
        <DriftErpKpi empresaIds={empresaIds} />

        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setPage(0); }}
              placeholder="Buscar por nome ou código do produto-raiz…"
              className="pl-9 h-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="com-saldo" className="text-sm">Apenas com saldo</Label>
            <Switch id="com-saldo" checked={somenteComSaldo} onCheckedChange={(v) => { setSomenteComSaldo(v); setPage(0); }} />
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            <Badge variant="secondary" className="text-xs">{empresasSelecionadasLabel}</Badge>
            {(opts?.empresas ?? []).slice(0, 8).map((e) => {
              const active = empresaIds.includes(e.id);
              return (
                <Button
                  key={e.id}
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setPage(0);
                    setEmpresaIds((prev) => (prev.includes(e.id) ? prev.filter((x) => x !== e.id) : [...prev, e.id]));
                  }}
                >
                  {e.nome}
                </Button>
              );
            })}
            {empresaIds.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEmpresaIds([]); setPage(0); }}>
                Limpar
              </Button>
            )}
          </div>
        </div>

        <EstoqueUnificadoTable
          rows={data?.rows ?? []}
          total={data?.total ?? 0}
          loading={isFetching}
          page={page}
          pageSize={pageSize}
          sortBy={sortBy}
          sortDir={sortDir}
          setPage={setPage}
          setSort={handleSort}
          onRowClick={(r) => { setSelected(r); setDrawerOpen(true); }}
        />

        <EstoqueUnificadoDrawer row={selected} open={drawerOpen} onOpenChange={setDrawerOpen} />
      </div>
    </DashboardLayout>
  );
}
