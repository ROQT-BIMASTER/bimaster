import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { buildReturnToTarget } from "@/lib/navigation/withReturnTo";
import { Inbox, RefreshCw, Search, X, Trash2, RotateCcw, Clock, Calculator, History, Sparkles } from "lucide-react";
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
import { ChinaInboxOCAba } from "@/components/china/inbox-oc/ChinaInboxOCAba";
import { SnoozeMenu } from "@/components/china/inbox/SnoozeMenu";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useChinaMailbox, type MailboxFolder, type MailboxItem } from "@/hooks/useChinaMailbox";
import { useToggleInboxRead, useToggleSubmissaoFlag } from "@/hooks/useChinaMailboxActions";
import {
  useTrashSubmissoes,
  useRestoreSubmissoes,
  usePurgeSubmissoes,
} from "@/hooks/useChinaMailboxTrash";


import { useEnviarDocumentoAoBrasil } from "@/hooks/useEnviarDocumentoAoBrasil";
import { useMediaQuery } from "@/hooks/useMediaQuery";

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
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const goWithReturn = (target: string) => {
    const fromPath = `${location.pathname}${location.search}`;
    const { url, state } = buildReturnToTarget(target, fromPath, { fromLabel: "Caixa de Entrada" });
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

  const { items, counts, isLoading, isFetching, refetch } = useChinaMailbox(folder);
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
  const [copilotOpen, setCopilotOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Reset seleção ao trocar pasta
  useEffect(() => {
    setSelectedId(null);
    setSelectedIds(new Set());
  }, [folder]);

  // Auto-seleção em desktop: primeira mensagem
  useEffect(() => {
    if (!isDesktop) return;
    if (selectedId) return;
    if (items.length === 0) return;
    setSelectedId(items[0].documento_id ?? items[0].submissao_id);
  }, [items, isDesktop, selectedId]);

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return items.find((i) => (i.documento_id ?? i.submissao_id) === selectedId) ?? null;
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
      const idx = items.findIndex((i) => (i.documento_id ?? i.submissao_id) === selectedId);
      if (e.key === "j") {
        const next = items[Math.min(items.length - 1, idx + 1)];
        if (next) setSelectedId(next.documento_id ?? next.submissao_id);
      } else if (e.key === "k") {
        const prev = items[Math.max(0, idx - 1)];
        if (prev) setSelectedId(prev.documento_id ?? prev.submissao_id);
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
  const handleCorrigir = (item: MailboxItem) => {
    goWithReturn(`/dashboard/fabrica-china/submissao/${item.submissao_id}`);
  };
  const handleEnviarBrasil = (item: MailboxItem) => {
    enviarBrasil.mutate({
      submissao_id: item.submissao_id,
      ...(item.documento_id ? { documento_id: item.documento_id } : {}),
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

  const subtitle = isBrasilUser
    ? "Documentos da China aguardando sua aprovação."
    : "Central de comando: acompanhe submissões criadas, enviadas e em análise no Brasil.";

  const loading = enviarBrasil.isPending;

  return (
    <ChinaPageShell>
      <ChinaPageHeader
        titlePt="Caixa de Entrada"
        titleCn="收件箱"
        subtitle={subtitle}
        icon={Inbox}
        iconTone="primary"
        actions={
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const { data, error } = await (supabase as any).rpc("rpc_china_normalize_legacy_status");
                  if (error) throw error;
                  const n = Array.isArray(data) ? data.length : 0;
                  await queryClient.invalidateQueries({ queryKey: ["china-mailbox-dataset"] });
                  await refetch();
                  toast.success(
                    n > 0
                      ? `Pendências recalculadas. ${n} submissão(ões) normalizada(s).`
                      : "Pendências recalculadas. Nenhuma normalização necessária.",
                  );
                } catch (e: any) {
                  toast.error("Falha ao recalcular pendências", { description: e?.message });
                }
              }}
              disabled={isFetching}
            >
              <Calculator className="h-4 w-4 mr-1.5" />
              Recalcular pendências
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCopilotOpen(true)}
            >
              <Sparkles className="h-4 w-4 mr-1.5" />
              Copiloto de submissão
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard/fabrica-china/auditoria-normalizacao")}
            >
              <History className="h-4 w-4 mr-1.5" />
              Auditoria
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar / 刷新
            </Button>
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
            placeholder="Buscar produto, OC, arquivo / 搜索 (atalho: /)"
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
            <span className="text-[11px] text-muted-foreground">{selectedIds.size} selecionados</span>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleBulkRead}>
              Marcar como lidos
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
                  Mover para Lixeira
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
                  Restaurar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => {
                    if (!confirm("Excluir definitivamente os itens selecionados? Esta ação não pode ser desfeita.")) return;
                    purge.mutate(Array.from(selectedIds));
                    setSelectedIds(new Set());
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir definitivamente
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
              Limpar
            </Button>
          </div>
        )}
      </div>

      {/* Layout 3 colunas (desktop) ou pilha (mobile) */}
      {isDesktop ? (
        <div className="h-[calc(100vh-220px)] overflow-hidden rounded-md border border-border bg-card/20">
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={18} minSize={14} maxSize={28}>
              <MailboxSidebar
                folder={folder}
                counts={counts}
                onSelect={setFolder}
                onCompose={() => goWithReturn("/dashboard/fabrica-china/nova-submissao")}
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
              />
            </ResizablePanel>
            </>)}
          </ResizablePanelGroup>
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
            />
          ) : (
            <div className="rounded-md border border-border bg-card/30">
              <MailboxList
                items={items}
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
    </ChinaPageShell>
  );
}
