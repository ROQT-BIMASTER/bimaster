import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Paperclip, X, FileText } from "lucide-react";
import { useProcessDecisions } from "@/hooks/useProcessDecisions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { validateFileForUpload } from "@/lib/utils/file-security";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processId: string;
  submissaoId: string;
  documentos?: Array<{ id: string; nome_arquivo?: string; tipo_documento: string }>;
}

interface UploadedFile {
  nome: string;
  url: string;
  size: number;
}

const DECISION_TYPES = [
  { value: "approved" as const, label: "Aprovar", icon: CheckCircle2, color: "text-success", bg: "bg-success/10 border-success/30 hover:bg-success/20" },
  { value: "rejected" as const, label: "Rejeitar", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10 border-destructive/30 hover:bg-destructive/20" },
  { value: "needs_revision" as const, label: "Solicitar Ajuste", icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10 border-warning/30 hover:bg-warning/20" },
] as const;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProcessDecisionDialog({ open, onOpenChange, processId, submissaoId, documentos = [] }: Props) {
  const { createDecision } = useProcessDecisions(processId, submissaoId);
  const [decisionType, setDecisionType] = useState<"approved" | "rejected" | "needs_revision" | null>(null);
  const [message, setMessage] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [prazoRetorno, setPrazoRetorno] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const newFiles: UploadedFile[] = [];

      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop();
        const path = `${user.id}/${processId}/${Date.now()}-${file.name}`;

        const { error } = await supabase.storage
          .from("process-attachments")
          .upload(path, file, { upsert: false });

        if (error) {
          toast.error(`Erro ao enviar ${file.name}`);
          continue;
        }

        const { data: signedData } = await supabase.storage
          .from("process-attachments")
          .createSignedUrl(path, 31536000); // 1 year

        if (signedData?.signedUrl) {
          newFiles.push({ nome: file.name, url: signedData.signedUrl, size: file.size });
        }
      }

      setUploadedFiles(prev => [...prev, ...newFiles]);
      if (newFiles.length > 0) toast.success(`${newFiles.length} arquivo(s) enviado(s)`);
    } catch {
      toast.error("Erro ao enviar arquivos.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!decisionType || !message.trim()) {
      toast.error("Selecione o tipo de decisão e preencha o motivo.");
      return;
    }

    const items = Array.from(selectedItems).map(id => {
      const doc = documentos.find(d => d.id === id);
      return { documento_id: id, label: doc?.nome_arquivo || doc?.tipo_documento || id };
    });

    const attachments = uploadedFiles.map(f => ({ url: f.url, nome: f.nome }));

    try {
      await createDecision.mutateAsync({
        process_id: processId,
        submissao_id: submissaoId,
        origin: "brasil",
        destination: "china",
        decision_type: decisionType,
        message: message.trim(),
        items_affected: items.length > 0 ? items : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        prazo_retorno: prazoRetorno || undefined,
      });
      toast.success("Decisão registrada com sucesso.");
      resetAndClose();
    } catch {
      toast.error("Erro ao registrar decisão.");
    }
  };

  const resetAndClose = () => {
    setDecisionType(null);
    setMessage("");
    setSelectedItems(new Set());
    setPrazoRetorno("");
    setUploadedFiles([]);
    onOpenChange(false);
  };

  const toggleItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            📜 Decisão do Brasil
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Selecione o tipo de decisão, justifique e anexe documentos se necessário.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Decision type selector */}
          <div className="grid grid-cols-3 gap-2">
            {DECISION_TYPES.map(dt => {
              const Icon = dt.icon;
              const isActive = decisionType === dt.value;
              return (
                <button
                  key={dt.value}
                  onClick={() => setDecisionType(dt.value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-sm font-medium",
                    isActive ? dt.bg + " border-2" : "border-border hover:bg-accent/30"
                  )}
                >
                  <Icon className={cn("h-5 w-5", isActive ? dt.color : "text-muted-foreground")} />
                  <span className={isActive ? dt.color : "text-foreground"}>{dt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Motivo / Justificativa *</Label>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Descreva o motivo da decisão..."
              rows={3}
            />
          </div>

          {/* Document selection - visible for ALL decision types */}
          {decisionType && documentos.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                {decisionType === "needs_revision" ? "Itens que precisam de correção" : "Documentos relacionados"}
              </Label>
              <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border p-2">
                {documentos.map(doc => (
                  <label key={doc.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/30 px-2 py-1 rounded">
                    <Checkbox
                      checked={selectedItems.has(doc.id)}
                      onCheckedChange={() => toggleItem(doc.id)}
                    />
                    <span className="truncate">{doc.nome_arquivo || doc.tipo_documento}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* File upload section */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Paperclip className="h-3.5 w-3.5" />
              Anexar Documentos
            </Label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/20 transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
              />
              {isUploading ? (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando...
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Clique para selecionar arquivos (PDF, DOC, XLS, imagens)
                </p>
              )}
            </div>

            {/* Uploaded files list */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-1 mt-2">
                {uploadedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-accent/30 rounded-md px-3 py-1.5 text-sm">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">{file.nome}</span>
                    <Badge variant="ghost" className="text-[10px] shrink-0">{formatFileSize(file.size)}</Badge>
                    <button onClick={() => removeFile(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Prazo (for needs_revision) */}
          {decisionType === "needs_revision" && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Prazo de retorno</Label>
              <Input
                type="date"
                value={prazoRetorno}
                onChange={e => setPrazoRetorno(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={!decisionType || !message.trim() || createDecision.isPending || isUploading}
          >
            {(createDecision.isPending || isUploading) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Registrar Decisão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
