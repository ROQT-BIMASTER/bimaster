import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ProjetoCreditoLancamento {
  id: string;
  projeto_id: string;
  mes_referencia: string;
  creditos: number;
  taxa_brl_por_credito: number;
  valor_brl: number;
  observacao: string | null;
  created_at: string;
  created_by: string | null;
}

export interface ProjetoInvestimentoTotal {
  creditos_total: number;
  valor_total_brl: number;
  total_lancamentos: number;
}

export function useProjetoInvestimentoLovable(projetoId: string | undefined) {
  const qc = useQueryClient();

  const total = useQuery({
    queryKey: ["projeto-investimento-lovable-total", projetoId],
    queryFn: async (): Promise<ProjetoInvestimentoTotal> => {
      const { data, error } = await supabase.rpc("get_projeto_investimento_lovable", {
        p_projeto_id: projetoId,
      });
      if (error) throw error;
      const row: any = Array.isArray(data) ? data[0] : data;
      return {
        creditos_total: Number(row?.creditos_total || 0),
        valor_total_brl: Number(row?.valor_total_brl || 0),
        total_lancamentos: Number(row?.total_lancamentos || 0),
      };
    },
    enabled: !!projetoId,
    staleTime: 30_000,
  });

  const lancamentos = useQuery({
    queryKey: ["projeto-investimento-lovable-list", projetoId],
    queryFn: async (): Promise<ProjetoCreditoLancamento[]> => {
      const { data, error } = await supabase
        .from("projeto_creditos_lovable")
        .select("*")
        .eq("projeto_id", projetoId)
        .order("mes_referencia", { ascending: false });
      if (error) throw error;
      return (data || []) as any;
    },
    enabled: !!projetoId,
    staleTime: 30_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["projeto-investimento-lovable-total", projetoId] });
    qc.invalidateQueries({ queryKey: ["projeto-investimento-lovable-list", projetoId] });
  };

  const adicionar = useMutation({
    mutationFn: async (input: {
      mes_referencia: string;
      creditos: number;
      taxa_brl_por_credito: number;
      observacao: string | null;
    }) => {
      const { error } = await supabase.from("projeto_creditos_lovable").insert({
        projeto_id: projetoId!,
        ...input,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Lançamento adicionado");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao adicionar"),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projeto_creditos_lovable").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Lançamento removido");
    },
  });

  return { total, lancamentos, adicionar, remover };
}
