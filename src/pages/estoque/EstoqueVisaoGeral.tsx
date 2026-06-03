import { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, RefreshCw } from 'lucide-react';
import { useEstoqueErpSync } from '@/hooks/useEstoqueErpSync';

function useDebounce<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}
import { FILTROS_INICIAIS, type EstoqueFiltros } from '@/lib/estoque/estoqueFilters';
import { useEstoqueQuery, type EstoqueRow, type EstoqueSortKey } from '@/hooks/estoque/useEstoqueQuery';
import { useEstoqueKpis } from '@/hooks/estoque/useEstoqueKpis';
import { EstoqueKpiBar } from '@/components/estoque/visao-geral/EstoqueKpiBar';
import { EstoqueQuickChips } from '@/components/estoque/visao-geral/EstoqueQuickChips';
import { EstoqueFilterPanel } from '@/components/estoque/visao-geral/EstoqueFilterPanel';
import { EstoqueFilialSelect } from '@/components/estoque/visao-geral/EstoqueFilialSelect';
import { EstoqueUnidadeChips } from '@/components/estoque/visao-geral/EstoqueUnidadeChips';
import { EstoqueActiveFilters } from '@/components/estoque/visao-geral/EstoqueActiveFilters';
import { EstoqueTable } from '@/components/estoque/visao-geral/EstoqueTable';
import { EstoqueDetailDrawer } from '@/components/estoque/visao-geral/EstoqueDetailDrawer';
import { EstoqueExportButton } from '@/components/estoque/visao-geral/EstoqueExportButton';

export default function EstoqueVisaoGeral() {
  const [buscaTxt, setBuscaTxt] = useState('');
  const buscaDebounced = useDebounce(buscaTxt, 300);
  const [filtrosBase, setFiltrosBase] = useState<EstoqueFiltros>(FILTROS_INICIAIS);

  const filtros: EstoqueFiltros = useMemo(
    () => ({ ...filtrosBase, busca: buscaDebounced }),
    [filtrosBase, buscaDebounced],
  );

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [sortBy, setSortBy] = useState<EstoqueSortKey>('custo_total');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const { data, isFetching } = useEstoqueQuery({ filtros, page, pageSize, sortBy, sortDir });
  const { data: kpis, isLoading: kpisLoading } = useEstoqueKpis(filtros);

  const [selected, setSelected] = useState<EstoqueRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const queryClient = useQueryClient();
  const { syncFull, isSyncing, syncProgress } = useEstoqueErpSync();

  const handleResync = async () => {
    await syncFull();
    await queryClient.invalidateQueries({ queryKey: ['estoque'] });
    await queryClient.invalidateQueries({ queryKey: ['estoque-filter-options'] });
    await queryClient.invalidateQueries({ queryKey: ['estoque-kpis'] });
  };

  const handleSort = (key: EstoqueSortKey) => {
    if (sortBy === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
    setPage(0);
  };

  const handleSetFiltros = (f: EstoqueFiltros) => {
    setFiltrosBase(f);
    setPage(0);
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Visão de Estoque</h1>
            <p className="text-sm text-muted-foreground">
              Consulta multiempresa do estoque sincronizado do ERP — saldos, curvas ABC, pendências e movimentação.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={handleResync}
              disabled={isSyncing}
              title="Re-sincroniza o estoque de todas as filiais a partir do ERP"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? `Sincronizando… ${syncProgress.elapsedSeconds}s` : 'Sincronizar ERP'}
            </Button>
            <EstoqueExportButton filtros={filtros} total={data?.total ?? 0} />
            <EstoqueFilterPanel filtros={filtrosBase} setFiltros={handleSetFiltros} />
          </div>
        </div>

        <EstoqueKpiBar kpis={kpis} loading={kpisLoading} />

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={buscaTxt}
                onChange={(e) => { setBuscaTxt(e.target.value); setPage(0); }}
                placeholder="Buscar por produto, código ERP ou fabricante..."
                className="pl-9 h-9"
              />
            </div>
            <EstoqueFilialSelect
              selected={filtrosBase.empresa_ids}
              onChange={(v) => handleSetFiltros({ ...filtrosBase, empresa_ids: v })}
            />
            <EstoqueUnidadeChips
              selected={filtrosBase.unidades}
              onChange={(v) => handleSetFiltros({ ...filtrosBase, unidades: v })}
            />
          </div>
          <EstoqueQuickChips filtros={filtrosBase} setFiltros={handleSetFiltros} />
        </div>

        <EstoqueActiveFilters filtros={filtrosBase} setFiltros={handleSetFiltros} />

        <EstoqueTable
          rows={data?.rows ?? []}
          total={data?.total ?? 0}
          loading={isFetching}
          page={page}
          pageSize={pageSize}
          setPage={setPage}
          setPageSize={setPageSize}
          sortBy={sortBy}
          sortDir={sortDir}
          setSort={handleSort}
          onRowClick={(r) => { setSelected(r); setDrawerOpen(true); }}
        />

        <EstoqueDetailDrawer row={selected} open={drawerOpen} onOpenChange={setDrawerOpen} />
      </div>
    </DashboardLayout>
  );
}
