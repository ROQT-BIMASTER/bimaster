import { useState, useRef } from "react";
import { Upload, ImagePlus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const BUCKET = "fabrica-produto-fotos";
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const ACCEPT_EXT = ".jpg,.jpeg,.png,.webp";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

interface UploadFotoProdutoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtoId: string;
  produtoNome?: string;
  onUploaded?: (publicUrl: string) => void;
}

export default function UploadFotoProdutoDialog({
  open,
  onOpenChange,
  produtoId,
  produtoNome,
  onUploaded,
}: UploadFotoProdutoDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const reset = () => {
    setFile(null);
    setPreview(null);
    setUploading(false);
  };

  const handleSelect = (f: File | null) => {
    if (!f) return;
    if (!ACCEPT.includes(f.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WEBP.");
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error("Arquivo muito grande. Limite de 5 MB.");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${produtoId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false, cacheControl: "3600" });
      if (upErr) throw upErr;

      // Gerar URL assinada de longa duração para gravar (ProductThumbnail também resolve)
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365);
      const urlToStore = signed?.signedUrl ?? path;

      const { error: updErr } = await supabase
        .from("fabrica_produtos")
        .update({ foto_url: urlToStore })
        .eq("id", produtoId);
      if (updErr) throw updErr;

      toast.success("Foto enviada com sucesso");
      queryClient.invalidateQueries({ queryKey: ["fabrica-produtos"] });
      queryClient.invalidateQueries({ queryKey: ["fabrica_produtos"] });
      onUploaded?.(urlToStore);
      reset();
      onOpenChange(false);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.toLowerCase().includes("row-level") || msg.toLowerCase().includes("not authorized")) {
        toast.error("Você não tem permissão no módulo Fábrica para enviar fotos.");
      } else {
        toast.error(`Falha ao enviar foto: ${msg}`);
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImagePlus className="h-5 w-5" /> Enviar foto do produto
          </DialogTitle>
          <DialogDescription>
            {produtoNome ? <span className="font-medium">{produtoNome}</span> : "Selecione uma imagem para este produto."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            <div className="font-medium text-foreground mb-1">Padrão de arquivo aceito</div>
            <ul className="list-disc pl-5 space-y-0.5">
              <li>Formatos: <strong>JPG, PNG ou WEBP</strong></li>
              <li>Tamanho máximo: <strong>5 MB</strong></li>
              <li>Proporção recomendada: <strong>1:1</strong> (quadrada), mínimo 400×400 px</li>
              <li>Fundo neutro, produto centralizado</li>
            </ul>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_EXT}
            className="hidden"
            onChange={(e) => handleSelect(e.target.files?.[0] ?? null)}
          />

          {preview ? (
            <div className="flex items-center gap-3 rounded-md border p-3">
              <img src={preview} alt="Pré-visualização" className="h-20 w-20 rounded object-cover border" />
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-medium">{file?.name}</div>
                <div className="text-xs text-muted-foreground">{((file?.size ?? 0) / 1024).toFixed(0)} KB</div>
                <Button variant="link" size="sm" className="px-0 h-auto" onClick={() => inputRef.current?.click()}>
                  Trocar arquivo
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => inputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" /> Selecionar arquivo
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={uploading}>Cancelar</Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</> : "Enviar foto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
