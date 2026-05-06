import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, X, FileIcon, AlertCircle } from "lucide-react";
import { logger } from "@/lib/logger";

export interface UploadedFile {
  url: string;
  path: string;
  name: string;
  size: number;
  type: string;
}

interface FormFileUploadProps {
  formId: string;
  fieldId: string;
  value: UploadedFile | UploadedFile[] | null;
  onChange: (val: UploadedFile | UploadedFile[] | null) => void;
  acceptImages?: boolean;
  multiple?: boolean;
  maxSizeMB?: number;
  maxFiles?: number;
  maxTotalSizeMB?: number;
  allowedExtra?: string[];
}

const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_DOC = [
  "application/pdf",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.ms-excel",
  "text/csv",
  "text/plain",
];

const TYPE_LABELS: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
  "image/gif": "GIF",
  "application/pdf": "PDF",
  "application/zip": "ZIP",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/msword": "DOC",
  "application/vnd.ms-excel": "XLS",
  "text/csv": "CSV",
  "text/plain": "TXT",
};

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function FormFileUpload({
  formId,
  fieldId,
  value,
  onChange,
  acceptImages = false,
  multiple = false,
  maxSizeMB = 20,
  maxFiles = multiple ? 10 : 1,
  maxTotalSizeMB = 50,
  allowedExtra,
}: FormFileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const allowed = allowedExtra ?? (acceptImages ? ALLOWED_IMAGE : [...ALLOWED_IMAGE, ...ALLOWED_DOC]);
  const accept = acceptImages ? "image/*" : "image/*,.pdf,.zip,.xlsx,.xls,.docx,.doc,.csv,.txt";
  const allowedLabels = Array.from(new Set(allowed.map((t) => TYPE_LABELS[t] || t))).join(", ");

  const items: UploadedFile[] = Array.isArray(value) ? value : value ? [value] : [];
  const currentTotal = items.reduce((s, i) => s + i.size, 0);

  async function uploadOne(file: File): Promise<UploadedFile | null> {
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${formId}/${fieldId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
    const { error } = await supabase.storage
      .from("dynamic-form-uploads")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      logger.error("Upload error", error);
      return null;
    }
    const { data } = supabase.storage.from("dynamic-form-uploads").getPublicUrl(path);
    return { url: data.publicUrl, path, name: file.name, size: file.size, type: file.type };
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;

    const newErrors: string[] = [];
    const validFiles: File[] = [];
    let runningTotal = currentTotal;

    // Pre-validate
    for (const f of files) {
      if (allowed.length && !allowed.includes(f.type)) {
        newErrors.push(`"${f.name}": tipo não permitido. Aceitos: ${allowedLabels}.`);
        continue;
      }
      if (f.size > maxSizeMB * 1024 * 1024) {
        newErrors.push(`"${f.name}" (${fmtSize(f.size)}) ultrapassa o limite de ${maxSizeMB} MB por arquivo.`);
        continue;
      }
      if (items.length + validFiles.length >= maxFiles) {
        newErrors.push(`Limite de ${maxFiles} ${maxFiles === 1 ? "arquivo" : "arquivos"} atingido. "${f.name}" não foi enviado.`);
        continue;
      }
      if (runningTotal + f.size > maxTotalSizeMB * 1024 * 1024) {
        newErrors.push(`Tamanho total excederia ${maxTotalSizeMB} MB. "${f.name}" não foi enviado.`);
        continue;
      }
      runningTotal += f.size;
      validFiles.push(f);
    }

    if (validFiles.length === 0) {
      setErrors(newErrors);
      return;
    }

    setUploading(true);
    try {
      const results: UploadedFile[] = [];
      for (const f of validFiles) {
        const r = await uploadOne(f);
        if (r) results.push(r);
        else newErrors.push(`Falha ao enviar "${f.name}". Tente novamente.`);
      }
      if (multiple) {
        onChange([...items, ...results]);
      } else if (results[0]) {
        onChange(results[0]);
      }
    } finally {
      setUploading(false);
      setErrors(newErrors);
    }
  }

  async function removeItem(idx: number) {
    const item = items[idx];
    try {
      await supabase.storage.from("dynamic-form-uploads").remove([item.path]);
    } catch {
      /* noop */
    }
    if (multiple) {
      const next = items.filter((_, i) => i !== idx);
      onChange(next.length ? next : null);
    } else {
      onChange(null);
    }
    setErrors([]);
  }

  const reachedLimit = items.length >= maxFiles;

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 cursor-pointer">
        <Input
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFiles}
          disabled={uploading || reachedLimit}
          className="cursor-pointer file:mr-2 file:rounded file:border-0 file:bg-primary file:text-primary-foreground file:px-3 file:py-1 file:text-xs"
        />
        {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </label>

      <p className="text-[10px] text-muted-foreground">
        {multiple
          ? `Até ${maxFiles} arquivos · máx. ${maxSizeMB} MB cada · ${maxTotalSizeMB} MB no total`
          : `Máx. ${maxSizeMB} MB`}
        {" · "}Tipos: {allowedLabels}
      </p>

      {multiple && items.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          {items.length}/{maxFiles} arquivo{items.length === 1 ? "" : "s"} · {fmtSize(currentTotal)}
          {" / "}
          {maxTotalSizeMB} MB
        </p>
      )}

      {errors.length > 0 && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-3.5 w-3.5" />
          <AlertDescription className="text-xs space-y-0.5">
            {errors.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((it, idx) => {
            const isImage = it.type.startsWith("image/");
            return (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-xs"
              >
                {isImage ? (
                  <img src={it.url} alt={it.name} className="h-8 w-8 object-cover rounded" />
                ) : (
                  <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <a
                  href={it.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 truncate text-foreground hover:text-primary"
                  title={it.name}
                >
                  {it.name}
                </a>
                <span className="text-muted-foreground shrink-0">{fmtSize(it.size)}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => removeItem(idx)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
