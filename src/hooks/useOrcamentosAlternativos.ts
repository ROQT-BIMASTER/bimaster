import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { uploadAndGetSignedUrl } from "@/lib/utils/storage-helper";

export interface OrcamentoAlternativo {
  id: string;
  revisao_id: string;
  fornecedor_nome: string;
  valor_proposta: number;
  descricao: string | null;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  validade: string | null;
  selecionado: boolean;
  created_by: string | null;
  created_at: string;
}

export function useOrcamentosAlternativos(revisaoId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ["orcamentos-alternativos", revisaoId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!revisaoId) return [];
      const { data, error } = await supabase
        .from("revisao_orcamentos_alternativos")
        .select("*")
        .eq("revisao_id", revisaoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as OrcamentoAlternativo[];
    },
    enabled: !!revisaoId,
  });

  const createMutation = useMutation({
    mutationFn: async (params: {
      revisaoId: string;
      fornecedorNome: string;
      valorProposta: number;
      descricao?: string;
      validade?: string;
      arquivo?: File;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      let arquivoUrl: string | null = null;
      let arquivoNome: string | null = null;

      if (params.arquivo) {
        const ts = Date.now();
        const filePath = `${user?.id || "anon"}/${ts}_${params.arquivo.name}`;
        const result = await uploadAndGetSignedUrl("revisao-orcamentos", filePath, params.arquivo);
        if (result.error) throw result.error;
        arquivoUrl = result.signedUrl;
        arquivoNome = params.arquivo.name;
      }

      const { error } = await supabase
        .from("revisao_orcamentos_alternativos")
        .insert({
          revisao_id: params.revisaoId,
          fornecedor_nome: params.fornecedorNome,
          valor_proposta: params.valorProposta,
          descricao: params.descricao || null,
          validade: params.validade || null,
          arquivo_url: arquivoUrl,
          arquivo_nome: arquivoNome,
          created_by: user?.id || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Orçamento adicionado com sucesso!");
    },
    onError: (err: Error) => {
      toast.error("Erro ao adicionar orçamento: " + err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("revisao_orcamentos_alternativos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Orçamento removido.");
    },
  });

  const selectMutation = useMutation({
    mutationFn: async ({ id, revisaoId, fornecedorNome }: { id: string; revisaoId: string; fornecedorNome: string }) => {
      // Desmarcar todos
      await supabase
        .from("revisao_orcamentos_alternativos")
        .update({ selecionado: false })
        .eq("revisao_id", revisaoId);
      // Marcar o selecionado
      const { error } = await supabase
        .from("revisao_orcamentos_alternativos")
        .update({ selecionado: true })
        .eq("id", id);
      if (error) throw error;
      // Atualizar substituido_por na revisão
      await supabase
        .from("contas_pagar_revisao")
        .update({ substituido_por: fornecedorNome })
        .eq("id", revisaoId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["plano-revisoes"] });
      toast.success("Fornecedor selecionado como substituto!");
    },
  });

  return {
    orcamentos: query.data || [],
    isLoading: query.isLoading,
    addOrcamento: createMutation.mutateAsync,
    isAdding: createMutation.isPending,
    deleteOrcamento: deleteMutation.mutate,
    selectOrcamento: selectMutation.mutate,
  };
}
