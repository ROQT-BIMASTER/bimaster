import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Paperclip, Upload, Download, Trash2, FolderOpen, File, FileText, Image, ExternalLink, AlertTriangle, RefreshCw, Eye } from "lucide-react";
import { toast } from "sonner";
import { StoragePreviewDialog } from "@/components/fabrica/StoragePreviewDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { UploadAnexoDialog } from "./UploadAnexoDialog";


const COFRE_CATEGORIAS = [
  "briefing", "arte_final", "rotulo", "ficha_tecnica", "laudo", "certificado", "orcamento", "nota_fiscal", "art", "outro"
];

const COFRE_CATEGORIA_LABELS: Record<string, string> = {
  briefing: "Briefing",
  arte_final: "Arte Final",
  rotulo: "Rótulo",
  ficha_tecnica: "Ficha Técnica",
  laudo: "Laudo",
  certificado: "Certificado",
  orcamento: "Orçamento",
  nota_fiscal: "Nota Fiscal",
  art: "ART",
  outro: "Outro",
};

function getFileIcon(tipo: string | null) {
  if (!tipo) return <File className="h-5 w-5" />;
  if (tipo.startsWith("image/")) return <Image className="h-5 w-5 text-blue-400" />;
  if (tipo.includes("pdf")) return <FileText className="h-5 w-5 text-red-400" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

interface Anexo {
  id: string;
  nome: string;
  tipo_arquivo: string | null;
  tamanho: number | null;
  storage_path: string;
}

interface TarefaAnexosSectionProps {
  tarefaId: string;
  anexos: Anexo[];
  produtoId: string | null;
  uploadAnexo: { mutate: (input: File | { file: File; notificarIds?: string[] }) => void };
  deleteAnexo: { mutate: (anexo: Anexo) => void };
  getAnexoUrl: (path: string) => Promise<string | null>;
  sendToCofre: { mutate: (data: { anexoIds: string[]; produtoId: string; categoriasPorAnexo: Record<string, string> }) => void; isPending: boolean };
}

export function TarefaAnexosSection({
  tarefaId, anexos, produtoId, uploadAnexo, deleteAnexo, getAnexoUrl, sendToCofre,
}: TarefaAnexosSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedAnexoIds, setSelectedAnexoIds] = useState<string[]>([]);
  const [categoriasPorAnexo, setCategoriasPorAnexo] = useState<Record<string, string>>({});
  const [cofreDialogOpen, setCofreDialogOpen] = useState(false);
  const [previewState, setPreviewState] = useState<{ open: boolean; path: string; name: string }>({ open: false, path: "", name: "" });
  const [reimportingId, setReimportingId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const toggleAnexoSelection = (id: string) => {
    setSelectedAnexoIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setPendingFiles(Array.from(files));
    setUploadDialogOpen(true);
    e.target.value = "";
  };

  const handleConfirmUpload = (notificarIds: string[]) => {
    pendingFiles.forEach(f => uploadAnexo.mutate({ file: f, notificarIds }));
    setPendingFiles([]);
  };


  // Classifies an attachment into one of: "storage" | "external" | "asana_legacy" | "expired" | "too_large"
  const classifyAnexo = (a: Anexo): "storage" | "external" | "asana_legacy" | "expired" | "too_large" => {
    if (a.tipo_arquivo === "asana_expired") return "expired";
    if (a.tipo_arquivo === "asana_too_large") return "too_large";
    if (a.storage_path?.startsWith("external://")) return "external";
    if (a.storage_path?.startsWith("http")) return "asana_legacy";
    return "storage";
  };

  const handlePreview = (a: Anexo) => {
    const kind = classifyAnexo(a);
    if (kind === "storage") {
      setPreviewState({ open: true, path: a.storage_path, name: a.nome });
    } else if (kind === "external") {
      const url = a.storage_path.replace(/^external:\/\//, "");
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else toast.error("Link externo inválido.");
    } else if (kind === "asana_legacy") {
      toast.warning("Este anexo do Asana ainda não foi importado para o storage. Clique em 'Reimportar'.");
    } else if (kind === "expired") {
      toast.error("O Asana removeu este anexo (expirado/excluído na origem).");
    } else if (kind === "too_large") {
      toast.error("Anexo excede 50 MB e não pôde ser importado.");
    }
  };

  const handleReimport = async (a: Anexo) => {
    setReimportingId(a.id);
    try {
      const { data, error } = await supabase.functions.invoke("asana-reimport-attachments", {
        body: { batch_size: 1, anexo_id: a.id },
      });
      if (error) throw error;
      const result = (data as any)?.results?.[0];
      if (!result) {
        toast.message("Reimportação executada", { description: "Atualize a tarefa para ver o anexo." });
      } else if (result.status === "imported" || result.status === "converted_external") {
        toast.success("Anexo reimportado com sucesso.");
      } else if (result.status === "expired") {
        toast.error("O anexo não está mais disponível no Asana.");
      } else {
        toast.error(`Falha: ${result.status}${result.error ? " — " + result.error : ""}`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao reimportar anexo.");
    } finally {
      setReimportingId(null);
    }
  };

  const handleSendToCofre = () => {
    if (!produtoId) return;
    const allHaveCategory = selectedAnexoIds.every(id => categoriasPorAnexo[id]);
    if (!allHaveCategory) {
      toast.error("Selecione uma categoria para cada documento.");
      return;
    }
    sendToCofre.mutate({
      anexoIds: selectedAnexoIds,
      produtoId,
      categoriasPorAnexo,
    });
    setCofreDialogOpen(false);
    setSelectedAnexoIds([]);
    setCategoriasPorAnexo({});
  };

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium flex items-center gap-1.5">
            <Paperclip className="h-4 w-4" /> Anexos ({anexos.length})
          </h3>
          <div className="flex items-center gap-1">
            {selectedAnexoIds.length > 0 && produtoId && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 text-emerald-400 border-emerald-500/30"
                onClick={() => setCofreDialogOpen(true)}
              >
                <FolderOpen className="h-3.5 w-3.5" /> Enviar ao Cofre ({selectedAnexoIds.length})
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Upload
            </Button>
          </div>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
        </div>
        {anexos.length > 0 ? (
          <TooltipProvider delayDuration={200}>
            <div className="space-y-1.5">
              {anexos.map(a => {
                const kind = classifyAnexo(a);
                const isLegacy = kind === "asana_legacy";
                const isExpired = kind === "expired";
                const isTooLarge = kind === "too_large";
                const isExternal = kind === "external";
                const isStorage = kind === "storage";
                const externalUrl = isExternal ? a.storage_path.replace(/^external:\/\//, "") : "";
                return (
                  <div
                    key={a.id}
                    className={`flex items-center gap-2 p-2 rounded-md border ${
                      isLegacy || isExpired || isTooLarge
                        ? "bg-amber-500/5 border-amber-500/30"
                        : "bg-muted/30 border-border/30"
                    }`}
                  >
                    <Checkbox
                      checked={selectedAnexoIds.includes(a.id)}
                      onCheckedChange={() => toggleAnexoSelection(a.id)}
                      disabled={!isStorage}
                      className="flex-shrink-0"
                    />
                    {isLegacy || isExpired || isTooLarge
                      ? <AlertTriangle className="h-5 w-5 text-amber-500" />
                      : isExternal
                        ? <ExternalLink className="h-5 w-5 text-blue-400" />
                        : getFileIcon(a.tipo_arquivo)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{a.nome}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatFileSize(a.tamanho)}
                        {isLegacy && " • Aguardando reimportação"}
                        {isExpired && " • Removido no Asana"}
                        {isTooLarge && " • Excede 50 MB"}
                        {isExternal && " • Link externo"}
                      </p>
                    </div>

                    {isLegacy && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-amber-500"
                            onClick={() => handleReimport(a)}
                            disabled={reimportingId === a.id}
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${reimportingId === a.id ? "animate-spin" : ""}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reimportar do Asana</TooltipContent>
                      </Tooltip>
                    )}

                    {(isStorage || isExternal) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePreview(a)}>
                            {isExternal ? <ExternalLink className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{isExternal ? "Abrir link externo" : "Visualizar"}</TooltipContent>
                      </Tooltip>
                    )}

                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteAnexo.mutate(a)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </TooltipProvider>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum anexo.</p>
        )}
        {!produtoId && selectedAnexoIds.length > 0 && (
          <p className="text-[10px] text-amber-400 mt-1">
            ⚠ Vincule um produto à tarefa para enviar ao Cofre
          </p>
        )}
      </div>

      {/* Cofre Dialog */}
      <Dialog open={cofreDialogOpen} onOpenChange={setCofreDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-emerald-500" />
              Enviar ao Cofre de Documentos
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Documentos selecionados — selecione a categoria de cada um</Label>
              <div className="mt-2 space-y-2">
                {anexos.filter(a => selectedAnexoIds.includes(a.id)).map(a => (
                  <div key={a.id} className="flex items-center gap-2 text-xs p-2 bg-muted/30 rounded-md">
                    {getFileIcon(a.tipo_arquivo)}
                    <span className="truncate flex-1 min-w-0">{a.nome}</span>
                    <Select
                      value={categoriasPorAnexo[a.id] || ""}
                      onValueChange={v => setCategoriasPorAnexo(prev => ({ ...prev, [a.id]: v }))}
                    >
                      <SelectTrigger className="h-7 w-[130px] text-[11px]">
                        <SelectValue placeholder="Categoria..." />
                      </SelectTrigger>
                      <SelectContent>
                        {COFRE_CATEGORIAS.map(c => (
                          <SelectItem key={c} value={c}>{COFRE_CATEGORIA_LABELS[c]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCofreDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSendToCofre} disabled={sendToCofre.isPending} className="gap-1.5">
              <FolderOpen className="h-4 w-4" />
              {sendToCofre.isPending ? "Enviando..." : "Enviar ao Cofre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StoragePreviewDialog
        open={previewState.open}
        onOpenChange={(o) => setPreviewState((p) => ({ ...p, open: o }))}
        filePath={previewState.path}
        fileName={previewState.name}
        bucketHint="projeto-anexos"
      />

      <UploadAnexoDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        tarefaId={tarefaId}
        files={pendingFiles}
        onConfirm={handleConfirmUpload}
      />
    </>
  );
}

