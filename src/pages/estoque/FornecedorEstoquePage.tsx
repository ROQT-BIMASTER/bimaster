import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUpDown, ExternalLink, Search } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { parseLocalDate } from '@/lib/utils/parseLocalDate';
import {
  useDistribuidorasEmpresas,
  useEmpresasFornecedor,
  useFornecedorIntegradoKpis,
  useFornecedorIntegradoList,
  useFornecedorTotalCaixas,
  type CasadoFiltro,
  type FornecedorSortBy,
} from '@/hooks/estoque/useFornecedorIntegrado';

const PAGE_SIZE = 25;
const numberFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const decimalFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });

function formatTs(value: string | null): string {
  if (!value) return '—';
  try {
    const d = value.length === 10 ? parseLocalDate(value) : new Date(value);
    if (!d || Number.isNaN(d.getTime())) return '—';
    return format(d, "dd/MM HH:mm");
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
  if (!casado) return <Badge variant="outline">Não casado</Badge>;
  const map: Record<string, string> = {
    master_caixa: 'Master · caixa',
    master_unitario: 'Master · unitário',
    depara_manual: 'De-para manual',
    fabrica_produtos: 'Fábrica',
  };
  return (
    <div className="flex flex-col gap-0.5">
      <Badge className="w-fit">Casado</Badge>
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
  const [casadoFiltro, setCasadoFiltro] = useState<CasadoFiltro>('todos');
  const [apenasComSaldo, setApenasComSaldo] = useState(false);
  const [sortBy, setSortBy] = useState<FornecedorSortBy>('fornecedor_caixas');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  useEffect(() => { setPage(0); }, [busca, empresas, casadoFiltro, apenasComSaldo, sortBy, sortDir]);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Estoque do fornecedor · Estoque';
    return () => { document.title = prev; };
  }, []);

  const { data: kpis, isLoading: kpisLoading } = useFornecedorIntegradoKpis();
  const { data: totalCx, isLoading: totalCxLoading } = useFornecedorTotalCaixas();
  const { data: empresasOpt = [] } = useEmpresasFornecedor();
  const { data: distribuidoras = [] } = useDistribuidorasEmpresas();
  const { data, isLoading, isError, error } = useFornecedorIntegradoList({
    busca, empresas, casadoFiltro, apenasComSaldo, sortBy, sortDir, page, pageSize: PAGE_SIZE,
  });
  const colSpan = 8 + distribuidoras.length + 1;

  const limparFiltros = () => {
    setBuscaInput('');
    setEmpresas([]);
    setCasadoFiltro('todos');
    setApenasComSaldo(false);
  };
  const filtrosAtivos = buscaInput.length > 0 || empresas.length > 0 || casadoFiltro !== 'todos' || apenasComSaldo;

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

  return (
    <div className="container mx-auto space-y-4 p-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2 w-fit text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Estoque do fornecedor</h1>
          <p className="text-sm text-muted-foreground">
            Visualização dos itens do fornecedor (Futura) com casamento ao catálogo master.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard/estoque/fornecedor-depara">
            <ExternalLink className="mr-2 h-4 w-4" /> Exceções de de-para
          </Link>
        </Button>
      </header>


      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total de itens" value={kpisLoading ? '—' : numberFmt.format(kpis?.total ?? 0)} />
        <KpiCard
          label="% casado"
          value={kpisLoading ? '—' : `${kpis?.pct_casado ?? 0}%`}
          sub={kpisLoading ? '' : `${numberFmt.format(kpis?.casados ?? 0)} / ${numberFmt.format(kpis?.total ?? 0)}`}
        />
        <KpiCard
          label="Itens com saldo no fornecedor"
          value={kpisLoading ? '—' : numberFmt.format(kpis?.com_saldo ?? 0)}
          sub="fornecedor_caixas > 0"
        />
        <KpiCard
          label="Caixas no fornecedor"
          value={totalCxLoading ? '—' : numberFmt.format(Math.round(totalCx ?? 0))}
          sub="Soma de fornecedor_caixas"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-base">Itens</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
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
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>EAN caixa</TableHead>
                <TableHead>Cód. Futura</TableHead>
                <TableHead>
                  <SortBtn label="Descrição" col="futura_descricao" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
                </TableHead>
                <TableHead className="text-right">
                  <SortBtn label="Estoque forn. (CX)" col="fornecedor_caixas" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
                </TableHead>
                <TableHead>Casado</TableHead>
                <TableHead>Nosso produto</TableHead>
                {distribuidoras.map((d) => (
                  <TableHead key={d.id} className="text-right" title={`${d.nome} (id ${d.id})`}>
                    {d.abrev}
                  </TableHead>
                ))}
                <TableHead className="bg-muted/40 text-right font-semibold">Total</TableHead>
                <TableHead>Atualizado</TableHead>

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
              {!isLoading && !isError && data?.rows.map((r) => (

                <TableRow key={`${r.empresa_id}-${r.futura_codigo}-${r.ean_normalizado}`}>
                  <TableCell>
                    <div className="text-sm">{r.empresa_nome ?? '—'}</div>
                    <div className="text-[10px] text-muted-foreground">{r.empresa_id}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.ean_caixa ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{r.futura_codigo ?? '—'}</TableCell>
                  <TableCell>
                    <div className="text-sm">{r.futura_descricao ?? '—'}</div>
                    {r.futura_status && (
                      <Badge variant="outline" className="mt-0.5 text-[10px]">{r.futura_status}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.fornecedor_caixas != null ? decimalFmt.format(Number(r.fornecedor_caixas)) : '—'}
                  </TableCell>
                  <TableCell><OrigemBadge origem={r.origem_match} casado={r.casado} /></TableCell>
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
                  {distribuidoras.map((d) => {
                    const s = r.saldos_por_empresa?.[String(d.id)];
                    if (!r.casado || !s || (!s.cx && !s.un)) {
                      return <TableCell key={d.id} className="text-right text-xs text-muted-foreground">—</TableCell>;
                    }
                    return (
                      <TableCell key={d.id} className="text-right tabular-nums">
                        <div className="text-sm">{numberFmt.format(Math.round(Number(s.cx ?? 0)))} <span className="text-[10px] text-muted-foreground">CX</span></div>
                        <div className="text-[10px] text-muted-foreground">{numberFmt.format(Math.round(Number(s.un ?? 0)))} UN</div>
                      </TableCell>
                    );
                  })}
                  <TableCell className="bg-muted/40 text-right tabular-nums font-semibold">
                    {r.casado ? (
                      <div>
                        <div className="text-sm">{numberFmt.format(Math.round(Number(r.nosso_saldo_cx ?? 0)))} <span className="text-[10px] text-muted-foreground">CX</span></div>
                        <div className="text-[10px] text-muted-foreground">{numberFmt.format(Math.round(Number(r.nosso_saldo_un ?? 0)))} UN</div>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">F: {formatTs(r.data_atualizacao_origem)}</div>
                    <div className="text-xs text-muted-foreground">S: {formatTs(r.sincronizado_em)}</div>
                  </TableCell>

                </TableRow>
              ))}
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
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
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
