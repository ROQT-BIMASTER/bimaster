import { useMemo, useState } from "react";
import { Package, Search, Layers, ArrowUp, ArrowDown, ArrowUpDown, Activity } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import {
  useVendasProdutoResumoResult,
  type ProdutoResumoResult,
} from "@/hooks/fornecedor/useVendasProdutoResult";
import {
  ProdutoDemandaDrawerResult,
  type MetricaSerie,
} from "@/components/fornecedor/ProdutoDemandaDrawerResult";
import { FuturaBackButton } from "@/components/fornecedor/FuturaBackButton";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

function fmtNum(n: number | null | undefined, frac = 0): string {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
  return Number(n).toLocaleString("pt-BR", { minimumFractionDigits: frac, maximumFractionDigits: frac });
}

type SortKey =
  | "produto_id"
  | "descricao"
  | "qtd_total"
  | "valor_total"
  | "media_mensal"
  | "desvio_mensal"
  | "cv"
  | "classe_abc"
  | "classe_xyz";
type SortState = { key: SortKey; dir: "asc" | "desc" };

const ABC_ORDER: Record<string, number> = { A: 0, B: 1, C: 2 };
const XYZ_ORDER: Record<string, number> = { X: 0, Y: 1, Z: 2 };

function sortValue(r: ProdutoResumoResult, key: SortKey): number | string {
  switch (key) {
    case "produto_id": return Number(r.produto_id) || 0;
    case "descricao": return (r.descricao ?? "").toLowerCase();
    case "qtd_total": return Number(r.qtd_total) || 0;
    case "valor_total": return Number(r.valor_total) || 0;
    case "media_mensal": return Number(r.media_mensal) || 0;
    case "desvio_mensal": return Number(r.desvio_mensal) || 0;
    case "cv": return r.cv === null || r.cv === undefined ? Number.POSITIVE_INFINITY : Number(r.cv);
    case "classe_abc": return ABC_ORDER[r.classe_abc] ?? 99;
    case "classe_xyz": return XYZ_ORDER[r.classe_xyz] ?? 99;
  }
}

function SortableHead({
  k, sort, onSort, align = "left", children,
}: {
  k: SortKey;
  sort: SortState;
  onSort: (k: SortKey) => void;
  align?: "left" | "right" | "center";
  children: React.ReactNode;
}) {
  const active = sort.key === k;
  const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  const justify =
    align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "";
  return (
    <TableHead className={alignClass}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 w-full ${justify} text-xs font-medium hover:text-foreground transition-colors ${active ? "text-foreground" : "text-muted-foreground"}`}
      >
        <span>{children}</span>
        <Icon className={`h-3 w-3 ${active ? "opacity-100" : "opacity-50"}`} />
      </button>
    </TableHead>
  );
}

const DESDE = "2025-01-01";

export default function ProdutosVendasResultPage() {
  const [search, setSearch] = useState("");
  const [abcFilter, setAbcFilter] = useState<string[]>([]);
  const [xyzFilter, setXyzFilter] = useState<string[]>([]);
  const [openProduto, setOpenProduto] = useState<ProdutoResumoResult | null>(null);
  const [metric, setMetric] = useState<MetricaSerie>("quantidade");
  const [sort, setSort] = useState<SortState>({ key: "valor_total", dir: "desc" });

  const { data, isLoading, error } = useVendasProdutoResumoResult(DESDE, null);

  const rows = useMemo<ProdutoResumoResult[]>(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.filter((p) => {
      if (abcFilter.length && !abcFilter.includes(p.classe_abc)) return false;
      if (xyzFilter.length && !xyzFilter.includes(p.classe_xyz)) return false;
      if (q) {
        const hay = `${p.produto_id} ${p.descricao ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, search, abcFilter, xyzFilter]);

  const sortedRows = useMemo<ProdutoResumoResult[]>(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return rows.slice().sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb), "pt-BR") * dir;
    });
  }, [rows, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((cur) =>
      cur.key !== key ? { key, dir: "asc" } : { key, dir: cur.dir === "asc" ? "desc" : "asc" },
    );

  const kpis = useMemo(() => {
    const total = rows.length;
    const classeA = rows.filter((r) => r.classe_abc === "A").length;
    const classeX = rows.filter((r) => r.classe_xyz === "X").length;
    const classeZ = rows.filter((r) => r.classe_xyz === "Z").length;
    return { total, classeA, classeX, classeZ };
  }, [rows]);

  const handleRowClick = (p: ProdutoResumoResult) => {
    setOpenProduto(p);
  };

  return (
    <DashboardLayout>
      <div className="w-full px-4 md:px-6 py-6 space-y-4">
        <FuturaBackButton />
        <PageHeader
          title="Vendas por produto (Result)"
          description="Demanda, classificação ABC/XYZ e previsão a partir dos pedidos faturados Result"
          icon={Package}
          breadcrumbs={[
            { label: "Fornecedor", href: "/dashboard/fornecedor" },
            { label: "Vendas por produto (Result)" },
          ]}
        />

        {/* Controles */}
        <Card className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1 flex-1 min-w-[220px]">
              <label className="text-xs font-medium text-muted-foreground">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Código ou descrição"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Classe ABC</label>
              <ToggleGroup
                type="multiple"
                value={abcFilter}
                onValueChange={setAbcFilter}
                className="border rounded-md"
              >
                {(["A", "B", "C"] as const).map((c) => (
                  <ToggleGroupItem key={c} value={c} className="px-3 w-10">
                    {c}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Classe XYZ</label>
              <ToggleGroup
                type="multiple"
                value={xyzFilter}
                onValueChange={setXyzFilter}
                className="border rounded-md"
              >
                {(["X", "Y", "Z"] as const).map((c) => (
                  <ToggleGroupItem key={c} value={c} className="px-3 w-10">
                    {c}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4 bg-card/70 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Layers className="h-3.5 w-3.5" /> Produtos
            </div>
            <div className="text-2xl font-semibold mt-1">{fmtNum(kpis.total)}</div>
          </Card>
          <Card className="p-4 bg-card/70 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">Classe A</div>
            <div className="text-2xl font-semibold mt-1">{fmtNum(kpis.classeA)}</div>
            <div className="text-xs text-muted-foreground">top 80% do valor</div>
          </Card>
          <Card className="p-4 bg-card/70 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="h-3.5 w-3.5" /> Classe X
            </div>
            <div className="text-2xl font-semibold mt-1">{fmtNum(kpis.classeX)}</div>
            <div className="text-xs text-muted-foreground">demanda estável</div>
          </Card>
          <Card className="p-4 bg-card/70 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="h-3.5 w-3.5" /> Classe Z
            </div>
            <div className="text-2xl font-semibold mt-1">{fmtNum(kpis.classeZ)}</div>
            <div className="text-xs text-muted-foreground">alta variabilidade</div>
          </Card>
        </div>

        {/* Tabela */}
        <Card className="p-0 overflow-hidden">
          {error ? (
            <div className="p-6 text-sm text-destructive">Falha ao carregar dados.</div>
          ) : isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead sort={sort} onSort={toggleSort} k="produto_id">Cód</SortableHead>
                    <SortableHead sort={sort} onSort={toggleSort} k="descricao">Produto</SortableHead>
                    <SortableHead sort={sort} onSort={toggleSort} k="qtd_total" align="right">Qtd</SortableHead>
                    <SortableHead sort={sort} onSort={toggleSort} k="valor_total" align="right">R$ total</SortableHead>
                    <SortableHead sort={sort} onSort={toggleSort} k="media_mensal" align="right">Média/mês</SortableHead>
                    <SortableHead sort={sort} onSort={toggleSort} k="desvio_mensal" align="right">σ</SortableHead>
                    <SortableHead sort={sort} onSort={toggleSort} k="cv" align="right">CV</SortableHead>
                    <SortableHead sort={sort} onSort={toggleSort} k="classe_abc" align="center">ABC</SortableHead>
                    <SortableHead sort={sort} onSort={toggleSort} k="classe_xyz" align="center">XYZ</SortableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                        Nenhum produto no filtro atual.
                      </TableCell>
                    </TableRow>
                  ) : sortedRows.map((r) => (
                    <TableRow
                      key={r.produto_id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => handleRowClick(r)}
                    >
                      <TableCell className="font-mono text-xs">{r.produto_id}</TableCell>
                      <TableCell className="max-w-[360px] truncate">{r.descricao ?? "—"}</TableCell>
                      <TableCell className="text-right">{fmtNum(r.qtd_total)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(r.valor_total) || 0)}</TableCell>
                      <TableCell className="text-right">{fmtNum(r.media_mensal, 0)}</TableCell>
                      <TableCell className="text-right">{fmtNum(r.desvio_mensal, 0)}</TableCell>
                      <TableCell className="text-right">
                        {r.cv === null || r.cv === undefined
                          ? "—"
                          : Number(r.cv).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-mono">{r.classe_abc}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-mono">{r.classe_xyz}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      <ProdutoDemandaDrawerResult
        produto={openProduto}
        open={!!openProduto}
        onOpenChange={(o) => !o && setOpenProduto(null)}
        metric={metric}
        onMetricChange={setMetric}
      />
    </DashboardLayout>
  );
}
