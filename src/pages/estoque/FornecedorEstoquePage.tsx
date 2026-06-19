import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUpDown, Columns3, ExternalLink, Search, X } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import {
  useDistribuidorasEmpresas,
  useEmpresasFornecedor,
  useFornecedorEstoqueKpisAvancados,
  useFornecedorIntegradoKpis,
  useFornecedorIntegradoList,
  useFornecedorTotalCaixas,
  type CasadoFiltro,
  type FornecedorSortBy,
} from '@/hooks/estoque/useFornecedorIntegrado';

const PAGE_SIZE = 25;
const numberFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const decimalFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
const cxFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

type ColKey = 'empresa' | 'ean' | 'codFutura' | 'descricao' | 'estoqueForn' | 'casado' | 'nossoProduto' | 'atualizado';
const COL_LABEL: Record<ColKey, string> = {
  empresa: 'Empresa',
  ean: 'EAN caixa',
  codFutura: 'Cód. Futura',
  descricao: 'Descrição',
  estoqueForn: 'Estoque forn. (CX)',
  casado: 'Casado',
  nossoProduto: 'Nosso produto',
  atualizado: 'Atualizado',
};
const COLS_STORAGE_KEY = 'fornecedor-estoque:cols:v1';
const DEFAULT_COLS: Record<ColKey, boolean> = {
  empresa: true,
  ean: false,
  codFutura: false,
  descricao: true,
  estoqueForn: true,
  casado: true,
  nossoProduto: true,
  atualizado: true,
};

function formatTs(value: string | null): string {
  if (!value) return '—';
  try {
    const d = value.length === 10 ? parseLocalDate(value) : new Date(value);
    if (!d || Number.isNaN(d.getTime())) return '—';
    return format(d, 'dd/MM HH:mm');
  } catch {
    return '—';
  }
}

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function OrigemBadge({ origem, casado }: { origem: string | null; casado: boolean | null }) {
  if (!casado) {
    return <Badge variant="outline" className="bg-muted/40 text-[10px] text-muted-foreground">Não casado</Badge>;
  }
  const map: Record<string, string> = {
    master_caixa: 'Master · caixa',
    master_unitario: 'Master · unitário',
    depara_manual: 'De-para manual',
    fabrica_produtos: 'Fábrica',
  };
  return (
    <div className="flex flex-col gap-0.5">
      <Badge className="w-fit bg-success/15 text-[10px] text-success hover:bg-success/15">Casado</Badge>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {map[origem ?? ''] ?? origem ?? '—'}
      </span>
    </div>
  );
}

export default function FornecedorEstoquePage() {
  const navigate = useNavigate();
  const [buscaInput, setBuscaInput] = useState('');
  const busca = useDebounced(buscaInput, 300);
  const [empresas, setEmpresas] = useState<number[]>([]);
  const [distribuidorasSel, setDistribuidorasSel] = useState<number[]>([]);
  const [casadoFiltro, setCasadoFiltro] = useState<CasadoFiltro>('todos');
  const [apenasComSaldo, setApenasComSaldo] = useState(false);
  const [sortBy, setSortBy] = useState<FornecedorSortBy>('fornecedor_caixas');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  const [colsVisiveis, setColsVisiveis] = useState<Record<ColKey, boolean>>(() => {
    try {
      const raw = localStorage.getItem(COLS_STORAGE_KEY);
      if (raw) return { ...DEFAULT_COLS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_COLS;
  });
  useEffect(() => {
    try { localStorage.setItem(COLS_STORAGE_KEY, JSON.stringify(colsVisiveis)); } catch {}
  }, [colsVisiveis]);

  useEffect(() => { setPage(0); }, [busca, empresas, distribuidorasSel, casadoFiltro, apenasComSaldo, sortBy, sortDir]);

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
  const { data, isLoading, isError, error } = useFornecedorIntegradoList({
    busca, empresas, casadoFiltro, apenasComSaldo, sortBy, sortDir, page, pageSize: PAGE_SIZE,
  });

  const distribuidorasVisiveis = useMemo(
    () => distribuidorasSel.length === 0 ? distribuidoras : distribuidoras.filter((d) => distribuidorasSel.includes(d.id)),
    [distribuidoras, distribuidorasSel],
  );
  const filtroDistAtivo = distribuidorasSel.length > 0;

  const colSpan = Object.values(colsVisiveis).filter(Boolean).length + distribuidorasVisiveis.length + 1; // +Total

  const limparFiltros = () => {
    setBuscaInput('');
    setEmpresas([]);
    setDistribuidorasSel([]);
    setCasadoFiltro('todos');
    setApenasComSaldo(false);
  };
  const filtrosAtivos = buscaInput.length > 0 || empresas.length > 0 || distribuidorasSel.length > 0 || casadoFiltro !== 'todos' || apenasComSaldo;

  const totalPages = useMemo(() => Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE)), [data?.total]);

  const toggleSort = (col: FornecedorSortBy) => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir(col === 'futura_descricao' ? 'asc' : 'desc'); }
  };

  const empresasLabel = empresas.length === 0
    ? 'Todas as empresas'
    : empresas.length === 1
      ? (empresasOpt.find((e) => e.id === empresas[0])?.nome ?? `Empresa ${empresas[0]}`)
      : `${empresas.length} empresas`;

  const distLabel = distribuidorasSel.length === 0
    ? 'Todas as filiais'
    : distribuidorasSel.length === 1
      ? (distribuidoras.find((d) => d.id === distribuidorasSel[0])?.abrev ?? `Filial ${distribuidorasSel[0]}`)
      : `${distribuidorasSel.length} filiais`;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="w-full space-y-4 px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2 w-fit text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Columns3 className="mr-2 h-4 w-4" /> Colunas
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Colunas visíveis</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(Object.keys(COL_LABEL) as ColKey[]).map((k) => (
                  <DropdownMenuCheckboxItem
                    key={k}
                    checked={colsVisiveis[k]}
                    onCheckedChange={(v) => setColsVisiveis((p) => ({ ...p, [k]: !!v }))}
                  >
                    {COL_LABEL[k]}
                  </DropdownMenuCheckboxItem>
                ))}
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
          <p className="text-sm text-muted-foreground">
            Visualização dos itens do fornecedor (Futura) com casamento ao catálogo master.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            label="Itens casados"
            value={kpisLoading ? '—' : `${numberFmt.format(kpis?.casados ?? 0)}`}
            sub={kpisLoading ? '' : `${kpis?.pct_casado ?? 0}% de ${numberFmt.format(kpis?.total ?? 0)}`}
          />
          <KpiCard
            label="Itens com saldo (forn.)"
            value={kpisLoading ? '—' : numberFmt.format(kpis?.com_saldo ?? 0)}
            sub="fornecedor_caixas > 0"
          />
          <KpiCard
            label="Caixas no fornecedor"
            value={totalCxLoading ? '—' : numberFmt.format(Math.round(totalCx ?? 0))}
            sub="Soma Futura"
          />
          <KpiCard
            label="Disponível nosso (CX)"
            value={kpisAdvLoading ? '—' : cxFmt.format(kpisAdv?.disp_cx_total ?? 0)}
            sub="Saldo − bloqueado"
            accent
          />
          <KpiCard
            label="Disponível nosso (UN)"
            value={kpisAdvLoading ? '—' : numberFmt.format(Math.round(kpisAdv?.disp_un_total ?? 0))}
            sub="Convertido em unidades"
            accent
          />
          <KpiCard
            label="Cobertura vs. fornecedor"
            value={kpisAdvLoading ? '—' : `${kpisAdv?.cobertura_pct ?? 0}%`}
            sub="CX disp. / CX no fornec."
            tooltip="Razão entre nossa caixa máster disponível e a caixa que o fornecedor (Futura) tem em estoque. Valores baixos indicam baixa cobertura para reposição."
          />
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 space-y-0 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base">Itens</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="w-72 pl-8"
                  placeholder="Buscar descrição, EAN, código ou SKU"
                  value={buscaInput}
                  onChange={(e) => setBuscaInput(e.target.value)}
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">{empresasLabel}</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Empresa (fornecedor)</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {empresasOpt.map((e) => {
                    const checked = empresas.includes(e.id);
                    return (
                      <DropdownMenuCheckboxItem
                        key={e.id}
                        checked={checked}
                        onCheckedChange={(v) => {
                          setEmpresas((prev) => v ? [...prev, e.id] : prev.filter((x) => x !== e.id));
                        }}
                      >
                        {e.nome} · {e.id}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                  {empresasOpt.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma empresa</div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">{distLabel}</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Filiais (distribuidoras)</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {distribuidoras.map((d) => {
                    const checked = distribuidorasSel.includes(d.id);
                    return (
                      <DropdownMenuCheckboxItem
                        key={d.id}
                        checked={checked}
                        onCheckedChange={(v) => {
                          setDistribuidorasSel((prev) => v ? [...prev, d.id] : prev.filter((x) => x !== d.id));
                        }}
                      >
                        {d.abrev} — {d.nome}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                  {distribuidoras.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma filial</div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

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
                    {colsVisiveis.empresa && <TableHead>Empresa</TableHead>}
                    {colsVisiveis.ean && <TableHead>EAN caixa</TableHead>}
                    {colsVisiveis.codFutura && <TableHead>Cód. Futura</TableHead>}
                    {colsVisiveis.descricao && (
                      <TableHead>
                        <SortBtn label="Descrição" col="futura_descricao" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
                      </TableHead>
                    )}
                    {colsVisiveis.estoqueForn && (
                      <TableHead className="text-right">
                        <SortBtn label="Estoque forn. (CX)" col="fornecedor_caixas" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
                      </TableHead>
                    )}
                    {colsVisiveis.casado && <TableHead>Casado</TableHead>}
                    {colsVisiveis.nossoProduto && <TableHead>Nosso produto</TableHead>}
                    {distribuidorasVisiveis.map((d) => (
                      <TableHead key={d.id} className="text-right" title={`${d.nome} (id ${d.id})`}>
                        {d.abrev}
                      </TableHead>
                    ))}
                    <TableHead className="border-l-2 border-primary/30 bg-muted/40 text-right font-semibold">Total</TableHead>
                    {colsVisiveis.atualizado && <TableHead>Atualizado</TableHead>}
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
                          <Button size="sm" variant="link" className="mt-1" onClick={limparFiltros}>
                            Limpar filtros
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && !isError && data?.rows.map((r) => {
                    // Total recalculado se o usuário filtrou distribuidoras
                    let totalCx: number | null = (r as any).nosso_disponivel_cx ?? null;
                    let totalUn: number | null = (r as any).nosso_disponivel_un ?? null;
                    if (filtroDistAtivo && r.casado) {
                      let cxSum = 0, unSum = 0, hasAny = false;
                      for (const d of distribuidorasVisiveis) {
                        const s = r.saldos_por_empresa?.[String(d.id)] as any;
                        if (!s) continue;
                        hasAny = true;
                        if (s.disp_cx != null) cxSum += Number(s.disp_cx);
                        if (s.disp_un != null) unSum += Number(s.disp_un);
                      }
                      totalCx = hasAny ? cxSum : null;
                      totalUn = hasAny ? unSum : null;
                    }
                    return (
                      <TableRow key={`${r.empresa_id}-${r.futura_codigo}-${r.ean_normalizado}`} className="even:bg-muted/20">
                        {colsVisiveis.empresa && (
                          <TableCell>
                            <div className="text-sm">{r.empresa_nome ?? '—'}</div>
                            <div className="text-[10px] text-muted-foreground">{r.empresa_id}</div>
                          </TableCell>
                        )}
                        {colsVisiveis.ean && (
                          <TableCell className="font-mono text-xs">{r.ean_caixa ?? '—'}</TableCell>
                        )}
                        {colsVisiveis.codFutura && (
                          <TableCell className="font-mono text-xs">{r.futura_codigo ?? '—'}</TableCell>
                        )}
                        {colsVisiveis.descricao && (
                          <TableCell>
                            <div className="text-sm">{r.futura_descricao ?? '—'}</div>
                            {r.futura_status && (
                              <Badge variant="outline" className="mt-0.5 text-[10px]">{r.futura_status}</Badge>
                            )}
                          </TableCell>
                        )}
                        {colsVisiveis.estoqueForn && (
                          <TableCell className="text-right tabular-nums">
                            {r.fornecedor_caixas != null ? decimalFmt.format(Number(r.fornecedor_caixas)) : '—'}
                          </TableCell>
                        )}
                        {colsVisiveis.casado && (
                          <TableCell><OrigemBadge origem={r.origem_match} casado={r.casado} /></TableCell>
                        )}
                        {colsVisiveis.nossoProduto && (
                          <TableCell>
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
                        )}
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
                                {dispCx != null ? cxFmt.format(dispCx) : '—'}
                                <span className="text-[10px] text-muted-foreground"> CX</span>
                              </div>
                              <div className="text-[10px] font-medium text-success">{numberFmt.format(Math.round(dispUn))} UN</div>
                            </TableCell>
                          );
                        })}
                        <TableCell className="border-l-2 border-primary/30 bg-muted/40 text-right font-semibold tabular-nums">
                          {r.casado ? (
                            <div>
                              <div className="text-sm">
                                {totalCx != null ? cxFmt.format(totalCx) : '—'}
                                <span className="text-[10px] text-muted-foreground"> CX</span>
                              </div>
                              <div className="text-[10px] font-medium text-success">{numberFmt.format(Math.round(Number(totalUn ?? 0)))} UN</div>
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        {colsVisiveis.atualizado && (
                          <TableCell>
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
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {numberFmt.format(data?.total ?? 0)} item(ns) · página {page + 1} de {totalPages}
              </span>
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
      <TooltipTrigger asChild>
        <div className="cursor-help">{body}</div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs"><span className="text-xs">{tooltip}</span></TooltipContent>
    </Tooltip>
  );
}

function SortBtn({
  label, col, sortBy, sortDir, onClick,
}: {
  label: string;
  col: FornecedorSortBy;
  sortBy: FornecedorSortBy;
  sortDir: 'asc' | 'desc';
  onClick: (c: FornecedorSortBy) => void;
}) {
  const active = sortBy === col;
  return (
    <button
      type="button"
      onClick={() => onClick(col)}
      className={`inline-flex items-center gap-1 hover:text-foreground ${active ? 'text-foreground' : 'text-muted-foreground'}`}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
      {active && <span className="text-[10px]">{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </button>
  );
}
