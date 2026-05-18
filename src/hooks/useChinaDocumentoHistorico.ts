/**
 * useChinaDocumentoHistorico — lista versões anteriores de um documento
 * China. Backend mantém o log automaticamente via trigger BEFORE UPDATE
 * em china_produto_documentos (migration 20260518280000).
 *
 * Cada linha do histórico é uma "versão antiga" — a versão ATUAL fica em
 * china_produto_documentos. A UI deve mostrar atual + lista de anteriores.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DocumentoVersaoAnterior {
  id: string;
  documento_id: string | null;
  submissao_id: string;
  tipo_documento: string;
  arquivo_path: string | null;
  arquivo_url: string | null;
  nome_arquivo: string | null;
  status: string;
  observacao: string | null;
  versionado_em: string;
  versionado_por: string | null;
  acao: "atualizado_arquivo" | "mudou_status" | "deletado" | null;
}

export function useChinaDocumentoHistorico(documentoId: string | null | undefined) {
  return useQuery({
    queryKey: ["china-doc-historico", documentoId],
    enabled: !!documentoId,
    staleTime: 60_000,
    queryFn: async (): Promise<DocumentoVersaoAnterior[]> => {
      if (!documentoId) return [];
      const { data, error } = await supabase
        .from("china_produto_documentos_historico" as any)
        .select("*")
        .eq("documento_id", documentoId)
        .order("versionado_em", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown) as DocumentoVersaoAnterior[];
    },
  });
}
