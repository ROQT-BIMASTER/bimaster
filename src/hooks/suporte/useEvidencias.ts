import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { watermarkImageBlob, isImage } from "@/lib/suporte/watermark";

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
  trilha_id: string | null;
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
  acao: "download" | "view" | "export";
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

/** Autores únicos das evidências (para filtro), com nome via profiles. */
export function useEvidenciaAutores(evidencias: SuporteEvidencia[]) {
  const ids = Array.from(new Set(evidencias.map((e) => e.uploaded_by))).sort();
  return useQuery({
    queryKey: ["suporte-evidencia-autores", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", ids);
      if (error) throw error;
      const map = new Map<string, { id: string; nome: string; email: string }>();
      (data ?? []).forEach((p: any) =>
        map.set(p.id, { id: p.id, nome: p.nome ?? p.email ?? p.id, email: p.email ?? "" }),
      );
      return map;
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
  trilha_id?: string | null;
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
        await supabase.storage.from(BUCKET).remove([path]);
        throw error;
      }

      const evidenciaId = data as string;

      if (input.trilha_id) {
        await (supabase as any).rpc("rpc_suporte_vincular_evidencia", {
          p_evidencia_id: evidenciaId,
          p_parecer_id: input.parecer_id ?? null,
          p_trilha_id: input.trilha_id,
        });
      }

      return evidenciaId;
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

async function registrarAcesso(
  evidenciaId: string,
  acao: "download" | "view" | "export",
) {
  await (supabase as any).rpc("rpc_suporte_registrar_acesso_evidencia", {
    p_evidencia_id: evidenciaId,
    p_acao: acao,
    p_user_agent: navigator.userAgent.slice(0, 500),
  });
}

async function fetchProfileForWatermark() {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  const email = userData.user?.email ?? null;
  let nome = email ?? "usuário";
  if (uid) {
    const { data } = await supabase
      .from("profiles")
      .select("nome, email")
      .eq("id", uid)
      .maybeSingle();
    if (data?.nome) nome = data.nome;
    else if (data?.email) nome = data.email;
  }
  return { uid, email, nome };
}

/**
 * Baixa a evidência e, se `applyWatermark`, aplica marca visual em imagens.
 * (PDFs marcados são baixados como .pdf reagrupado via export; download direto
 *  de PDF entrega o original com registro no log — o watermark completo só é
 *  visualizável pelo preview.)
 */
export function useBaixarEvidencia() {
  return useMutation({
    mutationFn: async (params: {
      evidencia: SuporteEvidencia;
      applyWatermark?: boolean;
    }) => {
      const { evidencia, applyWatermark } = params;
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .download(evidencia.storage_path);
      if (error) throw error;

      await registrarAcesso(evidencia.id, "download");

      let outBlob: Blob = data;
      let outName = evidencia.nome_arquivo;

      if (applyWatermark && isImage(evidencia.mime)) {
        const prof = await fetchProfileForWatermark();
        outBlob = await watermarkImageBlob(data, {
          usuario: prof.nome,
          email: prof.email,
          ticketId: evidencia.ticket_id,
          hashCurto: evidencia.hash_sha256.slice(0, 10),
        });
        outName = outName.replace(/(\.[^.]+)?$/, (m) => `_marcado${m || ".png"}`);
      }

      const url = URL.createObjectURL(outBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = outName;
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

/** Baixa o blob puro (sem trigger de download) e registra 'view'. */
export async function fetchEvidenciaBlob(evidencia: SuporteEvidencia) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(evidencia.storage_path);
  if (error) throw error;
  await registrarAcesso(evidencia.id, "view");
  return data;
}

/** Idem, mas registra como 'export' (para o dossiê consolidado). */
export async function fetchEvidenciaBlobForExport(evidencia: SuporteEvidencia) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(evidencia.storage_path);
  if (error) throw error;
  await registrarAcesso(evidencia.id, "export");
  return data;
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

export interface VincularEvidenciaInput {
  evidencia_id: string;
  ticket_id: string;
  parecer_id: string | null;
  trilha_id: string | null;
}

export function useVincularEvidencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: VincularEvidenciaInput) => {
      const { error } = await (supabase as any).rpc(
        "rpc_suporte_vincular_evidencia",
        {
          p_evidencia_id: input.evidencia_id,
          p_parecer_id: input.parecer_id,
          p_trilha_id: input.trilha_id,
        },
      );
      if (error) throw error;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["suporte-evidencias", vars.ticket_id] });
      toast.success("Vínculo atualizado");
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Falha ao vincular");
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
