import { useState, useMemo, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  Plus, FolderPlus,
} from "lucide-react";
import { CHINA_DOCUMENT_TYPES, DOCUMENT_CATEGORIES, CATEGORIES_CHINA_ENVIA, CATEGORIES_BRASIL_ENVIA, STATUS_LABELS } from "@/lib/china-document-types";
import type { DocumentSlotConfig } from "@/components/china/ChinaDocumentSlot";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { uploadAndGetSignedUrl } from "@/lib/utils/storage-helper";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createElement } from "react";

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
  icon: React.ReactNode;
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
}: ChinaChecklistFocusModeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCat, setActiveCat] = useState(DOCUMENT_CATEGORIES[0].key);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [uploadingTipo, setUploadingTipo] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const queryClient = useQueryClient();

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

  // Add custom items to default categories
  const enrichedCategories = useMemo(() => {
    return allCategories.map(cat => {
      if (cat.isCustom) return cat;
      // Find custom items assigned to this default category
      const extraItems = customItems
        .filter((i: any) => i.categoria_default_key === cat.key && !i.categoria_custom_id)
        .map((i: any) => i.tipo_key);
      return { ...cat, tipos: [...cat.tipos, ...extraItems] };
    });
  }, [allCategories, customItems]);

  const chinaEnviaCats = enrichedCategories.filter(c => c.fluxo === "china_envia");
  const brasilEnviaCats = enrichedCategories.filter(c => c.fluxo === "brasil_envia");

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

  const handleSubmitSelected = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("china_produto_documentos" as any)
        .update({ status: "pendente" } as any)
        .in("id", Array.from(selected));
      if (error) throw error;
      toast.success(`${selected.size} documento(s) enviado(s) ao Brasil! ${selected.size}份文件已发送至巴西！`);
      setSelected(new Set());
      onRefresh();
    } catch {
      toast.error("Erro ao submeter 提交错误");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadWithPreview = (tipo: string, file: File) => {
    const config = CHINA_DOCUMENT_TYPES.find((d) => d.tipo === tipo);
    setPreviewFile(file);
    setPreviewTipo({ tipo, pt: config?.labelPt || tipo, cn: config?.labelCn || "" });
  };

  const handleConfirmUpload = async (file: File, status: "rascunho" | "pendente") => {
    if (!previewTipo) return;
    setUploadingTipo(previewTipo.tipo);
    try {
      const path = `${submissaoId}/${previewTipo.tipo}/${Date.now()}_${file.name}`;
      const { signedUrl, error } = await uploadAndGetSignedUrl("china-documentos", path, file);
      if (error) { toast.error("Erro no upload 上传错误"); return; }

      // Check if there's a "planejado" placeholder to update instead of insert
      const existingPlaceholder = documentos.find(d => d.tipo_documento === previewTipo.tipo && d.status === "planejado");
      if (existingPlaceholder) {
        await supabase.from("china_produto_documentos" as any).update({
          arquivo_url: signedUrl,
          arquivo_path: path,
          nome_arquivo: file.name,
          status,
        } as any).eq("id", existingPlaceholder.id);
      } else {
        await supabase.from("china_produto_documentos" as any).insert({
          submissao_id: submissaoId,
          tipo_documento: previewTipo.tipo,
          arquivo_url: signedUrl,
          arquivo_path: path,
          nome_arquivo: file.name,
          status,
        } as any);
      }
      onRefresh();
      toast.success(status === "rascunho" ? "Salvo como rascunho 已保存为草稿" : "Enviado ao Brasil 已发送至巴西");
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
      toast.success("Previsão definida 预计日期已设置");
    } catch {
      toast.error("Erro ao definir previsão");
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
      toast.error("Erro ao limpar previsão");
    }
  };

  // Active category data
  const activeCatObj = DOCUMENT_CATEGORIES.find((c) => c.key === activeCat)!;
  const activeCatTypes = CHINA_DOCUMENT_TYPES.filter((d) => activeCatObj.tipos.includes(d.tipo));

  // Sidebar category stats helper
  const getCatStats = (cat: typeof DOCUMENT_CATEGORIES[0]) => {
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

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)} className="gap-2">
        <Maximize2 className="h-4 w-4" />
        Modo Foco 聚焦模式
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] max-h-[95vh] p-0 overflow-hidden flex flex-col">
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b bg-background/95 backdrop-blur shrink-0">
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
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {/* Counter chips */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <CounterChip icon={<CheckCircle2 className="h-3 w-3" />} label="Aprovados" value={counters.aprovados} colorClass="text-success bg-success/10" />
              <CounterChip icon={<Clock className="h-3 w-3" />} label="Enviados" value={counters.enviados} colorClass="text-warning bg-warning/10" />
              <CounterChip icon={<Save className="h-3 w-3" />} label="Rascunhos" value={counters.rascunhos} colorClass="text-muted-foreground bg-muted" />
              <CounterChip icon={<XCircle className="h-3 w-3" />} label="Rejeitados" value={counters.rejeitados} colorClass="text-destructive bg-destructive/10" />
              <CounterChip icon={<Upload className="h-3 w-3" />} label="Faltando" value={counters.faltando} colorClass="text-foreground bg-secondary" />
              {counters.comPrevisao > 0 && (
                <CounterChip icon={<CalendarIcon className="h-3 w-3" />} label="Com Previsão" value={counters.comPrevisao} colorClass="text-primary bg-primary/10" />
              )}
            </div>
          </DialogHeader>

          {/* Body: Sidebar + Main */}
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <div className="w-72 border-r bg-muted/20 flex flex-col shrink-0 min-w-0">
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {[
                    { categories: CATEGORIES_CHINA_ENVIA, headerPt: "China Envia", headerCn: "中国发送", icon: <ArrowUpRight className="h-3.5 w-3.5" />, color: "text-primary" },
                    { categories: CATEGORIES_BRASIL_ENVIA, headerPt: "Brasil Envia", headerCn: "巴西发送", icon: <ArrowDownLeft className="h-3.5 w-3.5" />, color: "text-success" },
                  ].map(({ categories, headerPt, headerCn, icon, color }, idx) => (
                    <div key={headerPt}>
                      {idx > 0 && <div className="my-2 border-t border-border" />}
                      <div className={cn("flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wide", color)}>
                        {icon}
                        <span>{headerPt}</span>
                        <span className="font-normal opacity-60">{headerCn}</span>
                      </div>
                      {categories.map((cat) => {
                        const stats = getCatStats(cat);
                        const isActive = activeCat === cat.key;

                        return (
                          <button
                            key={cat.key}
                            onClick={() => setActiveCat(cat.key)}
                            className={cn(
                              "w-full text-left rounded-lg px-3 py-2.5 transition-all text-xs",
                              isActive
                                ? "bg-primary/10 border border-primary/30 text-primary font-semibold"
                                : "hover:bg-accent/50 text-foreground"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="truncate">{cat.labelPt}</span>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <div>
                              <p className="text-sm font-semibold text-foreground">{config.labelPt}</p>
                              <p className="text-xs text-muted-foreground">{config.labelCn}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Previsão badge */}
                            {previsaoDate && (
                              <Badge
                                variant={isOverdue ? "destructive" : "default"}
                                className="text-[9px] px-1.5 py-0 h-5 gap-1 cursor-pointer"
                                onClick={() => previsaoDoc && handleClearPrevisao(previsaoDoc.id)}
                                title="Clique para remover previsão"
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
                          </div>
                          <input
                            ref={(el) => { fileInputRefs.current[config.tipo] = el; }}
                            type="file"
                            className="hidden"
                            accept={config.accept}
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
                                    <Badge variant={label.variant} className="text-[9px] px-1.5 py-0 h-4">
                                      {label.pt}
                                    </Badge>
                                  </div>

                                  <div className="flex gap-0.5 shrink-0">
                                    <button onClick={() => onViewDoc(d)} className="p-1 rounded hover:bg-accent/50">
                                      <Eye className="h-3.5 w-3.5 text-primary" />
                                    </button>
                                    {d.status !== "aprovado" && (
                                      <button onClick={() => onRemoveFile(d.id)} className="p-1 rounded hover:bg-destructive/10">
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
