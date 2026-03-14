
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
  acao_tipo: string | null;
  acao_por_nome: string | null;
  created_at: string;
}

async function getUserName(): Promise<{ id: string; nome: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { id: "", nome: "Usuário" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("nome")
    .eq("id", user.id)
    .single();
  return { id: user.id, nome: (profile as any)?.nome || user.email?.split("@")[0] || "Usuário" };
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
      acao_tipo?: string;
    }) => {
      const user = await getUserName();

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
          revisado_por: user.id,
          acao_tipo: params.acao_tipo || params.resultado,
          acao_por_nome: user.nome,
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

export function useDarCiencia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      documento_id: string;
      submissao_id: string;
    }) => {
      const user = await getUserName();

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
          resultado: "ciencia",
          revisado_por: user.id,
          acao_tipo: "ciencia",
          acao_por_nome: user.nome,
          anotacoes: [],
        } as any);
      if (error) throw error;

      await supabase
        .from("china_produto_documentos" as any)
        .update({ status: "ciencia" } as any)
        .eq("id", params.documento_id);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["china-revisoes", vars.submissao_id] });
      queryClient.invalidateQueries({ queryKey: ["china-ficha-docs", vars.submissao_id] });
      toast.success("Ciência registrada! 已确认！");
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
      const user = await getUserName();

      await supabase
        .from("china_doc_revisoes" as any)
        .update({
          resultado: "contestado",
          contestado_por: user.id,
          contestacao_texto: params.contestacao_texto,
          acao_tipo: "contestar",
          acao_por_nome: user.nome,
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
