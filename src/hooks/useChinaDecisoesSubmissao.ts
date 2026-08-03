/**
 * Última decisão homologada por documento de uma submissão China.
 *
 * Alimenta o checklist (Modo Foco) para que a equipe da China veja, em tempo
 * real, quem movimentou o documento (em análise / aprovado / não aprovado),
 * com autor, método de confirmação (senha ou sessão) e data e hora.
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DecisaoDocumento {
  documento_id: string;
  decisao: string;
  parecer: string | null;
  decidido_por_nome: string | null;
  decidido_por_email: string | null;
  metodo_confirmacao: string;
  created_at: string;
}

export const DECISAO_DOC_LABEL: Record<string, string> = {
  em_analise: "Em análise",
  aprovado: "Aprovado",
  rejeitado: "Não aprovado",
  reaberto: "Reaberto para nova análise",
  pendente: "Pendente de aprovação",
};

export function useChinaDecisoesSubmissao(submissaoId: string | undefined) {
  return useQuery({
    queryKey: ["china-doc-decisoes", submissaoId],
    enabled: !!submissaoId,
    staleTime: 10_000,
    queryFn: async (): Promise<Map<string, DecisaoDocumento>> => {
      const { data, error } = await (supabase
        .from("china_doc_aprovacoes_audit" as any)
        .select(
          "documento_id, decisao, parecer, decidido_por_nome, decidido_por_email, metodo_confirmacao, created_at",
        )
        .eq("submissao_id", submissaoId!)
        .order("created_at", { ascending: false })
        .limit(500) as any);
      if (error) throw error;
      const map = new Map<string, DecisaoDocumento>();
      for (const r of ((data || []) as DecisaoDocumento[])) {
        if (!map.has(r.documento_id)) map.set(r.documento_id, r);
      }
      return map;
    },
  });
}

/**
 * Mantém documentos e trilha de decisões sincronizados em tempo real com o
 * Kanban/Projeto: qualquer mudança em `china_produto_documentos` recarrega o
 * checklist e as decisões da submissão.
 */
export function useChinaDocsRealtime(submissaoId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!submissaoId) return;
    const channel = supabase
      .channel(`china-docs-submissao-${submissaoId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "china_produto_documentos",
          filter: `submissao_id=eq.${submissaoId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["china-ficha-docs", submissaoId] });
          qc.invalidateQueries({ queryKey: ["china-doc-decisoes", submissaoId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [submissaoId, qc]);
}
