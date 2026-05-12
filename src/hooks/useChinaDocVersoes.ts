import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ChinaDocVersao {
  id: string;
  documento_id: string;
  submissao_id: string;
  tipo_documento: string;
  rodada: number;
  arquivo_path: string;
  arquivo_url: string | null;
  nome_arquivo: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  status_no_momento: string;
  revisao_id: string | null;
  enviada_por: string | null;
  enviada_em: string;
}

export function useVersoesPorDocumento(documentoId: string | undefined) {
  return useQuery({
    queryKey: ["china-doc-versoes", documentoId],
    enabled: !!documentoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_doc_versoes" as any)
        .select("*")
        .eq("documento_id", documentoId)
        .order("rodada", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ChinaDocVersao[];
    },
  });
}

export function useVersoesPorSubmissao(submissaoId: string | undefined) {
  return useQuery({
    queryKey: ["china-doc-versoes-submissao", submissaoId],
    enabled: !!submissaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_doc_versoes" as any)
        .select("*")
        .eq("submissao_id", submissaoId)
        .order("rodada", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ChinaDocVersao[];
    },
  });
}
