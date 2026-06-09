import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Search, RefreshCw, ChevronDown, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useEstoqueOptions } from '@/hooks/estoque/useEstoqueFiltrosOptions';
import { useMarcasLinhasOptions } from '@/hooks/estoque/useMarcasLinhasOptions';
import {
  useEstoqueUnificado,
  type EstoqueUnificadoRow,
  type UseEstoqueUnificadoOpts,
} from '@/hooks/estoque/useEstoqueUnificado';
import {
  BACKEND_SORT_KEYS,
  useEstoqueUnificadoTablePrefs,
} from '@/hooks/estoque/useEstoqueUnificadoTablePrefs';
import { EstoqueUnificadoKpis } from '@/components/estoque/unificado/EstoqueUnificadoKpis';
import { EstoqueUnificadoTable } from '@/components/estoque/unificado/EstoqueUnificadoTable';
import { EstoqueUnificadoColumnsMenu } from '@/components/estoque/unificado/EstoqueUnificadoColumnsMenu';
import { EstoqueUnificadoDrawer } from '@/components/estoque/unificado/EstoqueUnificadoDrawer';
import { EstoqueCopilotPanel } from '@/components/estoque/unificado/EstoqueCopilotPanel';
import { EstoqueCopilotFAB } from '@/components/estoque/unificado/EstoqueCopilotFAB';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import type { ModoExibicao } from '@/lib/estoque/modoExibicao';


function MultiSelectChip({
  label, options, selected, onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (v: string) => {
    if (selected.includes(v)) onChange(selected.filter((x) => x !== v));
    else onChange([...selected, v]);
  };
  const triggerLabel =
    selected.length === 0
      ? label
      : selected.length === 1
        ? `${label}: ${selected[0]}`
        : `${label}: ${selected.length}`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={selected.length ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-xs gap-1"
        >
          {triggerLabel}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0 z-[60]" align="start">
        <Command>
          <CommandInput placeholder={`Buscar ${label.toLowerCase()}...`} className="h-9" />
          <CommandList>
            <CommandEmpty>Nada encontrado.</CommandEmpty>
            <CommandGroup>
              {selected.length > 0 && (
                <CommandItem onSelect={() => onChange([])} className="text-muted-foreground">
                  Limpar seleção
                </CommandItem>
              )}
              {options.map((o) => (
                <CommandItem key={o} onSelect={() => toggle(o)}>
                  <Check className={cn('h-4 w-4 mr-2', selected.includes(o) ? 'opacity-100' : 'opacity-0')} />
                  {o}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

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
  const [consolidar, setConsolidar] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(50);
  const tablePrefs = useEstoqueUnificadoTablePrefs();
  const { sortBy, sortDir, isHidden, toggle, reset, setSort } = tablePrefs;
  const [marcas, setMarcas] = useState<string[]>([]);
  const [linhas, setLinhas] = useState<string[]>([]);

  const [selected, setSelected] = useState<EstoqueUnificadoRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [recalculando, setRecalculando] = useState(false);
  const [modo, setModo] = useState<ModoExibicao>('fisico');
  const [copilotOpen, setCopilotOpen] = useState(false);

  // Quando o sort selecionado não é nativo do backend, mantemos um sort estável
  // (default) para a query e o sort real é aplicado client-side na tabela.
  const backendSortBy: UseEstoqueUnificadoOpts['sortBy'] = BACKEND_SORT_KEYS.has(sortBy)
    ? (sortBy as UseEstoqueUnificadoOpts['sortBy'])
    : 'saldo_total_em_unidades';

  const { data: opts } = useEstoqueOptions();
  const { data: marcasLinhasOpts } = useMarcasLinhasOptions();
  const { data, isFetching, refetch, error } = useEstoqueUnificado({
    empresaIds, busca: buscaDeb, somenteComSaldo, page, pageSize,
    sortBy: backendSortBy, sortDir, consolidar,
    marcas, linhas,
  });

  useEffect(() => {
    if (error) toast.error('Falha ao carregar estoque unificado: ' + ((error as any)?.message ?? 'erro desconhecido'));
  }, [error]);

  const handleSort = (k: typeof sortBy) => {
    setSort(k);
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

  const kpisSnapshot = useMemo(() => {
    const rows = data?.aggregateRows ?? [];
    const acc = rows.reduce(
      (a, r) => {
        a.caixas += Number(r.saldo_em_caixas || 0);
        a.displays += Number(r.saldo_em_displays || 0);
        a.unidades += Number(r.saldo_em_unidades || 0);
        a.total_un += Number(r.saldo_total_em_unidades || 0);
        a.bloqueado += Number(r.bloqueado_total_em_unidades || 0);
        a.disponivel += Number(r.disponivel_total_em_unidades || 0);
        a.pendente += Number(r.pendente_total_em_unidades || 0);
        const fcx = Number(r.fator_cx_para_un ?? 0);
        if (fcx > 0) a.equivalente_cx += Number(r.disponivel_total_em_unidades || 0) / fcx;
        return a;
      },
      { caixas: 0, displays: 0, unidades: 0, total_un: 0, bloqueado: 0, disponivel: 0, pendente: 0, equivalente_cx: 0 },
    );
    return {
      caixas: Math.round(acc.caixas),
      displays: Math.round(acc.displays),
      unidades: Math.round(acc.unidades),
      total_un: Math.round(acc.total_un),
      bloqueado: Math.round(acc.bloqueado),
      disponivel: Math.round(acc.disponivel),
      pendente: Math.round(acc.pendente),
      equivalente_cx: Math.round(acc.equivalente_cx * 10) / 10,
    };
  }, [data?.aggregateRows]);

  const copilotFiltros = useMemo(
    () => ({
      empresaIds,
      marcas,
      linhas,
      busca: buscaDeb,
      somenteComSaldo,
      consolidar,
      modo,
    }),
    [empresaIds, marcas, linhas, buscaDeb, somenteComSaldo, consolidar, modo],
  );

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

        <EstoqueUnificadoKpis rows={data?.aggregateRows ?? []} total={data?.total ?? 0} loading={isFetching} modo={modo} />

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

          <div className="flex items-center gap-2" title="Soma os saldos do mesmo SKU em todas as empresas">
            <Label htmlFor="consolidar" className="text-sm">Consolidar empresas</Label>
            <Switch id="consolidar" checked={consolidar} onCheckedChange={(v) => { setConsolidar(v); setPage(0); }} />
          </div>

          <ToggleGroup
            type="single"
            value={modo}
            onValueChange={(v) => v && setModo(v as ModoExibicao)}
            className="border rounded-md"
            size="sm"
          >
            <ToggleGroupItem value="fisico" className="h-7 text-xs px-2">Físico</ToggleGroupItem>
            <ToggleGroupItem value="cx" className="h-7 text-xs px-2">CX</ToggleGroupItem>
            <ToggleGroupItem value="bx" className="h-7 text-xs px-2">BX</ToggleGroupItem>
            <ToggleGroupItem value="un" className="h-7 text-xs px-2">UN</ToggleGroupItem>
          </ToggleGroup>

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

            <span className="mx-1 h-5 w-px bg-border" aria-hidden />

            <MultiSelectChip
              label="Marca"
              options={marcasLinhasOpts?.marcas ?? []}
              selected={marcas}
              onChange={(v) => { setMarcas(v); setPage(0); }}
            />
            <MultiSelectChip
              label="Linha"
              options={marcasLinhasOpts?.linhas ?? []}
              selected={linhas}
              onChange={(v) => { setLinhas(v); setPage(0); }}
            />
            {(marcas.length > 0 || linhas.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setMarcas([]); setLinhas([]); setPage(0); }}
              >
                Limpar marca/linha
              </Button>
            )}

            <span className="mx-1 h-5 w-px bg-border" aria-hidden />

            <EstoqueUnificadoColumnsMenu isHidden={isHidden} toggle={toggle} reset={reset} />
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
          isHidden={isHidden}
          onRowClick={(r) => { setSelected(r); setDrawerOpen(true); }}
          modo={modo}
          consolidado={consolidar}
        />


        <EstoqueUnificadoDrawer row={selected} open={drawerOpen} onOpenChange={setDrawerOpen} />
      </div>

      <EstoqueCopilotFAB onClick={() => setCopilotOpen(true)} />
      <EstoqueCopilotPanel
        open={copilotOpen}
        onOpenChange={setCopilotOpen}
        filtros={copilotFiltros}
        kpisSnapshot={kpisSnapshot}
      />
    </DashboardLayout>
  );
}
