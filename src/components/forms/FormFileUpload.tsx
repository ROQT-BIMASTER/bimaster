import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, X, FileIcon, ImageIcon } from "lucide-react";
import { logger } from "@/lib/logger";

interface UploadedFile {
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

export function FormFileUpload({
  formId,
  fieldId,
  value,
  onChange,
  acceptImages = false,
  multiple = false,
  maxSizeMB = 20,
}: FormFileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const allowed = acceptImages ? ALLOWED_IMAGE : [...ALLOWED_IMAGE, ...ALLOWED_DOC];
  const accept = acceptImages ? "image/*" : "image/*,.pdf,.zip,.xlsx,.xls,.docx,.doc,.csv,.txt";

  const items: UploadedFile[] = Array.isArray(value) ? value : value ? [value] : [];

  async function uploadOne(file: File): Promise<UploadedFile | null> {
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`"${file.name}" excede ${maxSizeMB}MB`);
      return null;
    }
    if (allowed.length && !allowed.includes(file.type)) {
      toast.error(`Tipo não permitido: ${file.name}`);
      return null;
    }
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${formId}/${fieldId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
    const { error } = await supabase.storage
      .from("dynamic-form-uploads")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      logger.error("Upload error", error);
      toast.error(`Falha ao enviar ${file.name}`);
      return null;
    }
    const { data } = supabase.storage.from("dynamic-form-uploads").getPublicUrl(path);
    return { url: data.publicUrl, path, name: file.name, size: file.size, type: file.type };
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const results: UploadedFile[] = [];
      for (const f of files) {
        const r = await uploadOne(f);
        if (r) results.push(r);
      }
      if (multiple) {
        onChange([...items, ...results]);
      } else {
        onChange(results[0] || null);
      }
    } finally {
      setUploading(false);
      e.target.value = "";
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
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 cursor-pointer">
        <Input
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFiles}
          disabled={uploading}
          className="cursor-pointer file:mr-2 file:rounded file:border-0 file:bg-primary file:text-primary-foreground file:px-3 file:py-1 file:text-xs"
        />
        {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </label>

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
                <span className="text-muted-foreground shrink-0">
                  {(it.size / 1024).toFixed(0)} KB
                </span>
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
