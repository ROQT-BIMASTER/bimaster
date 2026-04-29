import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TarefaAcessoEvent {
  id: string;
  tarefa_id: string | null;
  projeto_id: string | null;
  user_afetado_id: string;
  ator_id: string | null;
  acao: "ganhou_acesso" | "perdeu_acesso";
  motivo: string;
  papel_anterior: string | null;
  papel_novo: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user_afetado_nome?: string | null;
  ator_nome?: string | null;
}

/**
 * Lê os eventos de acesso de uma tarefa. RLS garante que só admin,
 * o ator ou o usuário afetado conseguem ler. Faz lookup de nomes em paralelo.
 */
export function useTarefaAcessoAudit(tarefaId?: string | null, limit = 50) {
  return useQuery({
    queryKey: ["tarefa-acesso-audit", tarefaId, limit],
    queryFn: async (): Promise<TarefaAcessoEvent[]> => {
      if (!tarefaId) return [];
      const { data, error } = await supabase
        .from("projeto_tarefa_acesso_audit" as any)
        .select("*")
        .eq("tarefa_id", tarefaId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      const rows = (data || []) as any[];
      const ids = Array.from(
        new Set(
          rows.flatMap((r) => [r.user_afetado_id, r.ator_id]).filter(Boolean),
        ),
      );
      let nameMap: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", ids as string[]);
        nameMap = Object.fromEntries((profs || []).map((p: any) => [p.id, p.nome]));
      }
      return rows.map((r) => ({
        ...r,
        user_afetado_nome: nameMap[r.user_afetado_id] ?? null,
        ator_nome: r.ator_id ? nameMap[r.ator_id] ?? null : null,
      }));
    },
    enabled: !!tarefaId,
    staleTime: 30_000,
  });
}
