import { supabase } from "@/integrations/supabase/client";
import type { ProjetoTarefa } from "@/hooks/useProjetoTarefas";

/**
 * Busca subtarefas de uma tarefa-pai já hidratando os campos que a UI de
 * subtarefas (SubtarefasSection + pickers de responsável/seguidores) precisa
 * para renderizar avatares e nomes corretamente em qualquer contexto:
 *
 * - `responsavel` (principal) — join em `profiles`
 * - `responsaveis` — junction `projeto_tarefa_responsaveis` (multi)
 * - `colaboradores` — junction `projeto_tarefa_colaboradores` (seguidores)
 *
 * Usado pelos "bridges" da Central de Trabalho (V2) e da tela `MinhasTarefas`
 * simples (V1) para que alterações feitas pelos pickers reflitam de imediato
 * sem depender do cache global `projeto-tarefas-v2`.
 */
export async function fetchHydratedSubtarefas(parentId: string): Promise<ProjetoTarefa[]> {
  if (!parentId) return [];

  const { data, error } = await supabase
    .from("projeto_tarefas")
    .select(
      `*,
       responsavel:profiles!projeto_tarefas_responsavel_id_fkey(id,nome,avatar_url),
       responsaveis:projeto_tarefa_responsaveis(user_id,papel,profile:profiles(nome,avatar_url)),
       colaboradores:projeto_tarefa_colaboradores(user_id,profile:profiles(nome,avatar_url))`,
    )
    .eq("parent_tarefa_id", parentId)
    .is("excluida_em", null)
    .order("ordem");

  if (error) {
    // Fallback silencioso: se o join falhar (ex.: RLS restringindo colunas),
    // retornamos ao menos as linhas cruas para não deixar a UI vazia.
    const { data: raw } = await supabase
      .from("projeto_tarefas")
      .select("*")
      .eq("parent_tarefa_id", parentId)
      .is("excluida_em", null)
      .order("ordem");
    return (raw || []) as ProjetoTarefa[];
  }

  return (data || []).map((row: any) => ({
    ...row,
    responsavel: row.responsavel
      ? { id: row.responsavel.id, nome: row.responsavel.nome, avatar_url: row.responsavel.avatar_url }
      : null,
    responsaveis: (row.responsaveis || []).map((r: any) => ({
      user_id: r.user_id,
      papel: r.papel,
      nome: r.profile?.nome || "Membro",
      avatar_url: r.profile?.avatar_url || null,
    })),
    colaboradores: (row.colaboradores || []).map((c: any) => ({
      user_id: c.user_id,
      nome: c.profile?.nome || "Membro",
      avatar_url: c.profile?.avatar_url || null,
    })),
  })) as ProjetoTarefa[];
}
