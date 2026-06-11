import { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Search, Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  useEstoqueCoresQuery,
  FILTROS_CORES_INICIAIS,
  type EstoqueCoresFiltros,
  type EstoqueCorRow,
  type EstoqueCoresSortKey,
} from '@/hooks/estoque/useEstoqueCoresQuery';
import { useEstoqueCoresKpis } from '@/hooks/estoque/useEstoqueCoresKpis';
import { EstoqueCoresKpiBar } from '@/components/estoque/cores/EstoqueCoresKpiBar';
import { EstoqueCoresTable } from '@/components/estoque/cores/EstoqueCoresTable';
import { EstoqueCoresDrawer } from '@/components/estoque/cores/EstoqueCoresDrawer';
import { EstoqueLinhaTabs } from '@/components/estoque/cores/EstoqueLinhaTabs';
import { EstoqueCampanhaFilter } from '@/components/estoque/cores/EstoqueCampanhaFilter';
import { EstoqueFilialSelect } from '@/components/estoque/visao-geral/EstoqueFilialSelect';

function useDebounce<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export default function EstoqueCoresPage() {
  const [busca, setBusca] = useState('');
  const buscaD = useDebounce(busca, 300);
  const [base, setBase] = useState<EstoqueCoresFiltros>(FILTROS_CORES_INICIAIS);

  const filtros = useMemo<EstoqueCoresFiltros>(() => ({ ...base, busca: buscaD }), [base, buscaD]);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [sortBy, setSortBy] = useState<EstoqueCoresSortKey>('saldo_total_disponivel');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const { data, isFetching } = useEstoqueCoresQuery({ filtros, page, pageSize, sortBy, sortDir });
  const { data: kpis, isLoading: kpisLoading } = useEstoqueCoresKpis(filtros);

  const [selected, setSelected] = useState<EstoqueCorRow | null>(null);
  const [open, setOpen] = useState(false);

  const setF = (f: EstoqueCoresFiltros) => { setBase(f); setPage(0); };
  const onSort = (k: EstoqueCoresSortKey) => {
    if (sortBy === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(k); setSortDir('desc'); }
    setPage(0);
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Estoque por Cor (Unidades)</h1>
            <p className="text-sm text-muted-foreground">
              Visão das unidades de cor com explosão de caixas/boxes do ERP. Atualiza a cada 30s.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-9">
              <Link to="/dashboard/estoque/etiquetas">
                <Settings2 className="h-4 w-4 mr-2" /> Etiquetas
              </Link>
            </Button>
          </div>
        </div>

        <EstoqueCoresKpiBar kpis={kpis} loading={kpisLoading} />

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => { setBusca(e.target.value); setPage(0); }}
                placeholder="Buscar por produto, código ou fabricante..."
                className="pl-9 h-9"
              />
            </div>
            <EstoqueFilialSelect
              selected={base.empresas}
              onChange={(v) => setF({ ...base, empresas: v })}
            />
            <EstoqueCampanhaFilter
              selected={base.campanha_ids}
              onChange={(ids) => setF({ ...base, campanha_ids: ids })}
            />
            <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-card">
              <Switch
                id="incluir-pot"
                checked={base.incluir_potencial}
                onCheckedChange={(v) => setF({ ...base, incluir_potencial: v })}
              />
              <Label htmlFor="incluir-pot" className="text-xs cursor-pointer">Incluir potencial de desmontagem</Label>
            </div>
            <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-card">
              <Switch
                id="apenas-saldo"
                checked={base.apenas_com_saldo}
                onCheckedChange={(v) => setF({ ...base, apenas_com_saldo: v })}
              />
              <Label htmlFor="apenas-saldo" className="text-xs cursor-pointer">Apenas com saldo</Label>
            </div>
            <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-card">
              <Switch
                id="com-pend"
                checked={base.com_pedido_pendente}
                onCheckedChange={(v) => setF({ ...base, com_pedido_pendente: v })}
              />
              <Label htmlFor="com-pend" className="text-xs cursor-pointer">Com pedido pendente</Label>
            </div>
          </div>

          <EstoqueLinhaTabs
            selected={base.linhas}
            onChange={(linhas) => setF({ ...base, linhas })}
          />
        </div>

        <EstoqueCoresTable
          rows={data?.rows ?? []}
          total={data?.total ?? 0}
          loading={isFetching}
          page={page}
          pageSize={pageSize}
          setPage={setPage}
          setPageSize={setPageSize}
          sortBy={sortBy}
          sortDir={sortDir}
          setSort={onSort}
          onRowClick={(r) => { setSelected(r); setOpen(true); }}
        />

        <EstoqueCoresDrawer row={selected} open={open} onOpenChange={setOpen} />
      </div>
    </DashboardLayout>
  );
}
