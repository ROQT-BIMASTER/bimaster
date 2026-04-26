import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MentionableUser {
  id: string;
  nome: string;
  avatar_url: string | null;
}

/**
 * Retorna apenas os usuários efetivamente vinculados ao processo/projeto/tarefa:
 *  - Membros do projeto (projeto_membros)
 *  - Responsável e criador da tarefa
 *  - Criador do processo vinculado (product_process via produto_id)
 *  - Participantes que já interagiram no chat do processo
 *
 * Fallback: se não houver vínculos, retorna apenas responsável + criador da tarefa.
 * Inclui sempre o usuário corrente para que ele veja a si mesmo na lista.
 */
export function useTarefaMentionableUsers(tarefaId: string | null | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["tarefa-mentionable-users", tarefaId, user?.id],
    enabled: !!tarefaId && !!user,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<MentionableUser[]> => {
      const ids = new Set<string>();
      if (user?.id) ids.add(user.id);

      // 1. Tarefa: projeto_id, produto_id, responsavel_id, criador_id
      const { data: tarefa } = await supabase
        .from("projeto_tarefas")
        .select("projeto_id, produto_id, responsavel_id, criador_id")
        .eq("id", tarefaId!)
        .maybeSingle();

      if (tarefa?.responsavel_id) ids.add(tarefa.responsavel_id);
      if (tarefa?.criador_id) ids.add(tarefa.criador_id);

      // 2. Membros do projeto
      if (tarefa?.projeto_id) {
        const { data: membros } = await supabase
          .from("projeto_membros")
          .select("user_id")
          .eq("projeto_id", tarefa.projeto_id);
        membros?.forEach(m => m.user_id && ids.add(m.user_id));
      }

      // 3. Processo vinculado (criador + participantes do chat)
      if (tarefa?.produto_id) {
        const { data: processos } = await supabase
          .from("product_process" as any)
          .select("id, criado_por")
          .eq("produto_ref_id", tarefa.produto_id);

        const procIds: string[] = [];
        (processos as any[] | null)?.forEach(p => {
          if (p.criado_por) ids.add(p.criado_por);
          if (p.id) procIds.push(p.id);
        });

        if (procIds.length > 0) {
          const { data: chatUsers } = await supabase
            .from("process_chat_messages" as any)
            .select("user_id")
            .in("process_id", procIds);
          (chatUsers as any[] | null)?.forEach(c => c.user_id && ids.add(c.user_id));
        }
      }

      const idList = Array.from(ids);
      if (idList.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url")
        .in("id", idList)
        .order("nome");

      return (profiles || []) as MentionableUser[];
    },
  });
}
