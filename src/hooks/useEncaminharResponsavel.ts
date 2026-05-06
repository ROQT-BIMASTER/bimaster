import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EncaminharResponsavelInput {
  submissao_id: string;
  responsavel_id: string;
  responsavel_nome: string;
  observacao: string;
  produto_codigo?: string;
  produto_nome?: string;
}

/**
 * Encaminha uma submissão da China diretamente a um responsável (Brasil).
 * Cria notificação para o responsável e — se já existir um process associado
 * à submissão — registra um process_event do tipo `encaminhamento_responsavel`.
 */
export function useEncaminharResponsavel() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: EncaminharResponsavelInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      const remetenteId = user?.id;

      // 1. Notificação ao responsável
      const tituloProd = input.produto_codigo
        ? `${input.produto_codigo} — ${input.produto_nome ?? ""}`.trim()
        : input.produto_nome ?? "Submissão China";

      await supabase.from("notifications").insert({
        user_id: input.responsavel_id,
        type: "china_encaminhamento",
        title: `Encaminhamento da China: ${tituloProd}`,
        message: input.observacao || "Você recebeu um envio da China para acompanhamento.",
        action_url: `/dashboard/projetos/vincular-china?sub=${input.submissao_id}`,
      } as any);

      // 2. Registro em process_events, se houver process
      const { data: proc } = await (supabase
        .from("product_process" as any)
        .select("id")
        .eq("produto_tipo", "china")
        .eq("produto_ref_id", input.submissao_id)
        .maybeSingle() as any);

      if (proc?.id) {
        let nomeRem: string | null = null;
        if (remetenteId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("nome")
            .eq("id", remetenteId)
            .maybeSingle();
          nomeRem = profile?.nome ?? null;
        }
        await (supabase.from("process_events" as any).insert({
          process_id: proc.id,
          tipo_evento: "encaminhamento_responsavel",
          modulo_origem: "vincular_china",
          descricao: `Encaminhado a ${input.responsavel_nome}${input.observacao ? ` — ${input.observacao}` : ""}`,
          usuario_id: remetenteId,
          usuario_nome: nomeRem,
          ref_entity_id: input.responsavel_id,
          ref_entity_table: "profiles",
          metadata: { observacao: input.observacao },
        }) as any);
      }
    },
    onSuccess: () => {
      toast.success("Encaminhado ao responsável");
      qc.invalidateQueries({ queryKey: ["china-mailbox"] });
      qc.invalidateQueries({ queryKey: ["process-events"] });
      qc.invalidateQueries({ queryKey: ["china-dispatch-history"] });
    },
    onError: (e: any) => {
      toast.error("Falha ao encaminhar", { description: e?.message });
    },
  });
}
