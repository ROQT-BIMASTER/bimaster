import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MailboxItem } from "@/hooks/useChinaMailbox";
import type { MailboxGroup } from "@/lib/china/groupMailboxItems";
import { evaluateAwaitingSend } from "@/lib/china/awaitingSendRule";
import { useMergedChinaChecklist, type MergedChecklistCategory } from "@/hooks/useMergedChinaChecklist";

export interface ChecklistPendingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: MailboxGroup | null;
  onSelectItem?: (id: string) => void;
  onEnviarGrupoBrasil?: (group: MailboxGroup) => void;
  onOpenSubmissao?: (submissao_id: string) => void;
}

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
  enviados: number;
  total: number;
}

function buildSections(
  group: MailboxGroup,
  cats: MergedChecklistCategory[],
): CategorySection[] {
  // Index categories by tipo_key → categoria
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
      s = { key, labelPt, labelCn, fluxo, rows: [], enviados: 0, total: 0 };
      byCat.set(key, s);
    }
    return s;
  };

  // Pré-cria as categorias visíveis (mesmo que vazias, para refletir fielmente
  // a configuração) e contabiliza o total esperado.
  for (const c of cats) {
    const s = ensure(c.key, c.labelPt, c.labelCn, c.fluxo);
    s.total = c.tipos.length;
  }

  // Distribui os docs do grupo em suas categorias.
  for (const item of group.docs) {
    const tipo = item.tipo_documento || "";
    const cat = tipoToCat.get(tipo);
    const s = cat
      ? ensure(cat.key, cat.labelPt, cat.labelCn, cat.fluxo)
      : ensure("__outros__", "Outros itens", undefined, "outros");
    const state = classifyItem(item);
    s.rows.push({ item, state });
    if (state === "enviado" || state === "aprovado") s.enviados += 1;
  }

  // Ordena cada seção por estado.
  for (const s of byCat.values()) {
    s.rows.sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]);
  }

  // Mantém ordem: china_envia → brasil_envia → outros.
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
  onSelectItem,
  onEnviarGrupoBrasil,
  onOpenSubmissao,
}: ChecklistPendingSheetProps) {
  const navigate = useNavigate();
  const merged = useMergedChinaChecklist(group?.submissao_id ?? null);

  const sections = useMemo(() => {
    if (!group) return [];
    return buildSections(group, merged.categories);
  }, [group, merged.categories]);

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

  const handleAttach = (item: MailboxItem) => {
    if (!item.tipo_documento) return;
    navigate(
      `/dashboard/fabrica-china/produto/${group.submissao_id}?focus=${encodeURIComponent(item.tipo_documento)}`,
    );
  };

  const handleOpenInPage = () => {
    navigate(
      `/dashboard/fabrica-china/produto/${group.submissao_id}/checklist-status`,
      { state: { from: "/dashboard/fabrica-china/caixa-entrada" } },
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="space-y-2 border-b border-border/60 px-4 py-3">
          <SheetTitle className="text-sm font-semibold leading-tight">
            <span className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              Checklist pendente
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
          </div>
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
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {section.enviados}/{Math.max(section.total, section.rows.length)}
                  </span>
                </header>
                <ul role="list" className="divide-y divide-border/40">
                  {section.rows.map(({ item, state }) => {
                    const meta = STATE_META[state];
                    const Icon = meta.icon;
                    const name =
                      item.tipo_documento_label ??
                      merged.getDocType(item.tipo_documento || "")?.labelPt ??
                      formatTipoFallback(item.tipo_documento);
                    const id = rowKey(item);
                    return (
                      <li key={id} className="flex items-start gap-2 px-4 py-2.5">
                        <Paperclip className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
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
                            {(state === "nao_criado" ||
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
                  })}
                  {section.rows.length === 0 && (
                    <li className="px-4 py-2 text-[11px] text-muted-foreground/80">
                      Nenhum documento criado nesta categoria ainda.
                    </li>
                  )}
                </ul>
              </section>
            );
          })}
        </div>

        <div className="sticky bottom-0 flex items-center gap-2 border-t border-border/60 bg-background/95 px-4 py-2 backdrop-blur">
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
          {pendingCount > 0 && onEnviarGrupoBrasil && (
            <Button
              type="button"
              size="sm"
              className="ml-auto h-7 gap-1 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => onEnviarGrupoBrasil(group)}
            >
              <Send className="h-3 w-3" />
              Enviar todos ao Brasil
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
