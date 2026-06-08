import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Check, PackageSearch, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/shared/StatusPill";
import { cn } from "@/lib/utils";
import { useRrLinhas, useRrProdutos, type RrProduto } from "@/hooks/useRrProdutos";
import { WF_FIELDS, emGargalo, motivosGargalo, wfTone, type WfTone } from "@/lib/controladoria";
import { ProdutoWorkflowDrawer } from "@/components/controladoria/ProdutoWorkflowDrawer";
import { ProjetoBackButton } from "@/components/projetos/ProjetoBackButton";


const TONE_CELL: Record<WfTone, string> = {
  done: "bg-emerald-500/80",
  prog: "bg-amber-500/80",
  block: "bg-rose-500/80",
  idle: "bg-slate-400/40 dark:bg-slate-500/40",
};

const TONE_LABEL: Record<WfTone, string> = {
  done: "Concluído",
  prog: "Em andamento",
  block: "Bloqueado",
  idle: "Não iniciado",
};

function BoolIcon({ value }: { value: boolean | null | undefined }) {
  if (value) return <Check className="h-4 w-4 text-emerald-600" />;
  return <X className="h-4 w-4 text-rose-600" />;
}

function WfStrip({ wf }: { wf: Record<string, string | null> | null }) {
  return (
    <div className="flex items-center gap-0.5">
      {WF_FIELDS.map((field) => {
        const v = wf?.[field] ?? null;
        const tone = wfTone(v);
        return (
          <Tooltip key={field}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "h-4 w-3 rounded-[2px] border border-border/30 cursor-help",
                  TONE_CELL[tone],
                )}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <div className="font-medium">{field}</div>
              <div className="text-muted-foreground">
                {v ?? TONE_LABEL[tone]}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export default function ControladoriaProdutos() {
  const { data: produtos, isLoading } = useRrProdutos();
  const { data: linhas } = useRrLinhas();

  const [q, setQ] = useState("");
  const [marca, setMarca] = useState<string>("__all__");
  const [status, setStatus] = useState<string>("__all__");
  const [soGargalo, setSoGargalo] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const produtoParam = searchParams.get("produto");
  const selecionado = useMemo(
    () =>
      produtoParam
        ? (produtos ?? []).find((p) => p.notion_page_id === produtoParam) ?? null
        : null,
    [produtoParam, produtos],
  );
  const openProduto = (p: RrProduto | null) => {
    const next = new URLSearchParams(searchParams);
    if (p?.notion_page_id) next.set("produto", p.notion_page_id);
    else next.delete("produto");
    setSearchParams(next, { replace: false });
  };

  const linhaMap = useMemo(() => {
    const m = new Map<string, string>();
    (linhas ?? []).forEach((l) => {
      if (l.notion_page_id) m.set(l.notion_page_id, l.nome ?? "—");
    });
    return m;
  }, [linhas]);

  const marcas = useMemo(() => {
    const s = new Set<string>();
    (produtos ?? []).forEach((p) => p.marca && s.add(p.marca));
    return Array.from(s).sort();
  }, [produtos]);

  const statuses = useMemo(() => {
    const s = new Set<string>();
    (produtos ?? []).forEach((p) => p.status && s.add(p.status));
    return Array.from(s).sort();
  }, [produtos]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (produtos ?? []).filter((p) => {
      if (term) {
        const hay = `${p.sku ?? ""} ${p.nome_comercial ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (marca !== "__all__" && p.marca !== marca) return false;
      if (status !== "__all__" && p.status !== status) return false;
      if (soGargalo && !emGargalo(p)) return false;
      return true;
    });
  }, [produtos, q, marca, status, soGargalo]);

  const totals = useMemo(() => {
    const list = produtos ?? [];
    const total = list.length;
    const gargalo = list.filter(emGargalo).length;
    const semComp = list.filter((p) => !p.composicao_pt).length;
    const semAnvisa = list.filter((p) => !p.anvisa).length;
    return {
      total,
      gargalo,
      gargaloPct: total ? Math.round((gargalo / total) * 100) : 0,
      semComp,
      semAnvisa,
    };
  }, [produtos]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-6 space-y-6">
        <ProjetoBackButton fallbackTo="/dashboard" label="Voltar ao menu inicial" />
        <header className="space-y-1">
          <div className="flex items-center gap-2">
            <PackageSearch className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Controladoria de Produtos
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Visão global da planilha de produtos sincronizada da agência, com
            destaque para gargalos de regulatório e workflow gráfico.
          </p>
        </header>


        {/* Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard label="Total de produtos" value={totals.total} />
          <SummaryCard
            label="Em gargalo"
            value={`${totals.gargalo} (${totals.gargaloPct}%)`}
            tone={totals.gargalo > 0 ? "warn" : "ok"}
          />
          <SummaryCard
            label="Sem composição PT"
            value={totals.semComp}
            tone={totals.semComp > 0 ? "warn" : "ok"}
          />
          <SummaryCard
            label="Sem ANVISA"
            value={totals.semAnvisa}
            tone={totals.semAnvisa > 0 ? "warn" : "ok"}
          />
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <Input
              placeholder="Buscar por SKU ou nome…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-64"
            />
            <Select value={marca} onValueChange={setMarca}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Marca" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as marcas</SelectItem>
                {marcas.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os status</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 ml-auto">
              <Switch
                id="so-gargalo"
                checked={soGargalo}
                onCheckedChange={setSoGargalo}
              />
              <Label htmlFor="so-gargalo" className="text-sm cursor-pointer">
                Só com gargalo
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={PackageSearch}
                title="Nenhum produto encontrado"
                description={
                  (produtos?.length ?? 0) === 0
                    ? "Nenhum produto sincronizado ainda — os dados aparecem quando a agência popular o RR-Produtos."
                    : "Ajuste os filtros para ver outros produtos."
                }
              />
            ) : (
              <Table minWidthClass="min-w-[1100px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nome Comercial</TableHead>
                    <TableHead>Marca</TableHead>
                    <TableHead>Linha</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Comp.</TableHead>
                    <TableHead className="text-center">ANVISA</TableHead>
                    <TableHead>Workflow</TableHead>
                    <TableHead>Motivo do gargalo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <ProdutoRow
                      key={p.notion_page_id}
                      p={p}
                      linhaNome={
                        p.linha_notion_id
                          ? linhaMap.get(p.linha_notion_id) ?? "—"
                          : "—"
                      }
                      onClick={() => openProduto(p)}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <ProdutoWorkflowDrawer
          produto={selecionado}
          linhaNome={
            selecionado?.linha_notion_id
              ? linhaMap.get(selecionado.linha_notion_id) ?? "—"
              : "—"
          }
          open={!!selecionado}
          onOpenChange={(o) => !o && openProduto(null)}
        />
      </div>
    </TooltipProvider>
  );
}

function ProdutoRow({
  p,
  linhaNome,
  onClick,
}: {
  p: RrProduto;
  linhaNome: string;
  onClick?: () => void;
}) {
  const gargalo = emGargalo(p);
  const motivos = motivosGargalo(p);
  return (
    <TableRow
      onClick={onClick}
      className={cn(
        "cursor-pointer",
        gargalo && "border-l-2 border-l-amber-500 bg-amber-500/[0.03]",
      )}
    >
      <TableCell className="font-mono text-xs">
        <div className="flex items-center gap-1.5">
          {gargalo && (
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              </TooltipTrigger>
              <TooltipContent>Produto em gargalo</TooltipContent>
            </Tooltip>
          )}
          {p.sku ?? "—"}
        </div>
      </TableCell>
      <TableCell className="font-medium">{p.nome_comercial ?? "—"}</TableCell>
      <TableCell>{p.marca ?? "—"}</TableCell>
      <TableCell className="text-muted-foreground">{linhaNome}</TableCell>
      <TableCell>
        {p.status ? <StatusPill tone="slate">{p.status}</StatusPill> : "—"}
      </TableCell>
      <TableCell className="text-center">
        <BoolIcon value={p.composicao_pt} />
      </TableCell>
      <TableCell className="text-center">
        <BoolIcon value={!!p.anvisa} />
      </TableCell>
      <TableCell>
        <WfStrip wf={p.wf} />
      </TableCell>
      <TableCell className="max-w-[280px]">
        {motivos.length === 0 ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {motivos.slice(0, 3).map((m) => (
              <Tooltip key={m.label}>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-200 cursor-help">
                    {m.label}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  <div className="font-medium">{m.label}</div>
                  <div className="text-muted-foreground">{m.detail}</div>
                </TooltipContent>
              </Tooltip>
            ))}
            {motivos.length > 3 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground cursor-help">
                    +{motivos.length - 3}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="text-xs max-w-xs">
                  {motivos.slice(3).map((m) => (
                    <div key={m.label}>
                      <span className="font-medium">{m.label}</span>
                      <span className="text-muted-foreground"> · {m.detail}</span>
                    </div>
                  ))}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

function SummaryCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  tone?: "neutral" | "ok" | "warn";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div
          className={cn(
            "mt-1 text-2xl font-semibold tabular-nums",
            tone === "warn" && "text-amber-600",
            tone === "ok" && "text-emerald-600",
          )}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
