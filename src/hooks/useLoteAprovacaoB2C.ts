import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useCriarLoteAprovacaoB2C() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      submissaoId: string;
      configId: string;
      loteNome: string;
      itemIds: string[];
      prazoLote?: string | null;
      politica?: "continuar" | "reiniciar_etapa";
    }) => {
      const { data, error } = await supabase.rpc("rpc_criar_lote_aprovacao_b2c" as any, {
        p_submissao_id: input.submissaoId,
        p_config_id: input.configId,
        p_lote_nome: input.loteNome,
        p_b2c_item_ids: input.itemIds,
        p_prazo_lote: input.prazoLote ?? undefined,
        p_politica: input.politica ?? undefined,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_id, vars) => {
      toast.success("Aprovação interna iniciada");
      qc.invalidateQueries({ queryKey: ["china-checklist-b2c", vars.submissaoId] });
      qc.invalidateQueries({ queryKey: ["lotes-aprovacao", "submissao", vars.submissaoId] });
      qc.invalidateQueries({ queryKey: ["china-unified-timeline"] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao iniciar aprovação"),
  });
}
