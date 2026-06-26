import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Package, Search, AlertTriangle, TrendingDown, Layers, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  coberturaDias,
  estoqueSeguranca,
  pontoReposicao,
  statusEstoque,
  zFromServico,
  type StatusEstoque,
} from "@/lib/inventory";
import {
  useVendasProdutoResumo,
  type Janela,
  type ProdutoResumo,
} from "@/hooks/fornecedor/useVendasProduto";
import { ProdutoDemandaDrawer } from "@/components/fornecedor/ProdutoDemandaDrawer";
import { FuturaBackButton } from "@/components/fornecedor/FuturaBackButton";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

type Servico = 90 | 95 | 98;

const STATUS_TONE: Record<StatusEstoque, string> = {
  critico: "bg-destructive/15 text-destructive border-destructive/30",
  repor: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300",
  excesso: "bg-sky-500/15 text-sky-700 border-sky-500/30 dark:text-sky-300",
  ok: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
};

const STATUS_LABEL: Record<StatusEstoque, string> = {
  critico: "Crítico",
  repor: "Repor",
  excesso: "Excesso",
  ok: "OK",
};

function fmtNum(n: number | null | undefined, frac = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: frac, maximumFractionDigits: frac });
}

function fmtCov(d: number): string {
  if (!Number.isFinite(d)) return "∞";
  return `${Math.round(d)} d`;
}

type Row = ProdutoResumo & {
  cobertura: number;
  rop: number;
  es: number;
  status: StatusEstoque;
  marca_linha: string;
};

type SortKey =
  | "cod_produto" | "descricao" | "marca_linha"
  | "qtd_total" | "valor_total" | "media_mensal" | "desvio_mensal" | "cv"
  | "classe_abc" | "classe_xyz"
  | "estoque_cx" | "cobertura" | "status";
type SortState = { key: SortKey; dir: "asc" | "desc" } | null;

const ABC_ORDER: Record<string, number> = { A: 0, B: 1, C: 2 };
const XYZ_ORDER: Record<string, number> = { X: 0, Y: 1, Z: 2 };
const STATUS_ORDER: Record<StatusEstoque, number> = { critico: 0, repor: 1, excesso: 2, ok: 3 };

function sortValue(r: Row, key: SortKey): number | string {
  switch (key) {
    case "cod_produto": return r.cod_produto ?? "";
    case "descricao":   return (r.descricao ?? "").toLowerCase();
    case "marca_linha": return r.marca_linha.toLowerCase();
    case "qtd_total":   return Number(r.qtd_total) || 0;
    case "valor_total": return Number(r.valor_total) || 0;
    case "media_mensal":return Number(r.media_mensal) || 0;
    case "desvio_mensal":return Number(r.desvio_mensal) || 0;
    case "cv":          return r.cv === null ? Number.POSITIVE_INFINITY : Number(r.cv);
    case "classe_abc":  return ABC_ORDER[r.classe_abc] ?? 99;
    case "classe_xyz":  return XYZ_ORDER[r.classe_xyz] ?? 99;
    case "estoque_cx":  return r.estoque_atual_cx ?? (Number(r.estoque_atual) || 0);
    case "cobertura":   return Number.isFinite(r.cobertura) ? r.cobertura : Number.MAX_SAFE_INTEGER;
    case "status":      return STATUS_ORDER[r.status];
  }
}

export default function ProdutosVendasPage() {
  const [janela, setJanela] = useState<Janela>("12m");
  const [leadDias, setLeadDias] = useState<number>(45);
  const [servico, setServico] = useState<Servico>(95);
  const [search, setSearch] = useState("");
  const [abcFilter, setAbcFilter] = useState<string[]>([]);
  const [xyzFilter, setXyzFilter] = useState<string[]>([]);
  const [openProduto, setOpenProduto] = useState<ProdutoResumo | null>(null);

  const { data, isLoading, error } = useVendasProdutoResumo(janela);

  const z = zFromServico(servico);

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data
      .filter((p) => {
        if (abcFilter.length && !abcFilter.includes(p.classe_abc)) return false;
        if (xyzFilter.length && !xyzFilter.includes(p.classe_xyz)) return false;
        if (q) {
          const hay = `${p.cod_produto} ${p.descricao ?? ""} ${p.marca ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .map<Row>((p) => {
        const media = Number(p.media_mensal) || 0;
        const desvio = Number(p.desvio_mensal) || 0;
        const estoque = Number(p.estoque_atual) || 0;
        const cob = coberturaDias(estoque, media);
        const es = estoqueSeguranca(desvio, leadDias, z);
        const rop = pontoReposicao(media, desvio, leadDias, z);
        return {
          ...p,
          cobertura: cob,
          rop,
          es,
          status: statusEstoque(estoque, rop, es, cob),
          marca_linha: [p.marca, p.nome_linha].filter(Boolean).join(" · "),
        };
      });
  }, [data, search, abcFilter, xyzFilter, leadDias, z]);

  const [sort, setSort] = useState<SortState>(null);
  const sortedRows = useMemo<Row[]>(() => {
    if (!sort) return rows;
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
      !cur || cur.key !== key
        ? { key, dir: "asc" }
        : cur.dir === "asc"
        ? { key, dir: "desc" }
        : null,
    );

  const kpis = useMemo(() => {
    const total = rows.length;
    const criticoRepor = rows.filter((r) => r.status === "critico" || r.status === "repor").length;
    const excesso = rows.filter((r) => r.status === "excesso").length;
    const classeA = rows.filter((r) => r.classe_abc === "A").length;
    return { total, criticoRepor, excesso, classeA };
  }, [rows]);

  return (
    <DashboardLayout>
      <div className="w-full px-4 md:px-6 py-6 space-y-4">
        <FuturaBackButton />
        <PageHeader
        title="Vendas por produto"
        description="Demanda, ABC/XYZ, cobertura de estoque e ponto de reposição"
        icon={Package}
        breadcrumbs={[
          { label: "Fornecedor", href: "/dashboard/fornecedor" },
          { label: "Vendas por produto" },
        ]}
      />

      {/* Controles */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Janela</label>
            <Select value={janela} onValueChange={(v) => setJanela(v as Janela)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="12m">Últimos 12 meses</SelectItem>
                <SelectItem value="24m">Últimos 24 meses</SelectItem>
                <SelectItem value="since-2024">Desde 2024</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Lead time (dias)</label>
            <Input
              type="number"
              min={1}
              max={365}
              value={leadDias}
              onChange={(e) => setLeadDias(Math.max(1, Number(e.target.value) || 1))}
              className="w-[120px]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Nível de serviço</label>
            <ToggleGroup
              type="single"
              value={String(servico)}
              onValueChange={(v) => v && setServico(Number(v) as Servico)}
              className="border rounded-md"
            >
              <ToggleGroupItem value="90" className="px-3">90%</ToggleGroupItem>
              <ToggleGroupItem value="95" className="px-3">95%</ToggleGroupItem>
              <ToggleGroupItem value="98" className="px-3">98%</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="space-y-1 flex-1 min-w-[220px]">
            <label className="text-xs font-medium text-muted-foreground">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Código, descrição ou marca"
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
              {(["A","B","C"] as const).map((c) => (
                <ToggleGroupItem key={c} value={c} className="px-3 w-10">{c}</ToggleGroupItem>
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
              {(["X","Y","Z"] as const).map((c) => (
                <ToggleGroupItem key={c} value={c} className="px-3 w-10">{c}</ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-card/70 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Layers className="h-3.5 w-3.5" /> Produtos</div>
          <div className="text-2xl font-semibold mt-1">{fmtNum(kpis.total)}</div>
        </Card>
        <Card className="p-4 bg-card/70 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" /> Crítico / Repor</div>
          <div className="text-2xl font-semibold mt-1 text-destructive">{fmtNum(kpis.criticoRepor)}</div>
          <div className="text-xs text-muted-foreground">{kpis.total ? `${Math.round((kpis.criticoRepor/kpis.total)*100)}%` : "—"} do catálogo ativo</div>
        </Card>
        <Card className="p-4 bg-card/70 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingDown className="h-3.5 w-3.5" /> Itens em excesso</div>
          <div className="text-2xl font-semibold mt-1">{fmtNum(kpis.excesso)}</div>
          <div className="text-xs text-muted-foreground">cobertura &gt; 180 dias</div>
        </Card>
        <Card className="p-4 bg-card/70 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">Classe A</div>
          <div className="text-2xl font-semibold mt-1">{fmtNum(kpis.classeA)}</div>
          <div className="text-xs text-muted-foreground">top 80% do valor</div>
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
                  <TableHead>Cód</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Marca / Linha</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">R$ total</TableHead>
                  <TableHead className="text-right">Média/mês</TableHead>
                  <TableHead className="text-right">σ</TableHead>
                  <TableHead className="text-right">CV</TableHead>
                  <TableHead className="text-center">ABC</TableHead>
                  <TableHead className="text-center">XYZ</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead className="text-right">Cobertura</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={13} className="h-24 text-center text-muted-foreground">Nenhum produto no filtro atual.</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow
                    key={r.cod_produto}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setOpenProduto(r)}
                  >
                    <TableCell className="font-mono text-xs">{r.cod_produto}</TableCell>
                    <TableCell className="max-w-[320px] truncate">{r.descricao ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{[r.marca, r.nome_linha].filter(Boolean).join(" · ") || "—"}</TableCell>
                    <TableCell className="text-right">{fmtNum(r.qtd_total)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(r.valor_total) || 0)}</TableCell>
                    <TableCell className="text-right">{fmtNum(r.media_mensal, 0)}</TableCell>
                    <TableCell className="text-right">{fmtNum(r.desvio_mensal, 0)}</TableCell>
                    <TableCell className="text-right">{r.cv === null ? "—" : r.cv.toLocaleString("pt-BR",{maximumFractionDigits:2})}</TableCell>
                    <TableCell className="text-center"><Badge variant="outline" className="font-mono">{r.classe_abc}</Badge></TableCell>
                    <TableCell className="text-center"><Badge variant="outline" className="font-mono">{r.classe_xyz}</Badge></TableCell>
                    <TableCell className="text-right">{fmtNum(r.estoque_atual)}</TableCell>
                    <TableCell className="text-right">{fmtCov(r.cobertura)}</TableCell>
                    <TableCell><Badge variant="outline" className={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <ProdutoDemandaDrawer
        produto={openProduto}
        open={!!openProduto}
        onOpenChange={(o) => !o && setOpenProduto(null)}
        leadDias={leadDias}
        servico={servico}
      />
      </div>
    </DashboardLayout>
  );
}
