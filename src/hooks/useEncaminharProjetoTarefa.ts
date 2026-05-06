import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EncaminharProjetoTarefaInput {
  submissao_id: string;
  projeto_id: string;
  projeto_nome: string;
  tarefa_id?: string | null;
  tarefa_titulo?: string | null;
  secao_id?: string | null;
  observacao?: string;
  produto_codigo?: string;
  produto_nome?: string;
}

/**
 * Encaminha uma submissão recebida da China a um Projeto (e opcionalmente uma
 * Tarefa específica). Cria/atualiza:
 *  - vínculo em `china_submissao_tarefa_vinculos` (se houver tarefa)
 *  - vínculo "leve" em `produtos_brasil` (sempre)
 *  - registro `product_process` (se ainda não existir) na etapa `projeto`
 *  - `process_events` do tipo `encaminhamento_projeto` com metadata
 *  - notificação ao responsável da tarefa (ou ao criador do projeto)
 */
export function useEncaminharProjetoTarefa() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: EncaminharProjetoTarefaInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      const remetenteId = user?.id ?? null;

      let nomeRem: string | null = null;
      if (remetenteId) {
        const { data: profile } = await supabase
          .from("profiles").select("nome").eq("id", remetenteId).maybeSingle();
        nomeRem = profile?.nome ?? null;
      }

      // 1. Vínculo leve em produtos_brasil (idempotente)
      const { data: prodBrasilExist } = await (supabase
        .from("produtos_brasil" as any)
        .select("id")
        .eq("submissao_china_id", input.submissao_id)
        .maybeSingle() as any);

      if (!prodBrasilExist) {
        await (supabase.from("produtos_brasil" as any).insert({
          submissao_china_id: input.submissao_id,
          projeto_id: input.projeto_id,
          china_codigo: input.produto_codigo ?? null,
          china_nome: input.produto_nome ?? null,
          status: "aguardando_precadastro",
        }) as any);
      } else {
        await (supabase.from("produtos_brasil" as any)
          .update({ projeto_id: input.projeto_id })
          .eq("id", prodBrasilExist.id) as any);
      }

      // 2. Vínculo de tarefa (se escolhida)
      if (input.tarefa_id) {
        await (supabase.from("china_submissao_tarefa_vinculos" as any).insert({
          submissao_id: input.submissao_id,
          tarefa_id: input.tarefa_id,
          secao_id: input.secao_id ?? null,
          projeto_id: input.projeto_id,
          created_by: remetenteId,
        }) as any);
      }

      // 3. product_process — garantir existência
      const { data: proc } = await (supabase
        .from("product_process" as any)
        .select("id")
        .eq("produto_tipo", "china")
        .eq("produto_ref_id", input.submissao_id)
        .maybeSingle() as any);

      let processId: string | null = proc?.id ?? null;
      if (!processId) {
        const { data: newProc } = await (supabase
          .from("product_process" as any)
          .insert({
            produto_tipo: "china",
            produto_ref_id: input.submissao_id,
            criado_por: remetenteId,
            etapa_atual: "projeto",
          })
          .select("id")
          .single() as any);
        processId = newProc?.id ?? null;
      }

      // 4. process_events
      if (processId) {
        const destino = input.tarefa_titulo
          ? `${input.projeto_nome} → ${input.tarefa_titulo}`
          : input.projeto_nome;
        await (supabase.from("process_events" as any).insert({
          process_id: processId,
          tipo_evento: "encaminhamento_projeto",
          modulo_origem: "vincular_china",
          descricao: `Encaminhado a ${destino}${input.observacao ? ` — ${input.observacao}` : ""}`,
          usuario_id: remetenteId,
          usuario_nome: nomeRem,
          ref_entity_id: input.tarefa_id ?? input.projeto_id,
          ref_entity_table: input.tarefa_id ? "projeto_tarefas" : "projetos",
          metadata: {
            projeto_id: input.projeto_id,
            projeto_nome: input.projeto_nome,
            tarefa_id: input.tarefa_id ?? null,
            tarefa_titulo: input.tarefa_titulo ?? null,
            submissao_id: input.submissao_id,
            produto_codigo: input.produto_codigo ?? null,
            produto_nome: input.produto_nome ?? null,
            observacao: input.observacao ?? null,
          },
        }) as any);
      }

      // 5. Notificação ao destinatário (responsável da tarefa, ou criador do projeto)
      let destinatarioId: string | null = null;
      if (input.tarefa_id) {
        const { data: tarefa } = await supabase
          .from("projeto_tarefas")
          .select("responsavel_id, criador_id")
          .eq("id", input.tarefa_id)
          .maybeSingle();
        destinatarioId = tarefa?.responsavel_id ?? tarefa?.criador_id ?? null;
      }
      if (!destinatarioId) {
        const { data: projeto } = await supabase
          .from("projetos")
          .select("criador_id")
          .eq("id", input.projeto_id)
          .maybeSingle();
        destinatarioId = projeto?.criador_id ?? null;
      }

      if (destinatarioId && destinatarioId !== remetenteId) {
        const tituloProd = input.produto_codigo
          ? `${input.produto_codigo} — ${input.produto_nome ?? ""}`.trim()
          : input.produto_nome ?? "Submissão China";
        await supabase.from("notifications").insert({
          user_id: destinatarioId,
          type: "china_encaminhamento_projeto",
          title: `Encaminhamento da China: ${tituloProd}`,
          message: input.tarefa_titulo
            ? `Vinculado à tarefa "${input.tarefa_titulo}" no projeto ${input.projeto_nome}.${input.observacao ? ` ${input.observacao}` : ""}`
            : `Vinculado ao projeto ${input.projeto_nome}.${input.observacao ? ` ${input.observacao}` : ""}`,
          action_url: input.tarefa_id
            ? `/dashboard/projetos/${input.projeto_id}?tarefa=${input.tarefa_id}`
            : `/dashboard/projetos/${input.projeto_id}`,
        } as any);
      }

      return { processId };
    },
    onSuccess: () => {
      toast.success("Encaminhado ao projeto");
      qc.invalidateQueries({ queryKey: ["china-tarefa-vinculos"] });
      qc.invalidateQueries({ queryKey: ["china-tarefa-vinculos-all"] });
      qc.invalidateQueries({ queryKey: ["china-produto-brasil-vinculos"] });
      qc.invalidateQueries({ queryKey: ["process-events"] });
    },
    onError: (e: any) => {
      if (e?.code === "23505") {
        toast.error("Esta tarefa já está vinculada a esta submissão");
      } else {
        toast.error("Falha ao encaminhar", { description: e?.message });
      }
    },
  });
}
