
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Anotacao {
  tipo: string;
  descricao: string;
  campo?: string;
}

export interface Revisao {
  id: string;
  documento_id: string;
  submissao_id: string;
  rodada: number;
  resultado: string;
  motivo_rejeicao: string | null;
  anotacoes: Anotacao[];
  revisado_por: string | null;
  contestado_por: string | null;
  contestacao_texto: string | null;
  created_at: string;
}

export function useRevisoesPorSubmissao(submissaoId: string | undefined) {
  return useQuery({
    queryKey: ["china-revisoes", submissaoId],
    enabled: !!submissaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_doc_revisoes" as any)
        .select("*")
        .eq("submissao_id", submissaoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Revisao[];
    },
  });
}

export function useCriarRevisao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      documento_id: string;
      submissao_id: string;
      resultado: "aprovado" | "rejeitado";
      motivo_rejeicao?: string;
      anotacoes?: Anotacao[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Get current round
      const { data: existing } = await supabase
        .from("china_doc_revisoes" as any)
        .select("rodada")
        .eq("documento_id", params.documento_id)
        .order("rodada", { ascending: false })
        .limit(1);

      const rodada = ((existing as any)?.[0]?.rodada || 0) + 1;

      const { error } = await supabase
        .from("china_doc_revisoes" as any)
        .insert({
          documento_id: params.documento_id,
          submissao_id: params.submissao_id,
          rodada,
          resultado: params.resultado,
          motivo_rejeicao: params.motivo_rejeicao || null,
          anotacoes: params.anotacoes || [],
          revisado_por: user?.id,
        } as any);
      if (error) throw error;

      // Update document status
      await supabase
        .from("china_produto_documentos" as any)
        .update({ status: params.resultado } as any)
        .eq("id", params.documento_id);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["china-revisoes", vars.submissao_id] });
      queryClient.invalidateQueries({ queryKey: ["china-ficha-docs", vars.submissao_id] });
      const msg = vars.resultado === "aprovado"
        ? "Documento aprovado! 文件已批准！"
        : "Documento rejeitado. 文件已拒绝。";
      toast.success(msg);
    },
  });
}

export function useContestarRevisao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      revisao_id: string;
      submissao_id: string;
      documento_id: string;
      contestacao_texto: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      await supabase
        .from("china_doc_revisoes" as any)
        .update({
          resultado: "contestado",
          contestado_por: user?.id,
          contestacao_texto: params.contestacao_texto,
        } as any)
        .eq("id", params.revisao_id);

      await supabase
        .from("china_produto_documentos" as any)
        .update({ status: "contestado" } as any)
        .eq("id", params.documento_id);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["china-revisoes", vars.submissao_id] });
      queryClient.invalidateQueries({ queryKey: ["china-ficha-docs", vars.submissao_id] });
      toast.success("Contestação enviada! 异议已提交！");
    },
  });
}
