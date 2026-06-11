import { useEffect, useMemo, useState } from "react";
import {
  FileEdit, Send, Eye, RotateCcw, CheckCircle2,
  Inbox, XCircle, Star, ArrowUpRight, ArrowDownLeft,
  MessageSquare, Check, Clock, Upload, Circle, AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { groupBySubmissao, type MailboxGroup } from "@/lib/china/groupMailboxItems";
import type { MailboxItem, MailboxFolder } from "@/hooks/useChinaMailbox";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMergedChinaChecklist } from "@/hooks/useMergedChinaChecklist";
import { ItemThumb } from "@/components/china/inbox/ItemThumb";


interface Props {
  items: MailboxItem[];
  progressItems: MailboxItem[];
  selectedId: string | null;
  onSelectGroup: (group: MailboxGroup, item?: MailboxItem) => void;
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

// Mapeia o status do documento para um dos buckets visuais da barra/chips.
type Bucket = "aprovado" | "rejeitado" | "em_analise" | "enviado" | "pendente";
function bucketForDoc(d: MailboxItem): Bucket {
  const s = (d.doc_status || "").toLowerCase();
  if (s === "aprovado") return "aprovado";
  if (s === "rejeitado") return "rejeitado";
  if (s === "contestado") return "em_analise";
  if (s === "enviado" || s === "enviado_brasil") {
    // Documento enviado ao Brasil mas ainda não aberto = "enviado" (azul).
    // Quando o Brasil abre, o backend muda para "em_analise" (ou contestado).
    return "enviado";
  }
  return "pendente";
}

function itemColumnFor(d: MailboxItem, perspective: "china" | "brasil"): ColumnKey {
  const b = bucketForDoc(d);
  if (perspective === "brasil") {
    if (b === "aprovado") return "approved";
    if (b === "rejeitado") return "rejected";
    return "inbox";
  }
  if (b === "aprovado") return "approved";
  if (b === "rejeitado") return "returned";
  if (b === "em_analise") return "in_analysis";
  if (b === "enviado") return "sent_brazil";
  return "awaiting_send";
}

const BUCKET_META: Record<Bucket, { label: string; icon: typeof Check; cls: string; barCls: string }> = {
  aprovado:   { label: "aprov.",  icon: Check,          cls: "text-emerald-600",          barCls: "bg-emerald-500" },
  em_analise: { label: "análise", icon: Eye,            cls: "text-amber-600",            barCls: "bg-amber-500" },
  enviado:    { label: "enviados",icon: Upload,         cls: "text-primary",              barCls: "bg-primary" },
  pendente:   { label: "pend.",   icon: Circle,         cls: "text-muted-foreground",     barCls: "bg-muted-foreground/40" },
  rejeitado:  { label: "devolv.", icon: AlertTriangle,  cls: "text-rose-600",             barCls: "bg-rose-500" },
};

function ProgressBar({ progress }: { progress: MailboxGroup["progress"] }) {
  const total = progress.total;
  if (total === 0) {
    return (
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-sm bg-muted/60" title="Sem checklist" />
    );
  }
  const segs: Array<{ key: Bucket; n: number }> = [
    { key: "aprovado",   n: progress.aprovados },
    { key: "em_analise", n: progress.em_analise },
    { key: "enviado",    n: progress.enviados },
    { key: "rejeitado",  n: progress.rejeitados },
    { key: "pendente",   n: progress.pendentes },
  ];
  return (
    <div
      className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-sm bg-muted/40"
      title={`Aprovados ${progress.aprovados} · Em análise ${progress.em_analise} · Enviados ${progress.enviados} · Devolvidos ${progress.rejeitados} · Pendentes ${progress.pendentes}`}
    >
      {segs.map((s) =>
        s.n > 0 ? (
          <div
            key={s.key}
            className={cn("h-full", BUCKET_META[s.key].barCls)}
            style={{ width: `${(s.n / total) * 100}%` }}
          />
        ) : null,
      )}
    </div>
  );
}

interface ChipProps { bucket: Bucket; count: number; subnote?: string }
function StatusChip({ bucket, count, subnote }: ChipProps) {
  const meta = BUCKET_META[bucket];
  const Icon = meta.icon;
  const muted = count === 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 tabular-nums",
        meta.cls,
        muted && "opacity-40",
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      <span>{count}</span>
      {subnote && !muted && <span className="text-[9.5px] opacity-70">({subnote})</span>}
    </span>
  );
}

function ChecklistHoverContent({ group }: { group: MailboxGroup }) {
  const merged = useMergedChinaChecklist(group.submissao_id);

  // Mapeia tipo_documento -> item mais recente vindo do inbox (já carregado).
  const docsByTipo = useMemo(() => {
    const m = new Map<string, MailboxItem>();
    for (const d of group.docs) {
      const tipo = (d as any).tipo_documento as string | undefined;
      if (!tipo) continue;
      const prev = m.get(tipo);
      if (!prev) { m.set(tipo, d); continue; }
      const a = new Date(prev.created_at || 0).getTime();
      const b = new Date(d.created_at || 0).getTime();
      if (b >= a) m.set(tipo, d);
    }
    return m;
  }, [group.docs]);

  const cats = merged.categories;
  const totalTipos = cats.reduce((s, c) => s + c.tipos.length, 0);
  const aprovados = cats.reduce((s, c) => s + c.tipos.filter((t) => {
    const d = docsByTipo.get(t);
    return d && bucketForDoc(d) === "aprovado";
  }).length, 0);

  return (
    <div className="w-80 text-[11.5px]">
      <div className="mb-1.5 flex items-center gap-1.5 border-b border-border/60 pb-1.5">
        <span className="font-mono text-[10px] text-muted-foreground">{group.produto_codigo}</span>
        <span className="truncate font-medium">{group.produto_nome}</span>
        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground tabular-nums">
          {aprovados}/{totalTipos} aprov.
        </span>
      </div>

      {merged.isLoading ? (
        <div className="py-3 text-center text-muted-foreground">Carregando checklist…</div>
      ) : totalTipos === 0 ? (
        <div className="py-2 text-center text-muted-foreground">Sem itens no checklist</div>
      ) : (
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {cats.map((cat) => {
            if (cat.tipos.length === 0) return null;
            return (
              <div key={cat.key}>
                <div className="mb-0.5 flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground/80">
                  <span className="truncate">{cat.labelPt}</span>
                  {cat.labelCn && <span className="truncate opacity-60">· {cat.labelCn}</span>}
                </div>
                <ul className="space-y-0.5">
                  {cat.tipos.map((tipo) => {
                    const doc = docsByTipo.get(tipo);
                    const dt = merged.getDocType(tipo);
                    const labelPt = dt?.labelPt ?? tipo;
                    const labelCn = dt?.labelCn;
                    const bucket = doc ? bucketForDoc(doc) : "pendente";
                    const meta = BUCKET_META[bucket];
                    const Icon = meta.icon;
                    const statusTxt = !doc
                      ? "não criado"
                      : ({
                          aprovado: "aprovado",
                          em_analise: "em análise",
                          enviado: "enviado",
                          pendente: "pendente",
                          rejeitado: "devolvido",
                        } as const)[bucket];
                    return (
                      <li key={tipo} className="flex items-start gap-1.5">
                        <Icon className={cn("mt-0.5 h-3 w-3 shrink-0", !doc ? "text-muted-foreground/50" : meta.cls)} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate">{labelPt}</div>
                          {labelCn && <div className="truncate text-[10px] text-muted-foreground/70">{labelCn}</div>}
                        </div>
                        <span className={cn("shrink-0 text-[10px] tabular-nums", !doc ? "text-muted-foreground/60" : meta.cls)}>
                          {statusTxt}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-1.5 border-t border-border/60 pt-1 text-[10px] text-muted-foreground">
        Clique no card para abrir no painel
      </div>
    </div>
  );
}

function ChecklistHover({ group, open }: { group: MailboxGroup; open: boolean }) {
  // Só monta o conteúdo (e dispara queries) quando o hover está aberto.
  if (!open) return null;
  return <ChecklistHoverContent group={group} />;
}

function KanbanCard({ group, selected, perspective, onClick }: CardProps) {
  const { progress } = group;
  const hasConversa = (group as any).has_conversation ?? false;

  const flowIcon = perspective === "china"
    ? <ArrowUpRight className="h-3 w-3 text-primary" />
    : <ArrowDownLeft className="h-3 w-3 text-emerald-500" />;

  const pendSubnote = progress.anexados_rascunho > 0 ? `${progress.anexados_rascunho} anex.` : undefined;

  const previewDocs = (group.docs || [])
    .filter((d: any) => !d.is_virtual && (d.arquivo_path || d.arquivo_url))
    .slice(0, 3);
  const extraPreview = Math.max(
    0,
    (group.docs || []).filter((d: any) => !d.is_virtual && (d.arquivo_path || d.arquivo_url)).length - previewDocs.length,
  );

  const [hoverOpen, setHoverOpen] = useState(false);
  return (
    <HoverCard openDelay={250} closeDelay={80} open={hoverOpen} onOpenChange={setHoverOpen}>
      <HoverCardTrigger asChild>
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

          {/* Strip de pré-visualização (até 3 thumbs) */}
          {previewDocs.length > 0 && (
            <div className="mt-1.5 flex items-center gap-1">
              {previewDocs.map((d: any, i: number) => (
                <ItemThumb key={d.documento_id ?? `${group.submissao_id}-thumb-${i}`} item={d} size="sm" />
              ))}
              {extraPreview > 0 && (
                <span className="ml-0.5 text-[10px] tabular-nums text-muted-foreground">
                  +{extraPreview}
                </span>
              )}
            </div>
          )}

          {/* Barra de progresso segmentada */}
          <ProgressBar progress={progress} />

          {/* Chips numéricos por status (posições fixas) */}
          <div className="mt-1 flex items-center gap-2 text-[10px]">
            <StatusChip bucket="aprovado"   count={progress.aprovados} />
            <StatusChip bucket="em_analise" count={progress.em_analise} />
            <StatusChip bucket="enviado"    count={progress.enviados} />
            <StatusChip bucket="pendente"   count={progress.pendentes} subnote={pendSubnote} />
            <StatusChip bucket="rejeitado"  count={progress.rejeitados} />
          </div>

          {/* Rodapé */}
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{safeRelative(group.latest_at)}</span>
            <div className="flex items-center gap-1">
              <span className="tabular-nums opacity-70">{progress.total} doc{progress.total === 1 ? "" : "s"}</span>
              {hasConversa && <MessageSquare className="h-3 w-3 opacity-70" />}
            </div>
          </div>
        </button>
      </HoverCardTrigger>
      <HoverCardContent side="right" align="start" className="w-auto p-2.5">
        <ChecklistHover group={group} open={hoverOpen} />
      </HoverCardContent>
    </HoverCard>
  );
}

interface ItemCardProps {
  item: MailboxItem;
  group: MailboxGroup;
  selected: boolean;
  onClick: () => void;
}

function ItemCard({ item, group, selected, onClick }: ItemCardProps) {
  const bucket = bucketForDoc(item);
  const meta = BUCKET_META[bucket];
  const Icon = meta.icon;
  const docLabel = item.tipo_documento_label || item.tipo_documento || "Item do checklist";
  const statusLabel = ({
    aprovado: "aprovado",
    em_analise: "em análise",
    enviado: "enviado",
    pendente: "pendente",
    rejeitado: "devolvido",
  } as const)[bucket];

  const [hoverOpen, setHoverOpen] = useState(false);
  return (
    <HoverCard openDelay={250} closeDelay={80} open={hoverOpen} onOpenChange={setHoverOpen}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "group w-full rounded-md border bg-card px-2.5 py-1.5 text-left transition-colors",
            "hover:bg-muted/40 hover:border-primary/40",
            selected
              ? "border-primary/60 ring-1 ring-primary/30 bg-primary/5"
              : "border-border",
          )}
        >
          {(item.arquivo_path || item.arquivo_url) && !(item as any).is_virtual && (
            <div className="mb-1.5 -mx-0.5">
              <ItemThumb item={item as any} size="md" />
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Icon className={cn("h-3.5 w-3.5 shrink-0", meta.cls)} />
            <span className="truncate text-[12px] font-medium leading-tight flex-1">
              {docLabel}
            </span>
            {group.is_flagged && <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[10.5px] text-muted-foreground">
            <span className="font-mono tabular-nums">{group.produto_codigo}</span>
            <span className="opacity-60">·</span>
            <span className="truncate">{group.produto_nome}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{safeRelative(item.created_at)}</span>
            <span className={cn("tabular-nums", meta.cls)}>{statusLabel}</span>
          </div>
        </button>
      </HoverCardTrigger>
      <HoverCardContent side="right" align="start" className="w-auto p-2.5">
        <ChecklistHover group={group} open={hoverOpen} />
      </HoverCardContent>
    </HoverCard>
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

  const viewModeStorageKey = `china.kanban.viewMode.${perspective}`;
  const [viewMode, setViewMode] = useState<"submission" | "item">(() => {
    if (typeof window === "undefined") return "submission";
    const v = window.localStorage.getItem(viewModeStorageKey);
    return v === "item" ? "item" : "submission";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(viewModeStorageKey, viewMode);
  }, [viewMode, viewModeStorageKey]);

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
    // Colunas terminais: decisões recentes no topo (desc).
    // Colunas de fluxo ativo: mais antigos parados no topo (asc por SLA).
    const TERMINAL: ColumnKey[] = ["approved", "rejected"];
    for (const [key, arr] of map.entries()) {
      if (TERMINAL.includes(key)) {
        arr.sort((a, b) => (b.latest_at || "").localeCompare(a.latest_at || ""));
      } else {
        arr.sort((a, b) => {
          const dateCmp = (a.latest_at || "").localeCompare(b.latest_at || "");
          if (dateCmp !== 0) return dateCmp;
          const aBacklog = a.progress.pendentes + a.progress.rejeitados;
          const bBacklog = b.progress.pendentes + b.progress.rejeitados;
          return bBacklog - aBacklog;
        });
      }
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

  // Modo "Por item": distribui cada documento do checklist na coluna
  // correspondente ao seu próprio status (independente do gargalo da submissão).
  const byColumnItems = useMemo(() => {
    const map = new Map<ColumnKey, Array<{ item: MailboxItem; group: MailboxGroup }>>();
    for (const c of columns) map.set(c.key, []);
    if (viewMode !== "item") return map;
    const TERMINAL: ColumnKey[] = ["approved", "rejected"];
    for (const g of visibleGroups) {
      for (const d of g.docs) {
        const k = itemColumnFor(d, perspective);
        if (!map.has(k)) continue;
        map.get(k)!.push({ item: d, group: g });
      }
    }
    for (const [key, arr] of map.entries()) {
      if (TERMINAL.includes(key)) {
        arr.sort((a, b) => (b.item.created_at || "").localeCompare(a.item.created_at || ""));
      } else {
        arr.sort((a, b) => (a.item.created_at || "").localeCompare(b.item.created_at || ""));
      }
    }
    return map;
  }, [viewMode, visibleGroups, columns, perspective]);

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
        <div className="flex items-center gap-1.5" aria-label="Modo de visualização do Kanban">
          <div className="flex h-6 overflow-hidden rounded-md border border-border">
            <button
              type="button"
              onClick={() => setViewMode("submission")}
              className={cn(
                "px-2 text-[10.5px] transition-colors",
                viewMode === "submission"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground",
              )}
              title="Um card por submissão (visão agregada)"
            >
              Por submissão
            </button>
            <button
              type="button"
              onClick={() => setViewMode("item")}
              className={cn(
                "px-2 text-[10.5px] transition-colors border-l border-border",
                viewMode === "item"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground",
              )}
              title="Um card por documento do checklist (visão detalhada)"
            >
              Por item
            </button>
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
      </div>

      {/* Colunas */}
      <div className="flex flex-1 min-h-0 gap-2 overflow-x-auto p-2">
        {columns.map((col) => {
          const Icon = col.icon;
          const list = byColumn.get(col.key) ?? [];
          const itemList = byColumnItems.get(col.key) ?? [];
          const count = viewMode === "item" ? itemList.length : list.length;
          const emptyLabel = viewMode === "item" ? "Nenhum item" : "Nenhuma submissão";
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
                    {count}
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
                  {count === 0 ? (
                    <div className="rounded-sm border border-dashed border-border/60 px-2 py-6 text-center text-[10px] text-muted-foreground">
                      {emptyLabel}
                    </div>
                  ) : viewMode === "item" ? (
                    itemList.map(({ item, group }, idx) => (
                      <ItemCard
                        key={item.documento_id ?? `${group.submissao_id}-${col.key}-${idx}`}
                        item={item}
                        group={group}
                        selected={selectedSubId === group.submissao_id}
                        onClick={() => onSelectGroup(group)}
                      />
                    ))
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
