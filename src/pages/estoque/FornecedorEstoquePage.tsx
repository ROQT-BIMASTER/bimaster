import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, CalendarIcon, Columns3, ExternalLink, Search, X } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { parseLocalDate } from '@/lib/utils/parseLocalDate';
import { useAuth } from '@/contexts/AuthContext';
import {
  useDistribuidorasEmpresas,
  useEmpresasFornecedor,
  useFornecedorEstoqueKpisAvancados,
  useFornecedorFiltroOpcoes,
  useFornecedorIntegradoKpis,
  useFornecedorIntegradoList,
  useFornecedorTotalCaixas,
  type CasadoFiltro,
  type FornecedorSortBy,
} from '@/hooks/estoque/useFornecedorIntegrado';
import { SyncHealthBadge } from '@/components/estoque/SyncHealthBadge';

const PAGE_SIZE = 25;
const numberFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const decimalFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
const cxFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

type ColKey = 'empresa' | 'ean' | 'codFutura' | 'descricao' | 'categoria' | 'estoqueForn' | 'validade' | 'casado' | 'nossoProduto' | 'atualizado';
const COL_LABEL: Record<ColKey, string> = {
  empresa: 'Empresa',
  ean: 'EAN caixa',
  codFutura: 'Cód. Futura',
  descricao: 'Descrição',
  categoria: 'Categoria',
  estoqueForn: 'Estoque forn. (CX)',
  validade: 'Validade',
  casado: 'Casado',
  nossoProduto: 'Nosso produto',
  atualizado: 'Atualizado',
};
const DEFAULT_ORDER: ColKey[] = ['empresa', 'ean', 'codFutura', 'descricao', 'categoria', 'estoqueForn', 'validade', 'casado', 'nossoProduto', 'atualizado'];
const DEFAULT_HIDDEN: ColKey[] = ['ean', 'codFutura', 'categoria'];

interface ColsState { order: ColKey[]; hidden: ColKey[]; }
const defaultColsState: ColsState = { order: DEFAULT_ORDER, hidden: DEFAULT_HIDDEN };
const storageKey = (uid: string | null) => `fornecedor-estoque:cols:v2:${uid ?? 'anon'}`;

function formatTs(value: string | null): string {
  if (!value) return '—';
  try {
    const d = value.length === 10 ? parseLocalDate(value) : new Date(value);
    if (!d || Number.isNaN(d.getTime())) return '—';
    return format(d, 'dd/MM HH:mm');
  } catch { return '—'; }
}

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

function OrigemBadge({ origem, casado }: { origem: string | null; casado: boolean | null }) {
  if (!casado) return <Badge variant="outline" className="bg-muted/40 text-[10px] text-muted-foreground">Não casado</Badge>;
  const map: Record<string, string> = {
    master_caixa: 'Master · caixa', master_unitario: 'Master · unitário',
    depara_manual: 'De-para manual', fabrica_produtos: 'Fábrica',
  };
  return (
    <div className="flex flex-col gap-0.5">
      <Badge className="w-fit bg-success/15 text-[10px] text-success hover:bg-success/15">Casado</Badge>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{map[origem ?? ''] ?? origem ?? '—'}</span>
    </div>
  );
}

function renderValidadeCell(k: ColKey, r: any) {
  const raw = r.validade_ultimo_lote as string | null;
  const dias = r.validade_dias as number | null;
  if (!raw && dias == null) {
    return <TableCell key={k} className="text-xs text-muted-foreground">—</TableCell>;
  }
  let label = '—';
  let tone = '';
  if (raw) {
    const d = parseLocalDate(raw);
    if (d && !Number.isNaN(d.getTime())) {
      label = format(d, 'dd/MM/yyyy');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((d.getTime() - today.getTime()) / 86_400_000);
      if (diffDays < 0) tone = 'text-destructive font-medium';
      else if (diffDays < 90) tone = 'text-amber-600 dark:text-amber-400 font-medium';
    }
  }
  return (
    <TableCell key={k}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">
            <div className={cn('text-xs', tone)}>{label}</div>
            {dias != null && (
              <div className="text-[10px] text-muted-foreground">Prazo: {dias}d</div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="max-w-[240px] text-xs">
            Validade do último lote cadastrado (aproximada — não é FEFO).
          </div>
        </TooltipContent>
      </Tooltip>
    </TableCell>
  );
}

export default function FornecedorEstoquePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.id ?? null;

  const [buscaInput, setBuscaInput] = useState('');
  const busca = useDebounced(buscaInput, 300);
  const [empresas, setEmpresas] = useState<number[]>([]);
  const [distribuidorasSel, setDistribuidorasSel] = useState<number[]>([]);
  const [casadoFiltro, setCasadoFiltro] = useState<CasadoFiltro>('todos');
  const [apenasComSaldo, setApenasComSaldo] = useState(false);
  const [statusSel, setStatusSel] = useState<string[]>([]);
  const [categoriasSel, setCategoriasSel] = useState<string[]>([]);
  const [linhasSel, setLinhasSel] = useState<string[]>([]);
  const [dataDe, setDataDe] = useState<Date | undefined>(undefined);
  const [dataAte, setDataAte] = useState<Date | undefined>(undefined);

  const [sortBy, setSortBy] = useState<FornecedorSortBy>('fornecedor_caixas');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  // Per-user column state (order + hidden), persisted in localStorage
  const [cols, setCols] = useState<ColsState>(defaultColsState);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(uid));
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ColsState>;
        const order = Array.isArray(parsed.order)
          ? [
              ...parsed.order.filter((k): k is ColKey => (DEFAULT_ORDER as string[]).includes(k)),
              ...DEFAULT_ORDER.filter((k) => !parsed.order!.includes(k)),
            ]
          : DEFAULT_ORDER;
        const hidden = Array.isArray(parsed.hidden)
          ? (parsed.hidden.filter((k): k is ColKey => (DEFAULT_ORDER as string[]).includes(k)))
          : DEFAULT_HIDDEN;
        setCols({ order, hidden });
      } else {
        setCols(defaultColsState);
      }
    } catch { setCols(defaultColsState); }
  }, [uid]);
  useEffect(() => {
    try { localStorage.setItem(storageKey(uid), JSON.stringify(cols)); } catch {}
  }, [cols, uid]);

  const visibleCols = useMemo(() => cols.order.filter((k) => !cols.hidden.includes(k)), [cols]);
  const isHidden = (k: ColKey) => cols.hidden.includes(k);
  const toggleHidden = (k: ColKey, v: boolean) =>
    setCols((p) => ({ ...p, hidden: v ? p.hidden.filter((x) => x !== k) : [...p.hidden, k] }));
  const moveCol = (k: ColKey, dir: -1 | 1) =>
    setCols((p) => {
      const i = p.order.indexOf(k);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.order.length) return p;
      const order = [...p.order];
      [order[i], order[j]] = [order[j], order[i]];
      return { ...p, order };
    });

  useEffect(() => { setPage(0); }, [busca, empresas, distribuidorasSel, casadoFiltro, apenasComSaldo, statusSel, categoriasSel, linhasSel, dataDe, dataAte, sortBy, sortDir]);
  useEffect(() => {
    const prev = document.title;
    document.title = 'Estoque do fornecedor · Estoque';
    return () => { document.title = prev; };
  }, []);

  const { data: kpis, isLoading: kpisLoading } = useFornecedorIntegradoKpis();
  const { data: totalCx, isLoading: totalCxLoading } = useFornecedorTotalCaixas();
  const { data: kpisAdv, isLoading: kpisAdvLoading } = useFornecedorEstoqueKpisAvancados();
  const { data: empresasOpt = [] } = useEmpresasFornecedor();
  const { data: distribuidoras = [] } = useDistribuidorasEmpresas();
  const { data: filtroOpcoes } = useFornecedorFiltroOpcoes();
  const { data, isLoading, isError, error } = useFornecedorIntegradoList({
    busca, empresas, casadoFiltro, apenasComSaldo,
    status: statusSel, categorias: categoriasSel, linhas: linhasSel,
    dataDe: dataDe ? format(dataDe, 'yyyy-MM-dd') : null,
    dataAte: dataAte ? format(dataAte, 'yyyy-MM-dd') : null,
    sortBy, sortDir, page, pageSize: PAGE_SIZE,
  });


  const distribuidorasVisiveis = useMemo(
    () => distribuidorasSel.length === 0 ? distribuidoras : distribuidoras.filter((d) => distribuidorasSel.includes(d.id)),
    [distribuidoras, distribuidorasSel],
  );
  const filtroDistAtivo = distribuidorasSel.length > 0;

  const colSpan = visibleCols.length + distribuidorasVisiveis.length + 1;

  const limparFiltros = () => {
    setBuscaInput(''); setEmpresas([]); setDistribuidorasSel([]);
    setCasadoFiltro('todos'); setApenasComSaldo(false);
    setStatusSel([]); setCategoriasSel([]); setLinhasSel([]);
    setDataDe(undefined); setDataAte(undefined);
  };
  const filtrosAtivos = buscaInput.length > 0 || empresas.length > 0 || distribuidorasSel.length > 0 || casadoFiltro !== 'todos' || apenasComSaldo || statusSel.length > 0 || categoriasSel.length > 0 || linhasSel.length > 0 || !!dataDe || !!dataAte;


  const totalPages = useMemo(() => Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE)), [data?.total]);

  // Agrupa rows por nome_linha preservando a ordenação original como tie-breaker.
  const groupedRows = useMemo(() => {
    const groups = new Map<string, any[]>();
    const order: string[] = [];
    for (const r of (data?.rows ?? []) as any[]) {
      const key = r.nome_linha ?? '__sem_linha__';
      if (!groups.has(key)) { groups.set(key, []); order.push(key); }
      groups.get(key)!.push(r);
    }
    // Sort group keys alphabetically, "Sem linha" por último.
    order.sort((a, b) => {
      if (a === '__sem_linha__') return 1;
      if (b === '__sem_linha__') return -1;
      return a.localeCompare(b, 'pt-BR');
    });
    return order.map((k) => ({ key: k, label: k === '__sem_linha__' ? 'Sem linha' : k, rows: groups.get(k)! }));
  }, [data?.rows]);


  const toggleSort = (col: FornecedorSortBy) => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir(col === 'futura_descricao' ? 'asc' : 'desc'); }
  };

  const empresasLabel = empresas.length === 0 ? 'Todas as empresas' : empresas.length === 1
    ? (empresasOpt.find((e) => e.id === empresas[0])?.nome ?? `Empresa ${empresas[0]}`) : `${empresas.length} empresas`;
  const distLabel = distribuidorasSel.length === 0 ? 'Todas as filiais' : distribuidorasSel.length === 1
    ? (distribuidoras.find((d) => d.id === distribuidorasSel[0])?.abrev ?? `Filial ${distribuidorasSel[0]}`) : `${distribuidorasSel.length} filiais`;
  const statusLabel = statusSel.length === 0 ? 'Todos status' : statusSel.length === 1 ? statusSel[0] : `${statusSel.length} status`;
  const categoriaLabel = categoriasSel.length === 0 ? 'Todas categorias' : categoriasSel.length === 1 ? categoriasSel[0] : `${categoriasSel.length} categorias`;
  const linhaLabel = linhasSel.length === 0 ? 'Todas linhas' : linhasSel.length === 1 ? linhasSel[0] : `${linhasSel.length} linhas`;

  const dataLabel = (dataDe || dataAte)
    ? `${dataDe ? format(dataDe, 'dd/MM/yy') : '…'} – ${dataAte ? format(dataAte, 'dd/MM/yy') : '…'}`
    : 'Período';

  const renderHeaderCell = (k: ColKey) => {
    switch (k) {
      case 'empresa': return <TableHead key={k}>Empresa</TableHead>;
      case 'ean': return <TableHead key={k}>EAN caixa</TableHead>;
      case 'codFutura': return <TableHead key={k}>Cód. Futura</TableHead>;
      case 'descricao': return <TableHead key={k}><SortBtn label="Descrição" col="futura_descricao" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} /></TableHead>;
      case 'categoria': return <TableHead key={k}>Categoria</TableHead>;
      case 'estoqueForn': return <TableHead key={k} className="text-right"><SortBtn label="Estoque forn. (CX)" col="fornecedor_caixas" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} /></TableHead>;
      case 'validade': return <TableHead key={k}>Validade</TableHead>;
      case 'casado': return <TableHead key={k}>Casado</TableHead>;
      case 'nossoProduto': return <TableHead key={k}>Nosso produto</TableHead>;
      case 'atualizado': return <TableHead key={k}>Atualizado</TableHead>;
    }
  };

  const renderBodyCell = (k: ColKey, r: any) => {
    switch (k) {
      case 'empresa': return (
        <TableCell key={k}>
          <div className="text-sm">{r.empresa_nome ?? '—'}</div>
          <div className="text-[10px] text-muted-foreground">{r.empresa_id}</div>
        </TableCell>
      );
      case 'ean': return <TableCell key={k} className="font-mono text-xs">{r.ean_caixa ?? '—'}</TableCell>;
      case 'codFutura': return <TableCell key={k} className="font-mono text-xs">{r.futura_codigo ?? '—'}</TableCell>;
      case 'descricao': return (
        <TableCell key={k}>
          <div className="text-sm">{r.futura_descricao ?? '—'}</div>
          {r.futura_status && <Badge variant="outline" className="mt-0.5 text-[10px]">{r.futura_status}</Badge>}
        </TableCell>
      );
      case 'categoria': return <TableCell key={k} className="text-xs">{r.categoria ?? '—'}</TableCell>;
      case 'estoqueForn': return (
        <TableCell key={k} className="text-right tabular-nums">
          {r.fornecedor_caixas != null ? decimalFmt.format(Number(r.fornecedor_caixas)) : '—'}
        </TableCell>
      );
      case 'validade': return renderValidadeCell(k, r);
      case 'casado': return <TableCell key={k}><OrigemBadge origem={r.origem_match} casado={r.casado} /></TableCell>;
      case 'nossoProduto': return (
        <TableCell key={k}>
          {r.casado ? (
            <div>
              <div className="text-sm">
                <span className="font-mono text-xs text-muted-foreground">{r.nosso_codigo ?? '—'}</span>
                {r.sku && <span className="ml-2 font-mono text-xs">{r.sku}</span>}
              </div>
              <div className="text-xs text-muted-foreground">{r.nome_comercial ?? '—'}</div>
            </div>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </TableCell>
      );
      case 'atualizado': return (
        <TableCell key={k}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-help text-xs text-muted-foreground">{formatTs(r.data_atualizacao_origem)}</div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">Origem: {formatTs(r.data_atualizacao_origem)}</div>
              <div className="text-xs">Sync: {formatTs(r.sincronizado_em)}</div>
            </TooltipContent>
          </Tooltip>
        </TableCell>
      );
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="w-full space-y-4 px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit text-muted-foreground hover:text-foreground">
            <Link to="/dashboard/fornecedor"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao módulo Fornecedor</Link>
          </Button>
          <div className="flex items-center gap-2">
            <SyncHealthBadge />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm"><Columns3 className="mr-2 h-4 w-4" /> Colunas</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Colunas e ordem</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {cols.order.map((k, idx) => (
                  <div key={k} className="flex items-center gap-1 px-2 py-1">
                    <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === 0} onClick={(e) => { e.preventDefault(); moveCol(k, -1); }}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === cols.order.length - 1} onClick={(e) => { e.preventDefault(); moveCol(k, 1); }}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" className="h-3.5 w-3.5" checked={!isHidden(k)} onChange={(e) => toggleHidden(k, e.target.checked)} />
                      {COL_LABEL[k]}
                    </label>
                  </div>
                ))}
                <DropdownMenuSeparator />
                <button className="w-full px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent" onClick={() => setCols(defaultColsState)}>
                  Restaurar padrão
                </button>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard/estoque/fornecedor-depara">
                <ExternalLink className="mr-2 h-4 w-4" /> Exceções de de-para
              </Link>
            </Button>
          </div>
        </div>

        <header>
          <h1 className="text-xl font-semibold">Estoque do fornecedor</h1>
          <p className="text-sm text-muted-foreground">Visualização dos itens do fornecedor (Futura) com casamento ao catálogo master.</p>
        </header>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <KpiCard label="Itens casados" value={kpisLoading ? '—' : numberFmt.format(kpis?.casados ?? 0)} sub={kpisLoading ? '' : `${kpis?.pct_casado ?? 0}% de ${numberFmt.format(kpis?.total ?? 0)}`} />
          <KpiCard label="Itens com saldo (forn.)" value={kpisLoading ? '—' : numberFmt.format(kpis?.com_saldo ?? 0)} sub="fornecedor_caixas > 0" />
          <KpiCard label="Caixas no fornecedor" value={totalCxLoading ? '—' : numberFmt.format(Math.round(totalCx ?? 0))} sub="Soma Futura" />
          <KpiCard label="Disponível nosso (CX)" value={kpisAdvLoading ? '—' : cxFmt.format(kpisAdv?.disp_cx_total ?? 0)} sub="Saldo − bloqueado" accent />
          <KpiCard label="Disponível nosso (UN)" value={kpisAdvLoading ? '—' : numberFmt.format(Math.round(kpisAdv?.disp_un_total ?? 0))} sub="Convertido em unidades" accent />
          <KpiCard label="Cobertura vs. fornecedor" value={kpisAdvLoading ? '—' : `${kpisAdv?.cobertura_pct ?? 0}%`} sub="CX disp. / CX no fornec." tooltip="Razão entre nossa caixa máster disponível e a caixa que o fornecedor tem em estoque." />
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 space-y-0 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base">Itens</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="w-72 pl-8" placeholder="Buscar descrição, EAN, código ou SKU" value={buscaInput} onChange={(e) => setBuscaInput(e.target.value)} />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" size="sm">{empresasLabel}</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Empresa (fornecedor)</DropdownMenuLabel><DropdownMenuSeparator />
                  {empresasOpt.map((e) => (
                    <DropdownMenuCheckboxItem key={e.id} checked={empresas.includes(e.id)}
                      onCheckedChange={(v) => setEmpresas((p) => v ? [...p, e.id] : p.filter((x) => x !== e.id))}>
                      {e.nome} · {e.id}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {empresasOpt.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma empresa</div>}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" size="sm">{distLabel}</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Filiais (distribuidoras)</DropdownMenuLabel><DropdownMenuSeparator />
                  {distribuidoras.map((d) => (
                    <DropdownMenuCheckboxItem key={d.id} checked={distribuidorasSel.includes(d.id)}
                      onCheckedChange={(v) => setDistribuidorasSel((p) => v ? [...p, d.id] : p.filter((x) => x !== d.id))}>
                      {d.abrev} — {d.nome}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {distribuidoras.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma filial</div>}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" size="sm">{statusLabel}</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Status</DropdownMenuLabel><DropdownMenuSeparator />
                  {(filtroOpcoes?.status ?? []).map((s) => (
                    <DropdownMenuCheckboxItem key={s} checked={statusSel.includes(s)}
                      onCheckedChange={(v) => setStatusSel((p) => v ? [...p, s] : p.filter((x) => x !== s))}>
                      {s}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {(filtroOpcoes?.status?.length ?? 0) === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Sem status</div>}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" size="sm">{categoriaLabel}</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-72 w-64 overflow-y-auto">
                  <DropdownMenuLabel>Categoria</DropdownMenuLabel><DropdownMenuSeparator />
                  {(filtroOpcoes?.categorias ?? []).map((c) => (
                    <DropdownMenuCheckboxItem key={c} checked={categoriasSel.includes(c)}
                      onCheckedChange={(v) => setCategoriasSel((p) => v ? [...p, c] : p.filter((x) => x !== c))}>
                      {c}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {(filtroOpcoes?.categorias?.length ?? 0) === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Sem categorias</div>}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" size="sm">{linhaLabel}</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-72 w-64 overflow-y-auto">
                  <DropdownMenuLabel>Linha</DropdownMenuLabel><DropdownMenuSeparator />
                  {(filtroOpcoes?.linhas ?? []).map((l) => (
                    <DropdownMenuCheckboxItem key={l} checked={linhasSel.includes(l)}
                      onCheckedChange={(v) => setLinhasSel((p) => v ? [...p, l] : p.filter((x) => x !== l))}>
                      {l}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {(filtroOpcoes?.linhas?.length ?? 0) === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Sem linhas</div>}
                </DropdownMenuContent>
              </DropdownMenu>


              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn(!dataDe && !dataAte && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" /> {dataLabel}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="end">
                  <div className="flex gap-3">
                    <div>
                      <div className="mb-1 text-xs text-muted-foreground">De</div>
                      <Calendar mode="single" selected={dataDe} onSelect={setDataDe} className={cn('p-0 pointer-events-auto')} />
                    </div>
                    <div>
                      <div className="mb-1 text-xs text-muted-foreground">Até</div>
                      <Calendar mode="single" selected={dataAte} onSelect={setDataAte} className={cn('p-0 pointer-events-auto')} />
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => { setDataDe(undefined); setDataAte(undefined); }}>Limpar</Button>
                  </div>
                </PopoverContent>
              </Popover>

              <Select value={casadoFiltro} onValueChange={(v) => setCasadoFiltro(v as CasadoFiltro)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="casados">Só casados</SelectItem>
                  <SelectItem value="nao_casados">Só não casados</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Switch id="apenas-saldo" checked={apenasComSaldo} onCheckedChange={setApenasComSaldo} />
                <Label htmlFor="apenas-saldo" className="text-sm">Só com saldo</Label>
              </div>

              {filtrosAtivos && (
                <Button variant="ghost" size="sm" onClick={limparFiltros} className="text-muted-foreground hover:text-foreground">
                  <X className="mr-1 h-3 w-3" /> Limpar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    {visibleCols.map((k) => renderHeaderCell(k))}
                    {distribuidorasVisiveis.map((d) => (
                      <TableHead key={d.id} className="text-right" title={`${d.nome} (id ${d.id})`}>{d.abrev}</TableHead>
                    ))}
                    <TableHead className="border-l-2 border-primary/30 bg-muted/40 text-right font-semibold">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={colSpan}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
                  ))}
                  {!isLoading && isError && (
                    <TableRow>
                      <TableCell colSpan={colSpan} className="bg-destructive/10 text-center text-sm text-destructive">
                        Erro ao carregar: {(error as Error)?.message ?? 'falha desconhecida'}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && !isError && (data?.rows.length ?? 0) === 0 && (
                    <TableRow>
                      <TableCell colSpan={colSpan} className="text-center text-sm text-muted-foreground">
                        <div>Nenhum item para os filtros atuais.</div>
                        {filtrosAtivos && (
                          <Button size="sm" variant="link" className="mt-1" onClick={limparFiltros}>Limpar filtros</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && !isError && groupedRows.map((g) => (
                    <Fragment key={g.key}>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableCell colSpan={colSpan} className="py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {g.label} <span className="ml-2 font-normal normal-case text-muted-foreground/70">· {g.rows.length} item(ns)</span>
                        </TableCell>
                      </TableRow>
                      {g.rows.map((r: any) => {
                        let totalCxV: number | null = r.nosso_disponivel_cx ?? null;
                        let totalUnV: number | null = r.nosso_disponivel_un ?? null;
                        if (filtroDistAtivo && r.casado) {
                          let cxSum = 0, unSum = 0, hasAny = false;
                          for (const d of distribuidorasVisiveis) {
                            const s = r.saldos_por_empresa?.[String(d.id)] as any;
                            if (!s) continue;
                            hasAny = true;
                            if (s.disp_cx != null) cxSum += Number(s.disp_cx);
                            if (s.disp_un != null) unSum += Number(s.disp_un);
                          }
                          totalCxV = hasAny ? cxSum : null;
                          totalUnV = hasAny ? unSum : null;
                        }
                        return (
                          <TableRow key={`${r.empresa_id}-${r.futura_codigo}-${r.ean_normalizado}`} className="border-b border-border/60">
                            {visibleCols.map((k) => renderBodyCell(k, r))}
                            {distribuidorasVisiveis.map((d) => {
                              const s = r.saldos_por_empresa?.[String(d.id)] as any;
                              const dispUn = s ? Number(s.disp_un ?? 0) : 0;
                              const dispCx = s && s.disp_cx != null ? Number(s.disp_cx) : null;
                              if (!r.casado || !s || (!dispUn && !dispCx)) {
                                return <TableCell key={d.id} className="text-right text-xs text-muted-foreground">—</TableCell>;
                              }
                              return (
                                <TableCell key={d.id} className="text-right tabular-nums">
                                  <div className="text-sm">
                                    {dispCx != null ? cxFmt.format(dispCx) : '—'}<span className="text-[10px] text-muted-foreground"> CX</span>
                                  </div>
                                  <div className="text-[10px] font-medium text-success">{numberFmt.format(Math.round(dispUn))} UN</div>
                                </TableCell>
                              );
                            })}
                            <TableCell className="border-l-2 border-primary/30 bg-muted/40 text-right font-semibold tabular-nums">
                              {r.casado ? (
                                <div>
                                  <div className="text-sm">
                                    {totalCxV != null ? cxFmt.format(totalCxV) : '—'}<span className="text-[10px] text-muted-foreground"> CX</span>
                                  </div>
                                  <div className="text-[10px] font-medium text-success">{numberFmt.format(Math.round(Number(totalUnV ?? 0)))} UN</div>
                                </div>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </Fragment>
                  ))}

                </TableBody>
              </Table>
            </div>

            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{numberFmt.format(data?.total ?? 0)} item(ns) · página {page + 1} de {totalPages}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}

function KpiCard({ label, value, sub, accent, tooltip }: { label: string; value: string; sub?: string; accent?: boolean; tooltip?: string }) {
  const body = (
    <Card className={accent ? 'border-primary/30 bg-primary/5' : undefined}>
      <CardContent className="p-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
        {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
  if (!tooltip) return body;
  return (
    <Tooltip>
      <TooltipTrigger asChild><div className="cursor-help">{body}</div></TooltipTrigger>
      <TooltipContent className="max-w-xs"><span className="text-xs">{tooltip}</span></TooltipContent>
    </Tooltip>
  );
}

function SortBtn({ label, col, sortBy, sortDir, onClick }: {
  label: string; col: FornecedorSortBy; sortBy: FornecedorSortBy; sortDir: 'asc' | 'desc'; onClick: (c: FornecedorSortBy) => void;
}) {
  const active = sortBy === col;
  return (
    <button type="button" onClick={() => onClick(col)}
      className={`inline-flex items-center gap-1 hover:text-foreground ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
      {label}<ArrowUpDown className="h-3 w-3" />{active && <span className="text-[10px]">{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </button>
  );
}
