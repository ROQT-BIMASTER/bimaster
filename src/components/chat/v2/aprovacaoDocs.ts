/**
 * Helpers de upload/download dos documentos de aprovação do chat
 * (bucket privado `aprovacao-documentos`). Path casa com as policies:
 * foldername[1] = conversa_id (checa participação), foldername[3] = uploader uid.
 */
import { supabase } from "@/integrations/supabase/client";
import { validateFileForUpload } from "@/lib/utils/file-security";

const BUCKET = "aprovacao-documentos";

/** SHA-256 do arquivo em hex — usado na trilha de auditoria da assinatura. */
export async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function uploadAprovacaoDoc(
  conversaId: string,
  aprovacaoId: string,
  userId: string,
  file: File,
): Promise<{ storage_path: string; mime_type: string; size_bytes: number; hash: string }> {
  // validação de segurança (extensão/MIME/tamanho/double-extension/magic-bytes),
  // mesmo helper usado nos anexos do chat (chat-anexos).
  const check = await validateFileForUpload(file);
  if (!check.valid) throw new Error(check.error ?? "Arquivo inválido");
  // hash calculado no cliente (Web Crypto) — base da trilha de auditoria
  const hash = await sha256Hex(file);
  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 80);
  const path = `${conversaId}/${aprovacaoId}/${userId}/${Date.now()}_${safe}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  return {
    storage_path: path,
    mime_type: file.type || "application/octet-stream",
    size_bytes: file.size,
    hash,
  };
}

/** Baixa via Blob (download seguro — não expõe signed URL navegável). */
export async function downloadAprovacaoDoc(path: string, fileName: string): Promise<void> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw error ?? new Error("Falha ao baixar o documento");
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || "documento";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
