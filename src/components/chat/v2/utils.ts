import { supabase } from "@/integrations/supabase/client";
import { guardFileUpload, reportUploadSuccessShared, reportUploadFailureShared } from "@/lib/utils/sharedUploadGuard";

export function initials(name?: string | null, email?: string | null): string {
  const base = (name ?? email ?? "?").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export function formatHora(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function formatDataChip(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(); ontem.setDate(hoje.getDate() - 1);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, hoje)) return "Hoje";
  if (same(d, ontem)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatRelativo(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const dia = Math.floor(h / 24);
  if (dia < 7) return `${dia}d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export async function uploadChatAnexo(
  conversaId: string,
  userId: string,
  file: File,
): Promise<{ storage_path: string; file_name: string; mime_type: string; size_bytes: number; width?: number; height?: number }> {
  const ok = await guardFileUpload({ file, module: "chat-v2", userId, contextId: conversaId });
  if (!ok) throw new Error("Arquivo não passou na validação de upload.");
  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 80);
  // Ordem das pastas tem que casar com as policies do bucket chat-anexos:
  // foldername[1] = conversa_id (checa participação), foldername[2] = uploader uid.
  const path = `${conversaId}/${userId}/${Date.now()}_${safe}`;
  const { error } = await supabase.storage.from("chat-anexos").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) {
    reportUploadFailureShared({ module: "chat-v2", file, userId, contextId: conversaId, error });
    throw error;
  }
  reportUploadSuccessShared({ module: "chat-v2", file, userId, contextId: conversaId, storagePath: path });
  let width: number | undefined;
  let height: number | undefined;
  if (file.type.startsWith("image/")) {
    try {
      const dim = await readImageDimensions(file);
      width = dim.width; height = dim.height;
    } catch { /* ignore */ }
  }
  return {
    storage_path: path,
    file_name: file.name,
    mime_type: file.type || "application/octet-stream",
    size_bytes: file.size,
    width,
    height,
  };
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

const urlCache = new Map<string, { url: string; exp: number }>();
export async function signedAnexoUrl(path: string): Promise<string | null> {
  const now = Date.now();
  const cached = urlCache.get(path);
  if (cached && cached.exp > now + 30_000) return cached.url;
  const { data, error } = await supabase.storage.from("chat-anexos").createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) return null;
  urlCache.set(path, { url: data.signedUrl, exp: now + 60 * 60 * 1000 });
  return data.signedUrl;
}

export function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function nomeConversa(c: { nome: string | null; outroUsuario?: { nome: string | null; email?: string | null } | null; tipo: string }): string {
  if (c.nome) return c.nome;
  if (c.outroUsuario) return c.outroUsuario.nome ?? c.outroUsuario.email ?? "Sem nome";
  return c.tipo === "group" || c.tipo === "grupo" ? "Grupo" : "Conversa";
}
