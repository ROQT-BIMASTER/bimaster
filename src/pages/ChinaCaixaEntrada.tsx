import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { buildReturnToTarget } from "@/lib/navigation/withReturnTo";
import { Inbox, RefreshCw, Search, X, Trash2, RotateCcw, Clock, Calculator, History, Sparkles, CheckCheck, Loader2, LayoutGrid, Rows3, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MailboxKanban } from "@/components/china/inbox/MailboxKanban";
import type { MailboxGroup } from "@/lib/china/groupMailboxItems";
import { SubmissionCopilotPanel } from "@/components/china/SubmissionCopilotPanel";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChinaPageShell } from "@/components/china/ChinaPageShell";
import { ChinaPageHeader } from "@/components/china/ChinaPageHeader";
import { ChinaDocPreviewDialog } from "@/components/china/ChinaDocPreviewDialog";
import { MailboxSidebar } from "@/components/china/inbox/MailboxSidebar";
import { MailboxList } from "@/components/china/inbox/MailboxList";
import { MailboxReadingPane } from "@/components/china/inbox/MailboxReadingPane";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ChinaInboxOCAba } from "@/components/china/inbox-oc/ChinaInboxOCAba";
import { SnoozeMenu } from "@/components/china/inbox/SnoozeMenu";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useChinaMailbox, type MailboxFolder, type MailboxItem } from "@/hooks/useChinaMailbox";
import { useChinaInboxGroupMode } from "@/hooks/useChinaInboxGroupMode";
import { confirmConclusaoTarefa } from "@/lib/projetos/confirmConclusao";
import { useToggleInboxRead, useToggleSubmissaoFlag } from "@/hooks/useChinaMailboxActions";
import {
  useTrashSubmissoes,
  useRestoreSubmissoes,
  usePurgeSubmissoes,
} from "@/hooks/useChinaMailboxTrash";


import { useEnviarDocumentoAoBrasil } from "@/hooks/useEnviarDocumentoAoBrasil";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useChinaI18n } from "@/hooks/useChinaI18n";
import { useConfirm } from "@/hooks/useConfirm";

const VALID_FOLDERS: MailboxFolder[] = [
  "oc", "inbox", "starred", "sent", "drafts", "approved", "rejected", "trash",
  "awaiting_send", "sent_brazil", "in_analysis", "returned",
];

// Aliases legados → nova taxonomia da China (compat de URLs).
const CHINA_FOLDER_ALIAS: Partial<Record<MailboxFolder, MailboxFolder>> = {
  inbox: "awaiting_send",
  drafts: "awaiting_send",
  sent: "sent_brazil",
  rejected: "returned",
};

export default function ChinaCaixaEntrada() {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useChinaI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const goWithReturn = (target: string) => {
    const fromPath = `${location.pathname}${location.search}`;
    const { url, state } = buildReturnToTarget(target, fromPath, { fromLabel: t("inbox.title") });
    navigate(url, { state });
  };
  // Esta página é a CENTRAL DE COMANDO da China. Independente do perfil real
  // do usuário (admin, China, etc.), aqui ele opera como China. Brasil age
  // pela tela "Vincular China".
  const isChinaUser = true;
  const isBrasilUser = false;
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const queryClient = useQueryClient();

  const folderParam = searchParams.get("folder") as MailboxFolder | null;
  const rawFolder: MailboxFolder =
    folderParam && VALID_FOLDERS.includes(folderParam)
      ? folderParam
      : "awaiting_send";
  const folder: MailboxFolder = CHINA_FOLDER_ALIAS[rawFolder] ?? rawFolder;

  // Sub-filtro da pasta "Aprovados": all | total | partial | empty
  const VALID_APPROVAL = ["all", "total", "partial", "empty"] as const;
  type ApprovalSubFilter = typeof VALID_APPROVAL[number];
  const approvalParam = (searchParams.get("approval") as ApprovalSubFilter | null) ?? "all";
  const approvalFilter: ApprovalSubFilter = (VALID_APPROVAL as readonly string[]).includes(approvalParam)
    ? approvalParam
    : "all";
  const setApprovalFilter = (a: ApprovalSubFilter) => {
    const sp = new URLSearchParams(searchParams);
    if (a === "all") sp.delete("approval");
    else sp.set("approval", a);
    setSearchParams(sp, { replace: true });
  };

  const { items: rawItems, progressItems, counts, isLoading, isFetching, refetch } = useChinaMailbox(folder);
  const items = useMemo(() => {
    if (folder !== "approved" || approvalFilter === "all") return rawItems;
    return rawItems.filter((i) => i.approval_completeness === approvalFilter);
  }, [rawItems, folder, approvalFilter]);
  const toggleRead = useToggleInboxRead();
  const toggleFlag = useToggleSubmissaoFlag();
  const trash = useTrashSubmissoes();
  const restore = useRestoreSubmissoes();
  const purge = usePurgeSubmissoes();

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<"mine" | "theirs" | "all">("mine");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewDoc, setPreviewDoc] = useState<MailboxItem | null>(null);
  const [kanbanSelected, setKanbanSelected] = useState<MailboxItem | null>(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [groupMode, setGroupMode] = useChinaInboxGroupMode(folder);
  const [viewMode, setViewMode] = useState<"list" | "kanban">(() => {
    if (typeof window === "undefined") return "list";
    return (localStorage.getItem("china_inbox_view") as "list" | "kanban") || "list";
  });
  useEffect(() => {
    try { localStorage.setItem("china_inbox_view", viewMode); } catch { /* ignore */ }
  }, [viewMode]);

  // Reset seleção ao trocar pasta (apenas no modo lista — no Kanban a seleção
  // pode sobreviver a uma troca de pasta porque clicar em um card de outra
  // coluna implica em mover de pasta + abrir o Sheet daquele item).
  useEffect(() => {
    if (viewMode === "kanban") {
      setSelectedIds(new Set());
      return;
    }
    setSelectedId(null);
    setSelectedIds(new Set());
  }, [folder, viewMode]);

  // Helper: id estável que considera itens "fantasma" (virtuais) — múltiplos
  // virtuais por submissão precisam de chave única (`<sub>:virtual:<tipo>`),
  // já que `documento_id` é null em todos eles.
  const itemRowId = (i: { is_virtual?: boolean; documento_id: string | null; submissao_id: string; tipo_documento: string | null }) =>
    i.is_virtual
      ? `${i.submissao_id}:virtual:${i.tipo_documento ?? "_"}`
      : i.documento_id ?? i.submissao_id;

  // Auto-seleção em desktop: primeira mensagem apenas no modo lista.
  // No Kanban, a seleção abre um Sheet; ao fechar, não deve reabrir automaticamente.
  useEffect(() => {
    if (!isDesktop) return;
    if (viewMode === "kanban") return;
    if (selectedId) return;
    if (items.length === 0) return;
    setSelectedId(itemRowId(items[0]));
  }, [items, isDesktop, selectedId, viewMode]);

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return items.find((i) => itemRowId(i) === selectedId) ?? null;
  }, [items, selectedId]);

  const setFolder = (f: MailboxFolder) => {
    const sp = new URLSearchParams(searchParams);
    sp.set("folder", f);
    setSearchParams(sp, { replace: true });
  };

  // Atalhos de teclado estilo Gmail
  const gPrefixRef = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        if (e.key === "Escape") (target as HTMLInputElement).blur();
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.key === "g") {
        gPrefixRef.current = true;
        setTimeout(() => { gPrefixRef.current = false; }, 800);
        return;
      }
      if (gPrefixRef.current) {
        gPrefixRef.current = false;
        if (isChinaUser) {
          if (e.key === "p") setFolder("awaiting_send");
          else if (e.key === "e") setFolder("sent_brazil");
          else if (e.key === "a") setFolder("in_analysis");
          else if (e.key === "r") setFolder("returned");
          else if (e.key === "v") setFolder("approved");
        } else {
          if (e.key === "i") setFolder("inbox");
          else if (e.key === "s") setFolder("sent");
          else if (e.key === "d") setFolder("drafts");
          else if (e.key === "a") setFolder("approved");
        }
        return;
      }
      if (!items.length) return;
      const idx = items.findIndex((i) => itemRowId(i) === selectedId);
      if (e.key === "j") {
        const next = items[Math.min(items.length - 1, idx + 1)];
        if (next) setSelectedId(itemRowId(next));
      } else if (e.key === "k") {
        const prev = items[Math.max(0, idx - 1)];
        if (prev) setSelectedId(itemRowId(prev));
      } else if (e.key === "s" && selectedItem) {
        toggleFlag.mutate({ submissao_id: selectedItem.submissao_id, flagged: !selectedItem.is_flagged });
      } else if (
        e.key === "b" &&
        selectedItem &&
        selectedItem.tipo_documento &&
        (selectedItem.submissao_status === "rascunho" || selectedItem.doc_status === "rascunho")
      ) {
        handleEnviarBrasil(selectedItem);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, selectedId, selectedItem, isBrasilUser]);

  const enviarBrasil = useEnviarDocumentoAoBrasil();
  const [lastEnvioVars, setLastEnvioVars] = useState<{ submissao_id: string; documento_id?: string } | null>(null);
  const handleCorrigir = (item: MailboxItem) => {
    goWithReturn(`/dashboard/fabrica-china/submissao/${item.submissao_id}`);
  };
  const handleEnviarBrasil = async (item: MailboxItem) => {
    const ok = await confirmConclusaoTarefa({
      tituloDialog: "Deseja mesmo enviar esse item ao Brasil?",
      titulo: item.nome_arquivo || item.tipo_documento || `${item.produto_codigo} — ${item.produto_nome}`,
      descricao:
        "Após o envio, esta submissão entra na fila de análise do Brasil e não pode mais ser editada pela China sem solicitar retorno.",
      acaoLabel: "Sim, enviar ao Brasil",
    });
    if (!ok) return;
    const vars = {
      submissao_id: item.submissao_id,
      ...(item.documento_id ? { documento_id: item.documento_id } : {}),
    };
    setLastEnvioVars(vars);
    enviarBrasil.reset();
    enviarBrasil.mutate(vars);
  };
  const handleEnviarGrupoBrasil = async (group: import("@/lib/china/groupMailboxItems").MailboxGroup) => {
    // Lista de itens elegíveis = pendentes de envio com documento anexado.
    // Itens "sem documento" não podem ser despachados (a edge function rejeita)
    // — esses precisam ser corrigidos individualmente.
    const eligible = group.docs.filter(
      (d) => d.documento_id && (d.doc_status === "rascunho" || d.submissao_status === "rascunho"),
    );
    if (eligible.length === 0) {
      toast.info("Nenhum item desta submissão está pronto para envio. Anexe documentos primeiro.");
      return;
    }
    const ok = await confirmConclusaoTarefa({
      tituloDialog: `Enviar ${eligible.length} item${eligible.length === 1 ? "" : "s"} ao Brasil?`,
      titulo: `${group.produto_codigo} — ${group.produto_nome}`,
      descricao:
        "Os itens elegíveis desta submissão serão despachados ao Brasil. Itens sem documento permanecem pendentes e precisam ser corrigidos individualmente.",
      acaoLabel: `Sim, enviar ${eligible.length} ao Brasil`,
    });
    if (!ok) return;
    let okCount = 0;
    let failCount = 0;
    for (const d of eligible) {
      try {
        await enviarBrasil.mutateAsync({
          submissao_id: d.submissao_id,
          documento_id: d.documento_id!,
        });
        okCount++;
      } catch {
        failCount++;
      }
    }
    if (okCount > 0) toast.success(`${okCount} item${okCount === 1 ? "" : "s"} enviado${okCount === 1 ? "" : "s"} ao Brasil.`);
    if (failCount > 0) toast.error(`${failCount} item${failCount === 1 ? "" : "s"} falharam no envio.`);
    queryClient.invalidateQueries({ queryKey: ["china-mailbox-dataset"] });
  };
  const handleRetryEnvio = () => {
    if (!lastEnvioVars) return;
    enviarBrasil.reset();
    enviarBrasil.mutate(lastEnvioVars, {
      onSettled: () => {
        // Atualiza o contador de não lidas e a listagem assim que o retry termina,
        // independentemente de sucesso/erro.
        queryClient.invalidateQueries({ queryKey: ["china-mailbox-dataset"] });
        refetch();
      },
    });
  };
  const handleToggleRead = (item: MailboxItem) => {
    if (!item.documento_id) return;
    toggleRead.mutate({ documento_id: item.documento_id, read: !item.is_read });
  };
  const handleToggleStar = (item: MailboxItem) => {
    toggleFlag.mutate({ submissao_id: item.submissao_id, flagged: !item.is_flagged });
  };

  const onToggleCheck = (subId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(subId)) next.delete(subId); else next.add(subId);
      return next;
    });
  };
  const onToggleAllChecks = () => {
    if (selectedIds.size > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map((i) => i.submissao_id)));
  };

  const handleBulkRead = () => {
    items
      .filter((i) => selectedIds.has(i.submissao_id) && i.documento_id && !i.is_read)
      .forEach((i) => toggleRead.mutate({ documento_id: i.documento_id!, read: true }));
    setSelectedIds(new Set());
  };

  const unreadVisibleCount = useMemo(
    () => items.filter((i) => i.documento_id && !i.is_read).length,
    [items],
  );
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const handleMarkAllRead = async () => {
    const targets = items.filter((i) => i.documento_id && !i.is_read);
    if (targets.length === 0) {
      toast.info(t("inbox.toasts.nenhumaNaoLida"));
      return;
    }
    setIsMarkingAllRead(true);
    try {
      await Promise.all(
        targets.map((i) =>
          toggleRead.mutateAsync({ documento_id: i.documento_id!, read: true }).catch(() => null),
        ),
      );
      toast.success(t("inbox.toasts.todasLidasOk", { count: targets.length }));
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const subtitle = isBrasilUser
    ? t("inbox.subtitleBrasil")
    : t("inbox.subtitleChina");

  const loading = enviarBrasil.isPending;

  return (
    <ChinaPageShell>
      <ChinaPageHeader
        titlePt={t("inbox.title")}
        titleCn=""
        subtitle={subtitle}
        icon={Inbox}
        iconTone="primary"
        actions={
          <div className="flex items-center gap-1.5">
            <ToggleGroup
              type="single"
              size="sm"
              value={viewMode}
              onValueChange={(v) => v && setViewMode(v as "list" | "kanban")}
              className="rounded-md border border-border"
            >
              <ToggleGroupItem value="list" className="h-7 px-2 text-xs gap-1" title="Visão lista">
                <Rows3 className="h-3.5 w-3.5" /> Lista
              </ToggleGroupItem>
              <ToggleGroupItem value="kanban" className="h-7 px-2 text-xs gap-1" title="Visão Kanban">
                <LayoutGrid className="h-3.5 w-3.5" /> Kanban
              </ToggleGroupItem>
            </ToggleGroup>

            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={unreadVisibleCount === 0 || isMarkingAllRead}
              title={t("inbox.actions.marcarTodasLidasTitle")}
            >
              {isMarkingAllRead ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <CheckCheck className="h-4 w-4 mr-1.5" />
              )}
              {isMarkingAllRead ? t("inbox.actions.marcando") : t("inbox.actions.marcarTodasLidas")}
              {!isMarkingAllRead && unreadVisibleCount > 0 && (
                <span className="ml-1 text-[10px] opacity-70">({unreadVisibleCount})</span>
              )}
            </Button>

            <Button variant="outline" size="sm" onClick={() => setCopilotOpen(true)}>
              <Sparkles className="h-4 w-4 mr-1.5" />
              {t("inbox.actions.copiloto")}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5" title="Mais ações">
                  <MoreHorizontal className="h-4 w-4" />
                  Ações
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onSelect={() => refetch()} disabled={isFetching}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
                  {t("inbox.actions.atualizar")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={async () => {
                    try {
                      const { data, error } = await (supabase as any).rpc("rpc_china_normalize_legacy_status");
                      if (error) throw error;
                      const n = Array.isArray(data) ? data.length : 0;
                      await queryClient.invalidateQueries({ queryKey: ["china-mailbox-dataset"] });
                      await refetch();
                      toast.success(n > 0 ? t("inbox.toasts.recalcOk", { count: n }) : t("inbox.toasts.recalcNenhuma"));
                    } catch (e: any) {
                      toast.error(t("inbox.toasts.recalcErro"), { description: e?.message });
                    }
                  }}
                  disabled={isFetching}
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  {t("inbox.actions.recalcular")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate("/dashboard/fabrica-china/auditoria-normalizacao")}>
                  <History className="h-4 w-4 mr-2" />
                  {t("inbox.actions.auditoria")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {/* Toolbar de busca + bulk actions */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card/40 px-2.5 py-1.5">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("inbox.search.placeholder")}
            className="h-8 pl-7 pr-7 text-xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">{t("inbox.selecionados", { count: selectedIds.size })}</span>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleBulkRead}>
              {t("inbox.actions.marcarComoLidos")}
            </Button>
            {folder !== "trash" ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => {
                    trash.mutate(Array.from(selectedIds));
                    setSelectedIds(new Set());
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("inbox.actions.moverLixeira")}
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => {
                    restore.mutate(Array.from(selectedIds));
                    setSelectedIds(new Set());
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t("inbox.actions.restaurar")}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 gap-1.5 text-xs"
                  onClick={async () => {
                    if (!(await confirm({ title: t("inbox.confirmExcluir"), destructive: true }))) return;
                    purge.mutate(Array.from(selectedIds));
                    setSelectedIds(new Set());
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("inbox.actions.excluirDefinitivo")}
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
              {t("inbox.actions.limparSelecao")}
            </Button>
          </div>
        )}
      </div>

      {/* Sub-filtro da pasta Aprovados — distingue aprovação plena × parcial × sem checklist */}
      {folder === "approved" && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-card/40 px-2.5 py-1.5">
          <span className="text-[11px] font-medium text-muted-foreground mr-1">
            Aprovações:
          </span>
          {([
            { k: "all" as const, label: "Todas", count: counts.approved, tone: "" },
            { k: "total" as const, label: "Aprovação total", count: counts.approved_total, tone: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
            { k: "partial" as const, label: "Parcial (checklist incompleto)", count: counts.approved_partial, tone: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
            { k: "empty" as const, label: "Sem checklist", count: counts.approved_empty, tone: "text-muted-foreground border-border bg-muted/30" },
          ]).map((c) => (
            <button
              key={c.k}
              type="button"
              onClick={() => setApprovalFilter(c.k)}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                approvalFilter === c.k
                  ? "bg-primary/20 text-primary border-primary/40"
                  : c.tone || "text-muted-foreground border-border hover:bg-muted/40"
              }`}
              title={
                c.k === "total"
                  ? "Todos os documentos do checklist aprovados — libera ordem de compra"
                  : c.k === "partial"
                  ? "Submissão aprovada, mas com documentos do checklist ainda em aberto ou rejeitados"
                  : c.k === "empty"
                  ? "Submissão aprovada sem documentos no checklist"
                  : "Mostrar todas as aprovações"
              }
            >
              {c.label}
              <span className="text-[9.5px] tabular-nums opacity-80">{c.count}</span>
            </button>
          ))}
          <span className="ml-auto text-[10px] text-muted-foreground">
            Apenas submissões com aprovação <strong>total</strong> liberam ordem de compra/produção.
          </span>
        </div>
      )}

      {/* Layout 3 colunas (desktop) ou pilha (mobile) */}
      {isDesktop ? (
        <div className="h-[calc(100vh-220px)] overflow-hidden rounded-md border border-border bg-card/20">
          {viewMode === "kanban" && folder !== "oc" ? (
            <MailboxKanban
              items={items}
              progressItems={progressItems}
              selectedId={selectedId}
              perspective={isBrasilUser ? "brasil" : "china"}
              onJumpFolder={(f) => { setViewMode("list"); setFolder(f); }}
              onSelectGroup={(g: MailboxGroup) => {
                const targetFolder: MailboxFolder =
                  g.submissao_status === "aprovado" ? "approved"
                  : g.submissao_status === "rejeitado" ? (isBrasilUser ? "rejected" : "returned")
                  : g.submissao_status === "enviado_brasil" ? "sent_brazil"
                  : (g.submissao_status === "em_revisao" || g.submissao_status === "enviado") ? "in_analysis"
                  : "awaiting_send";
                if (folder !== targetFolder) setFolder(targetFolder);
                const firstDoc = g.docs[0];
                if (firstDoc) {
                  const id = firstDoc.is_virtual
                    ? `${firstDoc.submissao_id}:virtual:${firstDoc.tipo_documento ?? "_"}`
                    : firstDoc.documento_id ?? firstDoc.submissao_id;
                  setSelectedId(id);
                } else {
                  setSelectedId(g.submissao_id);
                }
              }}
            />
          ) : (
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={18} minSize={14} maxSize={28}>
              <MailboxSidebar
                folder={folder}
                counts={counts}
                onSelect={setFolder}
                onCompose={() => goWithReturn("/dashboard/fabrica-china/nova")}
                forceChinaLayout
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            {folder === "oc" ? (
              <ResizablePanel defaultSize={82} minSize={50}>
                <ChinaInboxOCAba />
              </ResizablePanel>
            ) : (<>
            <ResizablePanel defaultSize={36} minSize={24}>
              {isLoading ? (
                <div className="space-y-2 p-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-12 animate-pulse rounded bg-muted/30" />
                  ))}
                </div>
              ) : (
                <MailboxList
                  items={items}
                  progressItems={progressItems}
                  folder={folder}
                  selectedId={selectedId}
                  selectedIds={selectedIds}
                  onSelect={setSelectedId}
                  onToggleCheck={onToggleCheck}
                  onToggleAllChecks={onToggleAllChecks}
                  onToggleStar={handleToggleStar}
                  search={search}
                  actionFilter={actionFilter}
                  onActionFilterChange={setActionFilter}
                  viewerOverride={{ isChinaUser, isBrasilUser }}
                  groupMode={groupMode}
                  onGroupModeChange={setGroupMode}
                  onEnviarGrupoBrasil={handleEnviarGrupoBrasil}
                  onEnviarItemBrasil={handleEnviarBrasil}
                  onOpenSubmissao={(id) => goWithReturn(`/dashboard/fabrica-china/submissao/${id}`)}
                />
              )}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={46} minSize={28}>
              <MailboxReadingPane
                item={selectedItem}
                isBrasilUser={isBrasilUser}
                isChinaUser={isChinaUser}
                onView={(it) => setPreviewDoc(it)}
                onCorrigir={handleCorrigir}
                onEnviarBrasil={handleEnviarBrasil}
                onToggleRead={handleToggleRead}
                onToggleStar={handleToggleStar}
                loading={loading}
                error={enviarBrasil.isError ? (enviarBrasil.error as any)?.message ?? t("inbox.blocks.falhaEnviarBrasil") : null}
                onRetryEnvio={lastEnvioVars && enviarBrasil.isError ? handleRetryEnvio : undefined}
              />
            </ResizablePanel>
            </>)}
          </ResizablePanelGroup>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-1 overflow-x-auto rounded-md border border-border bg-card/40 p-1">
            {VALID_FOLDERS.map((f) => (
              <Button
                key={f}
                size="sm"
                variant={folder === f ? "default" : "ghost"}
                className="h-7 shrink-0 text-xs capitalize"
                onClick={() => setFolder(f)}
              >
                {f} {counts[f as keyof typeof counts] ? `(${counts[f as keyof typeof counts]})` : ""}
              </Button>
            ))}
          </div>
          {selectedItem ? (
            <MailboxReadingPane
              item={selectedItem}
              isBrasilUser={isBrasilUser}
              isChinaUser={isChinaUser}
              onView={(it) => setPreviewDoc(it)}
              onCorrigir={handleCorrigir}
              onEnviarBrasil={handleEnviarBrasil}
              onToggleRead={handleToggleRead}
              onToggleStar={handleToggleStar}
              onBack={() => setSelectedId(null)}
              loading={loading}
              error={enviarBrasil.isError ? (enviarBrasil.error as any)?.message ?? t("inbox.blocks.falhaEnviarBrasil") : null}
              onRetryEnvio={lastEnvioVars && enviarBrasil.isError ? handleRetryEnvio : undefined}
            />
          ) : (
            <div className="rounded-md border border-border bg-card/30">
              <MailboxList
                items={items}
                progressItems={progressItems}
                folder={folder}
                selectedId={selectedId}
                selectedIds={selectedIds}
                onSelect={setSelectedId}
                onToggleCheck={onToggleCheck}
                onToggleAllChecks={onToggleAllChecks}
                onToggleStar={handleToggleStar}
                search={search}
                actionFilter={actionFilter}
                onActionFilterChange={setActionFilter}
                viewerOverride={{ isChinaUser, isBrasilUser }}
                groupMode={groupMode}
                onGroupModeChange={setGroupMode}
                onEnviarGrupoBrasil={handleEnviarGrupoBrasil}
                onEnviarItemBrasil={handleEnviarBrasil}
                onOpenSubmissao={(id) => goWithReturn(`/dashboard/fabrica-china/submissao/${id}`)}
              />
            </div>
          )}
        </div>
      )}

      <ChinaDocPreviewDialog
        open={!!previewDoc}
        onOpenChange={(o) => !o && setPreviewDoc(null)}
        arquivoPath={previewDoc?.arquivo_path ?? null}
        arquivoUrl={previewDoc?.arquivo_url ?? null}
        nomeArquivo={previewDoc?.nome_arquivo ?? null}
        tipoDocumento={previewDoc?.tipo_documento ?? undefined}
      />
      <SubmissionCopilotPanel open={copilotOpen} onOpenChange={setCopilotOpen} initialQuery={search} />

      {/* Reading pane como Sheet lateral (modo Kanban) */}
      <Sheet
        open={viewMode === "kanban" && isDesktop && !!selectedItem}
        onOpenChange={(o) => { if (!o) setSelectedId(null); }}
      >
        <SheetContent
          side="right"
          hideClose
          className="w-full sm:max-w-[600px] p-0 flex flex-col"
        >
          {selectedItem && (
            <>
              <div className="flex items-center gap-2 border-b border-border bg-card/40 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[10.5px] tabular-nums text-muted-foreground">
                    {selectedItem.produto_codigo}
                    {selectedItem.submissao_status && (
                      <span className="rounded-sm bg-muted/60 px-1 py-px text-[9.5px] uppercase tracking-wide">
                        {selectedItem.submissao_status}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-sm font-semibold leading-tight">
                    {selectedItem.produto_nome}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  title="Fechar"
                  onClick={() => setSelectedId(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 min-h-0">
                <MailboxReadingPane
                  item={selectedItem}
                  isBrasilUser={isBrasilUser}
                  isChinaUser={isChinaUser}
                  onView={(it) => setPreviewDoc(it)}
                  onCorrigir={handleCorrigir}
                  onEnviarBrasil={handleEnviarBrasil}
                  onToggleRead={handleToggleRead}
                  onToggleStar={handleToggleStar}
                  loading={loading}
                  error={enviarBrasil.isError ? (enviarBrasil.error as any)?.message ?? t("inbox.blocks.falhaEnviarBrasil") : null}
                  onRetryEnvio={lastEnvioVars && enviarBrasil.isError ? handleRetryEnvio : undefined}
                  compact
                  chatDefaultOpen={false}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </ChinaPageShell>
  );
}
