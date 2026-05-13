import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileX2,
  Send,
  Paperclip,
  ExternalLink,
  ListChecks,
  ArrowUpRight,
  ArrowDownLeft,
  MessageSquarePlus,
  MessageSquareText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePageBgColor } from "@/hooks/usePageBgColor";
import { getBgPaletteVars } from "@/lib/colorUtils";
import type { MailboxItem, MailboxFolder } from "@/hooks/useChinaMailbox";
import type { MailboxGroup } from "@/lib/china/groupMailboxItems";
import { evaluateAwaitingSend } from "@/lib/china/awaitingSendRule";
import { useMergedChinaChecklist, type MergedChecklistCategory } from "@/hooks/useMergedChinaChecklist";
import { useChinaI18n } from "@/hooks/useChinaI18n";

/** Cor de borda esquerda por estado, para leitura visual rápida da lista. */
const STATE_BORDER: Record<string, string> = {
  aprovado: "border-l-emerald-500",
  enviado: "border-l-primary",
  rejeitado: "border-l-rose-500",
  pendente_envio: "border-l-amber-500",
  nao_criado: "border-l-muted-foreground/30",
};

export interface ChecklistPendingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: MailboxGroup | null;
  /** Pasta de origem — define título, escopo e ações exibidas. */
  folder?: MailboxFolder;
  onSelectItem?: (id: string) => void;
  onEnviarGrupoBrasil?: (group: MailboxGroup) => void;
  /** Despacho individual de um item ao Brasil. */
  onEnviarItemBrasil?: (item: MailboxItem) => void;
  onOpenSubmissao?: (submissao_id: string) => void;
}

interface FolderConfig {
  /** Chave i18n para o título do drawer. */
  titleKey: string;
  /** Filtra os docs do grupo que pertencem ao escopo desta pasta. */
  scope: (item: MailboxItem) => boolean;
  /** Define o filtro inicial da página dedicada via query string. */
  pageFilter: "todos" | "enviados" | "pendentes" | "rejeitados" | "nao_criados";
  /** Mostra ações "Anexar" / "Enviar" por linha e CTA bulk no footer. */
  showAttach: boolean;
  showEnviarFooter: boolean;
  /**
   * "pending" → prioriza pendentes/rejeitados (ordem padrão).
   * "sent"    → prioriza itens já enviados; pendentes vão para bloco recolhível.
   */
  priorityMode: "pending" | "sent";
}

// Visualização unificada do checklist em todas as pastas: mesma ordenação
// (pendentes/rejeitados primeiro), mesmo escopo (todos os itens da submissão)
// e mesmas ações por linha (Anexar/Enviar quando aplicável). Apenas o título
// do drawer e o filtro inicial da página dedicada variam por pasta.
const FOLDER_CONFIG: Partial<Record<MailboxFolder, FolderConfig>> = {
  awaiting_send: {
    titleKey: "inbox.checklistSheet.folder.awaitingSend",
    scope: () => true,
    pageFilter: "todos",
    showAttach: true,
    showEnviarFooter: true,
    priorityMode: "pending",
  },
  sent_brazil: {
    titleKey: "inbox.checklistSheet.folder.sentBrazil",
    scope: () => true,
    pageFilter: "enviados",
    showAttach: true,
    showEnviarFooter: true,
    priorityMode: "pending",
  },
  in_analysis: {
    titleKey: "inbox.checklistSheet.folder.inAnalysis",
    scope: () => true,
    pageFilter: "enviados",
    showAttach: true,
    showEnviarFooter: true,
    priorityMode: "pending",
  },
  returned: {
    titleKey: "inbox.checklistSheet.folder.returned",
    scope: () => true,
    pageFilter: "rejeitados",
    showAttach: true,
    showEnviarFooter: true,
    priorityMode: "pending",
  },
};

const DEFAULT_FOLDER_CONFIG: FolderConfig = FOLDER_CONFIG.awaiting_send!;


type ItemState =
  | "nao_criado"
  | "pendente_envio"
  | "enviado"
  | "aprovado"
  | "rejeitado";

function classifyItem(item: MailboxItem): ItemState {
  if (item.is_virtual) return "nao_criado";
  if (item.doc_status === "aprovado") return "aprovado";
  if (item.doc_status === "rejeitado") return "rejeitado";
  if (evaluateAwaitingSend(item).matches) return "pendente_envio";
  if (item.doc_status === "enviado" || item.doc_status === "contestado") return "enviado";
  if (item.doc_status === "pendente") return "enviado";
  return "pendente_envio";
}

const STATE_META: Record<
  ItemState,
  { labelKey: string; icon: typeof Clock; cls: string }
> = {
  nao_criado: {
    labelKey: "inbox.checklistSheet.state.naoCriado",
    icon: FileX2,
    cls: "bg-muted/40 text-muted-foreground border-border",
  },
  pendente_envio: {
    labelKey: "inbox.checklistSheet.state.pendenteEnvio",
    icon: Clock,
    cls: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  enviado: {
    labelKey: "inbox.checklistSheet.state.enviado",
    icon: Send,
    cls: "bg-primary/15 text-primary border-primary/30",
  },
  aprovado: {
    labelKey: "inbox.checklistSheet.state.aprovado",
    icon: CheckCircle2,
    cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  rejeitado: {
    labelKey: "inbox.checklistSheet.state.rejeitado",
    icon: AlertTriangle,
    cls: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  },
};

const STATE_ORDER: Record<ItemState, number> = {
  rejeitado: 0,
  pendente_envio: 1,
  nao_criado: 2,
  enviado: 3,
  aprovado: 4,
};

function formatTipoFallback(
  tipo: string | null | undefined,
  t: (k: string) => string,
): string {
  if (!tipo) return t("inbox.checklistSheet.fallback.itemChecklist");
  if (tipo.startsWith("custom_")) return t("inbox.checklistSheet.fallback.itemPersonalizado");
  return tipo
    .split("_")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function rowKey(item: MailboxItem): string {
  return item.is_virtual
    ? `${item.submissao_id}:virtual:${item.tipo_documento ?? "_"}`
    : item.documento_id ?? item.submissao_id;
}

interface CategorySection {
  key: string;
  labelPt: string;
  labelCn?: string;
  fluxo: "china_envia" | "brasil_envia" | "outros";
  rows: Array<{ item: MailboxItem; state: ItemState }>;
  enviadosCount: number;
  pendentesCount: number;
  total: number;
}

const SENT_STATES: ReadonlySet<ItemState> = new Set(["enviado", "aprovado", "rejeitado"]);

const STATE_ORDER_PENDING: Record<ItemState, number> = {
  rejeitado: 0,
  pendente_envio: 1,
  nao_criado: 2,
  enviado: 3,
  aprovado: 4,
};

const STATE_ORDER_SENT: Record<ItemState, number> = {
  enviado: 0,
  aprovado: 1,
  rejeitado: 2,
  pendente_envio: 3,
  nao_criado: 4,
};

function buildSections(
  group: MailboxGroup,
  cats: MergedChecklistCategory[],
  priorityMode: "pending" | "sent",
): CategorySection[] {
  const tipoToCat = new Map<string, MergedChecklistCategory>();
  for (const c of cats) {
    for (const t of c.tipos) tipoToCat.set(t, c);
  }

  const byCat = new Map<string, CategorySection>();
  const ensure = (
    key: string,
    labelPt: string,
    labelCn: string | undefined,
    fluxo: CategorySection["fluxo"],
  ): CategorySection => {
    let s = byCat.get(key);
    if (!s) {
      s = {
        key,
        labelPt,
        labelCn,
        fluxo,
        rows: [],
        enviadosCount: 0,
        pendentesCount: 0,
        total: 0,
      };
      byCat.set(key, s);
    }
    return s;
  };

  for (const c of cats) {
    const s = ensure(c.key, c.labelPt, c.labelCn, c.fluxo);
    s.total = c.tipos.length;
  }

  for (const item of group.docs) {
    const tipo = item.tipo_documento || "";
    const cat = tipoToCat.get(tipo);
    const s = cat
      ? ensure(cat.key, cat.labelPt, cat.labelCn, cat.fluxo)
      : ensure("__outros__", "Outros itens", undefined, "outros");
    const state = classifyItem(item);
    s.rows.push({ item, state });
    if (SENT_STATES.has(state)) s.enviadosCount += 1;
    else s.pendentesCount += 1;
  }

  const order = priorityMode === "sent" ? STATE_ORDER_SENT : STATE_ORDER_PENDING;
  for (const s of byCat.values()) {
    s.rows.sort((a, b) => order[a.state] - order[b.state]);
  }

  const fluxoOrder: Record<CategorySection["fluxo"], number> = {
    china_envia: 0,
    brasil_envia: 1,
    outros: 2,
  };
  return Array.from(byCat.values())
    .filter((s) => s.rows.length > 0 || s.total > 0)
    .sort((a, b) => fluxoOrder[a.fluxo] - fluxoOrder[b.fluxo]);
}

export function ChecklistPendingSheet({
  open,
  onOpenChange,
  group,
  folder,
  onSelectItem,
  onEnviarGrupoBrasil,
  onEnviarItemBrasil,
  onOpenSubmissao,
}: ChecklistPendingSheetProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useChinaI18n();
  const { bgColor } = usePageBgColor();
  const merged = useMergedChinaChecklist(group?.submissao_id ?? null);
  const cfg = (folder && FOLDER_CONFIG[folder]) ?? DEFAULT_FOLDER_CONFIG;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelected(new Set());
  }, [group?.submissao_id, folder]);

  // Parecer técnico da China (campo único por submissão).
  const currentParecer = group?.docs[0]?.observacoes_china ?? "";
  const [parecerOpen, setParecerOpen] = useState(false);
  const [parecerText, setParecerText] = useState(currentParecer);
  useEffect(() => {
    setParecerText(currentParecer);
  }, [currentParecer, group?.submissao_id]);

  const saveParecer = useMutation({
    mutationFn: async (texto: string) => {
      if (!group) throw new Error("sem submissão");
      const { error } = await supabase
        .from("china_produto_submissoes" as any)
        .update({ observacoes_china: texto.trim() })
        .eq("id", group.submissao_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("inbox.checklistSheet.parecerDialog.toastOk"));
      queryClient.invalidateQueries({ queryKey: ["china-mailbox"] });
      queryClient.invalidateQueries({ queryKey: ["china-merged-checklist"] });
      setParecerOpen(false);
    },
    onError: (e: any) => toast.error(e?.message || t("inbox.checklistSheet.parecerDialog.toastErr")),
  });

  // Aplica o escopo da pasta antes de montar as seções por categoria.
  const scopedGroup = useMemo<MailboxGroup | null>(() => {
    if (!group) return null;
    if (cfg === DEFAULT_FOLDER_CONFIG && (!folder || folder === "awaiting_send")) {
      return group;
    }
    return { ...group, docs: group.docs.filter(cfg.scope) };
  }, [group, cfg, folder]);

  const sections = useMemo(() => {
    if (!scopedGroup) return [];
    return buildSections(scopedGroup, merged.categories, cfg.priorityMode);
  }, [scopedGroup, merged.categories, cfg.priorityMode]);

  const totals = useMemo(() => {
    if (!group) return null;
    const expected = Math.max(
      group.docs[0]?.checklist_expected_total ?? 0,
      group.progress.total,
    );
    const enviados =
      group.progress.enviados +
      group.progress.aprovados +
      group.progress.em_analise +
      group.progress.rejeitados;
    const pct = expected > 0 ? Math.round((enviados / expected) * 100) : 0;
    return {
      enviados,
      expected,
      pendentes: Math.max(0, expected - enviados),
      pct,
    };
  }, [group]);

  if (!group) return null;

  const pendingCount = totals?.pendentes ?? 0;
  const hasParecer = currentParecer.trim().length > 0;
  // Mostra ações de parecer apenas em pastas onde "enviar ao Brasil" faz sentido.
  const showParecerActions = cfg.showEnviarFooter;

  const handleAttach = (item: MailboxItem) => {
    if (!item.tipo_documento) return;
    navigate(
      `/dashboard/fabrica-china/produto/${group.submissao_id}?focus=${encodeURIComponent(item.tipo_documento)}`,
    );
  };

  const handleOpenInPage = () => {
    navigate(
      `/dashboard/fabrica-china/produto/${group.submissao_id}/checklist-status?from=${encodeURIComponent(folder ?? "awaiting_send")}`,
      { state: { from: "/dashboard/fabrica-china/caixa-entrada" } },
    );
  };



  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col p-0"
        style={
          bgColor
            ? ({ backgroundColor: bgColor, color: "hsl(var(--foreground))", ...getBgPaletteVars(bgColor) } as React.CSSProperties)
            : undefined
        }
      >
        <SheetHeader className="space-y-2 border-b border-border/60 px-4 py-3">
          <SheetTitle className="text-sm font-semibold leading-tight">
            <span className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              {t(cfg.titleKey)}
            </span>
          </SheetTitle>
          <SheetDescription className="text-[12px] text-muted-foreground">
            <span className="block text-foreground font-medium truncate">
              {group.produto_codigo} — {group.produto_nome}
            </span>
            {group.numero_ordem && (
              <span className="block text-[10.5px]">{group.numero_ordem}</span>
            )}
          </SheetDescription>
          {totals && (
            <div className="space-y-1 pt-1">
              <p className="text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground/90">
                  {t("inbox.checklistSheet.totals.linha", { enviados: totals.enviados, expected: totals.expected })}
                </span>{" "}
                {t("inbox.checklistSheet.totals.itensEnviados")} ·{" "}
                <span
                  className={cn(
                    "font-medium",
                    totals.pendentes > 0 ? "text-amber-400" : "text-emerald-400",
                  )}
                >
                  {t("inbox.checklistSheet.totals.pendente", { count: totals.pendentes })}
                </span>
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                <div
                  className={cn(
                    "h-full transition-all",
                    totals.pct === 100 ? "bg-emerald-500" : "bg-primary",
                  )}
                  style={{ width: `${totals.pct}%` }}
                />
              </div>
            </div>
          )}
          <div className="flex items-center gap-1.5 pt-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 gap-1 px-2 text-[10.5px] text-muted-foreground"
              onClick={handleOpenInPage}
              title={t("inbox.checklistSheet.header.abrirPaginaDedicadaTitle")}
            >
              <ExternalLink className="h-3 w-3" />
              {t("inbox.checklistSheet.header.abrirPaginaDedicada")}
            </Button>
            {showParecerActions && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn(
                  "h-6 gap-1 px-2 text-[10.5px]",
                  hasParecer ? "text-muted-foreground" : "text-amber-500",
                )}
                onClick={() => setParecerOpen(true)}
                title={hasParecer
                  ? t("inbox.checklistSheet.header.editarParecerTitle")
                  : t("inbox.checklistSheet.header.adicionarParecerTitle")}
              >
                {hasParecer ? <MessageSquareText className="h-3 w-3" /> : <MessageSquarePlus className="h-3 w-3" />}
                {hasParecer
                  ? t("inbox.checklistSheet.header.editarParecer")
                  : t("inbox.checklistSheet.header.adicionarParecer")}
              </Button>
            )}
          </div>
          {showParecerActions && !hasParecer && pendingCount > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200/90">
              <p className="font-medium text-amber-300">{t("inbox.checklistSheet.parecerBanner.titulo")}</p>
              <p className="mt-0.5 text-amber-200/80">
                {t("inbox.checklistSheet.parecerBanner.descricao")}
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-1.5 h-6 gap-1 px-2 text-[10.5px] bg-amber-500/90 hover:bg-amber-500 text-amber-950"
                onClick={() => setParecerOpen(true)}
              >
                <MessageSquarePlus className="h-3 w-3" />
                {t("inbox.checklistSheet.parecerBanner.abrirCaixa")}
              </Button>
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {sections.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {t("inbox.checklistSheet.empty")}
            </p>
          )}
          {sections.map((section) => {
            const FluxoIcon =
              section.fluxo === "china_envia"
                ? ArrowUpRight
                : section.fluxo === "brasil_envia"
                ? ArrowDownLeft
                : ListChecks;
            const fluxoLabel =
              section.fluxo === "china_envia"
                ? t("inbox.checklistSheet.fluxo.chinaEnvia")
                : section.fluxo === "brasil_envia"
                ? t("inbox.checklistSheet.fluxo.brasilEnvia")
                : t("inbox.checklistSheet.fluxo.outros");

            // Visualização unificada: todos os itens em sequência única,
            // ordenados pela prioridade definida em STATE_PRIORITY (pendentes
            // e rejeitados no topo). Sem bloco recolhível por pasta.
            const primaryRows = section.rows;

            const renderRow = ({ item, state }: { item: MailboxItem; state: ItemState }) => {
              const meta = STATE_META[state];
              const Icon = meta.icon;
              const name =
                item.tipo_documento_label ??
                merged.getDocType(item.tipo_documento || "")?.labelPt ??
                formatTipoFallback(item.tipo_documento, t);
              const id = rowKey(item);
              const canSendSingle =
                !!onEnviarItemBrasil &&
                !item.is_virtual &&
                !!item.documento_id &&
                (state === "pendente_envio" || state === "rejeitado");
              const canBulkSelect =
                !!onEnviarItemBrasil &&
                hasParecer &&
                !item.is_virtual &&
                !!item.documento_id &&
                (state === "pendente_envio" || state === "rejeitado");
              const isChecked = canBulkSelect && selected.has(id);
              return (
                <li
                  key={id}
                  className={cn(
                    "flex items-start gap-2 border-l-4 pl-3 pr-4 py-2.5 transition-colors hover:bg-muted/30",
                    STATE_BORDER[state] ?? "border-l-transparent",
                    isChecked && "bg-emerald-500/5",
                  )}
                >
                  {canBulkSelect ? (
                    <Checkbox
                      className="mt-0.5"
                      checked={isChecked}
                      onCheckedChange={(c) => {
                        setSelected((prev) => {
                          const n = new Set(prev);
                          if (c) n.add(id);
                          else n.delete(id);
                          return n;
                        });
                      }}
                      aria-label={t("inbox.checklistSheet.row.selecionarAria", { name })}
                    />
                  ) : (
                    <Paperclip className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-foreground">
                      {name}
                    </p>
                    {item.nome_arquivo && (
                      <p className="truncate text-[10.5px] text-muted-foreground">
                        {item.nome_arquivo}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-4 gap-0.5 px-1.5 text-[9.5px] font-medium",
                          meta.cls,
                        )}
                      >
                        <Icon className="h-2.5 w-2.5" />
                        {t(meta.labelKey)}
                      </Badge>
                      {cfg.showAttach &&
                        (state === "nao_criado" ||
                          state === "pendente_envio" ||
                          state === "rejeitado") && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-5 gap-1 px-1.5 text-[10px] text-primary"
                            onClick={() => handleAttach(item)}
                            title={t("inbox.checklistSheet.row.anexarTitle")}
                          >
                            {t("inbox.checklistSheet.row.anexar")}
                          </Button>
                        )}
                      {showParecerActions && !hasParecer &&
                        (state === "pendente_envio" || state === "rejeitado" || state === "nao_criado") && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-5 gap-1 px-1.5 text-[10px] border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                            onClick={() => setParecerOpen(true)}
                            title={t("inbox.checklistSheet.row.abrirParecerTitle")}
                          >
                            <MessageSquarePlus className="h-2.5 w-2.5" />
                            {t("inbox.checklistSheet.row.abrirParecer")}
                          </Button>
                        )}
                      {canSendSingle && (
                        <Button
                          type="button"
                          size="sm"
                          className="h-5 gap-1 px-1.5 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                          onClick={() => onEnviarItemBrasil!(item)}
                          disabled={showParecerActions && !hasParecer}
                          title={
                            showParecerActions && !hasParecer
                              ? t("inbox.checklistSheet.row.enviarBrasilBloqueadoTitle")
                              : t("inbox.checklistSheet.row.enviarBrasilTitle")
                          }
                        >
                          <Send className="h-2.5 w-2.5" />
                          {t("inbox.checklistSheet.row.enviarBrasil")}
                        </Button>
                      )}
                      {!item.is_virtual && onSelectItem && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-5 px-1.5 text-[10px] text-muted-foreground"
                          onClick={() => onSelectItem(id)}
                        >
                          {t("inbox.checklistSheet.row.abrirItem")}
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            };

            return (
              <section
                key={section.key}
                className="border-b border-border/40 last:border-b-0"
                aria-label={t("inbox.checklistSheet.category.ariaLabel", { label: section.labelPt })}
              >
                <header className="sticky top-0 z-[1] flex items-center justify-between gap-2 bg-muted/40 px-4 py-1.5 backdrop-blur">
                  <div className="min-w-0 flex items-center gap-1.5">
                    <FluxoIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {fluxoLabel}
                    </span>
                    <span className="text-muted-foreground/50">·</span>
                    <span className="truncate text-[11.5px] font-semibold text-foreground">
                      {section.labelPt}
                    </span>
                    {section.labelCn && (
                      <span className="truncate text-[10px] text-muted-foreground/80">
                        {section.labelCn}
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] tabular-nums">
                    <span className="font-medium text-emerald-400">
                      {section.enviadosCount}
                    </span>
                    <span className="text-muted-foreground/70"> {t("inbox.checklistSheet.section.enviado", { count: section.enviadosCount })}</span>
                    {section.pendentesCount > 0 && (
                      <>
                        <span className="text-muted-foreground/50"> · </span>
                        <span className="text-muted-foreground">
                          {section.pendentesCount} {t("inbox.checklistSheet.section.pendente", { count: section.pendentesCount })}
                        </span>
                      </>
                    )}
                  </span>
                </header>
                <ul role="list" className="divide-y divide-border/40">
                  {primaryRows.map(renderRow)}
                  {primaryRows.length === 0 && !splitSecondary && (
                    <li className="px-4 py-2 text-[11px] text-muted-foreground/80">
                      {t("inbox.checklistSheet.section.vazioCategoria")}
                    </li>
                  )}
                  {primaryRows.length === 0 && splitSecondary && secondaryRows.length === 0 && (
                    <li className="px-4 py-2 text-[11px] text-muted-foreground/80">
                      {t("inbox.checklistSheet.section.vazioCategoriaSent")}
                    </li>
                  )}
                </ul>
                {splitSecondary && secondaryRows.length > 0 && (
                  <details className="group border-t border-border/40 bg-muted/10">
                    <summary className="cursor-pointer list-none px-4 py-1.5 text-[10.5px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                      <span className="transition-transform group-open:rotate-90">›</span>
                      {t("inbox.checklistSheet.section.verPendentes", { count: secondaryRows.length })}
                    </summary>
                    <ul role="list" className="divide-y divide-border/40 bg-background/40">
                      {secondaryRows.map(renderRow)}
                    </ul>
                  </details>
                )}
              </section>
            );
          })}
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-border/60 bg-background/95 px-4 py-2 backdrop-blur">
          {onOpenSubmissao && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-[11px]"
              onClick={() => onOpenSubmissao(group.submissao_id)}
            >
              {t("inbox.checklistSheet.footer.abrirSubmissao")}
            </Button>
          )}
          {cfg.showEnviarFooter && selected.size > 0 && onEnviarItemBrasil && (
            <Button
              type="button"
              size="sm"
              className="ml-auto h-7 gap-1 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                if (!scopedGroup) return;
                const map = new Map(scopedGroup.docs.map((d) => [rowKey(d), d]));
                const items = Array.from(selected)
                  .map((k) => map.get(k))
                  .filter((d): d is MailboxItem => !!d);
                items.forEach((it) => onEnviarItemBrasil(it));
                setSelected(new Set());
              }}
              title={t("inbox.checklistSheet.footer.enviarSelecionadosTitle")}
            >
              <Send className="h-3 w-3" />
              {t("inbox.checklistSheet.footer.enviarSelecionados", { count: selected.size })}
            </Button>
          )}
          {cfg.showEnviarFooter && selected.size === 0 && pendingCount > 0 && onEnviarGrupoBrasil && (
            <Button
              type="button"
              size="sm"
              className="ml-auto h-7 gap-1 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => onEnviarGrupoBrasil(group)}
              disabled={!hasParecer}
              title={hasParecer
                ? t("inbox.checklistSheet.footer.enviarTodosTitle")
                : t("inbox.checklistSheet.footer.enviarTodosBloqueadoTitle")}
            >
              <Send className="h-3 w-3" />
              {t("inbox.checklistSheet.footer.enviarTodos")}
            </Button>
          )}
        </div>
      </SheetContent>

      <Dialog open={parecerOpen} onOpenChange={setParecerOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <MessageSquarePlus className="h-4 w-4 text-primary" />
              {t("inbox.checklistSheet.parecerDialog.titulo")}
            </DialogTitle>
            <DialogDescription className="text-[12px]">
              {t("inbox.checklistSheet.parecerDialog.descricao")}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={parecerText}
            onChange={(e) => setParecerText(e.target.value)}
            placeholder={t("inbox.checklistSheet.parecerDialog.placeholder")}
            className="min-h-[160px] text-[12.5px]"
            maxLength={8000}
          />
          <p className="text-right text-[10.5px] text-muted-foreground">
            {t("inbox.checklistSheet.parecerDialog.contador", { atual: parecerText.length, max: 8000 })}
          </p>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setParecerOpen(false)}
              disabled={saveParecer.isPending}
            >
              {t("common.cancelar")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => saveParecer.mutate(parecerText)}
              disabled={saveParecer.isPending || parecerText.trim().length === 0}
            >
              {saveParecer.isPending
                ? t("inbox.checklistSheet.parecerDialog.salvando")
                : t("inbox.checklistSheet.parecerDialog.salvar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
