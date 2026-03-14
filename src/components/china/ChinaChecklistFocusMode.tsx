import { useState, useMemo, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BilingualLabel } from "./BilingualLabel";
import { ChinaUploadPreviewDialog } from "./ChinaUploadPreviewDialog";
import {
  Maximize2, X, Send, Save, Upload, Loader2, CheckCircle2, Clock, XCircle,
  FileText, Eye, Trash2, Image as ImageIcon,
} from "lucide-react";
import { CHINA_DOCUMENT_TYPES, DOCUMENT_CATEGORIES, CATEGORIES_CHINA_ENVIA, CATEGORIES_BRASIL_ENVIA, STATUS_LABELS } from "@/lib/china-document-types";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { uploadAndGetSignedUrl, getSignedUrl } from "@/lib/utils/storage-helper";
import { toast } from "sonner";

interface DocRecord {
  id: string;
  tipo_documento: string;
  nome_arquivo: string | null;
  status: string;
  observacao: string | null;
  arquivo_url: string | null;
  arquivo_path: string | null;
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
  rascunho: <Save className="h-3.5 w-3.5 text-muted-foreground" />,
  pendente: <Clock className="h-3.5 w-3.5 text-warning" />,
  aprovado: <CheckCircle2 className="h-3.5 w-3.5 text-success" />,
  rejeitado: <XCircle className="h-3.5 w-3.5 text-destructive" />,
};

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

  // Preview dialog state
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewTipo, setPreviewTipo] = useState<{ tipo: string; pt: string; cn: string } | null>(null);

  const draftDocs = useMemo(() => documentos.filter((d) => d.status === "rascunho"), [documentos]);

  const allTipos = CHINA_DOCUMENT_TYPES.length;
  const filledTipos = useMemo(() => {
    const filled = new Set<string>();
    documentos.forEach((d) => filled.add(d.tipo_documento));
    return filled.size;
  }, [documentos]);
  const progressPct = allTipos > 0 ? Math.round((filledTipos / allTipos) * 100) : 0;

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
      await supabase.from("china_produto_documentos" as any).insert({
        submissao_id: submissaoId,
        tipo_documento: previewTipo.tipo,
        arquivo_url: signedUrl,
        arquivo_path: path,
        nome_arquivo: file.name,
        status,
      } as any);
      onRefresh();
      toast.success(status === "rascunho" ? "Salvo como rascunho 已保存为草稿" : "Enviado ao Brasil 已发送至巴西");
    } finally {
      setUploadingTipo(null);
      setPreviewFile(null);
      setPreviewTipo(null);
    }
  };

  // Active category data
  const activeCatObj = DOCUMENT_CATEGORIES.find((c) => c.key === activeCat)!;
  const activeCatTypes = CHINA_DOCUMENT_TYPES.filter((d) => activeCatObj.tipos.includes(d.tipo));

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)} className="gap-2">
        <Maximize2 className="h-4 w-4" />
        Modo Foco 聚焦模式
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] max-h-[95vh] p-0 overflow-hidden flex flex-col">
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b bg-background/95 backdrop-blur flex-row items-center justify-between space-y-0 shrink-0">
            <div>
              <DialogTitle className="text-xl font-bold">Checklist de Documentos 文件清单</DialogTitle>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-muted-foreground">{filledTipos}/{allTipos} tipos preenchidos</span>
                <Progress value={progressPct} gradient className="h-1.5 w-32" />
                <span className="text-xs font-medium text-foreground">{progressPct}%</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selected.size > 0 && (
                <Button
                  variant="gradient"
                  size="sm"
                  disabled={submitting}
                  onClick={handleSubmitSelected}
                  className="gap-2"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Submeter {selected.size} ao Brasil
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          {/* Body: Sidebar + Main */}
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <div className="w-56 border-r bg-muted/20 flex flex-col shrink-0">
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {DOCUMENT_CATEGORIES.map((cat) => {
                    const catDocs = documentos.filter((d) => cat.tipos.includes(d.tipo_documento));
                    const catTotal = CHINA_DOCUMENT_TYPES.filter((d) => cat.tipos.includes(d.tipo)).length;
                    const catFilled = new Set(catDocs.map((d) => d.tipo_documento)).size;
                    const hasRejected = catDocs.some((d) => d.status === "rejeitado");
                    const hasDrafts = catDocs.some((d) => d.status === "rascunho");
                    const allApproved = catFilled === catTotal && catDocs.length > 0 && catDocs.every((d) => d.status === "aprovado");
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
                          <span className="text-[10px] text-muted-foreground">{catFilled}/{catTotal}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground block">{cat.labelCn}</span>
                        <div className="flex gap-1 mt-1">
                          {allApproved && <Badge variant="success" className="text-[9px] px-1 py-0 h-4">✓</Badge>}
                          {hasRejected && <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">✗</Badge>}
                          {hasDrafts && <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">📝</Badge>}
                        </div>
                      </button>
                    );
                  })}
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
                    const typeDrafts = typeDocs.filter((d) => d.status === "rascunho");
                    const isUploading = uploadingTipo === config.tipo;
                    const hasImage = config.accept?.includes("image");

                    return (
                      <div
                        key={config.tipo}
                        className={cn(
                          "border rounded-xl bg-card p-4 space-y-3 transition-all",
                          typeDocs.some((d) => d.status === "rejeitado") && "border-destructive/40",
                          typeDocs.length === 0 && "border-dashed border-muted-foreground/30"
                        )}
                      >
                        {/* Card header */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                              {config.icon || <FileText className="h-5 w-5 text-muted-foreground" />}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">{config.labelPt}</p>
                              <p className="text-xs text-muted-foreground">{config.labelCn}</p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1 shrink-0"
                            disabled={isUploading}
                            onClick={() => fileInputRefs.current[config.tipo]?.click()}
                          >
                            {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                            Upload
                          </Button>
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
                        {typeDocs.length > 0 ? (
                          <div className="space-y-1.5">
                            {typeDocs.map((d) => {
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
                          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                            <Upload className="h-8 w-8 mb-2 opacity-30" />
                            <p className="text-xs">Nenhum arquivo 无文件</p>
                            <p className="text-[10px]">Arraste ou clique em Upload</p>
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
              <Button
                variant="gradient"
                size="sm"
                disabled={submitting}
                onClick={handleSubmitSelected}
                className="gap-2"
              >
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
