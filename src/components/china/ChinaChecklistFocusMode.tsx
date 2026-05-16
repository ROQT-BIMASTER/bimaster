import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BilingualLabel } from "./BilingualLabel";
import { ChinaUploadPreviewDialog } from "./ChinaUploadPreviewDialog";
import {
  Maximize2, X, Send, Save, Upload, Loader2, CheckCircle2, Clock, XCircle,
  FileText, Eye, Trash2, Image as ImageIcon, CalendarIcon, AlertCircle,
  Plus, FolderPlus, Pencil, Bookmark, BookmarkPlus, FileWarning,
} from "lucide-react";
import { useRevisoesPorSubmissao } from "@/hooks/useChinaRevisoes";
import { DialogContestarDocumento } from "./DialogContestarDocumento";
import { ChecklistGovernancePanel } from "./ChecklistGovernancePanel";
import { useTraduzirTexto } from "@/hooks/useTraduzirTexto";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useDocChecklistTemplates, useSaveDocChecklistTemplate, useDeleteDocChecklistTemplate,
  aplicarTemplateNaSubmissao, useCategoriaOverrides, useUpsertCategoriaOverride,
  type TemplateEstrutura,
} from "@/hooks/useChinaDocChecklistTemplates";
import { CHINA_DOCUMENT_TYPES, DOCUMENT_CATEGORIES, CATEGORIES_CHINA_ENVIA, CATEGORIES_BRASIL_ENVIA, STATUS_LABELS } from "@/lib/china-document-types";
import type { DocumentSlotConfig } from "@/components/china/ChinaDocumentSlot";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { uploadAndGetSignedUrl } from "@/lib/utils/storage-helper";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createElement } from "react";
import { usePageBgColor } from "@/components/shared/PageBgCustomizer";
import { useChinaI18n } from "@/hooks/useChinaI18n";

interface DocRecord {
  id: string;
  tipo_documento: string;
  nome_arquivo: string | null;
  status: string;
  observacao: string | null;
  arquivo_url: string | null;
  arquivo_path: string | null;
  previsao_envio?: string | null;
}

interface ChinaChecklistFocusModeProps {
  submissaoId: string;
  documentos: DocRecord[];
  onUpload: (tipo: string, file: File) => Promise<void>;
  onRefresh: () => void;
  onRemoveFile: (fileId: string) => Promise<void>;
  onViewDoc: (doc: DocRecord) => void;
  /** Abre o dialog automaticamente ao montar e foca o tipo informado. */
  defaultOpen?: boolean;
  /** Tipo de documento alvo para destaque/scroll quando o dialog abre. */
  focusTipo?: string | null;
  /** Callback após o efeito de focus ser aplicado (limpar query param, etc). */
  onAfterFocus?: () => void;
}

const statusIcons: Record<string, React.ReactNode> = {
  planejado: <CalendarIcon className="h-3.5 w-3.5 text-primary" />,
  rascunho: <Save className="h-3.5 w-3.5 text-muted-foreground" />,
  pendente: <Clock className="h-3.5 w-3.5 text-warning" />,
  aprovado: <CheckCircle2 className="h-3.5 w-3.5 text-success" />,
  rejeitado: <XCircle className="h-3.5 w-3.5 text-destructive" />,
};

// Visual border colors per status
const statusBorders: Record<string, string> = {
  aprovado: "border-l-success border-l-4",
  rejeitado: "border-l-destructive border-l-4",
  pendente: "border-l-warning border-l-4",
  rascunho: "border-l-muted-foreground/40 border-l-4 border-dashed",
  planejado: "border-l-primary border-l-4 border-dashed",
};

// Merged category type used internally
interface MergedCategory {
  key: string;
  labelPt: string;
  labelCn: string;
  tipos: string[];
  fluxo: "china_envia" | "brasil_envia";
  isCustom?: boolean;
  customId?: string;
}

// Merged document type used internally
interface MergedDocType {
  tipo: string;
  labelPt: string;
  labelCn: string;
  icon?: React.ReactNode;
  accept?: string;
  multiple?: boolean;
  isCustom?: boolean;
}

export function ChinaChecklistFocusMode({
  submissaoId,
  documentos,
  onUpload,
  onRefresh,
  onRemoveFile,
  onViewDoc,
  defaultOpen,
  focusTipo,
  onAfterFocus,
}: ChinaChecklistFocusModeProps) {
  const { t } = useChinaI18n();
  const [isOpen, setIsOpen] = useState(false);
  const { bgStyle, BgColorButton } = usePageBgColor("china_checklist_focus");
  const [activeCat, setActiveCat] = useState(DOCUMENT_CATEGORIES[0].key);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [uploadingTipo, setUploadingTipo] = useState<string | null>(null);
  const [uploadErrorDialog, setUploadErrorDialog] = useState<{ title: string; message: string; hint?: string } | null>(null);
  const [confirmSingleId, setConfirmSingleId] = useState<string | null>(null);
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const queryClient = useQueryClient();

  // Substituir documento rejeitado com parecer técnico
  const [substituirDoc, setSubstituirDoc] = useState<DocRecord | null>(null);
  const { data: revisoes = [] } = useRevisoesPorSubmissao(submissaoId);
  const ultimaRevisaoPorDoc = useMemo(() => {
    const map = new Map<string, typeof revisoes[number]>();
    for (const r of revisoes) {
      const cur = map.get(r.documento_id);
      if (!cur || new Date(r.created_at) > new Date(cur.created_at)) map.set(r.documento_id, r);
    }
    return map;
  }, [revisoes]);

  // Auto-open + focus on a specific document type (vindo de "Corrigir" da tela de detalhe)
  useEffect(() => {
    if (!defaultOpen) return;
    setIsOpen(true);
    if (focusTipo) {
      const cat = DOCUMENT_CATEGORIES.find((c) => c.tipos.includes(focusTipo));
      if (cat) setActiveCat(cat.key);
    }
  }, [defaultOpen, focusTipo]);

  useEffect(() => {
    if (!isOpen || !focusTipo) return;
    const t = setTimeout(() => {
      const el = document.querySelector(
        `[data-doc-tipo="${focusTipo}"]`,
      ) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-destructive", "ring-offset-2");
        setTimeout(() => {
          el.classList.remove("ring-2", "ring-destructive", "ring-offset-2");
        }, 2800);
      }
      onAfterFocus?.();
    }, 250);
    return () => clearTimeout(t);
  }, [isOpen, focusTipo, activeCat, onAfterFocus]);

  // Preview dialog state
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewTipo, setPreviewTipo] = useState<{ tipo: string; pt: string; cn: string } | null>(null);

  // Add category/item dialogs
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [addCatFluxo, setAddCatFluxo] = useState<"china_envia" | "brasil_envia">("china_envia");
  const [addCatLabelPt, setAddCatLabelPt] = useState("");
  const [addCatLabelCn, setAddCatLabelCn] = useState("");
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemCatKey, setAddItemCatKey] = useState("");
  const [addItemCustomCatId, setAddItemCustomCatId] = useState<string | null>(null);
  const [addItemLabelPt, setAddItemLabelPt] = useState("");
  const [addItemLabelCn, setAddItemLabelCn] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Edit category dialog
  const [editCatOpen, setEditCatOpen] = useState(false);
  const [editCatTarget, setEditCatTarget] = useState<MergedCategory | null>(null);
  const [editCatLabelPt, setEditCatLabelPt] = useState("");
  const [editCatLabelCn, setEditCatLabelCn] = useState("");

  const traduzirLabel = useTraduzirTexto();
  const autoTranslateToCn = useCallback(
    async (textoPt: string, current: string, setter: (v: string) => void) => {
      const t = textoPt.trim();
      if (!t || current.trim()) return;
      try {
        const r = await traduzirLabel.mutateAsync({ texto: t, origem: "pt" });
        const zh = r?.traducoes?.zh;
        if (zh && !current.trim()) setter(zh);
      } catch {
        // erro já notificado em useTraduzirTexto
      }
    },
    [traduzirLabel],
  );

  // Templates
  const [tplSaveOpen, setTplSaveOpen] = useState(false);
  const [tplNome, setTplNome] = useState("");
  const [tplDescricao, setTplDescricao] = useState("");
  const [tplEscopo, setTplEscopo] = useState<"pessoal" | "global">("global");
  const [applyingTpl, setApplyingTpl] = useState(false);

  const { data: templates = [] } = useDocChecklistTemplates();
  const saveTemplate = useSaveDocChecklistTemplate();
  const deleteTemplate = useDeleteDocChecklistTemplate();
  const { data: catOverrides = [] } = useCategoriaOverrides(submissaoId);
  const upsertCatOverride = useUpsertCategoriaOverride();

  const overrideMap = useMemo(
    () => new Map(catOverrides.map((o) => [o.categoria_key, o])),
    [catOverrides],
  );

  // Fetch custom categories
  const { data: customCategories = [] } = useQuery({
    queryKey: ["checklist-custom-cats", submissaoId],
    enabled: !!submissaoId && isOpen,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("china_checklist_custom_categorias" as any)
        .select("*")
        .eq("submissao_id", submissaoId)
        .order("ordem") as any);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Fetch custom items
  const { data: customItems = [] } = useQuery({
    queryKey: ["checklist-custom-items", submissaoId],
    enabled: !!submissaoId && isOpen,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("china_checklist_custom_itens" as any)
        .select("*")
        .eq("submissao_id", submissaoId)
        .order("created_at") as any);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Fetch hidden default items (per submission)
  const { data: hiddenItems = [] } = useQuery({
    queryKey: ["checklist-hidden-items", submissaoId],
    enabled: !!submissaoId && isOpen,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("china_checklist_itens_ocultos" as any)
        .select("tipo_key")
        .eq("submissao_id", submissaoId) as any);
      if (error) throw error;
      return (data || []) as { tipo_key: string }[];
    },
  });
  const hiddenSet = useMemo(() => new Set(hiddenItems.map((h: any) => h.tipo_key)), [hiddenItems]);

  // Merge categories: default + custom
  const allCategories = useMemo(() => {
    const defaultCats: MergedCategory[] = DOCUMENT_CATEGORIES.map(c => ({
      ...c,
      isCustom: false,
    }));
    const customCats: MergedCategory[] = customCategories.map((c: any) => ({
      key: `custom_${c.id}`,
      labelPt: c.label_pt,
      labelCn: c.label_cn || "",
      tipos: customItems.filter((i: any) => i.categoria_custom_id === c.id).map((i: any) => i.tipo_key),
      fluxo: c.fluxo,
      isCustom: true,
      customId: c.id,
    }));
    return [...defaultCats, ...customCats];
  }, [customCategories, customItems]);

  // Merge doc types: default + custom items added to default categories
  const allDocTypes = useMemo(() => {
    const defaults: MergedDocType[] = CHINA_DOCUMENT_TYPES.map(d => ({ ...d, isCustom: false }));
    const customs: MergedDocType[] = customItems.map((i: any) => ({
      tipo: i.tipo_key,
      labelPt: i.label_pt,
      labelCn: i.label_cn || "",
      icon: createElement(FileText, { className: "h-5 w-5 text-muted-foreground" }),
      accept: i.accept || undefined,
      multiple: i.multiple || false,
      isCustom: true,
    }));
    return [...defaults, ...customs];
  }, [customItems]);

  // Add custom items to default categories + apply label overrides
  const enrichedCategories = useMemo(() => {
    return allCategories.map(cat => {
      const ov = overrideMap.get(cat.key);
      const labelPt = ov?.label_pt || cat.labelPt;
      const labelCn = ov?.label_cn ?? cat.labelCn;
      if (cat.isCustom) return { ...cat, labelPt, labelCn };
      const extraItems = customItems
        .filter((i: any) => i.categoria_default_key === cat.key && !i.categoria_custom_id)
        .map((i: any) => i.tipo_key);
      return { ...cat, labelPt, labelCn, tipos: [...cat.tipos, ...extraItems] };
    });
  }, [allCategories, customItems, overrideMap]);

  const visibleCategories = useMemo(
    () => enrichedCategories.filter((c) => !hiddenSet.has(`cat:${c.key}`)),
    [enrichedCategories, hiddenSet],
  );
  const chinaEnviaCats = visibleCategories.filter(c => c.fluxo === "china_envia");
  const brasilEnviaCats = visibleCategories.filter(c => c.fluxo === "brasil_envia");

  // Counters for header
  const counters = useMemo(() => {
    const realDocs = documentos.filter(d => d.status !== "planejado");
    const filledTipos = new Set(realDocs.map(d => d.tipo_documento));
    const allTipos = allDocTypes.length;
    return {
      total: allTipos,
      aprovados: realDocs.filter(d => d.status === "aprovado" || d.status === "ciencia").length,
      enviados: realDocs.filter(d => d.status === "pendente" || d.status === "enviado").length,
      rascunhos: realDocs.filter(d => d.status === "rascunho").length,
      rejeitados: realDocs.filter(d => d.status === "rejeitado").length,
      faltando: allTipos - filledTipos.size,
      comPrevisao: documentos.filter(d => d.previsao_envio).length,
      filled: filledTipos.size,
      progressPct: allTipos > 0 ? Math.round((filledTipos.size / allTipos) * 100) : 0,
    };
  }, [documentos, allDocTypes]);

  const draftDocs = useMemo(() => documentos.filter((d) => d.status === "rascunho"), [documentos]);

  const toggleSelect = useCallback((docId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(docId) ? next.delete(docId) : next.add(docId);
      return next;
    });
  }, []);

  const logSendEvent = async (docs: DocRecord[]) => {
    if (docs.length === 0) return;
    try {
      await supabase.rpc("rpc_china_log_evento" as any, {
        p_kind: "documento_enviado_brasil",
        p_title:
          docs.length === 1
            ? `Documento enviado ao Brasil: ${docs[0].nome_arquivo || docs[0].tipo_documento}`
            : `${docs.length} documentos enviados ao Brasil`,
        p_descricao: docs
          .map((d) => `• ${d.tipo_documento}${d.nome_arquivo ? ` — ${d.nome_arquivo}` : ""}`)
          .join("\n"),
        p_payload: {
          documento_ids: docs.map((d) => d.id),
          tipos: docs.map((d) => d.tipo_documento),
          nomes: docs.map((d) => d.nome_arquivo),
        },
        p_submissao_id: submissaoId,
        p_documento_id: docs.length === 1 ? docs[0].id : null,
      });
    } catch {
      /* não bloquear o envio se o log falhar */
    }
  };

  const submitDocs = async (docs: DocRecord[]) => {
    if (docs.length === 0) return;
    const ids = docs.map((d) => d.id);
    const { error } = await supabase
      .from("china_produto_documentos" as any)
      .update({ status: "pendente" } as any)
      .in("id", ids);
    if (error) throw error;
    const { error: subErr } = await supabase
      .from("china_produto_submissoes" as any)
      .update({ status: "enviado_brasil", data_envio: new Date().toISOString() } as any)
      .eq("id", submissaoId);
    if (subErr) throw subErr;
    await logSendEvent(docs);
  };

  const handleSubmitSelected = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    try {
      const docs = documentos.filter((d) => selected.has(d.id));
      await submitDocs(docs);
      toast.success(`${docs.length} documento(s) enviado(s) ao Brasil! ${docs.length}份文件已发送至巴西！`);
      setSelected(new Set());
      onRefresh();
    } catch {
      toast.error(t("focusMode.errSubmeter"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitAllDrafts = async () => {
    if (draftDocs.length === 0) return;
    setSubmitting(true);
    try {
      await submitDocs(draftDocs);
      toast.success(`${draftDocs.length} rascunho(s) enviado(s) ao Brasil! 已发送至巴西！`);
      setSelected(new Set());
      onRefresh();
    } catch {
      toast.error(t("focusMode.errEnviarRascunhos"));
    } finally {
      setSubmitting(false);
      setConfirmAllOpen(false);
    }
  };

  const handleSubmitSingleConfirmed = async (docId: string) => {
    try {
      const doc = documentos.find((d) => d.id === docId);
      if (!doc) return;
      await submitDocs([doc]);
      toast.success(t("focusMode.okEnviado"));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
      onRefresh();
    } catch {
      toast.error(t("focusMode.errEnviar"));
    } finally {
      setConfirmSingleId(null);
    }
  };

  const handleUploadWithPreview = (tipo: string, file: File) => {
    const config = allDocTypes.find((d) => d.tipo === tipo);
    setPreviewFile(file);
    setPreviewTipo({ tipo, pt: config?.labelPt || tipo, cn: config?.labelCn || "" });
  };

  const describeChecklistUploadError = (err: any): { title: string; message: string; hint?: string } => {
    const raw = (err?.message || err?.error?.message || String(err || "")).toLowerCase();
    if (raw.includes("row-level security") || raw.includes("unauthorized") || raw.includes("permission") || raw.includes("403")) {
      return { title: t("focusMode.errSemPermissaoTitle"), message: t("focusMode.errSemPermissaoMsg"), hint: t("focusMode.errSemPermissaoHint") };
    }
    if (raw.includes("jwt") || raw.includes("expired") || raw.includes("401")) {
      return { title: t("focusMode.errSessaoTitle"), message: t("focusMode.errSessaoMsg"), hint: t("focusMode.errSessaoHint") };
    }
    if (raw.includes("payload too large") || raw.includes("413") || raw.includes("excede o limite")) {
      return { title: t("focusMode.errArquivoGrandeTitle"), message: err?.message || t("focusMode.errArquivoGrandeMsg"), hint: t("focusMode.errArquivoGrandeHint") };
    }
    if (raw.includes("mime") || raw.includes("extens") || raw.includes("magic") || raw.includes("não é permitido") || raw.includes("não corresponde")) {
      return { title: t("focusMode.errArquivoRejeitadoTitle"), message: err?.message || t("focusMode.errArquivoRejeitadoMsg"), hint: t("focusMode.errArquivoRejeitadoHint") };
    }
    if (raw.includes("network") || raw.includes("failed to fetch") || raw.includes("timeout")) {
      return { title: t("focusMode.errConexaoTitle"), message: t("focusMode.errConexaoMsg"), hint: t("focusMode.errConexaoHint") };
    }
    if (raw.includes("bucket") && raw.includes("not found")) {
      return { title: t("focusMode.errRepoTitle"), message: t("focusMode.errRepoMsg"), hint: t("focusMode.errRepoHint") };
    }
    return { title: t("focusMode.errSalvarTitle"), message: err?.message || t("focusMode.errSalvarMsg"), hint: t("focusMode.errSalvarHint") };
  };

  const handleConfirmUpload = async (file: File, status: "rascunho" | "pendente") => {
    if (!previewTipo) return;
    if (!submissaoId) {
      const info = { title: t("focusMode.errSubmissaoTitle"), message: t("focusMode.errSubmissaoMsg"), hint: t("focusMode.errSubmissaoHint") };
      setUploadErrorDialog(info);
      toast.error(info.message);
      return;
    }
    setUploadingTipo(previewTipo.tipo);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const info = { title: t("focusMode.errSessaoTitle"), message: t("focusMode.errSessaoLoginMsg"), hint: undefined as string | undefined };
        setUploadErrorDialog(info);
        toast.error(info.message);
        return;
      }
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${session.user.id}/${submissaoId}/${previewTipo.tipo}/${Date.now()}_${safeName}`;
      const { signedUrl, error: uploadError } = await uploadAndGetSignedUrl("china-documentos", path, file);
      if (uploadError || !signedUrl) {
        logger.error("Checklist upload error:", uploadError);
        const info = describeChecklistUploadError(uploadError);
        setUploadErrorDialog(info);
        toast.error(info.message);
        return;
      }

      const existingPlaceholder = documentos.find(d => d.tipo_documento === previewTipo.tipo && d.status === "planejado");
      const dbResult = existingPlaceholder
        ? await supabase.from("china_produto_documentos" as any).update({
            arquivo_url: signedUrl,
            arquivo_path: path,
            nome_arquivo: file.name,
            status,
          } as any).eq("id", existingPlaceholder.id)
        : await supabase.from("china_produto_documentos" as any).insert({
            submissao_id: submissaoId,
            tipo_documento: previewTipo.tipo,
            arquivo_url: signedUrl,
            arquivo_path: path,
            nome_arquivo: file.name,
            status,
          } as any);

      if (dbResult.error) {
        logger.error("Checklist doc DB error:", dbResult.error);
        const info = describeChecklistUploadError(dbResult.error);
        setUploadErrorDialog(info);
        toast.error(info.message);
        return;
      }

      onRefresh();
      toast.success(status === "rascunho" ? t("focusMode.okRascunho") : t("focusMode.okEnviadoBrasil"));
    } catch (err: any) {
      logger.error("Checklist upload exception:", err);
      const info = describeChecklistUploadError(err);
      setUploadErrorDialog(info);
      toast.error(info.message);
    } finally {
      setUploadingTipo(null);
      setPreviewFile(null);
      setPreviewTipo(null);
    }
  };

  const handleSetPrevisao = async (tipo: string, date: Date | undefined) => {
    if (!date) return;
    const dateStr = format(date, "yyyy-MM-dd");
    // Check if a placeholder already exists
    const existing = documentos.find(d => d.tipo_documento === tipo && (d.status === "planejado" || !d.arquivo_path));
    try {
      if (existing) {
        await supabase.from("china_produto_documentos" as any)
          .update({ previsao_envio: dateStr } as any)
          .eq("id", existing.id);
      } else {
        await supabase.from("china_produto_documentos" as any).insert({
          submissao_id: submissaoId,
          tipo_documento: tipo,
          status: "planejado",
          previsao_envio: dateStr,
        } as any);
      }
      onRefresh();
      toast.success(t("focusMode.okPrevisao"));
    } catch {
      toast.error(t("focusMode.errPrevisao"));
    }
  };

  const handleClearPrevisao = async (docId: string) => {
    try {
      const doc = documentos.find(d => d.id === docId);
      if (doc?.status === "planejado") {
        // Remove the placeholder entirely
        await supabase.from("china_produto_documentos" as any).delete().eq("id", docId);
      } else {
        await supabase.from("china_produto_documentos" as any)
          .update({ previsao_envio: null } as any).eq("id", docId);
      }
      onRefresh();
    } catch {
      toast.error(t("focusMode.errLimparPrevisao"));
    }
  };

  // Active category data
  const activeCatObj = enrichedCategories.find((c) => c.key === activeCat) || enrichedCategories[0];
  const activeCatTypes = allDocTypes.filter((d) => activeCatObj?.tipos.includes(d.tipo) && !hiddenSet.has(d.tipo));

  // Sidebar category stats helper
  const getCatStats = (cat: MergedCategory) => {
    const catDocs = documentos.filter(d => cat.tipos.includes(d.tipo_documento));
    const realDocs = catDocs.filter(d => d.status !== "planejado");
    const catTotal = cat.tipos.length;
    const filledTipos = new Set(realDocs.map(d => d.tipo_documento)).size;
    const aprovados = realDocs.filter(d => d.status === "aprovado" || d.status === "ciencia").length;
    const rejeitados = realDocs.filter(d => d.status === "rejeitado").length;
    const rascunhos = realDocs.filter(d => d.status === "rascunho").length;
    const comPrevisao = catDocs.filter(d => d.previsao_envio).length;
    const pct = catTotal > 0 ? Math.round((filledTipos / catTotal) * 100) : 0;
    return { catTotal, filledTipos, aprovados, rejeitados, rascunhos, comPrevisao, pct };
  };

  // Create category mutation
  const createCategory = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase
        .from("china_checklist_custom_categorias" as any)
        .insert({
          submissao_id: submissaoId,
          label_pt: addCatLabelPt.trim(),
          label_cn: addCatLabelCn.trim(),
          fluxo: addCatFluxo,
          ordem: customCategories.length,
          created_by: user?.id,
        }) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-custom-cats", submissaoId] });
      setAddCatOpen(false);
      setAddCatLabelPt("");
      setAddCatLabelCn("");
      toast.success(t("focusMode.okCategoria"));
    },
  });

  // Create item mutation
  const createItem = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const tipoKey = `custom_${Date.now()}_${addItemLabelPt.trim().toLowerCase().replace(/\s+/g, "_")}`;
      const { error } = await (supabase
        .from("china_checklist_custom_itens" as any)
        .insert({
          submissao_id: submissaoId,
          categoria_custom_id: addItemCustomCatId || null,
          categoria_default_key: addItemCustomCatId ? null : addItemCatKey,
          tipo_key: tipoKey,
          label_pt: addItemLabelPt.trim(),
          label_cn: addItemLabelCn.trim(),
          accept: null,
          multiple: true,
          created_by: user?.id,
        }) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-custom-items", submissaoId] });
      queryClient.invalidateQueries({ queryKey: ["checklist-custom-cats", submissaoId] });
      setAddItemOpen(false);
      setAddItemLabelPt("");
      setAddItemLabelCn("");
      toast.success(t("focusMode.okItemAdicionado"));
    },
  });

  const openAddItem = (catKey: string, customCatId?: string) => {
    setEditingItemId(null);
    setAddItemCatKey(catKey);
    setAddItemCustomCatId(customCatId || null);
    setAddItemLabelPt("");
    setAddItemLabelCn("");
    setAddItemOpen(true);
  };

  const openEditItem = (tipoKey: string) => {
    const item = customItems.find((i: any) => i.tipo_key === tipoKey);
    if (!item) return;
    setEditingItemId(item.id);
    setAddItemLabelPt(item.label_pt || "");
    setAddItemLabelCn(item.label_cn || "");
    setAddItemOpen(true);
  };

  const updateItem = useMutation({
    mutationFn: async () => {
      if (!editingItemId) return;
      const { error } = await (supabase
        .from("china_checklist_custom_itens" as any)
        .update({
          label_pt: addItemLabelPt.trim(),
          label_cn: addItemLabelCn.trim(),
        })
        .eq("id", editingItemId) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-custom-items", submissaoId] });
      setAddItemOpen(false);
      setEditingItemId(null);
      setAddItemLabelPt("");
      setAddItemLabelCn("");
      toast.success(t("focusMode.okItemAtualizado"));
    },
    onError: (e: any) => toast.error(e?.message || t("focusMode.errAtualizarItem")),
  });

  // Delete/hide checklist item (custom => delete row; default => insert hidden row)
  const deleteItem = useMutation({
    mutationFn: async (config: MergedDocType) => {
      // Block deletion if there are real (non-planejado) docs uploaded
      const hasRealDocs = documentos.some(
        (d) => d.tipo_documento === config.tipo && d.status !== "planejado",
      );
      if (hasRealDocs) {
        throw new Error(t("focusMode.errArquivosNoItem"));
      }
      // Cleanup any planejado placeholders for this tipo
      await supabase
        .from("china_produto_documentos" as any)
        .delete()
        .eq("submissao_id", submissaoId)
        .eq("tipo_documento", config.tipo)
        .eq("status", "planejado");

      if (config.isCustom) {
        const item = customItems.find((i: any) => i.tipo_key === config.tipo);
        if (!item) return;
        const { error } = await (supabase
          .from("china_checklist_custom_itens" as any)
          .delete()
          .eq("id", item.id) as any);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await (supabase
          .from("china_checklist_itens_ocultos" as any)
          .insert({
            submissao_id: submissaoId,
            tipo_key: config.tipo,
            hidden_by: user?.id,
          }) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-custom-items", submissaoId] });
      queryClient.invalidateQueries({ queryKey: ["checklist-hidden-items", submissaoId] });
      onRefresh();
      toast.success(t("focusMode.okCardRemovido"));
    },
    onError: (e: any) => toast.error(e?.message || t("focusMode.errExcluirCard")),
  });

  const handleDeleteCard = async (config: MergedDocType) => {
    const { confirmExclusaoTarefa } = await import("@/lib/projetos/confirmConclusao");
    const ok = await confirmExclusaoTarefa({
      tituloDialog: "Excluir card do checklist?",
      acaoLabel: "Sim, excluir",
      descricao:
        `Você está prestes a remover o card "${config.labelPt}" deste checklist da submissão China. ` +
        `Itens com arquivos enviados precisam ter os arquivos removidos primeiro. Esta ação afeta apenas esta submissão.`,
    });
    if (!ok) return;
    deleteItem.mutate(config);
  };

  // Delete/hide category (custom => delete row + cascade items; default => insert hidden row with cat: prefix)
  const deleteCategory = useMutation({
    mutationFn: async (cat: MergedCategory) => {
      // Block if any item in this category has real docs
      const hasRealDocs = documentos.some(
        (d) => cat.tipos.includes(d.tipo_documento) && d.status !== "planejado",
      );
      if (hasRealDocs) {
        throw new Error(t("focusMode.errArquivosNaCategoria"));
      }
      // Cleanup planejado placeholders for tipos in this category
      if (cat.tipos.length > 0) {
        await supabase
          .from("china_produto_documentos" as any)
          .delete()
          .eq("submissao_id", submissaoId)
          .in("tipo_documento", cat.tipos)
          .eq("status", "planejado");
      }
      if (cat.isCustom && cat.customId) {
        const { error } = await (supabase
          .from("china_checklist_custom_categorias" as any)
          .delete()
          .eq("id", cat.customId) as any);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await (supabase
          .from("china_checklist_itens_ocultos" as any)
          .insert({
            submissao_id: submissaoId,
            tipo_key: `cat:${cat.key}`,
            hidden_by: user?.id,
          }) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-custom-cats", submissaoId] });
      queryClient.invalidateQueries({ queryKey: ["checklist-custom-items", submissaoId] });
      queryClient.invalidateQueries({ queryKey: ["checklist-hidden-items", submissaoId] });
      onRefresh();
      // Reset to first visible category
      setActiveCat(DOCUMENT_CATEGORIES[0].key);
      toast.success(t("focusMode.okCategoriaRemovida"));
    },
    onError: (e: any) => toast.error(e?.message || t("focusMode.errExcluirCategoria")),
  });

  const handleDeleteCategory = async (e: React.MouseEvent, cat: MergedCategory) => {
    e.stopPropagation();
    const { confirmExclusaoTarefa } = await import("@/lib/projetos/confirmConclusao");
    const ok = await confirmExclusaoTarefa({
      tituloDialog: "Excluir categoria do checklist?",
      acaoLabel: "Sim, excluir",
      descricao:
        `Você está prestes a remover a categoria "${cat.labelPt}" e todos os cards vinculados deste checklist da submissão China. ` +
        `Categorias com arquivos enviados precisam ter os arquivos removidos primeiro.`,
    });
    if (!ok) return;
    deleteCategory.mutate(cat);
  };

  const openAddCategory = (fluxo: "china_envia" | "brasil_envia") => {
    setAddCatFluxo(fluxo);
    setAddCatLabelPt("");
    setAddCatLabelCn("");
    setAddCatOpen(true);
  };

  const openEditCategory = (e: React.MouseEvent, cat: MergedCategory) => {
    e.stopPropagation();
    setEditCatTarget(cat);
    setEditCatLabelPt(cat.labelPt);
    setEditCatLabelCn(cat.labelCn || "");
    setEditCatOpen(true);
  };

  const saveEditCategory = useMutation({
    mutationFn: async () => {
      if (!editCatTarget) return;
      const labelPt = editCatLabelPt.trim();
      const labelCn = editCatLabelCn.trim();
      if (!labelPt) throw new Error(t("focusMode.errNomeObrigatorio"));
      if (editCatTarget.isCustom && editCatTarget.customId) {
        const { error } = await (supabase as any)
          .from("china_checklist_custom_categorias")
          .update({ label_pt: labelPt, label_cn: labelCn })
          .eq("id", editCatTarget.customId);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["checklist-custom-cats", submissaoId] });
      } else {
        await upsertCatOverride.mutateAsync({
          submissaoId,
          categoriaKey: editCatTarget.key,
          labelPt,
          labelCn,
        });
      }
    },
    onSuccess: () => {
      setEditCatOpen(false);
      setEditCatTarget(null);
    },
    onError: (e: any) => toast.error(e?.message || t("focusMode.errSalvar")),
  });

  // Build template snapshot from current state
  const buildEstruturaSnapshot = (): TemplateEstrutura => {
    const categorias = enrichedCategories.map((c, idx) => ({
      key: c.key,
      label_pt: c.labelPt,
      label_cn: c.labelCn || "",
      fluxo: c.fluxo,
      ordem: idx,
      custom: !!c.isCustom,
    }));
    const itens = allDocTypes
      .filter((d) => !hiddenSet.has(d.tipo))
      .map((d) => {
        const cat = enrichedCategories.find((c) => c.tipos.includes(d.tipo));
        return {
          tipo_key: d.tipo,
          label_pt: d.labelPt,
          label_cn: d.labelCn || "",
          categoria_key: cat?.key || "",
          custom: !!d.isCustom,
          accept: d.accept || null,
          multiple: d.multiple ?? false,
        };
      })
      .filter((i) => i.categoria_key);
    const ocultos = Array.from(hiddenSet) as string[];
    const overrides_categoria = catOverrides.map((o) => ({
      categoria_key: o.categoria_key,
      label_pt: o.label_pt,
      label_cn: o.label_cn || "",
    }));
    return { categorias, itens, ocultos, overrides_categoria };
  };

  const handleSaveTemplate = async () => {
    if (!tplNome.trim()) return;
    await saveTemplate.mutateAsync({
      nome: tplNome.trim(),
      descricao: tplDescricao.trim() || undefined,
      escopo: tplEscopo,
      estrutura: buildEstruturaSnapshot(),
    });
    setTplSaveOpen(false);
    setTplNome("");
    setTplDescricao("");
  };

  const handleApplyTemplate = async (tpl: { id: string; nome: string; estrutura: TemplateEstrutura }) => {
    if (!confirm(`Aplicar o modelo "${tpl.nome}"?\n\nA estrutura atual será SUBSTITUÍDA pela do modelo. Categorias e itens que já têm documentos anexados (ex.: planilha inicial) serão preservados. Arquivos enviados nunca são apagados.`)) return;
    setApplyingTpl(true);
    try {
      await aplicarTemplateNaSubmissao(submissaoId, tpl.estrutura);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["checklist-custom-cats", submissaoId] }),
        queryClient.invalidateQueries({ queryKey: ["checklist-custom-items", submissaoId] }),
        queryClient.invalidateQueries({ queryKey: ["checklist-hidden-items", submissaoId] }),
        queryClient.invalidateQueries({ queryKey: ["china-cat-overrides", submissaoId] }),
        queryClient.invalidateQueries({ queryKey: ["checklist-item-estado", submissaoId] }),
        queryClient.invalidateQueries({ queryKey: ["checklist-progresso", submissaoId] }),
      ]);
      onRefresh();
      toast.success(`Modelo "${tpl.nome}" aplicado`);
    } catch (e: any) {
      toast.error(e?.message || t("focusMode.errAplicarModelo"));
    } finally {
      setApplyingTpl(false);
    }
  };


  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)} className="gap-2">
        <Maximize2 className="h-4 w-4" />
        Modo Foco 聚焦模式
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className="max-w-[98vw] w-[98vw] h-[95vh] max-h-[95vh] p-0 overflow-hidden flex flex-col"
          style={bgStyle}
        >
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b bg-background/80 backdrop-blur shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold">Checklist de Documentos 文件清单</DialogTitle>
                <div className="flex items-center gap-3 mt-1.5">
                  <Progress value={counters.progressPct} gradient className="h-2 w-40" />
                  <span className="text-xs font-medium text-foreground">{counters.filled}/{counters.total} · {counters.progressPct}%</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selected.size > 0 && (
                  <Button variant="gradient" size="sm" disabled={submitting} onClick={handleSubmitSelected} className="gap-2">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Submeter {selected.size} ao Brasil
                  </Button>
                )}
                {draftDocs.length > 0 && selected.size === 0 && (
                  <Button
                    variant="gradient"
                    size="sm"
                    disabled={submitting}
                    onClick={() => setConfirmAllOpen(true)}
                    className="gap-2"
                    title={t("focusMode.tooltipEnviarTodos")}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Enviar {draftDocs.length} rascunho(s) ao Brasil
                  </Button>
                )}
                {/* Templates menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5" disabled={applyingTpl}>
                      {applyingTpl ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bookmark className="h-3.5 w-3.5" />}
                      Modelos
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[320px] max-h-[400px] overflow-y-auto">
                    <DropdownMenuLabel>{t("focusMode.modelosTitulo")}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {templates.length === 0 && (
                      <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                        {t("focusMode.nenhumModelo")}
                      </div>
                    )}
                    {templates.map((tpl) => (
                      <DropdownMenuItem
                        key={tpl.id}
                        onSelect={(e) => e.preventDefault()}
                        className="flex items-start justify-between gap-2 py-2"
                      >
                        <button
                          className="flex-1 text-left"
                          onClick={() => handleApplyTemplate(tpl)}
                        >
                          <div className="font-medium text-sm">{tpl.nome}</div>
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            <Badge variant={tpl.escopo === "global" ? "secondary" : "outline"} className="text-[10px] h-4">
                              {tpl.escopo === "global" ? t("focusMode.escopoGlobal") : t("focusMode.escopoPessoal")}
                            </Badge>
                            {tpl.descricao && (
                              <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                                {tpl.descricao}
                              </span>
                            )}
                          </div>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(t("focusMode.confirmExcluirModelo", { nome: tpl.nome }))) deleteTemplate.mutate(tpl.id);
                          }}
                          className="text-destructive hover:text-destructive/70 shrink-0"
                          title={t("focusMode.tooltipExcluirModelo")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setTplSaveOpen(true)} className="gap-2">
                      <BookmarkPlus className="h-3.5 w-3.5 text-primary" />
                      <span className="text-sm">{t("focusMode.salvarComoModelo")}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <BgColorButton />
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {/* Counter chips */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <CounterChip icon={<CheckCircle2 className="h-3 w-3" />} label={t("focusMode.labelAprovados")} value={counters.aprovados} colorClass="text-success bg-success/10" />
              <CounterChip icon={<Clock className="h-3 w-3" />} label={t("focusMode.labelEnviados")} value={counters.enviados} colorClass="text-warning bg-warning/10" />
              <CounterChip icon={<Save className="h-3 w-3" />} label={t("focusMode.labelRascunhos")} value={counters.rascunhos} colorClass="text-muted-foreground bg-muted" />
              <CounterChip icon={<XCircle className="h-3 w-3" />} label={t("focusMode.labelRejeitados")} value={counters.rejeitados} colorClass="text-destructive bg-destructive/10" />
              <CounterChip icon={<Upload className="h-3 w-3" />} label={t("focusMode.labelFaltando")} value={counters.faltando} colorClass="text-foreground bg-secondary" />
              {counters.comPrevisao > 0 && (
                <CounterChip icon={<CalendarIcon className="h-3 w-3" />} label={t("focusMode.labelComPrevisao")} value={counters.comPrevisao} colorClass="text-primary bg-primary/10" />
              )}
            </div>
            <div className="mt-3">
              <ChecklistGovernancePanel submissaoId={submissaoId} />
            </div>
          </DialogHeader>

          {/* Body: Sidebar + Main */}
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <div className="w-72 border-r bg-muted/20 flex flex-col shrink-0 min-w-0">
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {[
                    { categories: chinaEnviaCats, fluxo: "china_envia" as const, headerPt: t("focusMode.headerChinaEnvia"), headerCn: t("focusMode.headerChinaEnvia"), icon: <ArrowUpRight className="h-3.5 w-3.5" />, color: "text-primary" },
                    { categories: brasilEnviaCats, fluxo: "brasil_envia" as const, headerPt: t("focusMode.headerBrasilEnvia"), headerCn: t("focusMode.headerBrasilEnvia"), icon: <ArrowDownLeft className="h-3.5 w-3.5" />, color: "text-success" },
                  ].map(({ categories, fluxo, headerPt, headerCn, icon, color }, idx) => (
                    <div key={headerPt}>
                      {idx > 0 && <div className="my-2 border-t border-border" />}
                      <div className={cn("flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wide", color)}>
                        {icon}
                        <span>{headerPt}</span>
                        <span className="font-normal opacity-60">{headerCn}</span>
                        <button
                          onClick={() => openAddCategory(fluxo)}
                          className="ml-auto p-0.5 rounded hover:bg-accent/50 transition-colors"
                          title={t("focusMode.tooltipNovaCategoria")}
                        >
                          <FolderPlus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {categories.map((cat) => {
                        const stats = getCatStats(cat);
                        const isActive = activeCat === cat.key;

                        return (
                          <div key={cat.key} className="relative group">
                            <div className="absolute top-1.5 right-1.5 z-10 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={(e) => openEditCategory(e, cat)}
                                className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10"
                                title={t("focusMode.tooltipEditarCategoria")}
                                aria-label={`Editar categoria ${cat.labelPt}`}
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteCategory(e, cat)}
                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                title={t("focusMode.tooltipExcluirCategoria")}
                                aria-label={`Excluir categoria ${cat.labelPt}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                            <button
                              onClick={() => setActiveCat(cat.key)}
                              className={cn(
                                "w-full text-left rounded-lg px-3 py-2.5 transition-all text-xs",
                                isActive
                                  ? "bg-primary/10 border border-primary/30 text-primary font-semibold"
                                  : "hover:bg-accent/50 text-foreground"
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <span className="truncate flex items-center gap-1">
                                  {cat.isCustom && <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5">{t("focusMode.custom")}</Badge>}
                                  {cat.labelPt}
                                </span>
                                <span className={cn(
                                  "text-[10px] font-medium",
                                  stats.filledTipos === stats.catTotal && stats.catTotal > 0 ? "text-success" : "text-muted-foreground"
                                )}>
                                  {stats.filledTipos}/{stats.catTotal}
                                </span>
                              </div>
                              <span className="text-[10px] text-muted-foreground block">{cat.labelCn}</span>
                              {/* Mini progress bar */}
                              <div className="mt-1.5 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all duration-500",
                                    stats.rejeitados > 0 ? "bg-destructive" :
                                    stats.filledTipos === stats.catTotal && stats.catTotal > 0 ? "bg-success" :
                                    "bg-primary"
                                  )}
                                  style={{ width: `${stats.pct}%` }}
                                />
                              </div>
                              {/* Indicators */}
                              <div className="flex gap-1 mt-1">
                                {stats.rejeitados > 0 && <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">{stats.rejeitados}✗</Badge>}
                                {stats.rascunhos > 0 && <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">{stats.rascunhos}📝</Badge>}
                                {stats.comPrevisao > 0 && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] text-primary">
                                    <CalendarIcon className="h-2.5 w-2.5" />{stats.comPrevisao}
                                  </span>
                                )}
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {draftDocs.length > 0 && (
                <div className="p-3 border-t bg-muted/30">
                  <p className="text-[10px] text-muted-foreground text-center">
                    {draftDocs.length} rascunho(s) total
                  </p>
                </div>
              )}
            </div>

            {/* Main area: cards grid */}
            <ScrollArea className="flex-1">
              <div className="p-6">
                <BilingualLabel pt={activeCatObj.labelPt} cn={activeCatObj.labelCn} size="lg" className="mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-min items-start">
                  {activeCatTypes.map((config) => {
                    const typeDocs = documentos.filter((d) => d.tipo_documento === config.tipo);
                    const realDocs = typeDocs.filter(d => d.status !== "planejado");
                    const isUploading = uploadingTipo === config.tipo;
                    const hasImage = config.accept?.includes("image");

                    // Determine card visual state
                    const hasRejected = realDocs.some(d => d.status === "rejeitado");
                    const allApproved = realDocs.length > 0 && realDocs.every(d => d.status === "aprovado" || d.status === "ciencia");
                    const hasPending = realDocs.some(d => d.status === "pendente");
                    const hasDraft = realDocs.some(d => d.status === "rascunho");
                    const isEmpty = realDocs.length === 0;

                    const cardBorder = hasRejected ? statusBorders.rejeitado
                      : allApproved ? statusBorders.aprovado
                      : hasPending ? statusBorders.pendente
                      : hasDraft ? statusBorders.rascunho
                      : isEmpty && typeDocs.some(d => d.status === "planejado") ? statusBorders.planejado
                      : "";

                    // Previsão
                    const previsaoDoc = typeDocs.find(d => d.previsao_envio);
                    const previsaoDate = previsaoDoc?.previsao_envio ? new Date(previsaoDoc.previsao_envio + "T12:00:00") : undefined;
                    const isOverdue = previsaoDate && previsaoDate < new Date() && isEmpty;

                    return (
                      <div
                        key={config.tipo}
                        data-doc-tipo={config.tipo}
                        className={cn(
                          "border rounded-xl bg-card p-4 space-y-3 transition-all",
                          cardBorder,
                          isEmpty && !typeDocs.some(d => d.status === "planejado") && "border-dashed border-muted-foreground/30 bg-muted/5",
                        )}
                      >
                        {/* Card header */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                              allApproved ? "bg-success/10" : hasRejected ? "bg-destructive/10" : "bg-secondary"
                            )}>
                              {config.icon || <FileText className="h-5 w-5 text-muted-foreground" />}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-semibold text-foreground truncate">{config.labelPt}</p>
                                {config.isCustom && (
                                  <button
                                    type="button"
                                    onClick={() => openEditItem(config.tipo)}
                                    className="p-0.5 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground shrink-0"
                                    title={t("focusMode.tooltipEditarItem")}
                                    aria-label={`Editar descrição de ${config.labelPt}`}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{config.labelCn}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Previsão badge */}
                            {previsaoDate && (
                              <Badge
                                variant={isOverdue ? "destructive" : "default"}
                                className="text-[9px] px-1.5 py-0 h-5 gap-1 cursor-pointer"
                                onClick={() => previsaoDoc && handleClearPrevisao(previsaoDoc.id)}
                                title={t("focusMode.tooltipRemoverPrevisao")}
                              >
                                <CalendarIcon className="h-2.5 w-2.5" />
                                {format(previsaoDate, "dd/MM", { locale: ptBR })}
                                {isOverdue && <AlertCircle className="h-2.5 w-2.5" />}
                              </Badge>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1"
                              disabled={isUploading}
                              onClick={() => fileInputRefs.current[config.tipo]?.click()}
                            >
                              {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                              Upload
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              title={t("focusMode.tooltipExcluirCard")}
                              aria-label={`Excluir card ${config.labelPt}`}
                              disabled={deleteItem.isPending}
                              onClick={() => handleDeleteCard(config)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <input
                            ref={(el) => { fileInputRefs.current[config.tipo] = el; }}
                            type="file"
                            className="hidden"
                            accept={[
                              config.accept || "",
                              ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.odt,.ods,.odp,image/*",
                            ].filter(Boolean).join(",")}
                            multiple={config.multiple}
                            onChange={(e) => {
                              const files = e.target.files;
                              if (files) {
                                for (const f of Array.from(files)) {
                                  handleUploadWithPreview(config.tipo, f);
                                }
                              }
                              e.target.value = "";
                            }}
                          />
                        </div>

                        {/* Files list */}
                        {realDocs.length > 0 ? (
                          <div className="space-y-1.5">
                            {realDocs.map((d) => {
                              const label = STATUS_LABELS[d.status] || STATUS_LABELS.rascunho;
                              const isDraft = d.status === "rascunho";
                              const isImg = hasImage && d.arquivo_url;

                              return (
                                <div
                                  key={d.id}
                                  className={cn(
                                    "flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-all",
                                    isDraft ? "bg-muted/50 border border-dashed" : "bg-secondary/30"
                                  )}
                                >
                                  {isDraft && (
                                    <Checkbox
                                      checked={selected.has(d.id)}
                                      onCheckedChange={() => toggleSelect(d.id)}
                                      className="shrink-0"
                                    />
                                  )}

                                  {isImg ? (
                                    <div className="h-8 w-8 rounded bg-muted overflow-hidden shrink-0">
                                      <img src={d.arquivo_url!} alt="" className="h-full w-full object-cover" />
                                    </div>
                                  ) : (
                                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                  )}

                                  <span className="truncate flex-1 text-foreground">{d.nome_arquivo || "doc"}</span>

                                  <div className="flex items-center gap-1 shrink-0">
                                    {statusIcons[d.status]}
                                    {isDraft ? (
                                      <Badge variant="warning" className="text-[9px] px-1.5 py-0 h-4 whitespace-nowrap">
                                        Não enviado ao Brasil 未发送
                                      </Badge>
                                    ) : (
                                      <Badge variant={label.variant} className="text-[9px] px-1.5 py-0 h-4">
                                        {label.pt}
                                      </Badge>
                                    )}
                                  </div>

                                  <div className="flex gap-0.5 shrink-0">
                                    <button onClick={() => onViewDoc(d)} className="p-1 rounded hover:bg-accent/50" title={t("focusMode.tooltipVisualizar")}>
                                      <Eye className="h-3.5 w-3.5 text-primary" />
                                    </button>
                                    {isDraft && (
                                      <Button
                                        size="sm"
                                        variant="gradient"
                                        className="h-6 px-2 text-[10px] gap-1"
                                        onClick={() => setConfirmSingleId(d.id)}
                                        title={t("focusMode.tooltipEnviarDoc")}
                                      >
                                        <Send className="h-3 w-3" />
                                        Enviar ao Brasil
                                      </Button>
                                    )}
                                    {d.status === "rejeitado" ? (
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        className="h-6 px-2 text-[10px] gap-1"
                                        onClick={() => setSubstituirDoc(d)}
                                        title={t("focusMode.tooltipSubstituir")}
                                      >
                                        <FileWarning className="h-3 w-3" />
                                        Corrigir / Parecer
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 px-2 text-[10px] gap-1"
                                        onClick={() => setSubstituirDoc(d)}
                                        title={t("focusMode.tooltipAnexarParecer")}
                                      >
                                        <FileWarning className="h-3 w-3" />
                                        Parecer / Anexos
                                      </Button>
                                    )}
                                    {d.status !== "aprovado" && d.status !== "rejeitado" && (
                                      <button onClick={() => onRemoveFile(d.id)} className="p-1 rounded hover:bg-destructive/10" title={t("focusMode.tooltipRemover")}>
                                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-5 text-muted-foreground">
                            <Upload className="h-7 w-7 mb-2 opacity-20" />
                            <p className="text-xs">Nenhum arquivo 无文件</p>
                            <p className="text-[10px] mb-2">Arraste ou clique em Upload</p>
                            {/* Previsão de envio inline datepicker */}
                            {!previsaoDate && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-[10px] h-6 gap-1 text-primary hover:text-primary">
                                    <CalendarIcon className="h-3 w-3" />
                                    Definir previsão de envio
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="center">
                                  <Calendar
                                    mode="single"
                                    selected={undefined}
                                    onSelect={(date) => date && handleSetPrevisao(config.tipo, date)}
                                    disabled={(date) => date < new Date()}
                                    initialFocus
                                    className="p-3 pointer-events-auto"
                                  />
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        )}

                        {/* Observation */}
                        {typeDocs.find((d) => d.observacao) && (
                          <p className="text-[10px] text-destructive bg-destructive/5 rounded px-2 py-1">
                            ⚠ {typeDocs.find((d) => d.observacao)?.observacao}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add new item button */}
                {activeCatObj && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 gap-1.5 text-xs border-dashed"
                    onClick={() => openAddItem(activeCatObj.key, activeCatObj.isCustom ? activeCatObj.customId : undefined)}
                  >
                    <Plus className="h-3.5 w-3.5" /> Novo item em "{activeCatObj.labelPt}"
                  </Button>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Footer */}
          {selected.size > 0 && (
            <div className="px-6 py-3 border-t bg-primary/5 shrink-0 flex items-center justify-between">
              <span className="text-sm text-foreground">
                <strong>{selected.size}</strong> documento(s) selecionado(s) para submissão
              </span>
              <Button variant="gradient" size="sm" disabled={submitting} onClick={handleSubmitSelected} className="gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submeter ao Brasil 提交至巴西
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload Preview Dialog */}
      <ChinaUploadPreviewDialog
        file={previewFile}
        tipoLabel={{ pt: previewTipo?.pt || "", cn: previewTipo?.cn || "" }}
        open={!!previewFile}
        onClose={() => { setPreviewFile(null); setPreviewTipo(null); }}
        onConfirm={handleConfirmUpload}
      />

      {/* Add Category Dialog */}
      <Dialog open={addCatOpen} onOpenChange={setAddCatOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-primary" />
              Nova Categoria de Checklist
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">{t("focusMode.labelNomePt")}</Label>
              <Input
                value={addCatLabelPt}
                onChange={(e) => setAddCatLabelPt(e.target.value)}
                onBlur={(e) => autoTranslateToCn(e.target.value, addCatLabelCn, setAddCatLabelCn)}
                placeholder={t("focusMode.phCategoriaPt")}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1">{t("focusMode.labelNomeCn")} {traduzirLabel.isPending ? <span className="text-[10px] text-muted-foreground">{t("focusMode.autoTraduzindo")}</span> : <span className="text-muted-foreground">— {t("focusMode.autoTrad")}</span>}</Label>
              <Input
                value={addCatLabelCn}
                onChange={(e) => setAddCatLabelCn(e.target.value)}
                placeholder={t("focusMode.phCategoriaCn")}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Badge
                variant={addCatFluxo === "china_envia" ? "default" : "secondary"}
                className="cursor-pointer"
                onClick={() => setAddCatFluxo("china_envia")}
              >
                {t("focusMode.btnChinaEnvia")}
              </Badge>
              <Badge
                variant={addCatFluxo === "brasil_envia" ? "default" : "secondary"}
                className="cursor-pointer"
                onClick={() => setAddCatFluxo("brasil_envia")}
              >
                {t("focusMode.btnBrasilEnvia")}
              </Badge>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddCatOpen(false)}>{t("focusMode.cancelar")}</Button>
            <Button
              onClick={() => createCategory.mutate()}
              disabled={!addCatLabelPt.trim() || createCategory.isPending}
            >
              {createCategory.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FolderPlus className="h-4 w-4 mr-1" />}
              {t("focusMode.btnCriarCategoria")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Item Dialog */}
      <Dialog open={addItemOpen} onOpenChange={(o) => { setAddItemOpen(o); if (!o) setEditingItemId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingItemId ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
              {editingItemId ? t("focusMode.dialogEditarItem") : t("focusMode.dialogNovoItem")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">{t("focusMode.labelNomeItemPt")}</Label>
              <Input
                value={addItemLabelPt}
                onChange={(e) => setAddItemLabelPt(e.target.value)}
                onBlur={(e) => autoTranslateToCn(e.target.value, addItemLabelCn, setAddItemLabelCn)}
                placeholder={t("focusMode.phItemPt")}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1">Nome (Chinês) {traduzirLabel.isPending ? <span className="text-[10px] text-muted-foreground">traduzindo…</span> : <span className="text-muted-foreground">— auto-tradução</span>}</Label>
              <Input
                value={addItemLabelCn}
                onChange={(e) => setAddItemLabelCn(e.target.value)}
                placeholder={t("focusMode.phItemCn")}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setAddItemOpen(false); setEditingItemId(null); }}>{t("focusMode.cancelar")}</Button>
            <Button
              onClick={() => (editingItemId ? updateItem.mutate() : createItem.mutate())}
              disabled={!addItemLabelPt.trim() || createItem.isPending || updateItem.isPending}
            >
              {(createItem.isPending || updateItem.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : editingItemId ? (
                <Pencil className="h-4 w-4 mr-1" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              {editingItemId ? t("focusMode.btnSalvar") : t("focusMode.btnAdicionarItem")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={editCatOpen} onOpenChange={(o) => { setEditCatOpen(o); if (!o) setEditCatTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              {t("focusMode.dialogEditarCategoria")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Nome (Português)</Label>
              <Input
                value={editCatLabelPt}
                onChange={(e) => setEditCatLabelPt(e.target.value)}
                onBlur={(e) => autoTranslateToCn(e.target.value, editCatLabelCn, setEditCatLabelCn)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1">Nome (Chinês) {traduzirLabel.isPending ? <span className="text-[10px] text-muted-foreground">traduzindo…</span> : <span className="text-muted-foreground">— auto-tradução</span>}</Label>
              <Input
                value={editCatLabelCn}
                onChange={(e) => setEditCatLabelCn(e.target.value)}
                className="mt-1"
              />
            </div>
            {editCatTarget && !editCatTarget.isCustom && (
              <p className="text-[10px] text-muted-foreground">
                {t("focusMode.categoriaPadrao")}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditCatOpen(false)}>{t("focusMode.cancelar")}</Button>
            <Button
              onClick={() => saveEditCategory.mutate()}
              disabled={!editCatLabelPt.trim() || saveEditCategory.isPending}
            >
              {saveEditCategory.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              {t("focusMode.btnSalvar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Template Dialog */}
      <Dialog open={tplSaveOpen} onOpenChange={setTplSaveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookmarkPlus className="h-5 w-5 text-primary" />
              {t("focusMode.dialogSalvarModelo")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">{t("focusMode.labelNomeModelo")}</Label>
              <Input
                value={tplNome}
                onChange={(e) => setTplNome(e.target.value)}
                placeholder={t("focusMode.phNomeModelo")}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">{t("focusMode.labelDescricaoModelo")}</Label>
              <Input
                value={tplDescricao}
                onChange={(e) => setTplDescricao(e.target.value)}
                placeholder={t("focusMode.phDescricaoModelo")}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">{t("focusMode.visibilidade")}</Label>
              <div className="flex gap-2 mt-1">
                <Badge
                  variant={tplEscopo === "global" ? "default" : "secondary"}
                  className="cursor-pointer"
                  onClick={() => setTplEscopo("global")}
                >
                  {t("focusMode.btnGlobalTodos")}
                </Badge>
                <Badge
                  variant={tplEscopo === "pessoal" ? "default" : "secondary"}
                  className="cursor-pointer"
                  onClick={() => setTplEscopo("pessoal")}
                >
                  {t("focusMode.btnPessoalSoVoce")}
                </Badge>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {t("focusMode.infoModelo")}
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTplSaveOpen(false)}>{t("focusMode.cancelar")}</Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={!tplNome.trim() || saveTemplate.isPending}
            >
              {saveTemplate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <BookmarkPlus className="h-4 w-4 mr-1" />}
              {t("focusMode.btnSalvarModeloAcao")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {substituirDoc && (
        <DialogContestarDocumento
          open={!!substituirDoc}
          onOpenChange={(o) => !o && setSubstituirDoc(null)}
          documentoId={substituirDoc.id}
          submissaoId={submissaoId}
          tipoDocumento={substituirDoc.tipo_documento}
          tipoDocumentoLabel={
            allDocTypes.find((t) => t.tipo === substituirDoc.tipo_documento)?.labelPt
          }
          laudoRevisao={ultimaRevisaoPorDoc.get(substituirDoc.id) || null}
          onSucesso={() => {
            setSubstituirDoc(null);
            onRefresh();
          }}
        />
      )}

      {/* Confirmação: envio individual ao Brasil */}
      <AlertDialog open={!!confirmSingleId} onOpenChange={(o) => !o && setConfirmSingleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar documento ao Brasil? 发送至巴西？</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const d = documentos.find((x) => x.id === confirmSingleId);
                if (!d) return null;
                return (
                  <>
                    O arquivo <strong className="text-foreground">{d.nome_arquivo || d.tipo_documento}</strong> será marcado como pendente de revisão pelo Brasil. O envio será registrado no histórico (usuário e data).
                  </>
                );
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar 取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirmSingleId) handleSubmitSingleConfirmed(confirmSingleId);
              }}
            >
              Enviar ao Brasil 发送
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação: envio em lote de todos os rascunhos */}
      <AlertDialog open={confirmAllOpen} onOpenChange={setConfirmAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Enviar {draftDocs.length} rascunho(s) ao Brasil? 发送所有草稿？
            </AlertDialogTitle>
            <AlertDialogDescription>
              Todos os documentos atualmente em rascunho serão promovidos para "pendente" e ficarão disponíveis para revisão do Brasil. Cada envio será registrado no histórico com seu usuário e data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar 取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleSubmitAllDrafts();
              }}
            >
              Enviar todos 全部发送
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!uploadErrorDialog} onOpenChange={(o) => !o && setUploadErrorDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              {uploadErrorDialog?.title || t("focusMode.fallbackUploadFalha")}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">{uploadErrorDialog?.message}</span>
              {uploadErrorDialog?.hint && (
                <span className="block text-xs text-muted-foreground">
                  Sugestão: {uploadErrorDialog.hint}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setUploadErrorDialog(null)}>
              Entendi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Small counter chip for header */
function CounterChip({ icon, label, value, colorClass }: { icon: React.ReactNode; label: string; value: number; colorClass: string }) {
  return (
    <div className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium", colorClass)}>
      {icon}
      <span className="font-bold">{value}</span>
      <span>{label}</span>
    </div>
  );
}
