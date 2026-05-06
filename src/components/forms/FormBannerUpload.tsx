import { useCallback, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, X, AlertCircle, Crop as CropIcon, ImageIcon } from "lucide-react";
import { logger } from "@/lib/logger";
import type { UploadedFile } from "./FormFileUpload";

const ASPECTS: { value: string; label: string; ratio: number | null }[] = [
  { value: "3:1", label: "3:1 (Banner Trade)", ratio: 3 / 1 },
  { value: "16:9", label: "16:9 (Widescreen)", ratio: 16 / 9 },
  { value: "4:3", label: "4:3", ratio: 4 / 3 },
  { value: "1:1", label: "1:1 (Quadrado)", ratio: 1 },
  { value: "free", label: "Livre (sem crop)", ratio: null },
];

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_MB = 10;

interface FormBannerUploadProps {
  formId: string;
  fieldId: string;
  value: UploadedFile | null;
  onChange: (val: UploadedFile | null) => void;
  defaultAspect?: string; // ex.: "3:1"
}

async function getCroppedBlob(src: string, area: Area, mime = "image/jpeg"): Promise<Blob> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
  });
  const canvas = document.createElement("canvas");
  canvas.width = area.width;
  canvas.height = area.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar imagem"))), mime, 0.92),
  );
}

export function FormBannerUpload({
  formId,
  fieldId,
  value,
  onChange,
  defaultAspect = "3:1",
}: FormBannerUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [rawSrc, setRawSrc] = useState<string | null>(null);
  const [aspectKey, setAspectKey] = useState(defaultAspect);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);

  const aspect = ASPECTS.find((a) => a.value === aspectKey)?.ratio ?? null;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (!ALLOWED.includes(file.type)) {
      setError(`Tipo não permitido. Use JPG, PNG ou WEBP.`);
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Imagem excede ${MAX_MB} MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setRawSrc(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
  }

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedArea(areaPixels);
  }, []);

  async function handleConfirm() {
    if (!rawSrc) return;
    setUploading(true);
    setError(null);
    try {
      let blob: Blob;
      let mime = "image/jpeg";
      if (aspect && croppedArea) {
        blob = await getCroppedBlob(rawSrc, croppedArea, mime);
      } else {
        // No crop: re-encode original
        const r = await fetch(rawSrc);
        blob = await r.blob();
        mime = blob.type || "image/jpeg";
      }
      const path = `${formId}/${fieldId}/${Date.now()}_banner_${aspectKey.replace(":", "x")}.${mime === "image/png" ? "png" : "jpg"}`;
      const { error: upErr } = await supabase.storage
        .from("dynamic-form-uploads")
        .upload(path, blob, { contentType: mime, upsert: false });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("dynamic-form-uploads").getPublicUrl(path);
      onChange({
        url: data.publicUrl,
        path,
        name: `banner_${aspectKey.replace(":", "x")}.${mime === "image/png" ? "png" : "jpg"}`,
        size: blob.size,
        type: mime,
      });
      setCropOpen(false);
      setRawSrc(null);
    } catch (err) {
      logger.error("Banner upload error", err);
      setError("Falha ao processar a imagem. Tente novamente.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (!value) return;
    try {
      await supabase.storage.from("dynamic-form-uploads").remove([value.path]);
    } catch {
      /* noop */
    }
    onChange(null);
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="space-y-2">
          <div className="relative rounded-lg border overflow-hidden bg-muted">
            <img src={value.url} alt="Banner" className="w-full max-h-60 object-contain" />
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="absolute top-2 right-2 h-7 w-7"
              onClick={handleRemove}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => document.getElementById(`banner-input-${fieldId}`)?.click()}
              className="gap-1.5"
            >
              <CropIcon className="h-3.5 w-3.5" />
              Substituir
            </Button>
            <span className="text-[10px] text-muted-foreground">
              {(value.size / 1024).toFixed(0)} KB · {value.type.split("/")[1]?.toUpperCase()}
            </span>
          </div>
        </div>
      ) : (
        <label
          htmlFor={`banner-input-${fieldId}`}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-8 cursor-pointer hover:bg-muted/50 transition-colors"
        >
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Clique para enviar um banner</p>
          <p className="text-[10px] text-muted-foreground text-center">
            JPG, PNG ou WEBP · até {MAX_MB} MB · você poderá ajustar o enquadramento
          </p>
        </label>
      )}

      <Input
        id={`banner-input-${fieldId}`}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFile}
        className="hidden"
      />

      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-3.5 w-3.5" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      <Dialog open={cropOpen} onOpenChange={(o) => !uploading && setCropOpen(o)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ajustar banner</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium">Proporção</span>
              <Select value={aspectKey} onValueChange={setAspectKey}>
                <SelectTrigger className="h-8 w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASPECTS.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative w-full bg-muted rounded-md overflow-hidden" style={{ height: 360 }}>
              {rawSrc && aspect ? (
                <Cropper
                  image={rawSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={aspect}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              ) : rawSrc ? (
                <img src={rawSrc} alt="Preview" className="w-full h-full object-contain" />
              ) : null}
            </div>

            {aspect !== null && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-12">Zoom</span>
                <Slider
                  value={[zoom]}
                  min={1}
                  max={3}
                  step={0.05}
                  onValueChange={(v) => setZoom(v[0])}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground w-10 text-right">{zoom.toFixed(1)}x</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCropOpen(false)} disabled={uploading}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Aplicar e enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
