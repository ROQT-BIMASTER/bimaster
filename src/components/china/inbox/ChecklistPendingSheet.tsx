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
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MailboxItem } from "@/hooks/useChinaMailbox";
import type { MailboxGroup } from "@/lib/china/groupMailboxItems";
import { evaluateAwaitingSend } from "@/lib/china/awaitingSendRule";

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

export function ChecklistPendingSheet({
  open,
  onOpenChange,
  group,
  onSelectItem,
  onEnviarGrupoBrasil,
  onOpenSubmissao,
}: ChecklistPendingSheetProps) {
  const navigate = useNavigate();

  const { rows, totals } = useMemo(() => {
    if (!group) return { rows: [] as Array<{ item: MailboxItem; state: ItemState }>, totals: null };
    const r = group.docs.map((item) => ({ item, state: classifyItem(item) }));
    // Ordenação: rejeitado → pendente_envio → nao_criado → enviado → aprovado.
    const order: Record<ItemState, number> = {
      rejeitado: 0,
      pendente_envio: 1,
      nao_criado: 2,
      enviado: 3,
      aprovado: 4,
    };
    r.sort((a, b) => order[a.state] - order[b.state]);
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
      rows: r,
      totals: {
        enviados,
        expected,
        pendentes: Math.max(0, expected - enviados),
        pct,
      },
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
    navigate(`/dashboard/fabrica-china/produto/${group.submissao_id}/checklist`);
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
              title="Abrir em uma página dedicada (Modo Foco)"
            >
              <ExternalLink className="h-3 w-3" />
              Abrir em página dedicada
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {rows.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhum item no checklist.
            </p>
          )}
          <ul role="list" className="divide-y divide-border/40">
            {rows.map(({ item, state }) => {
              const meta = STATE_META[state];
              const Icon = meta.icon;
              const name =
                item.tipo_documento_label ?? formatTipoFallback(item.tipo_documento);
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
                      {(state === "nao_criado" || state === "pendente_envio" || state === "rejeitado") && (
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
          </ul>
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
