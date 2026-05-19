/**
 * useTarefaResumo — carrega resumo + comentários recentes de uma
 * tarefa de projeto a partir do `referencia_id` do inbox_item
 * (referencia_tipo = 'projeto_tarefa').
 *
 * Mutations: concluir tarefa e adicionar comentário (via
 * projeto_atividades). Invalida a inbox ao concluir.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";

export interface TarefaComentario {
  id: string;
  user_id: string | null;
  user_nome: string | null;
  descricao: string | null;
  tipo: string;
  created_at: string;
}

export interface TarefaResumo {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  data_prazo: Date | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  projeto_id: string;
  projeto_nome: string | null;
  comentarios: TarefaComentario[];
}

async function loadResumo(tarefaId: string): Promise<TarefaResumo | null> {
  const { data: tar, error } = await (supabase as any)
    .from("projeto_tarefas")
    .select("id, titulo, descricao, status, data_prazo, responsavel_id, projeto_id")
    .eq("id", tarefaId)
    .maybeSingle();
  if (error) throw error;
  if (!tar) return null;

  const [{ data: ativ }, { data: proj }, { data: resp }] = await Promise.all([
    (supabase as any)
      .from("projeto_atividades")
      .select("id, user_id, descricao, tipo, created_at")
      .eq("tarefa_id", tarefaId)
      .order("created_at", { ascending: false })
      .limit(10),
    tar.projeto_id
      ? (supabase as any).from("projetos").select("nome").eq("id", tar.projeto_id).maybeSingle()
      : Promise.resolve({ data: null }),
    tar.responsavel_id
      ? (supabase as any).from("profiles").select("nome").eq("id", tar.responsavel_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const userIds = Array.from(new Set((ativ || []).map((a: any) => a.user_id).filter(Boolean)));
  let nomes: Record<string, string> = {};
  if (userIds.length) {
    const { data: profs } = await (supabase as any)
      .from("profiles")
      .select("id, nome")
      .in("id", userIds);
    nomes = Object.fromEntries((profs || []).map((p: any) => [p.id, p.nome]));
  }

  return {
    id: tar.id,
    titulo: tar.titulo,
    descricao: tar.descricao,
    status: tar.status,
    data_prazo: tar.data_prazo ? parseLocalDate(tar.data_prazo) : null,
    responsavel_id: tar.responsavel_id,
    responsavel_nome: resp?.nome ?? null,
    projeto_id: tar.projeto_id,
    projeto_nome: proj?.nome ?? null,
    comentarios: ((ativ || []) as any[]).map((a) => ({
      id: a.id,
      user_id: a.user_id,
      user_nome: a.user_id ? nomes[a.user_id] ?? null : null,
      descricao: a.descricao,
      tipo: a.tipo,
      created_at: a.created_at,
    })),
  };
}

export function useTarefaResumo(tarefaId: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["inbox-tarefa", tarefaId],
    enabled: !!tarefaId,
    staleTime: 30_000,
    queryFn: () => loadResumo(tarefaId!),
  });

  const concluir = useMutation({
    mutationFn: async () => {
      if (!tarefaId) throw new Error("Tarefa não carregada");
      const { error } = await (supabase as any)
        .from("projeto_tarefas")
        .update({ status: "concluida", data_conclusao: new Date().toISOString().slice(0, 10) })
        .eq("id", tarefaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarefa concluída");
      qc.invalidateQueries({ queryKey: ["inbox-tarefa"] });
      qc.invalidateQueries({ queryKey: ["inbox-items"] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao concluir"),
  });

  const comentar = useMutation({
    mutationFn: async (texto: string) => {
      if (!tarefaId || !query.data?.projeto_id) throw new Error("Tarefa não carregada");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await (supabase as any)
        .from("projeto_atividades")
        .insert({
          projeto_id: query.data.projeto_id,
          tarefa_id: tarefaId,
          user_id: user.id,
          tipo: "comentario",
          descricao: texto,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comentário publicado");
      qc.invalidateQueries({ queryKey: ["inbox-tarefa", tarefaId] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao comentar"),
  });

  return { ...query, concluir, comentar };
}
