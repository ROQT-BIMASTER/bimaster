import { useMemo, useState } from "react";
import { format, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ShoppingCart,
  Receipt,
  Building2,
  TrendingUp,
  Landmark,
  Percent,
  Filter,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  useEntradasFutura,
  useEntradaItens,
  useNotasComProduto,
  type EntradaFuturaRow,
} from "@/hooks/compras/useEntradasFutura";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

const NATUREZA_LABEL: Record<string, string> = {
  venda: "Venda",
  bonificacao: "Bonificação",
  ativo: "Ativo",
};

function fmtDate(s: string | null): string {
  const d = parseLocalDate(s);
  return d ? format(d, "dd/MM/yyyy", { locale: ptBR }) : "—";
}

function fmtNum(n: number, frac = 0): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: frac,
    maximumFractionDigits: frac,
  });
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--module-comercial, 210 80% 50%))",
  "hsl(var(--module-financeiro))",
  "hsl(var(--module-trade))",
  "hsl(var(--module-fabrica))",
  "hsl(var(--module-marketing))",
  "hsl(var(--module-precos))",
  "hsl(var(--muted-foreground))",
];

const PAGE_SIZE = 50;

export default function EntradasFuturaPage() {
  const now = new Date();
  const [from, setFrom] = useState<string>(
    format(startOfYear(now), "yyyy-MM-dd"),
  );
  const [to, setTo] = useState<string>(
    format(endOfYear(now), "yyyy-MM-dd"),
  );
  const [empresas, setEmpresas] = useState<number[]>([]);
  const [naturezas, setNaturezas] = useState<string[]>(["venda"]);
  const [notaAberta, setNotaAberta] = useState<EntradaFuturaRow | null>(null);
  const [page, setPage] = useState(0);
  const [notaSearch, setNotaSearch] = useState("");
  const [fornecedorSearch, setFornecedorSearch] = useState("");
  const [produtoSearch, setProdutoSearch] = useState("");
  const [produtoTermo, setProdutoTermo] = useState("");
  type SortKey =
    | "data_entrada"
    | "empresa_nome"
    | "nro_nota"
    | "natureza"
    | "cfop_codigo"
    | "total_produto"
    | "total_desconto"
    | "total_nota"
    | "total_icms_valor"
    | "total_st_valor"
    | "total_ipi_valor";
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "data_entrada",
    dir: "desc",
  });
  const toggleSort = (key: SortKey) => {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" },
    );
    setPage(0);
  };

  const { data, isLoading, error } = useEntradasFutura({
    from,
    to,
    empresas,
    naturezas,
  });

  const empresasDisponiveis = useMemo(() => {
    const m = new Map<number, string>();
    (data ?? []).forEach((r) => {
      if (r.empresa_id != null) {
        m.set(r.empresa_id, r.empresa_nome ?? `Empresa ${r.empresa_id}`);
      }
    });
    return Array.from(m.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [data]);

  const kpis = useMemo(() => {
    const rows = data ?? [];
    let total = 0;
    let icms = 0;
    let st = 0;
    let ipi = 0;
    for (const r of rows) {
      total += r.total_nota;
      icms += r.total_icms_valor;
      st += r.total_st_valor;
      ipi += r.total_ipi_valor;
    }
    return {
      total,
      notas: rows.length,
      icms,
      st,
      ipi,
    };
  }, [data]);

  const chartData = useMemo(() => {
    const rows = data ?? [];
    const byMonth = new Map<string, Record<string, number | string>>();
    const distribuidoras = new Set<string>();
    for (const r of rows) {
      const d = parseLocalDate(r.data_entrada);
      if (!d) continue;
      const mk = format(d, "yyyy-MM");
      const dist = r.empresa_nome ?? "Sem distribuidora";
      distribuidoras.add(dist);
      const bucket = byMonth.get(mk) ?? { mes: mk };
      bucket[dist] = ((bucket[dist] as number) ?? 0) + r.total_nota;
      byMonth.set(mk, bucket);
    }
    const rowsSorted = Array.from(byMonth.values()).sort((a, b) =>
      String(a.mes).localeCompare(String(b.mes)),
    );
    return {
      rows: rowsSorted.map((r) => ({
        ...r,
        mesLabel: format(parseLocalDate(String(r.mes) + "-01")!, "MMM/yy", {
          locale: ptBR,
        }),
      })),
      distribuidoras: Array.from(distribuidoras).sort(),
    };
  }, [data]);

  const { data: notasProduto, isFetching: loadingProduto } =
    useNotasComProduto(produtoTermo);

  const rowsFiltered = useMemo(() => {
    let rows = data ?? [];
    const nq = notaSearch.trim();
    if (nq) rows = rows.filter((r) => String(r.nro_nota ?? "").includes(nq));
    const fq = fornecedorSearch.trim().toLowerCase();
    if (fq)
      rows = rows.filter((r) =>
        (r.empresa_nome ?? "").toLowerCase().includes(fq),
      );
    if (produtoTermo.trim().length >= 2 && notasProduto) {
      rows = rows.filter((r) => notasProduto.has(r.futura_nota_id));
    }
    return rows;
  }, [data, notaSearch, fornecedorSearch, produtoTermo, notasProduto]);

  const rowsSorted = useMemo(() => {
    const { key, dir } = sort;
    const mult = dir === "asc" ? 1 : -1;
    return rowsFiltered.slice().sort((a, b) => {
      const va = (a as any)[key];
      const vb = (b as any)[key];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number")
        return (va - vb) * mult;
      return String(va).localeCompare(String(vb), "pt-BR") * mult;
    });
  }, [rowsFiltered, sort]);

  const pageRows = useMemo(
    () => rowsSorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [rowsSorted, page],
  );
  const totalPages = Math.max(1, Math.ceil(rowsSorted.length / PAGE_SIZE));

  const toggleEmpresa = (id: number) =>
    setEmpresas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  const toggleNatureza = (n: string) =>
    setNaturezas((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n],
    );

  return (
    <DashboardLayout>
      <div className="w-full px-4 md:px-6 py-6 space-y-4">
        <PageHeader
          title="Entradas Futura"
          description="Compras internas das distribuidoras — notas emitidas pela Futura com tributos destacados"
          icon={ShoppingCart}
          breadcrumbs={[
            { label: "Compras", href: "/dashboard/compras" },
            { label: "Entradas Futura" },
          ]}
        />

        {/* Filtros */}
        <Card className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                De
              </label>
              <Input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(0);
                }}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Até
              </label>
              <Input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(0);
                }}
                className="w-[160px]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Distribuidora
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-[220px] justify-between"
                  >
                    <span className="truncate">
                      {empresas.length === 0
                        ? "Todas"
                        : `${empresas.length} selecionada(s)`}
                    </span>
                    <Filter className="h-4 w-4 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[280px] p-0 pointer-events-auto"
                  align="start"
                >
                  <div className="p-2 flex items-center justify-between border-b">
                    <span className="text-xs font-medium">Distribuidoras</span>
                    {empresas.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setEmpresas([])}
                      >
                        Limpar
                      </Button>
                    )}
                  </div>
                  <div className="max-h-[280px] overflow-y-auto p-2 space-y-1">
                    {empresasDisponiveis.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-2">
                        Sem distribuidoras no período.
                      </p>
                    ) : (
                      empresasDisponiveis.map((e) => (
                        <label
                          key={e.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/60 cursor-pointer"
                        >
                          <Checkbox
                            checked={empresas.includes(e.id)}
                            onCheckedChange={() => toggleEmpresa(e.id)}
                          />
                          <span className="text-sm truncate">{e.nome}</span>
                        </label>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Natureza
              </label>
              <div className="flex gap-2 items-center h-10">
                {(["venda", "bonificacao", "ativo"] as const).map((n) => (
                  <label
                    key={n}
                    className="flex items-center gap-1.5 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={naturezas.includes(n)}
                      onCheckedChange={() => toggleNatureza(n)}
                    />
                    <span>{NATUREZA_LABEL[n]}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 pt-3 border-t">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Nº da nota
              </label>
              <Input
                placeholder="Ex: 12345"
                value={notaSearch}
                onChange={(e) => {
                  setNotaSearch(e.target.value);
                  setPage(0);
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Fornecedor / distribuidora (texto)
              </label>
              <Input
                placeholder="Buscar por nome"
                value={fornecedorSearch}
                onChange={(e) => {
                  setFornecedorSearch(e.target.value);
                  setPage(0);
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Produto (código ou descrição)
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="Mín. 2 caracteres"
                  value={produtoSearch}
                  onChange={(e) => setProdutoSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setProdutoTermo(produtoSearch);
                      setPage(0);
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setProdutoTermo(produtoSearch);
                    setPage(0);
                  }}
                  disabled={produtoSearch.trim().length < 2 && !produtoTermo}
                >
                  {loadingProduto ? "..." : produtoTermo ? "Atualizar" : "Filtrar"}
                </Button>
                {produtoTermo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setProdutoSearch("");
                      setProdutoTermo("");
                      setPage(0);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-4 bg-card/70 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" /> Total de compras
            </div>
            <div className="text-2xl font-semibold mt-1">
              {formatCurrency(kpis.total)}
            </div>
          </Card>
          <Card className="p-4 bg-card/70 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Receipt className="h-3.5 w-3.5" /> Notas
            </div>
            <div className="text-2xl font-semibold mt-1">
              {fmtNum(kpis.notas)}
            </div>
          </Card>
          <Card className="p-4 bg-card/70 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Landmark className="h-3.5 w-3.5" /> ICMS
            </div>
            <div className="text-2xl font-semibold mt-1">
              {formatCurrency(kpis.icms)}
            </div>
          </Card>
          <Card className="p-4 bg-card/70 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Percent className="h-3.5 w-3.5" /> ST
            </div>
            <div className="text-2xl font-semibold mt-1">
              {formatCurrency(kpis.st)}
            </div>
          </Card>
          <Card className="p-4 bg-card/70 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Percent className="h-3.5 w-3.5" /> IPI
            </div>
            <div className="text-2xl font-semibold mt-1">
              {formatCurrency(kpis.ipi)}
            </div>
          </Card>
        </div>

        {/* Gráfico */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">
              Compras por mês (por distribuidora)
            </h3>
          </div>
          {isLoading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : chartData.rows.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
              Sem dados no período.
            </div>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.rows}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="mesLabel"
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(v) =>
                      v >= 1_000_000
                        ? `${(v / 1_000_000).toFixed(1)}M`
                        : v >= 1_000
                        ? `${(v / 1_000).toFixed(0)}k`
                        : String(v)
                    }
                  />
                  <RTooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      fontSize: 12,
                    }}
                    formatter={(v: number) => formatCurrency(v)}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {chartData.distribuidoras.map((d, i) => (
                    <Bar
                      key={d}
                      dataKey={d}
                      stackId="a"
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Tabela */}
        <Card className="p-0 overflow-hidden">
          {error ? (
            <div className="p-6 text-sm text-destructive">
              Falha ao carregar entradas.
            </div>
          ) : isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rowsSorted.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <Building2 className="h-8 w-8 mx-auto text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">
                Nenhuma nota encontrada com os filtros atuais.
              </p>
              <p className="text-xs text-muted-foreground">
                Ajuste o período, distribuidora ou natureza.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHead sortKey="data_entrada" sort={sort} onSort={toggleSort}>Data</SortableHead>
                      <SortableHead sortKey="empresa_nome" sort={sort} onSort={toggleSort}>Distribuidora</SortableHead>
                      <SortableHead sortKey="nro_nota" sort={sort} onSort={toggleSort}>Nº / Série</SortableHead>
                      <SortableHead sortKey="natureza" sort={sort} onSort={toggleSort}>Natureza</SortableHead>
                      <SortableHead sortKey="cfop_codigo" sort={sort} onSort={toggleSort} align="right">CFOP</SortableHead>
                      <SortableHead sortKey="total_produto" sort={sort} onSort={toggleSort} align="right">Produtos</SortableHead>
                      <SortableHead sortKey="total_desconto" sort={sort} onSort={toggleSort} align="right">Desconto</SortableHead>
                      <SortableHead sortKey="total_nota" sort={sort} onSort={toggleSort} align="right">Total</SortableHead>
                      <SortableHead sortKey="total_icms_valor" sort={sort} onSort={toggleSort} align="right">ICMS</SortableHead>
                      <SortableHead sortKey="total_st_valor" sort={sort} onSort={toggleSort} align="right">ST</SortableHead>
                      <SortableHead sortKey="total_ipi_valor" sort={sort} onSort={toggleSort} align="right">IPI</SortableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((r) => (
                      <TableRow
                        key={r.venda_id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => setNotaAberta(r)}
                      >
                        <TableCell className="text-sm">
                          {fmtDate(r.data_entrada)}
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate">
                          {r.empresa_nome ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.nro_nota ?? "—"}
                          {r.serie ? ` / ${r.serie}` : ""}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {NATUREZA_LABEL[r.natureza ?? ""] ??
                              (r.natureza ?? "—")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {r.cfop_codigo ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(r.total_produto)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {r.total_desconto > 0
                            ? formatCurrency(r.total_desconto)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatCurrency(r.total_nota)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.total_icms_valor > 0
                            ? formatCurrency(r.total_icms_valor)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.total_st_valor > 0
                            ? formatCurrency(r.total_st_valor)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.total_ipi_valor > 0
                            ? formatCurrency(r.total_ipi_valor)
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
                <p className="text-xs text-muted-foreground">
                  {rowsSorted.length} nota(s) — página {page + 1} de{" "}
                  {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() =>
                      setPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      <ItemsDrawer
        nota={notaAberta}
        onClose={() => setNotaAberta(null)}
      />
    </DashboardLayout>
  );
}

function ItemsDrawer({
  nota,
  onClose,
}: {
  nota: EntradaFuturaRow | null;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useEntradaItens(
    nota?.futura_nota_id ?? null,
  );

  return (
    <Sheet open={!!nota} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[900px] overflow-y-auto"
      >
        {nota && (
          <>
            <SheetHeader>
              <div className="flex items-center justify-between gap-2">
                <SheetTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Nota {nota.nro_nota ?? "—"}
                  {nota.serie ? ` / ${nota.serie}` : ""}
                </SheetTitle>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <SheetDescription className="text-xs">
                {nota.empresa_nome} · {fmtDate(nota.data_entrada)} · CFOP{" "}
                {nota.cfop_codigo ?? "—"} · Natureza{" "}
                {NATUREZA_LABEL[nota.natureza ?? ""] ?? nota.natureza ?? "—"}
              </SheetDescription>
            </SheetHeader>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
              <MiniStat label="Total" value={formatCurrency(nota.total_nota)} />
              <MiniStat
                label="ICMS"
                value={formatCurrency(nota.total_icms_valor)}
              />
              <MiniStat label="ST" value={formatCurrency(nota.total_st_valor)} />
              <MiniStat
                label="IPI"
                value={formatCurrency(nota.total_ipi_valor)}
              />
            </div>

            <div className="mt-4">
              {error ? (
                <p className="text-sm text-destructive">
                  Falha ao carregar itens.
                </p>
              ) : isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Nenhum item vinculado a esta nota.
                </p>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>NCM</TableHead>
                        <TableHead className="text-right">CFOP</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Qtd (un)</TableHead>
                        <TableHead className="text-right">Vlr un.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">ICMS</TableHead>
                        <TableHead className="text-right">ST</TableHead>
                        <TableHead className="text-right">IPI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data ?? []).map((it) => (
                        <TableRow key={it.id}>
                          <TableCell className="max-w-[260px]">
                            <div className="font-mono text-[11px] text-muted-foreground">
                              {it.cod_produto ?? "—"}
                            </div>
                            <div className="text-sm truncate">
                              {it.descricao ?? "—"}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {it.ncm ?? "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {it.cfop_codigo ?? "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtNum(it.quantidade, 2)}{" "}
                            <span className="text-[10px] text-muted-foreground">
                              {it.unidade_sigla ?? ""}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {it.quantidade_un !== null
                              ? fmtNum(it.quantidade_un, 0)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(it.valor_unitario)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {formatCurrency(it.total_item)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {it.icms_valor > 0
                              ? formatCurrency(it.icms_valor)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {it.st_valor > 0
                              ? formatCurrency(it.st_valor)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {it.ipi_valor > 0
                              ? formatCurrency(it.ipi_valor)
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3 bg-muted/30">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
    </Card>
  );
}

function SortableHead({
  children,
  sortKey,
  sort,
  onSort,
  align = "left",
}: {
  children: React.ReactNode;
  sortKey: string;
  sort: { key: string; dir: "asc" | "desc" };
  onSort: (key: any) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === sortKey;
  const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${
          align === "right" ? "flex-row-reverse ml-auto" : ""
        } ${active ? "text-foreground" : "text-muted-foreground"}`}
      >
        <span>{children}</span>
        <Icon className="h-3 w-3 opacity-70" />
      </button>
    </TableHead>
  );
}

