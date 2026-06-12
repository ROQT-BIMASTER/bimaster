import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Search, Settings2, ShieldCheck, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  useEstoqueCoresQuery,
  FILTROS_CORES_INICIAIS,
  type EstoqueCoresFiltros,
  type EstoqueCorRow,
  type EstoqueCoresSortKey,
} from '@/hooks/estoque/useEstoqueCoresQuery';
import { useEstoqueCoresKpis } from '@/hooks/estoque/useEstoqueCoresKpis';
import {
  useEstoqueCoresConsolidadoQuery,
  useEstoqueCoresKpisConsolidado,
  type EstoqueCoresConsolidadoSortKey,
} from '@/hooks/estoque/useEstoqueCoresConsolidadoQuery';
import { EstoqueCoresKpiBar } from '@/components/estoque/cores/EstoqueCoresKpiBar';
import { EstoqueCoresTable } from '@/components/estoque/cores/EstoqueCoresTable';
import { EstoqueCoresDrawer } from '@/components/estoque/cores/EstoqueCoresDrawer';
import { EstoqueLinhaTabs } from '@/components/estoque/cores/EstoqueLinhaTabs';
import { EstoqueCampanhaFilter } from '@/components/estoque/cores/EstoqueCampanhaFilter';
import { EstoqueFilialSelect } from '@/components/estoque/visao-geral/EstoqueFilialSelect';

const CONSOLIDADO_KEY = 'estoque-cores:consolidado';

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

  const [consolidado, setConsolidado] = useState<boolean>(() => {
    try { return localStorage.getItem(CONSOLIDADO_KEY) === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(CONSOLIDADO_KEY, consolidado ? '1' : '0'); } catch {}
  }, [consolidado]);

  const filtros = useMemo<EstoqueCoresFiltros>(() => ({ ...base, busca: buscaD }), [base, buscaD]);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  // sort keys separados por modo (compatíveis nos labels comuns)
  const [sortByEmp, setSortByEmp] = useState<EstoqueCoresSortKey>('saldo_total_disponivel');
  const [sortByCons, setSortByCons] = useState<EstoqueCoresConsolidadoSortKey>('saldo_total_disponivel');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const empQuery = useEstoqueCoresQuery({
    filtros, page, pageSize, sortBy: sortByEmp, sortDir,
  });
  const consQuery = useEstoqueCoresConsolidadoQuery({
    filtros, page, pageSize, sortBy: sortByCons, sortDir, enabled: consolidado,
  });
  const kpisEmp = useEstoqueCoresKpis(filtros);
  const kpisCons = useEstoqueCoresKpisConsolidado(filtros, consolidado);

  // mantém a mesma query ativa para o card de KPIs
  const kpis = consolidado
    ? (kpisCons.data
        ? {
            ...kpisCons.data,
            // EstoqueCoresKpis tem total_custo e total_valor_venda; alimenta com 0 (não exibidos)
            total_custo: 0,
            total_valor_venda: 0,
          }
        : undefined)
    : kpisEmp.data;
  const kpisLoading = consolidado ? kpisCons.isLoading : kpisEmp.isLoading;

  const [selected, setSelected] = useState<EstoqueCorRow | null>(null);
  const [open, setOpen] = useState(false);

  const setF = (f: EstoqueCoresFiltros) => { setBase(f); setPage(0); };

  const onSortEmp = (k: EstoqueCoresSortKey) => {
    if (sortByEmp === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortByEmp(k); setSortDir('desc'); }
    setPage(0);
  };
  const onSortCons = (k: EstoqueCoresConsolidadoSortKey) => {
    if (sortByCons === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortByCons(k); setSortDir('desc'); }
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
              <Link to="/dashboard/estoque/reconciliacao-cores">
                <ShieldCheck className="h-4 w-4 mr-2" /> Reconciliar com Unificado
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-9">
              <Link to="/dashboard/estoque/etiquetas">
                <Settings2 className="h-4 w-4 mr-2" /> Etiquetas
              </Link>
            </Button>
          </div>
        </div>

        <EstoqueCoresKpiBar kpis={kpis} loading={kpisLoading} consolidado={consolidado} />

        <DivergenciaLinhaBanner
          ativo={base.apenas_divergencia_linha}
          onToggle={(v) => setF({ ...base, apenas_divergencia_linha: v })}
          rows={consolidado ? (consQuery.data?.rows ?? []) : (empQuery.data?.rows ?? [])}
        />

        {base.incluir_potencial && (
          <Alert className="py-2">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              O potencial de desmontagem é <strong>rateado entre as cores-folha</strong>: se uma caixa-pai com saldo X pode virar N variantes de cor, cada variante recebe X/N (não X). Dessa forma o somatório de "Unidades totais" desta tela <strong>bate exatamente</strong> com o "Total em UN" do Estoque Unificado — sem duplicação. Composição lida em tempo real do ERP.
            </AlertDescription>
          </Alert>
        )}

        <ConciliacaoBadge />
        



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
                id="consolidado"
                checked={consolidado}
                onCheckedChange={(v) => { setConsolidado(v); setPage(0); }}
              />
              <Label htmlFor="consolidado" className="text-xs cursor-pointer">Consolidar empresas</Label>
            </div>
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
            <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-card">
              <Switch
                id="div-linha"
                checked={base.apenas_divergencia_linha}
                onCheckedChange={(v) => setF({ ...base, apenas_divergencia_linha: v })}
              />
              <Label htmlFor="div-linha" className="text-xs cursor-pointer flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-warning" />
                Somente divergências de linha
              </Label>
            </div>
          </div>

          <EstoqueLinhaTabs
            selected={base.linhas}
            onChange={(linhas) => setF({ ...base, linhas })}
          />
        </div>

        {consolidado ? (
          <EstoqueCoresTable
            variant="consolidado"
            rows={consQuery.data?.rows ?? []}
            total={consQuery.data?.total ?? 0}
            loading={consQuery.isFetching}
            page={page}
            pageSize={pageSize}
            setPage={setPage}
            setPageSize={setPageSize}
            sortBy={sortByCons}
            sortDir={sortDir}
            setSort={onSortCons}
          />
        ) : (
          <EstoqueCoresTable
            variant="por-empresa"
            rows={empQuery.data?.rows ?? []}
            total={empQuery.data?.total ?? 0}
            loading={empQuery.isFetching}
            page={page}
            pageSize={pageSize}
            setPage={setPage}
            setPageSize={setPageSize}
            sortBy={sortByEmp}
            sortDir={sortDir}
            setSort={onSortEmp}
            onRowClick={(r) => { setSelected(r); setOpen(true); }}
          />
        )}

        <EstoqueCoresDrawer row={selected} open={open} onOpenChange={setOpen} />
      </div>
    </DashboardLayout>
  );
}

interface RowWithDiv {
  cod_produto: number | null;
  tem_divergencia_linha?: boolean | null;
  linhas_divergentes?: string[] | null;
}

function DivergenciaLinhaBanner({
  ativo,
  onToggle,
  rows,
}: {
  ativo: boolean;
  onToggle: (v: boolean) => void;
  rows: RowWithDiv[];
}) {
  const divergentes = new Set<number>();
  for (const r of rows) {
    if (r.tem_divergencia_linha && r.cod_produto != null) divergentes.add(r.cod_produto);
  }
  const count = divergentes.size;
  if (count === 0 && !ativo) return null;
  return (
    <Alert className="py-2 border-warning/50 bg-warning/5">
      <AlertTriangle className="h-4 w-4 text-warning" />
      <AlertDescription className="text-xs flex flex-wrap items-center justify-between gap-2 w-full">
        <span>
          {count > 0 ? (
            <>
              <strong>{count}</strong> SKU{count === 1 ? '' : 's'} no recorte atual com <strong>linha divergente no ERP</strong> (mesmo produto cadastrado em linhas diferentes entre filiais).{' '}
            </>
          ) : (
            <>Nenhuma divergência no recorte atual. </>
          )}
          O saldo unificado <strong>já soma corretamente</strong> todas as filiais — a divergência é apenas no rótulo da linha. Corrija o cadastro no ERP.
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant={ativo ? 'default' : 'outline'}
            className="h-7 text-xs"
            onClick={() => onToggle(!ativo)}
          >
            {ativo ? 'Mostrar todos' : 'Filtrar somente divergências'}
          </Button>
          <Button asChild size="sm" variant="outline" className="h-7 text-xs">
            <Link to="/dashboard/estoque/auditoria-linhas-erp">Auditoria completa</Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
