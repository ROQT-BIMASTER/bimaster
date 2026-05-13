import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Star, Paperclip, Clock, AlertTriangle, CheckCircle2, FileText, FileX2, MessageSquareOff, ChevronRight, ChevronDown, Layers, CheckCheck, ListChecks, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { MailboxItem, MailboxFolder } from "@/hooks/useChinaMailbox";
import { resolveDirection, type DirectionInfo } from "@/lib/china/inboxDirection";
import { InboxDirectionBadge } from "./InboxDirectionBadge";
import { useChinaUserContext } from "@/hooks/useChinaUserContext";
import { evaluateAwaitingSend, AWAITING_SEND_REASON_LABEL } from "@/lib/china/awaitingSendRule";
import { groupBySubmissao, type MailboxGroup } from "@/lib/china/groupMailboxItems";
import { type ChinaInboxGroupMode, isGroupModeForced } from "@/hooks/useChinaInboxGroupMode";
import { ReadStatusLegend } from "./ReadStatusLegend";
import { ChecklistPendingSheet } from "./ChecklistPendingSheet";
import { useChinaI18n } from "@/hooks/useChinaI18n";

type TFn = (key: string, opts?: Record<string, unknown>) => string;

/**
 * Resolve o nome legível do `tipo_documento` para exibição na lista.
 * Usa `tipo_documento_label` (vindo do merge do checklist) e cai num
 * formatador snake_case → Title Case quando ausente.
 */
function resolveTipoLabel(item: MailboxItem, t: TFn): string | null {
  if (item.tipo_documento_label) return item.tipo_documento_label;
  const td = item.tipo_documento;
  if (!td) return null;
  if (td.startsWith("custom_")) return t("mailboxList.fallback.itemPersonalizado");
  return td
    .split("_")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export type ActionFilter = "mine" | "theirs" | "all";

const FOLDER_TITLE_KEYS: Partial<Record<MailboxFolder, string>> = {
  inbox: "inbox.sidebar.folders.inbox",
  starred: "inbox.sidebar.folders.starred",
  sent: "inbox.sidebar.folders.sent",
  drafts: "inbox.sidebar.folders.drafts",
  approved: "inbox.sidebar.folders.approved",
  rejected: "inbox.sidebar.folders.rejected",
  trash: "inbox.sidebar.folders.trash",
  oc: "inbox.sidebar.folders.oc",
  awaiting_send: "inbox.sidebar.folders.awaiting_send",
  sent_brazil: "inbox.sidebar.folders.sent_brazil",
  in_analysis: "inbox.sidebar.folders.in_analysis",
  returned: "inbox.sidebar.folders.returned",
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
  /** Disparado pelos CTAs de grupo na pasta "Pendentes de envio". */
  onEnviarGrupoBrasil?: (group: MailboxGroup) => void;
  /** Despacho individual de um item ao Brasil (botão por linha no drawer). */
  onEnviarItemBrasil?: (item: MailboxItem) => void;
  /** Abre a submissão (deep-link) — usado por "Anexar/Adicionar parecer". */
  onOpenSubmissao?: (submissao_id: string) => void;
}

function statusBadge(
  submissao_status: string,
  doc_status: string | null,
  approval_completeness?: "total" | "partial" | "empty",
) {
  if (submissao_status === "aprovado") {
    if (approval_completeness === "partial") {
      return {
        label: "Aprovado · parcial",
        icon: AlertTriangle,
        cls: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      };
    }
    if (approval_completeness === "empty") {
      return {
        label: "Aprovado · sem checklist",
        icon: AlertTriangle,
        cls: "bg-muted/40 text-muted-foreground border-border",
      };
    }
    return {
      label: "Aprovado · total",
      icon: CheckCircle2,
      cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    };
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
  const id = item.is_virtual
    ? `${item.submissao_id}:virtual:${item.tipo_documento ?? "_"}`
    : item.documento_id ?? item.submissao_id;
  const sb = statusBadge(item.submissao_status, item.doc_status, item.approval_completeness);
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
                {resolveTipoLabel(item)}
                {item.nome_arquivo ? ` · ${item.nome_arquivo}` : ""}
                {item.is_virtual && (
                  <span className="ml-1.5 italic text-muted-foreground/70">(ainda não criado)</span>
                )}
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
          // Mantemos apenas as badges de motivo ACIONÁVEIS — sem documento, sem
          // parecer. "Rascunho" só aparece quando o pai também é rascunho (caso
          // contrário é informação redundante: o cabeçalho do grupo já diz).
          // O contexto "item novo em submissão já enviada" é comunicado pelo
          // cabeçalho do grupo ("Enviada ao Brasil — aguardando análise"),
          // não mais por badge no item.
          const parentIsRascunho = item.submissao_status === "rascunho";
          const reasons = ev.reasons.filter((r) => r !== "rascunho" || parentIsRascunho);
          if (reasons.length === 0) return null;
          return (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {reasons.map((r) => {
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
        {item.submissao_status === "aprovado" && item.checklist_total > 0 && (
          <Badge
            variant="outline"
            className={cn(
              "h-4 px-1.5 text-[9.5px] gap-0.5 font-medium",
              item.checklist_aprovados === item.checklist_total
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : "bg-amber-500/10 text-amber-400 border-amber-500/30",
            )}
            title={
              item.checklist_aprovados === item.checklist_total
                ? "Checklist 100% aprovado — libera ordem de compra"
                : `Checklist incompleto — ${item.checklist_total - item.checklist_aprovados} doc(s) ainda não aprovados`
            }
          >
            <ListChecks className="h-2.5 w-2.5" />
            {item.checklist_aprovados}/{item.checklist_total}
          </Badge>
        )}
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
  onEnviarGrupoBrasil,
  onEnviarItemBrasil,
  onOpenSubmissao,
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

  // Drawer lateral de "Checklist pendente" — substitui a antiga expansão inline.
  const [openChecklistFor, setOpenChecklistFor] = useState<string | null>(null);
  const openGroup = useMemo(
    () => groups.find((g) => g.submissao_id === openChecklistFor) ?? null,
    [groups, openChecklistFor],
  );

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
        <ReadStatusLegend />
        {groupingAllowed && onGroupModeChange && !isGroupModeForced(folder) && (
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
            const id = item.is_virtual
              ? `${item.submissao_id}:virtual:${item.tipo_documento ?? "_"}`
              : item.documento_id ?? item.submissao_id;
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
              onEnviarGrupoBrasil={onEnviarGrupoBrasil}
              onOpenSubmissao={onOpenSubmissao}
              onOpenChecklist={(id) => setOpenChecklistFor(id)}
            />
          ))}
      </ul>
      <ChecklistPendingSheet
        open={openChecklistFor !== null}
        onOpenChange={(o) => !o && setOpenChecklistFor(null)}
        group={openGroup}
        folder={folder}
        onSelectItem={onSelect}
        onEnviarGrupoBrasil={onEnviarGrupoBrasil}
        onEnviarItemBrasil={onEnviarItemBrasil}
        onOpenSubmissao={onOpenSubmissao}
      />
    </div>
  );
}

interface GroupRowProps {
  group: MailboxGroup;
  dir: DirectionInfo | undefined;
  folder: MailboxFolder;
  selectedId: string | null;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleCheck: (id: string) => void;
  onToggleStar: (item: MailboxItem) => void;
  onEnviarGrupoBrasil?: (group: MailboxGroup) => void;
  onOpenSubmissao?: (submissao_id: string) => void;
  /** Abre o drawer lateral com a lista detalhada de pendências do checklist. */
  onOpenChecklist?: (submissao_id: string) => void;
}

/** Frase em linguagem natural para o status da submissão pai (cabeçalho do grupo). */
function describeParentStatus(status: string): string {
  switch (status) {
    case "rascunho":
      return "Rascunho — nada foi enviado ainda";
    case "pendente":
    case "em_revisao":
    case "enviado":
    case "enviado_brasil":
      return "Enviada ao Brasil — aguardando análise";
    case "aprovado":
      return "Aprovada pelo Brasil";
    case "rejeitado":
      return "Rejeitada — requer ajustes";
    default:
      return status;
  }
}

function GroupRow({
  group,
  dir,
  folder,
  selectedId,
  selectedIds,
  onSelect,
  onToggleCheck,
  onToggleStar,
  onEnviarGrupoBrasil,
  onOpenSubmissao,
  onOpenChecklist,
}: GroupRowProps) {
  // Em "Pendentes de envio" o detalhamento é feito agora num drawer lateral
  // (ChecklistPendingSheet), não mais por expansão inline. Para outras pastas,
  // mantemos o comportamento clássico de expandir/recolher.
  const useDrawer =
    folder === "awaiting_send" ||
    folder === "sent_brazil" ||
    folder === "in_analysis" ||
    folder === "returned";
  const isAwaiting = useDrawer;
  const allowSendBatch = folder === "awaiting_send" || folder === "returned";
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const headerActive = group.docs.some((d) => (d.documento_id ?? d.submissao_id) === selectedId);
  const checked = selectedIds.has(group.submissao_id);
  const sb = statusBadge(group.submissao_status, group.worst_status, group.docs[0]?.approval_completeness);
  const SbIcon = sb.icon;
  const ChevronIcon = expanded ? ChevronDown : ChevronRight;
  const Pivot = group.docs[0];
  const unread = group.has_unread && folder === "inbox";

  // Cálculo de progresso para a pasta "Pendentes de envio".
  // Denominador = total ESPERADO pelo Modo Foco (29 no exemplo), não apenas
  // os documentos já criados em DB. Cai no progress.total quando o checklist
  // efetivo ainda não foi customizado (Modo Foco vazio).
  const p = group.progress;
  const progressed = p.enviados + p.aprovados + p.em_analise + p.rejeitados;
  const expectedTotal = Math.max(
    group.docs[0]?.checklist_expected_total ?? 0,
    p.total,
  );
  const pct = expectedTotal > 0 ? Math.round((progressed / expectedTotal) * 100) : 0;
  const realCount = group.docs.filter((d) => !d.is_virtual).length;
  const expectedPending = Math.max(0, expectedTotal - progressed);
  const pendingCount = expectedPending;

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
            if (isAwaiting && onOpenChecklist) {
              onOpenChecklist(group.submissao_id);
            } else {
              setExpanded((v) => !v);
            }
          }}
          className="mt-0.5 text-muted-foreground hover:text-foreground"
          aria-label={isAwaiting ? "Abrir checklist pendente" : expanded ? "Recolher" : "Expandir"}
          aria-expanded={isAwaiting ? undefined : expanded}
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
          {isAwaiting ? (
            <>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Submissão: <span className="text-foreground/85">{describeParentStatus(group.submissao_status)}</span>
              </p>
              {(() => {
                const sentFirst = folder === "sent_brazil" || folder === "in_analysis";
                return (
                  <p
                    className="mt-0.5 text-[11px] text-muted-foreground"
                    title="Total baseado no checklist configurado (Modo Foco). Itens ainda não criados aparecem como pendentes de envio."
                  >
                    Checklist:{" "}
                    {sentFirst ? (
                      <>
                        <span className="font-medium text-emerald-400">{progressed} enviado{progressed === 1 ? "" : "s"}</span>
                        {" · "}
                        <span className="text-muted-foreground">
                          {pendingCount} ainda pendente{pendingCount === 1 ? "" : "s"}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-foreground/90 font-medium">{progressed} de {expectedTotal}</span>
                        {" itens enviados · "}
                        <span className={cn("font-medium", pendingCount > 0 ? "text-amber-400" : "text-emerald-400")}>
                          {pendingCount} pendente{pendingCount === 1 ? "" : "s"} de envio
                        </span>
                      </>
                    )}
                  </p>
                );
              })()}
              {expectedTotal > realCount && (
                <p className="mt-0.5 text-[10px] text-muted-foreground/80">
                  {realCount} no checklist atual · {expectedTotal - realCount} ainda não criado{expectedTotal - realCount === 1 ? "" : "s"}
                </p>
              )}
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                <div
                  className={cn(
                    "h-full transition-all",
                    pct === 100
                      ? "bg-emerald-500"
                      : (folder === "sent_brazil" || folder === "in_analysis")
                      ? "bg-emerald-500/80"
                      : "bg-primary",
                  )}
                  style={{ width: `${pct}%` }}
                  aria-label={`${pct}% enviado`}
                />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {(folder === "sent_brazil" || folder === "in_analysis") ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      className="h-6 gap-1 px-2 text-[10.5px] bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenChecklist?.(group.submissao_id);
                      }}
                      title="Ver os itens já enviados ao Brasil"
                    >
                      <ListChecks className="h-3 w-3" />
                      Ver enviados ({progressed})
                    </Button>
                    {pendingCount > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 gap-1 px-2 text-[10.5px] text-muted-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(
                            `/dashboard/fabrica-china/produto/${group.submissao_id}/checklist-status?from=awaiting_send`,
                            { state: { from: "/dashboard/fabrica-china/caixa-entrada" } },
                          );
                        }}
                        title="Abrir página dedicada filtrando os itens ainda pendentes"
                      >
                        Ver pendentes ({pendingCount})
                      </Button>
                    )}
                  </>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 gap-1 px-2 text-[10.5px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenChecklist?.(group.submissao_id);
                    }}
                    title="Abrir lista detalhada de pendências em uma caixa lateral"
                  >
                    <ListChecks className="h-3 w-3" />
                    Ver checklist ({pendingCount})
                  </Button>
                )}
                {allowSendBatch && pendingCount > 0 && onEnviarGrupoBrasil && (
                  <Button
                    type="button"
                    size="sm"
                    className="h-6 gap-1 px-2 text-[10.5px] bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEnviarGrupoBrasil(group);
                    }}
                    title="Despachar todos os itens elegíveis desta submissão ao Brasil"
                  >
                    <Send className="h-3 w-3" />
                    Enviar todos ao Brasil
                  </Button>
                )}
                {onOpenSubmissao && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 gap-1 px-2 text-[10.5px] text-muted-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenSubmissao(group.submissao_id);
                    }}
                    title="Abrir a submissão completa em uma nova tela"
                  >
                    Abrir submissão
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 truncate text-[11.5px] text-muted-foreground">
              <Paperclip className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {group.docs.length} documento{group.docs.length === 1 ? "" : "s"}
                {Pivot.tipo_documento ? ` · último: ${resolveTipoLabel(Pivot)}` : ""}
              </span>
              {folder === "approved" && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-5 gap-1 px-1.5 text-[10px] text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(
                      `/dashboard/fabrica-china/produto/${group.submissao_id}/checklist-status?from=approved`,
                      { state: { from: "/dashboard/fabrica-china/caixa-entrada" } },
                    );
                  }}
                  title="Abrir página dedicada com o status completo do checklist"
                >
                  <ListChecks className="h-3 w-3" />
                  Ver checklist completo
                </Button>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {!isAwaiting && (
            <Badge variant="outline" className={cn("h-4 px-1.5 text-[9.5px] gap-0.5 font-medium", sb.cls)}>
              <SbIcon className="h-2.5 w-2.5" />
              {sb.label}
            </Badge>
          )}
          <Badge variant="outline" className="h-4 px-1.5 text-[9.5px] gap-0.5 bg-muted/40 text-muted-foreground border-border">
            <Layers className="h-2.5 w-2.5" />
            {group.docs.length}
          </Badge>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {relativeAge(group.horas_pendentes)}
          </span>
        </div>
      </li>
      {expanded && !isAwaiting &&
        group.docs.map((d) => {
          const id = d.is_virtual
            ? `${d.submissao_id}:virtual:${d.tipo_documento ?? "_"}`
            : d.documento_id ?? d.submissao_id;
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
