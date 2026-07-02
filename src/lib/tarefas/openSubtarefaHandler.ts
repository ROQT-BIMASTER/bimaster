/**
 * Handler compartilhado para abrir uma subtarefa dentro do mesmo drawer
 * (`ProjetoTarefaDetalhe`) sem fechar/reabrir. Usado por Central de Trabalho (v2)
 * e Minhas Tarefas (v1) para garantir paridade da navegação hierárquica.
 *
 * A linha filha é buscada de `projeto_tarefas` e mesclada sobre a tarefa
 * corrente, preservando campos derivados herdados do pai (projeto_nome,
 * papel, etc.) que a subtarefa não carrega isoladamente.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface MakeOpenSubtarefaHandlerArgs<T> {
  supabase: Pick<SupabaseClient, "from">;
  getCurrent: () => T | null;
  setCurrent: (next: T) => void;
}

export function makeOpenSubtarefaHandler<T extends { id: string }>(
  args: MakeOpenSubtarefaHandlerArgs<T>,
): (childId: string) => Promise<void> {
  return async (childId: string) => {
    const current = args.getCurrent();
    if (!childId || !current) return;
    const { data } = await args.supabase
      .from("projeto_tarefas")
      .select("*")
      .eq("id", childId)
      .maybeSingle();
    if (data) {
      args.setCurrent({ ...current, ...(data as any) } as T);
    }
  };
}
