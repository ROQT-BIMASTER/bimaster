import { useMemo, useState } from "react";
import { format, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ShoppingCart,
  Receipt,
  TrendingUp,
  Landmark,
  Percent,
  Filter,
  Copy,
  Check,
  Info,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
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
  useEntradasResult,
  EMPRESA_RESULT_NOME,
  nomeEmpresaResult,
  type EntradaResultRow,
} from "@/hooks/compras/useEntradasResult";
import { toast } from "sonner";

const CLASSES = [
  { id: "revenda", label: "Revenda" },
  { id: "uso_consumo", label: "Uso/Consumo" },
  { id: "devolucao_venda", label: "Devolução de venda" },
  { id: "transferencia", label: "Transferência" },
  { id: "outros", label: "Outros" },
] as const;

const CLASSE_LABEL: Record<string, string> = Object.fromEntries(
  CLASSES.map((c) => [c.id, c.label]),
);

const EMPRESAS_ALL = Object.entries(EMPRESA_RESULT_NOME).map(([id, nome]) => ({
  id: Number(id),
  nome,
}));

function fmtDate(s: string | null): string {
  const d = parseLocalDate(s);
  return d ? format(d, "dd/MM/yyyy", { locale: ptBR }) : "—";
}

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR");
}

const PAGE_SIZE = 50;

type SortKey =
  | "data_entrada"
  | "empresa_result"
  | "fornecedor_nome"
  | "numero_nota"
  | "cfop"
  | "classe"
  | "valor_contabil"
  | "valor_icms"
  | "valor_st"
  | "valor_ipi";

function ChaveCell({ chave }: { chave: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!chave) return <span className="text-muted-foreground">—</span>;
  return (
    <button
      type="button"
      className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground"
      onClick={() => {
        navigator.clipboard.writeText(chave);
        setCopied(true);
        toast.success("Chave NFe copiada");
        setTimeout(() => setCopied(false), 1500);
      }}
      title={chave}
    >
      <span className="truncate max-w-[120px]">{chave.slice(-8)}</span>
      {copied ? (
        <Check className="h-3 w-3 text-green-600" />
      ) : (
        <Copy className="h-3 w-3 opacity-60" />
      )}
    </button>
  );
}

export default function EntradasResultPage() {
  const now = new Date();
  const [from, setFrom] = useState<string>(
    format(startOfYear(now), "yyyy-MM-dd"),
  );
  const [to, setTo] = useState<string>(format(endOfYear(now), "yyyy-MM-dd"));
  const [empresas, setEmpresas] = useState<number[]>([]);
  const [classes, setClasses] = useState<string[]>(["revenda"]);
  const [page, setPage] = useState(0);
  const [notaSearch, setNotaSearch] = useState("");
  const [fornecedorSearch, setFornecedorSearch] = useState("");
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

  const { data, isLoading } = useEntradasResult({
    from,
    to,
    empresas,
    classes,
  });

  const kpis = useMemo(() => {
    const rows = data ?? [];
    let total = 0;
    let icms = 0;
    let st = 0;
    let ipi = 0;
    for (const r of rows) {
      total += r.valor_contabil;
      icms += r.valor_icms;
      st += r.valor_st;
      ipi += r.valor_ipi;
    }
    return { total, notas: rows.length, icms, st, ipi };
  }, [data]);

  const rowsFiltered = useMemo(() => {
    let rows = data ?? [];
    const nq = notaSearch.trim();
    if (nq) rows = rows.filter((r) => String(r.numero_nota ?? "").includes(nq));
    const fq = fornecedorSearch.trim().toLowerCase();
    if (fq) {
      rows = rows.filter((r) => {
        const n = (r.fornecedor_nome ?? "").toLowerCase();
        const c = (r.fornecedor_cnpj ?? "").toLowerCase();
        return n.includes(fq) || c.includes(fq);
      });
    }
    return rows;
  }, [data, notaSearch, fornecedorSearch]);

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
  const toggleClasse = (c: string) =>
    setClasses((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );

  const SortHeader = ({
    label,
    keyName,
    align = "left",
  }: {
    label: string;
    keyName: SortKey;
    align?: "left" | "right";
  }) => {
    const active = sort.key === keyName;
    const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => toggleSort(keyName)}
        className={`flex items-center gap-1 hover:text-foreground w-full ${
          align === "right" ? "justify-end" : ""
        }`}
      >
        <span>{label}</span>
        <Icon className={`h-3 w-3 ${active ? "opacity-100" : "opacity-40"}`} />
      </button>
    );
  };

  return (
    <DashboardLayout>
      <div className="w-full px-4 md:px-6 py-6 space-y-4">
        <PageHeader
          title="Entradas Result (livro)"
          description="Livro de entradas do ERP — todas as notas de todos os fornecedores"
          icon={ShoppingCart}
          breadcrumbs={[
            { label: "Compras", href: "/dashboard/compras" },
            { label: "Entradas Result" },
          ]}
        />

        <Card className="p-3 border-l-4 border-l-amber-500 bg-amber-500/5">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <p>
              Visão do <strong>livro de entradas</strong> do ERP. A aba{" "}
              <strong>Entradas Futura</strong> mostra o faturado pela fábrica —
              as duas visões se sobrepõem (mesmas notas) e{" "}
              <strong>não devem ser somadas</strong>.
            </p>
          </div>
        </Card>

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
                Empresa
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
                    <span className="text-xs font-medium">Empresas</span>
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
                    {EMPRESAS_ALL.map((e) => (
                      <label
                        key={e.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/60 cursor-pointer"
                      >
                        <Checkbox
                          checked={empresas.includes(e.id)}
                          onCheckedChange={() => toggleEmpresa(e.id)}
                        />
                        <span className="text-sm truncate">
                          {e.nome}{" "}
                          <span className="text-muted-foreground">
                            ({e.id})
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Classe
              </label>
              <div className="flex gap-3 items-center h-10 flex-wrap">
                {CLASSES.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-1.5 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={classes.includes(c.id)}
                      onCheckedChange={() => toggleClasse(c.id)}
                    />
                    <span>{c.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t">
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
                Fornecedor (nome ou CNPJ)
              </label>
              <Input
                placeholder="Buscar por nome ou CNPJ"
                value={fornecedorSearch}
                onChange={(e) => {
                  setFornecedorSearch(e.target.value);
                  setPage(0);
                }}
              />
            </div>
          </div>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-4 bg-card/70 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" /> Valor total
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

        {/* Tabela */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">
                    <SortHeader label="Data" keyName="data_entrada" />
                  </TableHead>
                  <TableHead>
                    <SortHeader label="Empresa" keyName="empresa_result" />
                  </TableHead>
                  <TableHead>
                    <SortHeader label="Fornecedor" keyName="fornecedor_nome" />
                  </TableHead>
                  <TableHead className="w-[130px]">CNPJ</TableHead>
                  <TableHead>
                    <SortHeader label="NF/Série" keyName="numero_nota" />
                  </TableHead>
                  <TableHead className="w-[80px]">
                    <SortHeader label="CFOP" keyName="cfop" />
                  </TableHead>
                  <TableHead className="w-[60px]">CST</TableHead>
                  <TableHead>
                    <SortHeader label="Classe" keyName="classe" />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortHeader
                      label="Valor"
                      keyName="valor_contabil"
                      align="right"
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortHeader label="ICMS" keyName="valor_icms" align="right" />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortHeader label="ST" keyName="valor_st" align="right" />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortHeader label="IPI" keyName="valor_ipi" align="right" />
                  </TableHead>
                  <TableHead>Chave NFe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={13}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={13}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      Nenhuma nota encontrada com os filtros atuais.
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">
                        {fmtDate(r.data_entrada)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {nomeEmpresaResult(r.empresa_result)}
                      </TableCell>
                      <TableCell className="text-sm max-w-[240px] truncate">
                        {r.fornecedor_nome ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {r.fornecedor_cnpj ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.numero_nota ?? "—"}
                        {r.serie ? (
                          <span className="text-muted-foreground">
                            /{r.serie}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.cfop ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">{r.cst ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {CLASSE_LABEL[r.classe ?? ""] ?? r.classe ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatCurrency(r.valor_contabil)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(r.valor_icms)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(r.valor_st)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(r.valor_ipi)}
                      </TableCell>
                      <TableCell>
                        <ChaveCell chave={r.chave_nfe} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between p-3 border-t text-sm text-muted-foreground">
            <div>
              {fmtNum(rowsSorted.length)} nota(s) — página {page + 1} de{" "}
              {totalPages}
            </div>
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
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                Próxima
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
