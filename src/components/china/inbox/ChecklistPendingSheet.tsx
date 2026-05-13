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
  title: string;
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

const FOLDER_CONFIG: Partial<Record<MailboxFolder, FolderConfig>> = {
  awaiting_send: {
    title: "Checklist pendente",
    scope: () => true,
    pageFilter: "todos",
    showAttach: true,
    showEnviarFooter: true,
    priorityMode: "pending",
  },
  sent_brazil: {
    title: "Itens enviados ao Brasil",
    scope: () => true,
    pageFilter: "enviados",
    showAttach: false,
    showEnviarFooter: false,
    priorityMode: "sent",
  },
  in_analysis: {
    title: "Itens em análise no Brasil",
    scope: () => true,
    pageFilter: "enviados",
    showAttach: false,
    showEnviarFooter: false,
    priorityMode: "sent",
  },
  returned: {
    title: "Itens com ajustes solicitados",
    scope: (i) => i.doc_status === "rejeitado",
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
  { label: string; icon: typeof Clock; cls: string }
> = {
  nao_criado: {
    label: "Não criado",
    icon: FileX2,
    cls: "bg-muted/40 text-muted-foreground border-border",
  },
  pendente_envio: {
    label: "Pendente envio",
    icon: Clock,
    cls: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  enviado: {
    label: "Enviado",
    icon: Send,
    cls: "bg-primary/15 text-primary border-primary/30",
  },
  aprovado: {
    label: "Aprovado",
    icon: CheckCircle2,
    cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  rejeitado: {
    label: "Rejeitado",
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

function formatTipoFallback(tipo: string | null | undefined): string {
  if (!tipo) return "Item do checklist";
  if (tipo.startsWith("custom_")) return "Item personalizado";
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
      toast.success("Parecer técnico salvo.");
      queryClient.invalidateQueries({ queryKey: ["china-mailbox"] });
      queryClient.invalidateQueries({ queryKey: ["china-merged-checklist"] });
      setParecerOpen(false);
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao salvar parecer."),
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
              {cfg.title}
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
                  {totals.enviados} de {totals.expected}
                </span>{" "}
                itens enviados ·{" "}
                <span
                  className={cn(
                    "font-medium",
                    totals.pendentes > 0 ? "text-amber-400" : "text-emerald-400",
                  )}
                >
                  {totals.pendentes} pendente{totals.pendentes === 1 ? "" : "s"}
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
              title="Abrir em uma página dedicada com o status do checklist"
            >
              <ExternalLink className="h-3 w-3" />
              Abrir em página dedicada
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
                title={hasParecer ? "Editar parecer técnico da China" : "Adicionar parecer técnico para liberar envio ao Brasil"}
              >
                {hasParecer ? <MessageSquareText className="h-3 w-3" /> : <MessageSquarePlus className="h-3 w-3" />}
                {hasParecer ? "Editar parecer" : "Adicionar parecer"}
              </Button>
            )}
          </div>
          {showParecerActions && !hasParecer && pendingCount > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200/90">
              <p className="font-medium text-amber-300">Parecer técnico pendente</p>
              <p className="mt-0.5 text-amber-200/80">
                Para despachar ao Brasil, registre o parecer técnico desta submissão.
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-1.5 h-6 gap-1 px-2 text-[10.5px] bg-amber-500/90 hover:bg-amber-500 text-amber-950"
                onClick={() => setParecerOpen(true)}
              >
                <MessageSquarePlus className="h-3 w-3" />
                Abrir caixa de parecer
              </Button>
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {sections.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhum item no checklist.
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
                ? "China envia"
                : section.fluxo === "brasil_envia"
                ? "Brasil envia"
                : "Outros";

            // Em pastas "enviados-first" os pendentes vão para um bloco
            // recolhível secundário; nas demais, mostramos tudo em sequência.
            const splitSecondary = cfg.priorityMode === "sent";
            const primaryRows = splitSecondary
              ? section.rows.filter((r) => SENT_STATES.has(r.state))
              : section.rows;
            const secondaryRows = splitSecondary
              ? section.rows.filter((r) => !SENT_STATES.has(r.state))
              : [];

            const renderRow = ({ item, state }: { item: MailboxItem; state: ItemState }) => {
              const meta = STATE_META[state];
              const Icon = meta.icon;
              const name =
                item.tipo_documento_label ??
                merged.getDocType(item.tipo_documento || "")?.labelPt ??
                formatTipoFallback(item.tipo_documento);
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
                      aria-label={`Selecionar ${name} para envio em lote`}
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
                        {meta.label}
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
                            title="Abrir o Modo Foco já posicionado neste item"
                          >
                            Anexar
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
                            title="Registrar parecer técnico para liberar o envio ao Brasil"
                          >
                            <MessageSquarePlus className="h-2.5 w-2.5" />
                            Abrir parecer
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
                              ? "Registre o parecer técnico antes de despachar"
                              : "Despachar somente este item ao Brasil"
                          }
                        >
                          <Send className="h-2.5 w-2.5" />
                          Enviar ao Brasil
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
                          Abrir item
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
                aria-label={`Categoria ${section.labelPt}`}
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
                    <span className="text-muted-foreground/70"> enviado{section.enviadosCount === 1 ? "" : "s"}</span>
                    {section.pendentesCount > 0 && (
                      <>
                        <span className="text-muted-foreground/50"> · </span>
                        <span className="text-muted-foreground">
                          {section.pendentesCount} pendente{section.pendentesCount === 1 ? "" : "s"}
                        </span>
                      </>
                    )}
                  </span>
                </header>
                <ul role="list" className="divide-y divide-border/40">
                  {primaryRows.map(renderRow)}
                  {primaryRows.length === 0 && !splitSecondary && (
                    <li className="px-4 py-2 text-[11px] text-muted-foreground/80">
                      Nenhum documento criado nesta categoria ainda.
                    </li>
                  )}
                  {primaryRows.length === 0 && splitSecondary && secondaryRows.length === 0 && (
                    <li className="px-4 py-2 text-[11px] text-muted-foreground/80">
                      Nenhum item nesta categoria.
                    </li>
                  )}
                </ul>
                {splitSecondary && secondaryRows.length > 0 && (
                  <details className="group border-t border-border/40 bg-muted/10">
                    <summary className="cursor-pointer list-none px-4 py-1.5 text-[10.5px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                      <span className="transition-transform group-open:rotate-90">›</span>
                      Ver {secondaryRows.length} pendente{secondaryRows.length === 1 ? "" : "s"} desta categoria
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
              Abrir submissão
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
              title="Despachar somente os itens selecionados ao Brasil"
            >
              <Send className="h-3 w-3" />
              Enviar selecionados ({selected.size})
            </Button>
          )}
          {cfg.showEnviarFooter && selected.size === 0 && pendingCount > 0 && onEnviarGrupoBrasil && (
            <Button
              type="button"
              size="sm"
              className="ml-auto h-7 gap-1 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => onEnviarGrupoBrasil(group)}
              disabled={!hasParecer}
              title={hasParecer ? "Despachar todos os itens prontos ao Brasil" : "Registre o parecer técnico antes de despachar"}
            >
              <Send className="h-3 w-3" />
              Enviar todos ao Brasil
            </Button>
          )}
        </div>
      </SheetContent>

      <Dialog open={parecerOpen} onOpenChange={setParecerOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <MessageSquarePlus className="h-4 w-4 text-primary" />
              Parecer técnico da China
            </DialogTitle>
            <DialogDescription className="text-[12px]">
              Registre o parecer técnico desta submissão. Ele é obrigatório para
              despachar os itens ao Brasil e fica visível para a equipe brasileira.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={parecerText}
            onChange={(e) => setParecerText(e.target.value)}
            placeholder="Descreva análise, observações regulatórias e quaisquer pontos de atenção…"
            className="min-h-[160px] text-[12.5px]"
            maxLength={8000}
          />
          <p className="text-right text-[10.5px] text-muted-foreground">
            {parecerText.length}/8000
          </p>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setParecerOpen(false)}
              disabled={saveParecer.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => saveParecer.mutate(parecerText)}
              disabled={saveParecer.isPending || parecerText.trim().length === 0}
            >
              {saveParecer.isPending ? "Salvando…" : "Salvar parecer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
