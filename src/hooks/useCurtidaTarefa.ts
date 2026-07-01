import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Estado local (otimista) da curtida de uma tarefa.
 * Zero acoplamento com TanStack Query global — cada instância do botão
 * gerencia seu próprio estado para evitar invalidações caras em telas pesadas.
 */
export function useCurtidaTarefa(tarefaId: string | undefined) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!tarefaId) {
      setLiked(false);
      setTotal(0);
      return;
    }
    (async () => {
      const { count } = await (supabase as any)
        .from("projeto_tarefa_curtidas")
        .select("user_id", { count: "exact", head: true })
        .eq("tarefa_id", tarefaId);
      if (cancelled) return;
      setTotal(count ?? 0);

      if (user?.id) {
        const { data } = await (supabase as any)
          .from("projeto_tarefa_curtidas")
          .select("user_id")
          .eq("tarefa_id", tarefaId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (!cancelled) setLiked(!!data);
      } else {
        setLiked(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tarefaId, user?.id]);

  const toggle = useCallback(async () => {
    if (!tarefaId || loading) return;
    // otimista
    const prevLiked = liked;
    const prevTotal = total;
    setLiked(!prevLiked);
    setTotal(prevTotal + (prevLiked ? -1 : 1));
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc(
        "rpc_toggle_curtida_tarefa",
        { p_tarefa_id: tarefaId },
      );
      if (error) throw error;
      if (data) {
        setLiked(!!data.liked);
        setTotal(Number(data.total ?? 0));
      }
    } catch {
      // rollback
      setLiked(prevLiked);
      setTotal(prevTotal);
    } finally {
      setLoading(false);
    }
  }, [tarefaId, liked, total, loading]);

  return { liked, total, toggle, loading };
}
