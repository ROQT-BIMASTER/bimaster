import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileEdit, Send, Eye, RotateCcw, CheckCircle2,
  Inbox, XCircle, Star, ArrowUpRight, ArrowDownLeft,
  MessageSquare, Check, Clock, Upload, Circle, AlertTriangle, GripVertical,
  ChevronRight, Filter as FilterIcon, Paperclip,
} from "lucide-react";
import {
  DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable,
  useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { cn } from "@/lib/utils";
import { groupBySubmissao, hasAttachment, type MailboxGroup } from "@/lib/china/groupMailboxItems";
import type { MailboxItem, MailboxFolder } from "@/hooks/useChinaMailbox";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import { ItemThumb } from "@/components/china/inbox/ItemThumb";
import { useChinaKanbanFilters, type BucketFilter } from "@/hooks/useChinaKanbanFilters";
import { MailboxKanbanFilters } from "@/components/china/inbox/MailboxKanbanFilters";


interface Props {
  items: MailboxItem[];
  progressItems: MailboxItem[];
  selectedId: string | null;
  onSelectGroup: (group: MailboxGroup, item?: MailboxItem) => void;
  onJumpFolder: (folder: MailboxFolder) => void;
  perspective: "china" | "brasil";
  /**
   * Disparado quando o usuário arrasta um item elegível da coluna
   * "Pendentes de envio" para "Enviados ao Brasil". O page owner decide
   * se chama a mutation direta (parecer presente) ou abre o drawer para
   * registro do parecer técnico (parecer ausente).
   */
  onDragSendDoc?: (item: MailboxItem, group: MailboxGroup) => void;
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
  if (g.submissao_status === "enviado_brasil" || g.submissao_status === "enviado_parcial") return "sent_brazil";
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
  );
}

interface ItemCardProps {
  item: MailboxItem;
  group: MailboxGroup;
  selected: boolean;
  onClick: () => void;
  draggable?: boolean;
  draggableHint?: string;
}

/**
 * Regra de elegibilidade para arrastar um item de "Pendentes de envio" → "Enviados ao Brasil".
 * Mantida ao lado do card para que UI e handler compartilhem a mesma fonte de verdade.
 */
export function isDocDraggableToSent(
  item: MailboxItem,
  group: MailboxGroup,
  perspective: "china" | "brasil",
): boolean {
  if (perspective !== "china") return false;
  if ((item as any).is_virtual) return false;
  if (!item.documento_id) return false;
  if (!item.arquivo_path && !item.arquivo_url) return false;
  const s = (item.doc_status || "").toLowerCase();
  if (!(s === "" || s === "rascunho" || s === "rejeitado")) return false;
  const ss = (group.submissao_status || "").toLowerCase();
  if (ss === "aprovado" || ss === "rejeitado") return false;
  return true;
}

function ItemCardInner({ item, group, selected, onClick, draggable, draggableHint }: ItemCardProps) {
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

  // Faixa lateral por estado do anexo. Devolvido pelo Brasil tem prioridade.
  const anexado = hasAttachment(item);
  const leftBorderCls =
    bucket === "rejeitado"
      ? "border-l-4 border-l-rose-500"
      : anexado
        ? "border-l-4 border-l-primary/60"
        : "border-l-4 border-l-dashed border-l-muted-foreground/30";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group w-full rounded-md border bg-card px-2.5 py-1.5 text-left transition-colors",
        "hover:bg-muted/40 hover:border-primary/40",
        leftBorderCls,
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
        {anexado && !draggable && (
          <Paperclip
            className="h-3 w-3 shrink-0 text-primary/70"
            aria-label="Documento anexado"
          />
        )}
        {draggable && (
          <GripVertical
            className="h-3 w-3 shrink-0 text-muted-foreground/60"
            aria-label={draggableHint ?? "Arraste para enviar ao Brasil"}
          />
        )}
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
  );
}

interface DraggableItemCardProps extends ItemCardProps {
  dragId: string;
}

function DraggableItemCard(props: DraggableItemCardProps) {
  const { dragId, item, group } = props;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: { kind: "doc", item, group },
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ opacity: isDragging ? 0.4 : 1, touchAction: "none" }}
    >
      <ItemCardInner {...props} draggable />
    </div>
  );
}

function ItemCard(props: ItemCardProps) {
  return <ItemCardInner {...props} />;
}


export function MailboxKanban({
  items,
  progressItems,
  selectedId,
  onSelectGroup,
  onJumpFolder,
  perspective,
  onDragSendDoc,
}: Props) {
  const [activeDrag, setActiveDrag] = useState<{ item: MailboxItem; group: MailboxGroup } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const [onlyUnread, setOnlyUnread] = useState(false);

  // Filtros persistidos + atalho de teclado
  const {
    filters, isActive: filtersActive,
    setAnexo, toggleBucket, toggleSubmissao, setSubmissoes, clearSubmissoes, clearAll,
  } = useChinaKanbanFilters(perspective);
  const [openSubmissaoSignal, setOpenSubmissaoSignal] = useState<number | undefined>(undefined);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) return;
      if (e.key === "f") {
        e.preventDefault();
        setOpenSubmissaoSignal(Date.now());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  // Aplica filtro de submissão + "apenas não lidas" no nível de grupos.
  const visibleGroups = useMemo(
    () =>
      groups.filter((g) => {
        if (g.is_deleted) return false;
        if (onlyUnread && !g.has_unread) return false;
        if (filters.submissaoIds.length > 0 && !filters.submissaoIds.includes(g.submissao_id)) return false;
        return true;
      }),
    [groups, onlyUnread, filters.submissaoIds],
  );

  const totalSubs = visibleGroups.length;
  const totalUnread = useMemo(
    () => groups.filter((g) => !g.is_deleted && g.has_unread).length,
    [groups],
  );

  // Predicate de filtro a nível de item (anexo + bucket).
  const itemPasses = useMemo(() => {
    return (d: MailboxItem) => {
      if (filters.anexo === "with" && !hasAttachment(d)) return false;
      if (filters.anexo === "without" && hasAttachment(d)) return false;
      const b = bucketForDoc(d) as BucketFilter;
      if (!filters.buckets.includes(b)) return false;
      return true;
    };
  }, [filters.anexo, filters.buckets]);

  const byColumn = useMemo(() => {
    const map = new Map<ColumnKey, MailboxGroup[]>();
    for (const c of columns) map.set(c.key, []);
    const resolver = perspective === "china" ? columnForChina : columnForBrasil;
    for (const g of visibleGroups) {
      // No modo "Por submissão", aplicamos os filtros de anexo/bucket como
      // "tem ao menos um item que passa" — caso contrário a submissão é omitida.
      const anyPass = g.docs.some(itemPasses);
      if (!anyPass) continue;
      const k = resolver(g);
      if (!map.has(k)) continue;
      map.get(k)!.push(g);
    }
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
  }, [visibleGroups, columns, perspective, itemPasses]);

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
        if (!itemPasses(d)) continue;
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
  }, [viewMode, visibleGroups, columns, perspective, itemPasses]);

  // DnD ativo apenas na perspectiva China + modo "Por item" + handler conectado.
  const dndEnabled = perspective === "china" && viewMode === "item" && !!onDragSendDoc;

  const handleDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as { item?: MailboxItem; group?: MailboxGroup } | undefined;
    if (data?.item && data?.group) setActiveDrag({ item: data.item, group: data.group });
  };
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDrag(null);
    const overId = String(e.over?.id ?? "");
    if (overId !== "col:sent_brazil") return;
    const data = e.active.data.current as { item?: MailboxItem; group?: MailboxGroup } | undefined;
    if (!data?.item || !data?.group) return;
    if (!isDocDraggableToSent(data.item, data.group, perspective)) return;
    onDragSendDoc?.(data.item, data.group);
  };

  const handleIsolateSubmissao = (id: string) => setSubmissoes([id]);

  const board = (
    <div className="flex h-full flex-col">
      {/* Header: modo de visualização + dica de DnD */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card/40 px-3 py-1.5">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {dndEnabled && (
            <span className="text-[10px] text-muted-foreground/80">
              Arraste itens prontos para "Enviados ao Brasil"
            </span>
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
        </div>
      </div>

      {/* Barra de filtros */}
      <MailboxKanbanFilters
        filters={filters}
        isActive={filtersActive || onlyUnread}
        groups={groups.filter((g) => !g.is_deleted)}
        totalSubs={totalSubs}
        totalUnread={totalUnread}
        onlyUnread={onlyUnread}
        onToggleUnread={() => setOnlyUnread((v) => !v)}
        onSetAnexo={setAnexo}
        onToggleBucket={toggleBucket}
        onToggleSubmissao={toggleSubmissao}
        onClearSubmissoes={clearSubmissoes}
        onClearAll={() => { clearAll(); setOnlyUnread(false); }}
        openSubmissaoSignal={openSubmissaoSignal}
      />

      {/* Colunas */}
      <div className="flex flex-1 min-h-0 gap-2 overflow-x-auto p-2">
        {columns.map((col) => (
          <KanbanColumn
            key={col.key}
            col={col}
            viewMode={viewMode}
            perspective={perspective}
            dndEnabled={dndEnabled}
            isDragging={!!activeDrag}
            list={byColumn.get(col.key) ?? []}
            itemList={byColumnItems.get(col.key) ?? []}
            selectedSubId={selectedSubId}
            onSelectGroup={onSelectGroup}
            onJumpFolder={onJumpFolder}
            onIsolateSubmissao={handleIsolateSubmissao}
          />
        ))}
      </div>
    </div>
  );

  if (!dndEnabled) return board;
  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDrag(null)}>
      {board}
      <DragOverlay dropAnimation={null}>
        {activeDrag ? (
          <div className="pointer-events-none w-[280px] rotate-1">
            <ItemCardInner
              item={activeDrag.item}
              group={activeDrag.group}
              selected={false}
              onClick={() => {}}
              draggable
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface KanbanColumnProps {
  col: ColumnDef;
  viewMode: "submission" | "item";
  perspective: "china" | "brasil";
  dndEnabled: boolean;
  isDragging: boolean;
  list: MailboxGroup[];
  itemList: Array<{ item: MailboxItem; group: MailboxGroup }>;
  selectedSubId: string | null;
  onSelectGroup: (group: MailboxGroup, item?: MailboxItem) => void;
  onJumpFolder: (folder: MailboxFolder) => void;
}

function KanbanColumn({
  col, viewMode, perspective, dndEnabled, isDragging,
  list, itemList, selectedSubId, onSelectGroup, onJumpFolder,
}: KanbanColumnProps) {
  const Icon = col.icon;
  const count = viewMode === "item" ? itemList.length : list.length;
  const emptyLabel = viewMode === "item" ? "Nenhum item" : "Nenhuma submissão";
  const isDropTarget = dndEnabled && col.key === "sent_brazil";
  const { setNodeRef, isOver } = useDroppable({
    id: `col:${col.key}`,
    disabled: !isDropTarget,
  });
  const showDropHint = isDropTarget && isDragging;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full w-[300px] min-w-[280px] shrink-0 flex-col rounded-md border bg-muted/20 transition-colors",
        isDropTarget && isOver ? "border-primary/70 bg-primary/10 ring-2 ring-primary/40" : "border-border",
        showDropHint && !isOver && "border-primary/40",
        dndEnabled && !isDropTarget && isDragging && "opacity-60",
      )}
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
          {showDropHint && (
            <div className="rounded-sm border-2 border-dashed border-primary/60 bg-primary/5 px-2 py-2 text-center text-[10.5px] font-medium text-primary">
              Solte para enviar ao Brasil
            </div>
          )}
          {count === 0 ? (
            <div className="rounded-sm border border-dashed border-border/60 px-2 py-6 text-center text-[10px] text-muted-foreground">
              {emptyLabel}
            </div>
          ) : viewMode === "item" ? (
            itemList.map(({ item, group }, idx) => {
              const eligible = dndEnabled && isDocDraggableToSent(item, group, perspective);
              const key = item.documento_id ?? `${group.submissao_id}-${col.key}-${idx}`;
              if (eligible) {
                return (
                  <DraggableItemCard
                    key={key}
                    dragId={`doc:${item.documento_id}`}
                    item={item}
                    group={group}
                    selected={selectedSubId === group.submissao_id}
                    onClick={() => onSelectGroup(group, item)}
                    draggableHint="Arraste para 'Enviados ao Brasil'"
                  />
                );
              }
              return (
                <ItemCard
                  key={key}
                  item={item}
                  group={group}
                  selected={selectedSubId === group.submissao_id}
                  onClick={() => onSelectGroup(group, item)}
                />
              );
            })
          ) : (
            list.map((g) => {
              const hint =
                (g.docs || []).find((d: any) => !d.is_virtual && (d.arquivo_path || d.arquivo_url)) ??
                (g.docs || []).find((d: any) => !d.is_virtual) ??
                (g.docs || [])[0];
              return (
                <KanbanCard
                  key={g.submissao_id}
                  group={g}
                  perspective={perspective}
                  selected={selectedSubId === g.submissao_id}
                  onClick={() => onSelectGroup(g, hint)}
                />
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
