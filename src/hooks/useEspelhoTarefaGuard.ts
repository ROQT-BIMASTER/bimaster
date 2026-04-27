import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TarefaEspelho } from "@/hooks/useProcessoTarefaEspelho";

/**
 * Helper: dada uma tarefa do projeto (ou subtarefa), retorna o espelho ATIVO
 * (status != concluida/cancelada) que aponta para ela. Usado para decidir se
 * a conclusão exige seleção de documento oficial.
 */
export function useEspelhoAtivoDaTarefa(tarefaId: string | null | undefined) {
  return useQuery({
    queryKey: ["espelho-ativo-da-tarefa", tarefaId],
    enabled: !!tarefaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("processo_tarefa_espelho")
        .select("*")
        .eq("projeto_tarefa_id", tarefaId)
        .in("status", ["pendente", "em_andamento"])
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as TarefaEspelho | null;
    },
  });
}

/**
 * Hook de orquestração para uso em telas do módulo Projetos.
 * Devolve um handler que, ao tentar concluir uma tarefa, primeiro verifica
 * se ela tem espelho ativo. Se tiver, abre o dialog de evidência e adia
 * a conclusão até o usuário escolher o documento oficial.
 */
export function useConcluirTarefaComEspelhoGuard() {
  const [pendingEspelho, setPendingEspelho] = useState<TarefaEspelho | null>(null);

  const guard = useCallback(
    async (
      tarefaId: string,
      isCompleting: boolean,
      fallbackToggle: () => Promise<void> | void,
    ) => {
      if (!isCompleting) {
        // Reabertura: não exige evidência
        await fallbackToggle();
        return;
      }
      const { data } = await (supabase as any)
        .from("processo_tarefa_espelho")
        .select("*")
        .eq("projeto_tarefa_id", tarefaId)
        .in("status", ["pendente", "em_andamento"])
        .limit(1)
        .maybeSingle();

      if (data) {
        // Tem espelho ativo: abre dialog (a conclusão real vem do RPC)
        setPendingEspelho(data as TarefaEspelho);
      } else {
        await fallbackToggle();
      }
    },
    [],
  );

  return {
    pendingEspelho,
    setPendingEspelho,
    guardConcluir: guard,
  };
}
