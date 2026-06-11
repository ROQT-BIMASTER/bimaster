/**
 * useUploadChinaDocumento
 * ------------------------------------------------------------------
 * Hook compartilhado para anexar um documento ao checklist de uma submissão
 * China. Extrai a lógica que vivia duplicada em ChinaChecklistFocusMode.tsx
 * (uploadAndGetSignedUrl + insert/update em china_produto_documentos) para
 * que telas menores (drawer focado da Caixa de Entrada) possam reutilizá-la
 * sem rascunhar o Modo Foco.
 */
import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uploadAndGetSignedUrl } from "@/lib/utils/storage-helper";
import { sanitizeStorageSegment } from "@/lib/china/sanitizeTipoKey";
import { toast } from "sonner";

export interface UploadVars {
  submissaoId: string;
  tipo: string;
  file: File;
  /** "rascunho" mantém o documento como pendente de envio; "pendente" simula despacho direto. */
  status?: "rascunho" | "pendente";
  observacoesChina?: string | null;
}

export interface UploadResult {
  documento_id: string | null;
  arquivo_path: string;
  signed_url: string;
}

export function useUploadChinaDocumento() {
  const qc = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadAndAttach = useCallback(
    async ({
      submissaoId,
      tipo,
      file,
      status = "rascunho",
      observacoesChina,
    }: UploadVars): Promise<UploadResult | null> => {
      setError(null);
      setIsUploading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          const msg = "Sua sessão expirou. Faça login novamente.";
          setError(msg);
          toast.error(msg);
          return null;
        }

        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const safeTipo = sanitizeStorageSegment(tipo);
        const path = `${session.user.id}/${submissaoId}/${safeTipo}/${Date.now()}_${safeName}`;

        const { signedUrl, error: uploadError } = await uploadAndGetSignedUrl(
          "china-documentos",
          path,
          file,
        );
        if (uploadError || !signedUrl) {
          const msg = uploadError?.message ?? "Falha ao subir o arquivo.";
          setError(msg);
          toast.error(msg);
          return null;
        }

        // Reaproveita placeholder "planejado" se existir para esse tipo nesta submissão.
        const { data: existing } = await (supabase as any)
          .from("china_produto_documentos")
          .select("id")
          .eq("submissao_id", submissaoId)
          .eq("tipo_documento", tipo)
          .eq("status", "planejado")
          .limit(1)
          .maybeSingle();

        const payload: Record<string, unknown> = {
          arquivo_url: signedUrl,
          arquivo_path: path,
          nome_arquivo: file.name,
          status,
        };
        if (typeof observacoesChina === "string") {
          payload.observacoes_china = observacoesChina.trim() || null;
        }

        let documentoId: string | null = null;
        if (existing?.id) {
          const { error: updErr } = await (supabase as any)
            .from("china_produto_documentos")
            .update(payload)
            .eq("id", existing.id);
          if (updErr) throw updErr;
          documentoId = existing.id as string;
        } else {
          const { data: inserted, error: insErr } = await (supabase as any)
            .from("china_produto_documentos")
            .insert({ submissao_id: submissaoId, tipo_documento: tipo, ...payload })
            .select("id")
            .single();
          if (insErr) throw insErr;
          documentoId = (inserted?.id as string) ?? null;
        }

        // Invalida tudo que depende do checklist desta submissão.
        qc.invalidateQueries({ queryKey: ["china-mailbox-dataset"] });
        qc.invalidateQueries({ queryKey: ["china-ficha-docs", submissaoId] });
        qc.invalidateQueries({ queryKey: ["china-checklist", submissaoId] });
        qc.invalidateQueries({ queryKey: ["checklist-custom-items", submissaoId] });

        toast.success("Documento anexado.");
        return { documento_id: documentoId, arquivo_path: path, signed_url: signedUrl };
      } catch (err: any) {
        const msg = err?.message ?? "Falha inesperada ao anexar o documento.";
        setError(msg);
        toast.error(msg);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [qc],
  );

  /** Atualiza apenas a observação da China em um documento já existente. */
  const updateObservacaoChina = useCallback(
    async (documentoId: string, observacaoChina: string | null) => {
      try {
        const { error: e } = await (supabase as any)
          .from("china_produto_documentos")
          .update({ observacoes_china: observacaoChina?.trim() || null })
          .eq("id", documentoId);
        if (e) throw e;
        qc.invalidateQueries({ queryKey: ["china-mailbox-dataset"] });
        return true;
      } catch (err: any) {
        toast.error(err?.message ?? "Falha ao salvar observação.");
        return false;
      }
    },
    [qc],
  );

  return { uploadAndAttach, updateObservacaoChina, isUploading, error };
}
