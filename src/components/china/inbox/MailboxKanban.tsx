import { useMemo, useState } from "react";
import {
  FileEdit, Send, Eye, RotateCcw, CheckCircle2,
  Inbox, XCircle, Star, AlertCircle, ArrowUpRight, ArrowDownLeft,
  MessageSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { groupBySubmissao, type MailboxGroup } from "@/lib/china/groupMailboxItems";
import type { MailboxItem, MailboxFolder } from "@/hooks/useChinaMailbox";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  items: MailboxItem[];
  progressItems: MailboxItem[];
  selectedId: string | null;
  onSelectGroup: (group: MailboxGroup) => void;
  onJumpFolder: (folder: MailboxFolder) => void;
  perspective: "china" | "brasil";
}

type ColumnKey =
  | "awaiting_send" | "sent_brazil" | "in_analysis" | "returned" | "approved"
  | "inbox" | "rejected";

interface ColumnDef {
  key: ColumnKey;
  folder: MailboxFolder;
  label: string;
  icon: typeof Inbox;
  tone: string;
  headerTone: string;
}

const CHINA_COLUMNS: ColumnDef[] = [
  { key: "awaiting_send", folder: "awaiting_send", label: "Pendentes de envio", icon: FileEdit,
    tone: "text-muted-foreground bg-muted/40", headerTone: "border-l-muted-foreground/40" },
  { key: "sent_brazil",   folder: "sent_brazil",   label: "Enviados ao Brasil", icon: Send,
    tone: "text-primary bg-primary/10",        headerTone: "border-l-primary/60" },
  { key: "in_analysis",   folder: "in_analysis",   label: "Em análise",         icon: Eye,
    tone: "text-amber-500 bg-amber-500/10",    headerTone: "border-l-amber-500/60" },
  { key: "returned",      folder: "returned",      label: "Devolvidos",         icon: RotateCcw,
    tone: "text-rose-500 bg-rose-500/10",      headerTone: "border-l-rose-500/60" },
  { key: "approved",      folder: "approved",      label: "Aprovados",          icon: CheckCircle2,
    tone: "text-emerald-500 bg-emerald-500/10",headerTone: "border-l-emerald-500/60" },
];

const BRASIL_COLUMNS: ColumnDef[] = [
  { key: "inbox",    folder: "inbox",    label: "Pendente análise", icon: Inbox,
    tone: "text-primary bg-primary/10",         headerTone: "border-l-primary/60" },
  { key: "approved", folder: "approved", label: "Aprovados",        icon: CheckCircle2,
    tone: "text-emerald-500 bg-emerald-500/10", headerTone: "border-l-emerald-500/60" },
  { key: "rejected", folder: "rejected", label: "Rejeitados",       icon: XCircle,
    tone: "text-rose-500 bg-rose-500/10",       headerTone: "border-l-rose-500/60" },
];

function columnForChina(g: MailboxGroup): ColumnKey {
  // Status finais da submissão dominam sobre o progresso por item.
  if (g.submissao_status === "aprovado") return "approved";
  if (g.submissao_status === "rejeitado") return "returned";

  const p = g.progress;
  // Itens devolvidos pelo Brasil (rejeitados) sempre puxam para Devolvidos.
  if (p.rejeitados > 0) return "returned";
  // Ainda há checklist a despachar? Pertence a Pendentes de envio, mesmo que
  // a submissão já esteja `em_revisao`/`enviado_brasil` (despachos parciais).
  if (p.pendentes > 0) return "awaiting_send";
  // Sem pendentes: classifica pelo estágio mais avançado do checklist.
  if (p.em_analise > 0) return "in_analysis";
  if (p.enviados > 0) return "sent_brazil";
  // Fallback pelo status da submissão.
  if (g.submissao_status === "enviado_brasil") return "sent_brazil";
  if (g.submissao_status === "em_revisao" || g.submissao_status === "enviado") return "in_analysis";
  return "awaiting_send";
}

function columnForBrasil(g: MailboxGroup): ColumnKey {
  if (g.submissao_status === "aprovado") return "approved";
  if (g.submissao_status === "rejeitado") return "rejected";
  return "inbox";
}

function safeRelative(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return formatDistanceToNow(d, { addSuffix: true, locale: ptBR });
  } catch {
    return "";
  }
}

interface CardProps {
  group: MailboxGroup;
  selected: boolean;
  perspective: "china" | "brasil";
  onClick: () => void;
}

function KanbanCard({ group, selected, perspective, onClick }: CardProps) {
  const { progress } = group;
  const pendentesTotal = progress.pendentes + progress.em_analise + progress.enviados;
  const hasRejeitados = progress.rejeitados > 0;
  const hasConversa = (group as any).has_conversation ?? false;

  const flowIcon = perspective === "china"
    ? <ArrowUpRight className="h-3 w-3 text-primary" />
    : <ArrowDownLeft className="h-3 w-3 text-emerald-500" />;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group w-full rounded-md border bg-card px-2.5 py-2 text-left transition-colors",
        "hover:bg-muted/40 hover:border-primary/40",
        selected
          ? "border-primary/60 ring-1 ring-primary/30 bg-primary/5"
          : "border-border",
      )}
    >
      {/* Linha 1: código + nome */}
      <div className="flex items-center gap-1.5">
        {group.has_unread && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" title="Não lido" />
        )}
        <div className="mt-0">{flowIcon}</div>
        <span className="shrink-0 text-[10.5px] font-medium tabular-nums text-muted-foreground">
          {group.produto_codigo}
        </span>
        <span className="truncate text-[12px] font-medium leading-tight flex-1">
          {group.produto_nome}
        </span>
        {group.is_flagged && <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />}
      </div>

      {/* Linha 2: chips agregados */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <span className="inline-flex items-center gap-0.5 rounded-sm bg-muted/50 px-1 py-px text-[10px] tabular-nums text-muted-foreground">
          {progress.total} doc{progress.total === 1 ? "" : "s"}
        </span>
        {pendentesTotal > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded-sm bg-amber-500/10 px-1 py-px text-[10px] tabular-nums text-amber-600">
            {pendentesTotal} pend.
          </span>
        )}
        {progress.aprovados > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded-sm bg-emerald-500/10 px-1 py-px text-[10px] tabular-nums text-emerald-600">
            {progress.aprovados} aprov.
          </span>
        )}
        {hasRejeitados && (
          <span className="inline-flex items-center gap-0.5 rounded-sm bg-rose-500/10 px-1 py-px text-[10px] tabular-nums text-rose-600">
            <AlertCircle className="h-2.5 w-2.5" />
            {progress.rejeitados}
          </span>
        )}
      </div>

      {/* Linha 3: rodapé */}
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{safeRelative(group.latest_at)}</span>
        {hasConversa && <MessageSquare className="h-3 w-3 opacity-70" />}
      </div>
    </button>
  );
}

export function MailboxKanban({
  items,
  progressItems,
  selectedId,
  onSelectGroup,
  onJumpFolder,
  perspective,
}: Props) {
  const [onlyUnread, setOnlyUnread] = useState(false);

  const groups = useMemo(() => {
    const safeItems = items ?? [];
    const safeProgress = progressItems ?? [];
    const source = safeProgress.length > 0 ? safeProgress : safeItems;
    return groupBySubmissao(source, safeProgress);
  }, [items, progressItems]);

  const columns = perspective === "china" ? CHINA_COLUMNS : BRASIL_COLUMNS;

  const visibleGroups = useMemo(
    () => groups.filter((g) => !g.is_deleted && (!onlyUnread || g.has_unread)),
    [groups, onlyUnread],
  );

  const totalSubs = visibleGroups.length;
  const totalUnread = useMemo(
    () => groups.filter((g) => !g.is_deleted && g.has_unread).length,
    [groups],
  );

  const byColumn = useMemo(() => {
    const map = new Map<ColumnKey, MailboxGroup[]>();
    for (const c of columns) map.set(c.key, []);
    const resolver = perspective === "china" ? columnForChina : columnForBrasil;
    for (const g of visibleGroups) {
      const k = resolver(g);
      if (!map.has(k)) continue;
      map.get(k)!.push(g);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (b.latest_at || "").localeCompare(a.latest_at || ""));
    }
    return map;
  }, [visibleGroups, columns, perspective]);

  const selectedSubId = useMemo(() => {
    if (!selectedId) return null;
    if (selectedId.includes(":virtual:")) return selectedId.split(":")[0];
    for (const g of groups) if (g.submissao_id === selectedId) return g.submissao_id;
    for (const g of groups) {
      if (g.docs.some((d) => d.documento_id === selectedId)) return g.submissao_id;
    }
    return null;
  }, [selectedId, groups]);

  return (
    <div className="flex h-full flex-col">
      {/* Header do board */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card/40 px-3 py-1.5">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="tabular-nums">
            <strong className="text-foreground">{totalSubs}</strong> submiss{totalSubs === 1 ? "ão" : "ões"}
          </span>
          {totalUnread > 0 && (
            <>
              <span className="text-border">·</span>
              <span className="tabular-nums text-primary">
                <strong>{totalUnread}</strong> não lid{totalUnread === 1 ? "a" : "as"}
              </span>
            </>
          )}
        </div>
        <Button
          type="button"
          variant={onlyUnread ? "default" : "outline"}
          size="sm"
          className="h-6 px-2 text-[10.5px]"
          onClick={() => setOnlyUnread((v) => !v)}
        >
          {onlyUnread ? "Mostrar todas" : "Apenas não lidas"}
        </Button>
      </div>

      {/* Colunas */}
      <div className="flex flex-1 min-h-0 gap-2 overflow-x-auto p-2">
        {columns.map((col) => {
          const Icon = col.icon;
          const list = byColumn.get(col.key) ?? [];
          return (
            <div
              key={col.key}
              className="flex h-full w-[300px] min-w-[280px] shrink-0 flex-col rounded-md border border-border bg-muted/20"
            >
              <div
                className={cn(
                  "flex items-center justify-between gap-1.5 border-l-4 bg-card/50 px-2.5 py-1.5",
                  col.headerTone,
                )}
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="truncate text-[12px] font-semibold">{col.label}</span>
                  <Badge variant="secondary" className={cn("h-4 px-1.5 text-[10px] tabular-nums", col.tone)}>
                    {list.length}
                  </Badge>
                </div>
                <button
                  type="button"
                  onClick={() => onJumpFolder(col.folder)}
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                  title="Abrir como lista"
                >
                  Lista
                </button>
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-1.5 p-2">
                  {list.length === 0 ? (
                    <div className="rounded-sm border border-dashed border-border/60 px-2 py-6 text-center text-[10px] text-muted-foreground">
                      Nenhuma submissão
                    </div>
                  ) : (
                    list.map((g) => (
                      <KanbanCard
                        key={g.submissao_id}
                        group={g}
                        perspective={perspective}
                        selected={selectedSubId === g.submissao_id}
                        onClick={() => onSelectGroup(g)}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>
    </div>
  );
}
