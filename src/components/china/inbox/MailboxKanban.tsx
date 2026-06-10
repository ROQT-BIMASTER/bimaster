import { useMemo } from "react";
import {
  FileEdit, Send, Eye, RotateCcw, CheckCircle2,
  Inbox, XCircle, Star, AlertCircle, ArrowUpRight, ArrowDownLeft,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  /** Pasta correspondente para deep-link (botão "abrir como lista"). */
  folder: MailboxFolder;
  label: string;
  icon: typeof Inbox;
  tone: string; // classe para badge contadora
  headerTone: string; // classe para borda/sombra do header
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

/**
 * Coluna em que a submissão deve aparecer. Usamos o `submissao_status` como
 * fonte de verdade (uma submissão = um card = uma coluna). Os mini-chips do
 * card mostram a quebra granular por item.
 */
function columnForChina(g: MailboxGroup): ColumnKey {
  if (g.submissao_status === "aprovado") return "approved";
  if (g.submissao_status === "rejeitado") return "returned";
  if (g.submissao_status === "enviado_brasil") return "sent_brazil";
  if (g.submissao_status === "em_revisao" || g.submissao_status === "enviado") {
    return "in_analysis";
  }
  // rascunho ou estados iniciais com itens pendentes
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
  const chips: Array<{ key: string; label: string; n: number; tone: string }> = [
    { key: "ap", label: "Aprov.", n: progress.aprovados, tone: "text-emerald-500 bg-emerald-500/10" },
    { key: "an", label: "Em análise", n: progress.em_analise, tone: "text-amber-500 bg-amber-500/10" },
    { key: "en", label: "Enviados", n: progress.enviados, tone: "text-primary bg-primary/10" },
    { key: "pd", label: "Pendentes", n: progress.pendentes, tone: "text-muted-foreground bg-muted/40" },
    { key: "rj", label: "Rejeitados", n: progress.rejeitados, tone: "text-rose-500 bg-rose-500/10" },
  ].filter((c) => c.n > 0);

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
      <div className="flex items-start gap-1.5">
        <div className="mt-0.5">{flowIcon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {group.has_unread && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" title="Não lido" />
            )}
            <span className="truncate text-[11px] font-medium tabular-nums text-muted-foreground">
              {group.produto_codigo}
            </span>
            {group.is_flagged && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
          </div>
          <div className="truncate text-[12px] font-medium leading-tight">
            {group.produto_nome}
          </div>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {chips.map((c) => (
            <span
              key={c.key}
              className={cn(
                "inline-flex items-center gap-0.5 rounded-sm px-1 py-px text-[9.5px] font-medium tabular-nums",
                c.tone,
              )}
            >
              <span className="opacity-80">{c.label}</span>
              <span>{c.n}</span>
            </span>
          ))}
        </div>
      )}

      <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{progress.total} item{progress.total === 1 ? "" : "s"}</span>
        <span>{safeRelative(group.latest_at)}</span>
      </div>

      {progress.rejeitados > 0 && perspective === "china" && (
        <div className="mt-1.5 flex items-center gap-1 rounded-sm bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-500">
          <AlertCircle className="h-3 w-3" />
          <span>Requer ajuste</span>
        </div>
      )}
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
  // Agrupa TODOS os itens (não só os da pasta atual) para que o Kanban exiba
  // o pipeline completo em uma única tela.
  const groups = useMemo(() => {
    const source = progressItems.length > 0 ? progressItems : items;
    return groupBySubmissao(source, progressItems);
  }, [items, progressItems]);

  const columns = perspective === "china" ? CHINA_COLUMNS : BRASIL_COLUMNS;

  const byColumn = useMemo(() => {
    const map = new Map<ColumnKey, MailboxGroup[]>();
    for (const c of columns) map.set(c.key, []);
    const resolver = perspective === "china" ? columnForChina : columnForBrasil;
    for (const g of groups) {
      if (g.is_deleted) continue;
      const k = resolver(g);
      if (!map.has(k)) continue; // estado fora das colunas atuais — ignora
      map.get(k)!.push(g);
    }
    // Ordena por mais recente desc
    for (const arr of map.values()) {
      arr.sort((a, b) => (b.latest_at || "").localeCompare(a.latest_at || ""));
    }
    return map;
  }, [groups, columns, perspective]);

  const selectedSubId = useMemo(() => {
    if (!selectedId) return null;
    // selectedId pode ser `<sub>:virtual:<tipo>` ou `<doc_id>` ou `<sub_id>`
    if (selectedId.includes(":virtual:")) return selectedId.split(":")[0];
    // Tenta casar com submissao_id direto
    for (const g of groups) if (g.submissao_id === selectedId) return g.submissao_id;
    // Tenta achar via documento_id
    for (const g of groups) {
      if (g.docs.some((d) => d.documento_id === selectedId)) return g.submissao_id;
    }
    return null;
  }, [selectedId, groups]);

  return (
    <div className="flex h-full gap-2 overflow-x-auto p-2">
      {columns.map((col) => {
        const Icon = col.icon;
        const list = byColumn.get(col.key) ?? [];
        return (
          <div
            key={col.key}
            className="flex h-full w-[280px] min-w-[260px] shrink-0 flex-col rounded-md border border-border bg-muted/20"
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
  );
}
