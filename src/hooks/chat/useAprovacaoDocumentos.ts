/**
 * useAprovacaoDocumentos — lista os documentos anexados a uma aprovação do
 * chat (tabela chat_aprovacao_documentos), com realtime. A escrita acontece
 * via RPC rpc_chat_aprovacao_anexar_documento (ver NovaAprovacaoDialog).
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime/channelName";

export interface AprovacaoDocumento {
  id: string;
  aprovacao_id: string;
  conversa_id: string;
  uploader_id: string;
  titulo: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  hash_arquivo: string | null;
  signed_storage_path: string | null;
  status: "anexado" | "assinado";
  assinado_por: string | null;
  assinado_em: string | null;
  created_at: string;
}

export function useAprovacaoDocumentos(aprovacaoId: string | null) {
  const qc = useQueryClient();
  const queryKey = ["chat-aprovacao-docs", aprovacaoId];

  const query = useQuery({
    queryKey,
    enabled: !!aprovacaoId,
    staleTime: 15_000,
    queryFn: async (): Promise<AprovacaoDocumento[]> => {
      if (!aprovacaoId) return [];
      const { data, error } = await supabase
        .from("chat_aprovacao_documentos" as any)
        .select("*")
        .eq("aprovacao_id", aprovacaoId)
        .order("created_at");
      if (error) throw error;
      return (data as unknown as AprovacaoDocumento[]) ?? [];
    },
  });

  useEffect(() => {
    if (!aprovacaoId) return;
    const ch = supabase
      .channel(uniqueChannelName(`aprov-docs-${aprovacaoId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_aprovacao_documentos", filter: `aprovacao_id=eq.${aprovacaoId}` },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [aprovacaoId, qc]);

  return query;
}
