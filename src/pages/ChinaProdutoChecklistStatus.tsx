import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ListChecks,
  Loader2,
  CheckCircle2,
  Circle,
  ArrowUpRight,
  ArrowDownLeft,
  Paperclip,
  Search,
  Download,
  FileText,
  FileSpreadsheet,
  Send,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { ChinaPageShell } from "@/components/china/ChinaPageShell";
import { ChinaPageHeader } from "@/components/china/ChinaPageHeader";
import { ChinaTimelineButton } from "@/components/china/timeline/ChinaTimelineButton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  useMergedChinaChecklist,
  type MergedChecklistCategory,
} from "@/hooks/useMergedChinaChecklist";
import { toast } from "sonner";
import { ChecklistItemPainel } from "@/components/china/checklist/ChecklistItemPainel";

interface DocRow {
  id: string;
  tipo_documento: string;
  status: string;
  nome_arquivo: string | null;
  created_at: string;
  oficializado_em: string | null;
  previsao_envio: string | null;
}

const SENT_STATUSES = new Set([
  "enviado",
  "enviado_brasil",
  "pendente",
  "aprovado",
  "ciencia",
  "contestado",
  "rejeitado",
]);

const STATUS_LABEL: Record<string, string> = {
  aprovado: "Aprovado",
  ciencia: "Ciente",
  enviado: "Enviado",
  enviado_brasil: "Enviado ao Brasil",
  pendente: "Pendente análise",
  rejeitado: "Rejeitado",
  contestado: "Contestado",
  rascunho: "Rascunho",
  planejado: "Planejado",
};

const STATUS_CLS: Record<string, string> = {
  aprovado: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  ciencia: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  enviado: "bg-primary/15 text-primary border-primary/30",
  enviado_brasil: "bg-primary/15 text-primary border-primary/30",
  pendente: "bg-primary/15 text-primary border-primary/30",
  contestado: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  rejeitado: "bg-rose-500/15 text-rose-500 border-rose-500/30",
  rascunho: "bg-muted text-muted-foreground border-border",
  planejado: "bg-muted text-muted-foreground border-border",
};

type FilterKey = "todos" | "enviados" | "pendentes" | "rejeitados" | "nao_criados";

const FILTER_OPTIONS: Array<{ key: FilterKey; label: string }> = [
  { key: "todos", label: "Todos" },
  { key: "enviados", label: "Enviados" },
  { key: "pendentes", label: "Pendentes" },
  { key: "rejeitados", label: "Rejeitados" },
  { key: "nao_criados", label: "Não criados" },
];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
}

function isSentToBrazil(doc: DocRow | undefined): boolean {
  if (!doc) return false;
  return SENT_STATUSES.has(doc.status);
}

/** Classifica um item para fins de filtro. */
function classifyForFilter(doc: DocRow | undefined): Exclude<FilterKey, "todos"> {
  if (!doc) return "nao_criados";
  if (doc.status === "rejeitado") return "rejeitados";
  if (SENT_STATUSES.has(doc.status)) return "enviados";
  return "pendentes";
}

interface CategoryBlockProps {
  cat: MergedChecklistCategory;
  visibleTipos: string[];
  docsByTipo: Map<string, DocRow>;
  getLabel: (tipo: string) => { pt: string; cn?: string };
  onOpenFocus: (tipo: string) => void;
  onAttachPendentes: (cat: MergedChecklistCategory) => void;
  pendentesCount: number;
  hiddenByFilter: number;
}

function CategoryBlock({
  cat,
  visibleTipos,
  docsByTipo,
  getLabel,
  onOpenFocus,
  onAttachPendentes,
  pendentesCount,
  hiddenByFilter,
}: CategoryBlockProps) {
  const FluxoIcon = cat.fluxo === "china_envia" ? ArrowUpRight : ArrowDownLeft;
  const fluxoLabel = cat.fluxo === "china_envia" ? "China envia" : "Brasil envia";

  const enviados = cat.tipos.reduce(
    (acc, t) => acc + (isSentToBrazil(docsByTipo.get(t)) ? 1 : 0),
    0,
  );
  const total = cat.tipos.length;
  const pct = total > 0 ? Math.round((enviados / total) * 100) : 0;

  return (
    <Card className="overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/30 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <FluxoIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
            {fluxoLabel}
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span className="truncate text-sm font-semibold text-foreground">
            {cat.labelPt}
          </span>
          {cat.labelCn && (
            <span className="truncate text-[11px] text-muted-foreground/80">
              {cat.labelCn}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">{enviados}</span> /{" "}
            {total} enviados
          </span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full transition-all",
                pct === 100 ? "bg-emerald-500" : "bg-primary",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          {pendentesCount > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-[11px]"
              onClick={() => onAttachPendentes(cat)}
              title="Abrir o Modo Foco no primeiro item pendente desta categoria"
            >
              <Send className="h-3 w-3" />
              Anexar pendências ({pendentesCount})
            </Button>
          )}
        </div>
      </header>

      {cat.tipos.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          Nenhum item configurado nesta categoria.
        </p>
      ) : visibleTipos.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          Nenhum item desta categoria corresponde aos filtros aplicados
          {hiddenByFilter > 0 && ` (${hiddenByFilter} oculto${hiddenByFilter === 1 ? "" : "s"})`}.
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[42%]">Item do checklist</TableHead>
                <TableHead className="w-[16%]">Status</TableHead>
                <TableHead className="w-[14%] text-center">Enviado ao Brasil</TableHead>
                <TableHead className="w-[16%]">Última atualização</TableHead>
                <TableHead className="w-[12%] text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleTipos.map((tipo) => {
                const doc = docsByTipo.get(tipo);
                const label = getLabel(tipo);
                const sent = isSentToBrazil(doc);
                const status = doc?.status ?? "nao_criado";
                const statusLabel =
                  status === "nao_criado"
                    ? "Não criado"
                    : STATUS_LABEL[status] ?? status;
                const statusCls =
                  status === "nao_criado"
                    ? "bg-muted text-muted-foreground border-border"
                    : STATUS_CLS[status] ?? "bg-muted text-muted-foreground border-border";
                const lastUpdate = doc?.oficializado_em ?? doc?.created_at ?? null;

                return (
                  <TableRow key={tipo}>
                    <TableCell className="py-2">
                      <div className="flex min-w-0 items-start gap-2">
                        <Paperclip className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {label.pt}
                          </p>
                          {label.cn && (
                            <p className="truncate text-[11px] text-muted-foreground">
                              {label.cn}
                            </p>
                          )}
                          {doc?.nome_arquivo && (
                            <p className="truncate text-[10.5px] text-muted-foreground/80">
                              {doc.nome_arquivo}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge
                        variant="outline"
                        className={cn("h-5 px-2 text-[10.5px] font-medium", statusCls)}
                      >
                        {statusLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 text-center">
                      {sent ? (
                        <span
                          className="inline-flex items-center justify-center"
                          title={`Enviado ao Brasil em ${formatDate(lastUpdate)}`}
                          aria-label="Enviado ao Brasil"
                        >
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center justify-center"
                          title="Ainda não enviado ao Brasil"
                          aria-label="Não enviado ao Brasil"
                        >
                          <Circle className="h-5 w-5 text-muted-foreground/40" />
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground">
                      {formatDate(lastUpdate)}
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[11px] text-primary"
                        onClick={() => onOpenFocus(tipo)}
                      >
                        {doc ? "Abrir" : "Anexar"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {hiddenByFilter > 0 && (
            <p className="px-4 py-2 text-[10.5px] text-muted-foreground/80">
              {hiddenByFilter} item{hiddenByFilter === 1 ? "" : "s"} oculto{hiddenByFilter === 1 ? "" : "s"} pelos filtros.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function downloadBlob(content: BlobPart, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ChinaProdutoChecklistStatus() {
  const { id } = useParams<{ id: string }>();
  
  const location = useLocation();
  const backTo =
    (location.state as { from?: string } | null)?.from ??
    `/dashboard/fabrica-china/produto/${id}`;
  const merged = useMergedChinaChecklist(id);

  const initialFilter = useMemo<FilterKey>(() => {
    const from = new URLSearchParams(location.search).get("from");
    switch (from) {
      case "sent_brazil":
      case "in_analysis":
        return "enviados";
      case "returned":
        return "rejeitados";
      case "awaiting_send":
      case "approved":
      default:
        return "todos";
    }
  }, [location.search]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>(initialFilter);
  const [painelTipo, setPainelTipo] = useState<string | null>(null);

  // Deep-link via ?item=<tipo>
  useEffect(() => {
    const param = new URLSearchParams(location.search).get("item");
    if (param) setPainelTipo(param);
  }, [location.search]);

  const { data: submissao } = useQuery({
    queryKey: ["china-ficha", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_produto_submissoes" as any)
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: documentos = [], isLoading: loadingDocs } = useQuery({
    queryKey: ["china-checklist-status-docs", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_produto_documentos" as any)
        .select(
          "id, tipo_documento, status, nome_arquivo, created_at, oficializado_em, previsao_envio",
        )
        .eq("submissao_id", id)
        .neq("status", "planejado");
      if (error) throw error;
      return (data || []) as unknown as DocRow[];
    },
  });

  const docsByTipo = useMemo(() => {
    const m = new Map<string, DocRow>();
    for (const d of documentos) {
      const prev = m.get(d.tipo_documento);
      if (!prev) {
        m.set(d.tipo_documento, d);
        continue;
      }
      const prevTs = new Date(prev.oficializado_em ?? prev.created_at).getTime();
      const curTs = new Date(d.oficializado_em ?? d.created_at).getTime();
      if (curTs > prevTs) m.set(d.tipo_documento, d);
    }
    return m;
  }, [documentos]);

  const getLabel = (tipo: string) => {
    const dt = merged.getDocType(tipo);
    return { pt: dt?.labelPt ?? tipo, cn: dt?.labelCn };
  };

  const matchesFilters = (tipo: string): boolean => {
    if (filter !== "todos") {
      if (classifyForFilter(docsByTipo.get(tipo)) !== filter) return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const label = getLabel(tipo);
      const doc = docsByTipo.get(tipo);
      const haystack = [
        tipo,
        label.pt,
        label.cn ?? "",
        doc?.nome_arquivo ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  };

  const handleOpenFocus = (tipo: string) => {
    setPainelTipo(tipo);
  };

  /**
   * Anexar pendências de uma categoria: abre o painel posicionado no
   * primeiro item ainda não enviado (pendente, rejeitado ou não criado).
   */
  const handleAttachPendentes = (cat: MergedChecklistCategory) => {
    const firstPending = cat.tipos.find((t) => {
      const doc = docsByTipo.get(t);
      return !isSentToBrazil(doc) || doc?.status === "rejeitado";
    });
    if (!firstPending) {
      toast.info("Nenhum item pendente nesta categoria.");
      return;
    }
    setPainelTipo(firstPending);
  };

  const buildExportRows = () => {
    const rows: Array<{
      fluxo: string;
      categoria: string;
      item: string;
      tipo: string;
      status: string;
      enviadoBrasil: string;
      ultimaAtualizacao: string;
      arquivo: string;
    }> = [];
    for (const cat of merged.categories) {
      const fluxoLabel = cat.fluxo === "china_envia" ? "China envia" : "Brasil envia";
      for (const tipo of cat.tipos) {
        if (!matchesFilters(tipo)) continue;
        const doc = docsByTipo.get(tipo);
        const label = getLabel(tipo);
        const status = doc?.status ?? "nao_criado";
        const statusLabel =
          status === "nao_criado" ? "Não criado" : STATUS_LABEL[status] ?? status;
        rows.push({
          fluxo: fluxoLabel,
          categoria: cat.labelPt,
          item: label.pt,
          tipo,
          status: statusLabel,
          enviadoBrasil: isSentToBrazil(doc) ? "Sim" : "Não",
          ultimaAtualizacao: formatDate(doc?.oficializado_em ?? doc?.created_at ?? null),
          arquivo: doc?.nome_arquivo ?? "",
        });
      }
    }
    return rows;
  };

  const handleExportCSV = () => {
    const rows = buildExportRows();
    if (rows.length === 0) {
      toast.info("Nada para exportar com os filtros atuais.");
      return;
    }
    const header = [
      "Fluxo",
      "Categoria",
      "Item",
      "Tipo",
      "Status",
      "Enviado ao Brasil",
      "Última atualização",
      "Arquivo",
    ];
    const lines = [header.map(csvEscape).join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.fluxo,
          r.categoria,
          r.item,
          r.tipo,
          r.status,
          r.enviadoBrasil,
          r.ultimaAtualizacao,
          r.arquivo,
        ]
          .map(csvEscape)
          .join(","),
      );
    }
    const filename = `checklist-status-${submissao?.produto_codigo ?? id}.csv`;
    // BOM para Excel reconhecer UTF-8.
    downloadBlob("\uFEFF" + lines.join("\n"), "text/csv;charset=utf-8;", filename);
    toast.success("CSV exportado.");
  };

  const handleExportPDF = async () => {
    const rows = buildExportRows();
    if (rows.length === 0) {
      toast.info("Nada para exportar com os filtros atuais.");
      return;
    }
    const [{ jsPDF }, autoTableMod] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const autoTable = (autoTableMod as any).default ?? (autoTableMod as any);
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const title = "Status do Checklist";
    const subtitle = submissao
      ? `${submissao.produto_codigo} — ${submissao.produto_nome}`
      : "";
    doc.setFontSize(14);
    doc.text(title, 40, 40);
    if (subtitle) {
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(subtitle, 40, 58);
      doc.setTextColor(0);
    }
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(
      `Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })} · Filtro: ${
        FILTER_OPTIONS.find((f) => f.key === filter)?.label ?? "Todos"
      }${search.trim() ? ` · Busca: "${search.trim()}"` : ""}`,
      40,
      72,
    );
    doc.setTextColor(0);
    autoTable(doc, {
      startY: 88,
      head: [
        [
          "Fluxo",
          "Categoria",
          "Item",
          "Status",
          "Enviado ao Brasil",
          "Última atualização",
        ],
      ],
      body: rows.map((r) => [
        r.fluxo,
        r.categoria,
        r.item,
        r.status,
        r.enviadoBrasil,
        r.ultimaAtualizacao,
      ]),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [60, 60, 60], textColor: 255 },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index === 4) {
          if (data.cell.raw === "Sim") {
            data.cell.styles.textColor = [16, 122, 87];
            data.cell.styles.fontStyle = "bold";
          } else {
            data.cell.styles.textColor = [140, 140, 140];
          }
        }
      },
    });
    const filename = `checklist-status-${submissao?.produto_codigo ?? id}.pdf`;
    doc.save(filename);
    toast.success("PDF exportado.");
  };

  if (!id) return null;

  const loading = merged.isLoading || loadingDocs;
  const allCats = merged.categories;

  // Totais globais (sobre TODOS os tipos, ignorando filtros).
  const allTipos = allCats.flatMap((c) => c.tipos);
  const totalGlobal = allTipos.length;
  const enviadosGlobal = allTipos.reduce(
    (acc, t) => acc + (isSentToBrazil(docsByTipo.get(t)) ? 1 : 0),
    0,
  );

  // Pré-calcula visibilidade por categoria.
  const visibleByCat = new Map<string, string[]>();
  let totalVisible = 0;
  for (const cat of allCats) {
    const visible = cat.tipos.filter(matchesFilters);
    visibleByCat.set(cat.key, visible);
    totalVisible += visible.length;
  }

  return (
    <ChinaPageShell>
      <ChinaPageHeader
        titlePt="Status do Checklist"
        titleCn="清单状态"
        subtitle={
          submissao
            ? `${submissao.produto_codigo} — ${submissao.produto_nome}`
            : undefined
        }
        icon={ListChecks}
        iconTone="primary"
        showBack
        backTo={backTo}
        actions={
          <>
            <ChinaTimelineButton scope={{ submissaoId: id }} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="sm" variant="outline" className="h-8 gap-1 text-xs">
                  <Download className="h-3.5 w-3.5" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={handleExportCSV} className="gap-2 text-xs">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Exportar CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF} className="gap-2 text-xs">
                  <FileText className="h-3.5 w-3.5" />
                  Exportar PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="space-y-3">
        <Card className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="space-y-0.5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Progresso geral
            </p>
            <p className="text-sm font-medium text-foreground">
              <span className="text-base font-semibold">{enviadosGlobal}</span>{" "}
              de <span className="font-semibold">{totalGlobal}</span> itens enviados ao Brasil
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2 w-48 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full transition-all",
                  totalGlobal > 0 && enviadosGlobal === totalGlobal
                    ? "bg-emerald-500"
                    : "bg-primary",
                )}
                style={{
                  width: `${totalGlobal > 0 ? Math.round((enviadosGlobal / totalGlobal) * 100) : 0}%`,
                }}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => {
                const firstPending = allTipos.find((t) => {
                  const d = docsByTipo.get(t);
                  return !isSentToBrazil(d) || d?.status === "rejeitado";
                });
                if (firstPending) setPainelTipo(firstPending);
                else toast.info("Nenhum item pendente.");
              }}
            >
              Abrir item pendente
            </Button>
          </div>
        </Card>

        <Card className="flex flex-wrap items-center gap-3 px-3 py-2.5">
          <div className="relative min-w-[220px] flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por nome ou tipo do documento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <ToggleGroup
            type="single"
            value={filter}
            onValueChange={(v) => v && setFilter(v as FilterKey)}
            className="flex-wrap"
          >
            {FILTER_OPTIONS.map((opt) => (
              <ToggleGroupItem
                key={opt.key}
                value={opt.key}
                className="h-7 px-2.5 text-[11px]"
              >
                {opt.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <span className="ml-auto text-[11px] text-muted-foreground">
            {totalVisible} de {totalGlobal} itens
          </span>
        </Card>

        {loading ? (
          <Card className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </Card>
        ) : allCats.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma categoria configurada para este produto.
          </Card>
        ) : (
          allCats.map((cat) => {
            const visible = visibleByCat.get(cat.key) ?? [];
            const pendentes = cat.tipos.filter((t) => {
              const d = docsByTipo.get(t);
              return !isSentToBrazil(d) || d?.status === "rejeitado";
            }).length;
            return (
              <CategoryBlock
                key={cat.key}
                cat={cat}
                visibleTipos={visible}
                docsByTipo={docsByTipo}
                getLabel={getLabel}
                onOpenFocus={handleOpenFocus}
                onAttachPendentes={handleAttachPendentes}
                pendentesCount={pendentes}
                hiddenByFilter={cat.tipos.length - visible.length}
              />
            );
          })
        )}
      </div>

      {painelTipo && (() => {
        const cat = allCats.find((c) => c.tipos.includes(painelTipo));
        const label = getLabel(painelTipo);
        return (
          <ChecklistItemPainel
            open={!!painelTipo}
            onOpenChange={(o) => {
              if (!o) setPainelTipo(null);
            }}
            submissaoId={id}
            tipoDocumento={painelTipo}
            labelPt={label.pt}
            labelCn={label.cn}
            fluxo={cat?.fluxo === "brasil_envia" ? "brasil_envia" : "china_envia"}
          />
        );
      })()}
    </ChinaPageShell>
  );
}
