import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { uniqueChannelName } from "@/lib/realtime/channelName";

export interface ComentarioAnexo {
  path: string;
  nome: string;
  tamanho?: number;
  mime?: string;
}

export interface ChinaDocComentario {
  id: string;
  documento_id: string;
  submissao_id: string;
  tipo_documento: string;
  autor_id: string;
  autor_nome: string;
  lado: "brasil" | "china";
  conteudo: string;
  mentions: string[];
  anexos: ComentarioAnexo[];
  ref_rodada: number | null;
  created_at: string;
  updated_at: string;
}

const BUCKET = "china-documentos";

async function getUserName(): Promise<{ id: string; nome: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { id: "", nome: "Usuário" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("nome")
    .eq("id", user.id)
    .single();
  return {
    id: user.id,
    nome: (profile as any)?.nome || user.email?.split("@")[0] || "Usuário",
  };
}

async function uploadAnexos(
  files: File[],
  basePath: string,
): Promise<ComentarioAnexo[]> {
  const out: ComentarioAnexo[] = [];
  for (const f of files) {
    const safe = f.name.replace(/[^\w.\-]+/g, "_");
    const path = `${basePath}/${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, f, {
      contentType: f.type || "application/octet-stream",
      upsert: false,
    });
    if (error) throw error;
    out.push({ path, nome: f.name, tamanho: f.size, mime: f.type });
  }
  return out;
}

export function useComentariosPorDocumento(documentoId: string | undefined) {
  return useQuery({
    queryKey: ["china-doc-comentarios", documentoId],
    enabled: !!documentoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_doc_comentarios" as any)
        .select("*")
        .eq("documento_id", documentoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ChinaDocComentario[];
    },
  });
}

export function useAdicionarComentario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      documento_id: string;
      submissao_id: string;
      tipo_documento: string;
      lado: "brasil" | "china";
      conteudo: string;
      mentions?: string[];
      anexos?: File[];
      ref_rodada?: number | null;
    }) => {
      const user = await getUserName();
      const conteudo = params.conteudo.trim();
      if (!conteudo && !(params.anexos?.length)) {
        throw new Error("Adicione um texto ou um arquivo de complemento.");
      }

      const { data: ins, error: insErr } = await supabase
        .from("china_doc_comentarios" as any)
        .insert({
          documento_id: params.documento_id,
          submissao_id: params.submissao_id,
          tipo_documento: params.tipo_documento,
          autor_id: user.id,
          autor_nome: user.nome,
          lado: params.lado,
          conteudo,
          mentions: params.mentions || [],
          anexos: [],
          ref_rodada: params.ref_rodada ?? null,
        } as any)
        .select("id")
        .single();
      if (insErr) throw insErr;

      const comentarioId = (ins as any).id as string;

      if (params.anexos?.length) {
        const anexos = await uploadAnexos(
          params.anexos,
          `comentarios/${params.submissao_id}/${comentarioId}`,
        );
        await supabase
          .from("china_doc_comentarios" as any)
          .update({ anexos } as any)
          .eq("id", comentarioId);
      }

      return comentarioId;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["china-doc-comentarios", vars.documento_id] });
      toast.success("Comentário registrado.");
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao registrar comentário."),
  });
}

export function useExcluirComentario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; documento_id: string }) => {
      const { error } = await supabase
        .from("china_doc_comentarios" as any)
        .delete()
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["china-doc-comentarios", vars.documento_id] });
      toast.success("Comentário removido.");
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao remover."),
  });
}
