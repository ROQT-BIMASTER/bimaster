import { toFriendlyPermissionMessage } from "@/lib/utils/permissionErrors";
// Hooks específicos da Vincular China para reutilizar a infra de Lotes de Aprovação
// (templates globais + RPCs do módulo Projetos), porém ancorados em `submissao_id`
// em vez de `tarefa_id`.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { LoteAprovacao } from "@/hooks/useLoteAprovacao";

export function useLotesDaSubmissao(submissaoId: string | undefined) {
  return useQuery({
    queryKey: ["lotes-aprovacao", "submissao", submissaoId],
    enabled: !!submissaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fluxo_aprovacao_instancias")
        .select("*")
        .eq("submissao_id", submissaoId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as LoteAprovacao[];
    },
  });
}

export function useCriarLoteAprovacaoSubmissao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      submissaoId: string;
      configId: string;
      loteNome: string;
      documentoIds?: string[];
      prazoLote?: string | null;
      politica?: "continuar" | "reiniciar_etapa";
    }) => {
      const { data, error } = await supabase.rpc("rpc_criar_lote_aprovacao_china" as any, {
        p_submissao_id: input.submissaoId,
        p_config_id: input.configId,
        p_lote_nome: input.loteNome,
        p_documento_ids: input.documentoIds ?? null,
        p_prazo_lote: input.prazoLote ?? undefined,
        p_politica: input.politica ?? undefined,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_id, vars) => {
      toast.success("Fluxo de aprovação iniciado");
      qc.invalidateQueries({ queryKey: ["lotes-aprovacao", "submissao", vars.submissaoId] });
      qc.invalidateQueries({ queryKey: ["china-unified-timeline"] });
    },
    onError: (e: any) => toast.error(toFriendlyPermissionMessage(e, "Falha ao iniciar aprovação")),
  });
}
