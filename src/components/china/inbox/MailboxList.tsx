import { useMemo, useState } from "react";
import { Star, Paperclip, Clock, AlertTriangle, CheckCircle2, FileText, FileX2, MessageSquareOff, ChevronRight, ChevronDown, Layers, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { MailboxItem, MailboxFolder } from "@/hooks/useChinaMailbox";
import { resolveDirection, type DirectionInfo } from "@/lib/china/inboxDirection";
import { InboxDirectionBadge } from "./InboxDirectionBadge";
import { useChinaUserContext } from "@/hooks/useChinaUserContext";
import { evaluateAwaitingSend, AWAITING_SEND_REASON_LABEL } from "@/lib/china/awaitingSendRule";
import { groupBySubmissao } from "@/lib/china/groupMailboxItems";
import type { ChinaInboxGroupMode } from "@/hooks/useChinaInboxGroupMode";

export type ActionFilter = "mine" | "theirs" | "all";

const FOLDER_TITLES: Partial<Record<MailboxFolder, string>> = {
  inbox: "Caixa de Entrada",
  starred: "Marcadas",
  sent: "Enviados",
  drafts: "Rascunhos",
  approved: "Aprovadas",
  rejected: "Rejeitadas",
  trash: "Lixeira",
  oc: "Ordens de Compra",
  awaiting_send: "Pendentes de envio",
  sent_brazil: "Enviadas ao Brasil — aguardando análise",
  in_analysis: "Em análise no Brasil",
  returned: "Retorno: ajustes solicitados",
};

// Pastas onde o agrupamento por submissão não faz sentido (já são por OC ou
// têm semântica de lixeira/recuperação).
const GROUP_DISABLED_FOLDERS: MailboxFolder[] = ["oc", "trash"];

interface Props {
  items: MailboxItem[];
  folder: MailboxFolder;
  selectedId: string | null;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleCheck: (id: string) => void;
  onToggleAllChecks: () => void;
  onToggleStar: (item: MailboxItem) => void;
  search: string;
  actionFilter?: ActionFilter;
  onActionFilterChange?: (f: ActionFilter) => void;
  viewerOverride?: { isChinaUser: boolean; isBrasilUser: boolean };
  /** Modo de agrupamento. "flat" preserva o comportamento clássico. */
  groupMode?: ChinaInboxGroupMode;
  onGroupModeChange?: (m: ChinaInboxGroupMode) => void;
}

function statusBadge(submissao_status: string, doc_status: string | null) {
  if (submissao_status === "aprovado") {
    return { label: "Aprovado", icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
  }
  if (submissao_status === "rejeitado") {
    return { label: "Rejeitado", icon: AlertTriangle, cls: "bg-rose-500/15 text-rose-400 border-rose-500/30" };
  }
  if (doc_status === "rejeitado") {
    return { label: "Ajuste", icon: AlertTriangle, cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
  }
  if (submissao_status === "rascunho") {
    return { label: "Rascunho", icon: FileText, cls: "bg-muted/40 text-muted-foreground border-border" };
  }
  return { label: "Aguardando", icon: Clock, cls: "bg-primary/15 text-primary border-primary/30" };
}

function relativeAge(hours: number) {
  if (hours < 1) return "agora";
  if (hours < 24) return `${hours}h`;
  const d = Math.floor(hours / 24);
  return `${d}d`;
}

interface RowProps {
  item: MailboxItem;
  dir: DirectionInfo;
  folder: MailboxFolder;
  active: boolean;
  checked: boolean;
  onSelect: (id: string) => void;
  onToggleCheck: (id: string) => void;
  onToggleStar: (item: MailboxItem) => void;
  /** Quando renderizado dentro de um grupo, recua e remove o cabeçalho de produto. */
  nested?: boolean;
}

function MailboxRow({ item, dir, folder, active, checked, onSelect, onToggleCheck, onToggleStar, nested }: RowProps) {
  const id = item.documento_id ?? item.submissao_id;
  const sb = statusBadge(item.submissao_status, item.doc_status);
  const SbIcon = sb.icon;
  // Padrão e-mail: enquanto não lido, título em destaque em qualquer pasta.
  // Itens sem documento (não rastreáveis por leitura) são tratados como lidos.
  const unread = !item.is_read;
  return (
    <li
      onClick={() => onSelect(id)}
      className={cn(
        "group flex cursor-pointer items-start gap-2 border-b border-border/40 px-3 py-2 text-sm transition-colors",
        active ? "bg-primary/10" : "hover:bg-muted/30",
        unread && "bg-card",
        nested && "pl-9 bg-muted/10",
      )}
    >
      <div className="flex flex-col items-center pt-0.5">
        <Checkbox
          checked={checked}
          onCheckedChange={() => onToggleCheck(item.submissao_id)}
          onClick={(e) => e.stopPropagation()}
          aria-label="Selecionar"
        />
      </div>
      {!nested && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar(item);
          }}
          className={cn(
            "mt-0.5 transition-colors",
            item.is_flagged ? "text-amber-400" : "text-muted-foreground/40 hover:text-amber-300",
          )}
          aria-label={item.is_flagged ? "Desmarcar estrela" : "Marcar com estrela"}
        >
          <Star className="h-3.5 w-3.5" fill={item.is_flagged ? "currentColor" : "none"} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        {!nested && <InboxDirectionBadge info={dir} size="sm" className="mb-0.5" />}
        {!nested && (
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "truncate text-[13px]",
                unread ? "font-semibold text-foreground" : "font-medium text-foreground/90",
              )}
            >
              {item.produto_codigo} — {item.produto_nome}
            </span>
            {item.numero_ordem && (
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {item.numero_ordem}
              </span>
            )}
          </div>
        )}
        <div className={cn("flex items-center gap-1.5 truncate text-[11.5px] text-muted-foreground", !nested && "mt-0.5")}>
          {item.tipo_documento && (
            <>
              <Paperclip className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {item.tipo_documento}
                {item.nome_arquivo ? ` · ${item.nome_arquivo}` : ""}
              </span>
            </>
          )}
          {!item.tipo_documento && (
            <span className="truncate italic">
              {item.observacoes_china || item.observacoes_brasil || "Sem documentos"}
            </span>
          )}
        </div>
        {folder === "awaiting_send" && (() => {
          const ev = evaluateAwaitingSend(item);
          if (!ev.matches) return null;
          return (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {ev.reasons.map((r) => {
                const Icon =
                  r === "sem_documento" ? FileX2 :
                  r === "sem_parecer" ? MessageSquareOff :
                  FileText;
                const cls =
                  r === "sem_documento"
                    ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                    : r === "sem_parecer"
                    ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                    : "bg-muted/40 text-muted-foreground border-border";
                return (
                  <Badge
                    key={r}
                    variant="outline"
                    className={cn("h-4 gap-0.5 px-1.5 text-[9.5px] font-medium", cls)}
                    title={`Motivo: ${AWAITING_SEND_REASON_LABEL[r]}`}
                  >
                    <Icon className="h-2.5 w-2.5" />
                    {AWAITING_SEND_REASON_LABEL[r]}
                  </Badge>
                );
              })}
            </div>
          );
        })()}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge variant="outline" className={cn("h-4 px-1.5 text-[9.5px] gap-0.5 font-medium", sb.cls)}>
          <SbIcon className="h-2.5 w-2.5" />
          {sb.label}
        </Badge>
        {item.snooze_until && (
          <Badge variant="outline" className="h-4 px-1.5 text-[9.5px] gap-0.5 bg-amber-500/15 text-amber-400 border-amber-500/30">
            <Clock className="h-2.5 w-2.5" /> adiada
          </Badge>
        )}
        <span className="flex items-center gap-1 text-[10px] tabular-nums text-muted-foreground">
          {!unread && (
            <span title="Lida" aria-label="Lida" className="inline-flex">
              <CheckCheck className="h-3 w-3 text-sky-400" />
            </span>
          )}
          {relativeAge(item.horas_pendentes)}
        </span>
      </div>
    </li>
  );
}

export function MailboxList({
  items,
  folder,
  selectedId,
  selectedIds,
  onSelect,
  onToggleCheck,
  onToggleAllChecks,
  onToggleStar,
  search,
  actionFilter = "all",
  onActionFilterChange,
  viewerOverride,
  groupMode = "flat",
  onGroupModeChange,
}: Props) {
  const ctx = useChinaUserContext();
  const viewer = viewerOverride ?? { isBrasilUser: ctx.isBrasilUser, isChinaUser: ctx.isChinaUser };

  const itemsWithDir = useMemo(
    () => items.map((i) => ({ item: i, dir: resolveDirection(i, viewer) })),
    [items, viewer.isBrasilUser, viewer.isChinaUser],
  );

  const filteredByAction = useMemo(() => {
    if (folder !== "inbox" || actionFilter === "all") return itemsWithDir;
    if (actionFilter === "mine") return itemsWithDir.filter((x) => x.dir.ballOnViewer);
    return itemsWithDir.filter((x) => !x.dir.ballOnViewer);
  }, [itemsWithDir, actionFilter, folder]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return filteredByAction;
    return filteredByAction.filter(({ item: i }) => {
      const blob = `${i.produto_codigo} ${i.produto_nome} ${i.numero_ordem ?? ""} ${i.nome_arquivo ?? ""} ${i.tipo_documento ?? ""} ${i.observacoes_brasil ?? ""} ${i.observacoes_china ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [filteredByAction, search]);

  const dirBySubmissao = useMemo(() => {
    const map = new Map<string, DirectionInfo>();
    for (const { item, dir } of filtered) {
      if (!map.has(item.submissao_id)) map.set(item.submissao_id, dir);
    }
    return map;
  }, [filtered]);

  const groupingAllowed = !GROUP_DISABLED_FOLDERS.includes(folder);
  const effectiveMode: ChinaInboxGroupMode = groupingAllowed ? groupMode : "flat";

  const groups = useMemo(() => {
    if (effectiveMode !== "grouped") return [];
    return groupBySubmissao(filtered.map((x) => x.item));
  }, [filtered, effectiveMode]);

  const mineCount = useMemo(
    () => itemsWithDir.filter((x) => x.dir.ballOnViewer).length,
    [itemsWithDir],
  );
  const theirsCount = itemsWithDir.length - mineCount;

  const allChecked =
    filtered.length > 0 && filtered.every(({ item: i }) => selectedIds.has(i.submissao_id));

  return (
    <div className="flex h-full flex-col">
      {folder === "inbox" && onActionFilterChange && (
        <div className="flex items-center gap-1 border-b border-border bg-card/40 px-2 py-1">
          {([
            { k: "mine" as const, label: "Aguarda você", labelCn: "等待您", count: mineCount },
            { k: "theirs" as const, label: "Outro lado", labelCn: "对方", count: theirsCount },
            { k: "all" as const, label: "Tudo", labelCn: "全部", count: itemsWithDir.length },
          ]).map((c) => (
            <button
              key={c.k}
              type="button"
              onClick={() => onActionFilterChange(c.k)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] transition-colors",
                actionFilter === c.k
                  ? "bg-primary/20 text-primary border border-primary/40"
                  : "text-muted-foreground hover:bg-muted/40 border border-transparent",
              )}
              title={c.labelCn}
            >
              {c.label}
              <span className="text-[9px] opacity-70">{c.count}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 border-b border-border bg-card/30 px-3 py-1.5">
        <Checkbox
          checked={allChecked}
          onCheckedChange={onToggleAllChecks}
          aria-label="Selecionar todos"
        />
        <span className="flex-1 text-[11px] text-muted-foreground">
          {effectiveMode === "grouped"
            ? `${groups.length} conversa${groups.length === 1 ? "" : "s"} · ${filtered.length} item${filtered.length === 1 ? "" : "s"}`
            : `${filtered.length} item${filtered.length === 1 ? "" : "s"}`}
          {" · "}
          {FOLDER_TITLES[folder] ?? folder}
        </span>
        {groupingAllowed && onGroupModeChange && (
          <div className="inline-flex items-center rounded-md border border-border/60 bg-background/40 p-0.5">
            <button
              type="button"
              onClick={() => onGroupModeChange("flat")}
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors",
                effectiveMode === "flat"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Mostrar um item por documento"
              aria-pressed={effectiveMode === "flat"}
            >
              <FileText className="h-3 w-3" />
              Documentos
            </button>
            <button
              type="button"
              onClick={() => onGroupModeChange("grouped")}
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors",
                effectiveMode === "grouped"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Agrupar documentos pela mesma submissão / OC"
              aria-pressed={effectiveMode === "grouped"}
            >
              <Layers className="h-3 w-3" />
              Agrupar por OC
            </button>
          </div>
        )}
      </div>
      <ul className="flex-1 overflow-y-auto" role="list">
        {filtered.length === 0 && (
          <li className="p-8 text-center text-sm text-muted-foreground">
            Nenhum item nesta pasta / 此文件夹中没有项目
          </li>
        )}
        {effectiveMode === "flat" &&
          filtered.map(({ item, dir }) => {
            const id = item.documento_id ?? item.submissao_id;
            return (
              <MailboxRow
                key={id}
                item={item}
                dir={dir}
                folder={folder}
                active={selectedId === id}
                checked={selectedIds.has(item.submissao_id)}
                onSelect={onSelect}
                onToggleCheck={onToggleCheck}
                onToggleStar={onToggleStar}
              />
            );
          })}
        {effectiveMode === "grouped" &&
          groups.map((g) => (
            <GroupRow
              key={g.submissao_id}
              group={g}
              dir={dirBySubmissao.get(g.submissao_id)}
              folder={folder}
              selectedId={selectedId}
              selectedIds={selectedIds}
              onSelect={onSelect}
              onToggleCheck={onToggleCheck}
              onToggleStar={onToggleStar}
            />
          ))}
      </ul>
    </div>
  );
}

interface GroupRowProps {
  group: ReturnType<typeof groupBySubmissao>[number];
  dir: DirectionInfo | undefined;
  folder: MailboxFolder;
  selectedId: string | null;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleCheck: (id: string) => void;
  onToggleStar: (item: MailboxItem) => void;
}

function GroupRow({ group, dir, folder, selectedId, selectedIds, onSelect, onToggleCheck, onToggleStar }: GroupRowProps) {
  const [expanded, setExpanded] = useState(false);
  const headerActive = group.docs.some((d) => (d.documento_id ?? d.submissao_id) === selectedId);
  const checked = selectedIds.has(group.submissao_id);
  const sb = statusBadge(group.submissao_status, group.worst_status);
  const SbIcon = sb.icon;
  const ChevronIcon = expanded ? ChevronDown : ChevronRight;
  const Pivot = group.docs[0];
  const unread = group.has_unread && folder === "inbox";

  return (
    <>
      <li
        onClick={() => onSelect(Pivot.documento_id ?? Pivot.submissao_id)}
        className={cn(
          "group flex cursor-pointer items-start gap-2 border-b border-border/40 px-3 py-2 text-sm transition-colors",
          headerActive ? "bg-primary/10" : "hover:bg-muted/30",
          unread && "bg-card",
        )}
      >
        <div className="flex flex-col items-center pt-0.5">
          <Checkbox
            checked={checked}
            onCheckedChange={() => onToggleCheck(group.submissao_id)}
            onClick={(e) => e.stopPropagation()}
            aria-label="Selecionar submissão"
          />
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar(Pivot);
          }}
          className={cn(
            "mt-0.5 transition-colors",
            group.is_flagged ? "text-amber-400" : "text-muted-foreground/40 hover:text-amber-300",
          )}
          aria-label={group.is_flagged ? "Desmarcar estrela" : "Marcar com estrela"}
        >
          <Star className="h-3.5 w-3.5" fill={group.is_flagged ? "currentColor" : "none"} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="mt-0.5 text-muted-foreground hover:text-foreground"
          aria-label={expanded ? "Recolher" : "Expandir"}
          aria-expanded={expanded}
        >
          <ChevronIcon className="h-3.5 w-3.5" />
        </button>
        <div className="min-w-0 flex-1">
          {dir && <InboxDirectionBadge info={dir} size="sm" className="mb-0.5" />}
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "truncate text-[13px]",
                unread ? "font-semibold text-foreground" : "font-medium text-foreground/90",
              )}
            >
              {group.produto_codigo} — {group.produto_nome}
            </span>
            {group.numero_ordem && (
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {group.numero_ordem}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 truncate text-[11.5px] text-muted-foreground">
            <Paperclip className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {group.docs.length} documento{group.docs.length === 1 ? "" : "s"}
              {Pivot.tipo_documento ? ` · último: ${Pivot.tipo_documento}` : ""}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant="outline" className={cn("h-4 px-1.5 text-[9.5px] gap-0.5 font-medium", sb.cls)}>
            <SbIcon className="h-2.5 w-2.5" />
            {sb.label}
          </Badge>
          <Badge variant="outline" className="h-4 px-1.5 text-[9.5px] gap-0.5 bg-muted/40 text-muted-foreground border-border">
            <Layers className="h-2.5 w-2.5" />
            {group.docs.length}
          </Badge>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {relativeAge(group.horas_pendentes)}
          </span>
        </div>
      </li>
      {expanded &&
        group.docs.map((d) => {
          const id = d.documento_id ?? d.submissao_id;
          return (
            <MailboxRow
              key={id}
              item={d}
              dir={dir as DirectionInfo}
              folder={folder}
              active={selectedId === id}
              checked={selectedIds.has(d.submissao_id)}
              onSelect={onSelect}
              onToggleCheck={onToggleCheck}
              onToggleStar={onToggleStar}
              nested
            />
          );
        })}
    </>
  );
}
