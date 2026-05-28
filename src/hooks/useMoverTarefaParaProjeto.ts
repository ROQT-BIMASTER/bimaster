import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MoverArgs {
  tarefaId: string;
  /** `null` move para o projeto Pessoal do usuário. */
  projetoDestinoId: string | null;
}

function traduzirErro(msg: string): string {
  if (msg.includes("sem_acesso_ao_projeto_destino")) return "Você não tem acesso a esse projeto.";
  if (msg.includes("sem_permissao_na_tarefa")) return "Você não pode mover esta tarefa.";
  if (msg.includes("tarefa_nao_encontrada")) return "Tarefa não encontrada.";
  if (msg.includes("auth_required")) return "Sessão expirada.";
  return "Não foi possível mover a tarefa.";
}

export function useMoverTarefaParaProjeto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tarefaId, projetoDestinoId }: MoverArgs) => {
      const { data, error } = await (supabase as any).rpc(
        "mover_tarefa_para_projeto",
        { p_tarefa_id: tarefaId, p_projeto_id_destino: projetoDestinoId },
      );
      if (error) throw error;
      return data as { success: boolean; projeto_id: string; secao_id: string; unchanged?: boolean };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["minhas-tarefas"] });
      qc.invalidateQueries({ queryKey: ["projeto-tarefas"] });
      toast.success(vars.projetoDestinoId ? "Tarefa vinculada ao projeto." : "Tarefa removida do projeto.");
    },
    onError: (err: any) => {
      toast.error(traduzirErro(err?.message || ""));
    },
  });
}
