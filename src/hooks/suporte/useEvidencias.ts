import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type EvidenciaCategoria =
  | "prova_juridica"
  | "contrato"
  | "email"
  | "print"
  | "audio"
  | "video"
  | "documento"
  | "outro";

export interface SuporteEvidencia {
  id: string;
  ticket_id: string;
  parecer_id: string | null;
  categoria: EvidenciaCategoria;
  descricao: string | null;
  storage_path: string;
  nome_arquivo: string;
  mime: string | null;
  tamanho: number | null;
  hash_sha256: string;
  uploaded_by: string;
  locked_juridico: boolean;
  locked_at: string | null;
  locked_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SuporteEvidenciaAcesso {
  id: string;
  evidencia_id: string;
  ticket_id: string;
  user_id: string;
  acao: "download" | "view";
  user_agent: string | null;
  created_at: string;
}

const BUCKET = "suporte-evidencias";

export function useTicketEvidencias(ticketId: string | null | undefined) {
  return useQuery({
    queryKey: ["suporte-evidencias", ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("suporte_ticket_evidencias")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SuporteEvidencia[];
    },
  });
}

export function useEvidenciaAcessos(evidenciaId: string | null | undefined) {
  return useQuery({
    queryKey: ["suporte-evidencia-acessos", evidenciaId],
    enabled: !!evidenciaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("suporte_evidencia_acessos")
        .select("*")
        .eq("evidencia_id", evidenciaId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SuporteEvidenciaAcesso[];
    },
  });
}

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface UploadEvidenciaInput {
  ticket_id: string;
  parecer_id?: string | null;
  categoria: EvidenciaCategoria;
  descricao?: string | null;
  file: File;
  marcar_como_prova?: boolean;
}

export function useUploadEvidencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadEvidenciaInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Não autenticado");
      if (input.file.size > 20 * 1024 * 1024) {
        throw new Error("Arquivo excede o limite de 20 MB");
      }

      const hash = await sha256Hex(input.file);
      const safeName = input.file.name.replace(/[^\w.\-]/g, "_");
      const path = `${uid}/${input.ticket_id}/${hash.slice(0, 12)}_${Date.now()}_${safeName}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, input.file, {
          upsert: false,
          contentType: input.file.type || "application/octet-stream",
        });
      if (upErr) throw upErr;

      const { data, error } = await (supabase as any).rpc(
        "rpc_suporte_criar_evidencia",
        {
          p_ticket_id: input.ticket_id,
          p_parecer_id: input.parecer_id ?? null,
          p_categoria: input.categoria,
          p_descricao: input.descricao ?? null,
          p_storage_path: path,
          p_nome_arquivo: input.file.name,
          p_mime: input.file.type || null,
          p_tamanho: input.file.size,
          p_hash_sha256: hash,
          p_marcar_como_prova: !!input.marcar_como_prova,
        },
      );
      if (error) {
        // rollback storage
        await supabase.storage.from(BUCKET).remove([path]);
        throw error;
      }
      return data as string;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ["suporte-evidencias", vars.ticket_id] });
      toast.success("Documento salvo no cofre de provas");
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Falha ao subir documento");
    },
  });
}

export function useBaixarEvidencia() {
  return useMutation({
    mutationFn: async (evidencia: SuporteEvidencia) => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .download(evidencia.storage_path);
      if (error) throw error;

      // registra acesso (fire-and-forget, mas espera para garantir cadeia de custódia)
      await (supabase as any).rpc("rpc_suporte_registrar_acesso_evidencia", {
        p_evidencia_id: evidencia.id,
        p_acao: "download",
        p_user_agent: navigator.userAgent.slice(0, 500),
      });

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = evidencia.nome_arquivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Falha no download");
    },
  });
}

export function useBloquearEvidencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (evidenciaId: string) => {
      const { error } = await (supabase as any).rpc(
        "rpc_suporte_bloquear_evidencia",
        { p_evidencia_id: evidenciaId },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suporte-evidencias"] });
      toast.success("Retenção jurídica aplicada");
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Falha ao aplicar retenção");
    },
  });
}

export const CATEGORIA_LABEL: Record<EvidenciaCategoria, string> = {
  prova_juridica: "Prova jurídica",
  contrato: "Contrato",
  email: "E-mail",
  print: "Print / captura",
  audio: "Áudio",
  video: "Vídeo",
  documento: "Documento",
  outro: "Outro",
};
