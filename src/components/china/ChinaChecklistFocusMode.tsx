import { useState, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BilingualLabel } from "./BilingualLabel";
import {
  Maximize2, X, Send, Save, ChevronDown, ChevronRight,
  FileText, Eye, Upload, Loader2, CheckCircle2, Clock, XCircle, Trash2,
} from "lucide-react";
import { CHINA_DOCUMENT_TYPES, DOCUMENT_CATEGORIES, STATUS_LABELS } from "@/lib/china-document-types";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRef } from "react";

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

const statusIcon = {
  rascunho: <Save className="h-3.5 w-3.5 text-muted-foreground" />,
  pendente: <Clock className="h-3.5 w-3.5 text-warning" />,
  aprovado: <CheckCircle2 className="h-3.5 w-3.5 text-success" />,
  rejeitado: <XCircle className="h-3.5 w-3.5 text-destructive" />,
} as Record<string, React.ReactNode>;

export function ChinaChecklistFocusMode({
  submissaoId,
  documentos,
  onUpload,
  onRefresh,
  onRemoveFile,
  onViewDoc,
}: ChinaChecklistFocusModeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedCats, setExpandedCats] = useState<Set<string>>(
    new Set(DOCUMENT_CATEGORIES.map((c) => c.key))
  );
  const [submitting, setSubmitting] = useState(false);
  const [uploadingTipo, setUploadingTipo] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Draft docs that can be selected for submission
  const draftDocs = useMemo(
    () => documentos.filter((d) => d.status === "rascunho"),
    [documentos]
  );

  // Progress
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
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  }, []);

  const toggleCatSelect = useCallback(
    (tipos: string[]) => {
      const catDraftDocs = draftDocs.filter((d) => tipos.includes(d.tipo_documento));
      const allSelected = catDraftDocs.every((d) => selected.has(d.id));
      setSelected((prev) => {
        const next = new Set(prev);
        catDraftDocs.forEach((d) => {
          if (allSelected) next.delete(d.id);
          else next.add(d.id);
        });
        return next;
      });
    },
    [draftDocs, selected]
  );

  const toggleCatExpand = (key: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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

  const handleFileUpload = async (tipo: string, file: File) => {
    setUploadingTipo(tipo);
    try {
      // Upload with rascunho status
      const path = `${submissaoId}/${tipo}/${Date.now()}_${file.name}`;
      const { uploadAndGetSignedUrl } = await import("@/lib/utils/storage-helper");
      const { signedUrl, error } = await uploadAndGetSignedUrl("china-documentos", path, file);
      if (error) {
        toast.error("Erro no upload 上传错误");
        return;
      }
      await supabase.from("china_produto_documentos" as any).insert({
        submissao_id: submissaoId,
        tipo_documento: tipo,
        arquivo_url: signedUrl,
        arquivo_path: path,
        nome_arquivo: file.name,
        status: "rascunho",
      } as any);
      onRefresh();
      toast.success("Salvo como rascunho 已保存为草稿");
    } finally {
      setUploadingTipo(null);
    }
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
          <DialogHeader className="px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-row items-center justify-between space-y-0 shrink-0">
            <DialogTitle className="text-xl font-bold">
              Checklist de Documentos 文件清单
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="gradient"
                size="sm"
                disabled={selected.size === 0 || submitting}
                onClick={handleSubmitSelected}
                className="gap-2"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submeter {selected.size > 0 ? `${selected.size}` : ""} ao Brasil
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          {/* Progress bar */}
          <div className="px-6 py-3 border-b bg-muted/30 shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-foreground">
                Progresso 进度
              </span>
              <span className="text-sm text-muted-foreground">
                {filledTipos}/{allTipos} tipos preenchidos ({progressPct}%)
              </span>
            </div>
            <Progress value={progressPct} gradient className="h-2" />
            {draftDocs.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1.5">
                <Save className="h-3 w-3 inline mr-1" />
                {draftDocs.length} documento(s) em rascunho — selecione e submeta ao Brasil
              </p>
            )}
          </div>

          {/* Body */}
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-4">
              {DOCUMENT_CATEGORIES.map((cat) => {
                const catDocTypes = CHINA_DOCUMENT_TYPES.filter((d) =>
                  cat.tipos.includes(d.tipo)
                );
                const catDocs = documentos.filter((d) =>
                  cat.tipos.includes(d.tipo_documento)
                );
                const catDrafts = catDocs.filter((d) => d.status === "rascunho");
                const allCatDraftsSelected =
                  catDrafts.length > 0 && catDrafts.every((d) => selected.has(d.id));
                const isExpanded = expandedCats.has(cat.key);

                return (
                  <div key={cat.key} className="border rounded-xl overflow-hidden bg-card">
                    {/* Category header */}
                    <button
                      onClick={() => toggleCatExpand(cat.key)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors text-left"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <BilingualLabel pt={cat.labelPt} cn={cat.labelCn} size="sm" className="flex-1" />
                      <Badge variant="secondary" className="text-xs">
                        {catDocs.length} arquivo(s)
                      </Badge>
                      {catDrafts.length > 0 && (
                        <Badge variant="warning" className="text-xs">
                          {catDrafts.length} rascunho(s)
                        </Badge>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t">
                        {/* Master checkbox for category */}
                        {catDrafts.length > 0 && (
                          <div className="px-4 py-2 bg-muted/20 border-b flex items-center gap-2">
                            <Checkbox
                              checked={allCatDraftsSelected}
                              onCheckedChange={() => toggleCatSelect(cat.tipos)}
                            />
                            <span className="text-xs text-muted-foreground">
                              Selecionar todos os rascunhos desta categoria
                            </span>
                          </div>
                        )}

                        {/* Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-muted/30 text-muted-foreground text-xs">
                                <th className="w-10 px-3 py-2"></th>
                                <th className="text-left px-3 py-2 font-medium">Tipo 类型</th>
                                <th className="text-left px-3 py-2 font-medium">Status 状态</th>
                                <th className="text-left px-3 py-2 font-medium">Arquivos 文件</th>
                                <th className="text-left px-3 py-2 font-medium">Observação 备注</th>
                                <th className="text-right px-3 py-2 font-medium">Ação 操作</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {catDocTypes.map((config) => {
                                const typeDocs = catDocs.filter(
                                  (d) => d.tipo_documento === config.tipo
                                );
                                const typeDrafts = typeDocs.filter(
                                  (d) => d.status === "rascunho"
                                );
                                const isUploading = uploadingTipo === config.tipo;

                                return (
                                  <tr key={config.tipo} className="hover:bg-accent/10 transition-colors">
                                    {/* Checkbox column — only for draft docs */}
                                    <td className="px-3 py-2.5 align-top">
                                      {typeDrafts.length > 0 && (
                                        <div className="space-y-1">
                                          {typeDrafts.map((d) => (
                                            <Checkbox
                                              key={d.id}
                                              checked={selected.has(d.id)}
                                              onCheckedChange={() => toggleSelect(d.id)}
                                            />
                                          ))}
                                        </div>
                                      )}
                                    </td>

                                    {/* Tipo */}
                                    <td className="px-3 py-2.5">
                                      <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center shrink-0">
                                          {config.icon || <FileText className="h-4 w-4 text-muted-foreground" />}
                                        </div>
                                        <div>
                                          <p className="font-medium text-foreground text-xs leading-tight">
                                            {config.labelPt}
                                          </p>
                                          <p className="text-[10px] text-muted-foreground">
                                            {config.labelCn}
                                          </p>
                                        </div>
                                      </div>
                                    </td>

                                    {/* Status */}
                                    <td className="px-3 py-2.5 align-top">
                                      {typeDocs.length === 0 ? (
                                        <span className="text-xs text-muted-foreground italic">
                                          Sem arquivo 无文件
                                        </span>
                                      ) : (
                                        <div className="space-y-0.5">
                                          {typeDocs.map((d) => {
                                            const label = STATUS_LABELS[d.status] || STATUS_LABELS.rascunho;
                                            return (
                                              <div key={d.id} className="flex items-center gap-1">
                                                {statusIcon[d.status] || statusIcon.rascunho}
                                                <Badge
                                                  variant={label.variant}
                                                  className="text-[10px] px-1.5 py-0 h-5"
                                                >
                                                  {label.pt}
                                                </Badge>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </td>

                                    {/* Arquivos */}
                                    <td className="px-3 py-2.5 align-top">
                                      {typeDocs.length === 0 ? (
                                        <span className="text-xs text-muted-foreground">—</span>
                                      ) : (
                                        <div className="space-y-0.5">
                                          {typeDocs.map((d) => (
                                            <div key={d.id} className="flex items-center gap-1.5 text-xs">
                                              <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                                              <span className="truncate max-w-[150px] text-foreground">
                                                {d.nome_arquivo || "doc"}
                                              </span>
                                              {d.status !== "aprovado" && (
                                                <button
                                                  onClick={() => onRemoveFile(d.id)}
                                                  className="text-destructive hover:text-destructive/80 shrink-0"
                                                >
                                                  <Trash2 className="h-3 w-3" />
                                                </button>
                                              )}
                                              <button
                                                onClick={() => onViewDoc(d)}
                                                className="text-primary hover:text-primary/80 shrink-0"
                                              >
                                                <Eye className="h-3 w-3" />
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </td>

                                    {/* Observação */}
                                    <td className="px-3 py-2.5 align-top">
                                      {typeDocs.find((d) => d.observacao) ? (
                                        <p className="text-xs text-destructive max-w-[200px] line-clamp-2">
                                          {typeDocs.find((d) => d.observacao)?.observacao}
                                        </p>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">—</span>
                                      )}
                                    </td>

                                    {/* Ação */}
                                    <td className="px-3 py-2.5 text-right align-top">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs gap-1"
                                        disabled={isUploading}
                                        onClick={() => fileInputRefs.current[config.tipo]?.click()}
                                      >
                                        {isUploading ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <Upload className="h-3 w-3" />
                                        )}
                                        Upload
                                      </Button>
                                      <input
                                        ref={(el) => { fileInputRefs.current[config.tipo] = el; }}
                                        type="file"
                                        className="hidden"
                                        accept={config.accept}
                                        multiple={config.multiple}
                                        onChange={async (e) => {
                                          const files = e.target.files;
                                          if (files) {
                                            for (const f of Array.from(files)) {
                                              await handleFileUpload(config.tipo, f);
                                            }
                                          }
                                          e.target.value = "";
                                        }}
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

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
    </>
  );
}
