import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Retorna o conjunto de `projeto_tarefa_id` que possuem espelho em
 * `processo_tarefa_espelho` para um dado projeto. Usado para bloquear a edição
 * de prazo / início dessas tarefas — o SLA é definido no cadastro do processo.
 */
export function useTarefasComEspelho(projetoId: string | null | undefined) {
  return useQuery({
    queryKey: ["tarefas-com-espelho", projetoId],
    enabled: !!projetoId,
    staleTime: 30_000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await (supabase as any)
        .from("processo_tarefa_espelho")
        .select("projeto_tarefa_id")
        .eq("projeto_id", projetoId!);
      if (error) throw error;
      return new Set<string>((data ?? []).map((r: any) => r.projeto_tarefa_id));
    },
  });
}
