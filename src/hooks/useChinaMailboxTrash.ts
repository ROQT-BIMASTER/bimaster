import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Soft delete em lote — usa coluna deleted_at já existente em china_produto_submissoes.
 */
export function useTrashSubmissoes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return;
      const { error } = await (supabase
        .from("china_produto_submissoes" as any) as any)
        .update({ deleted_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["china-mailbox-dataset"] });
      toast.success(`${vars.length} item${vars.length === 1 ? "" : "s"} movido${vars.length === 1 ? "" : "s"} para a Lixeira`);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao mover para Lixeira"),
  });
}

export function useRestoreSubmissoes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return;
      const { error } = await (supabase
        .from("china_produto_submissoes" as any) as any)
        .update({ deleted_at: null })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["china-mailbox-dataset"] });
      toast.success(`${vars.length} item${vars.length === 1 ? "" : "s"} restaurado${vars.length === 1 ? "" : "s"}`);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao restaurar"),
  });
}

export function usePurgeSubmissoes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return;
      const { error } = await (supabase
        .from("china_produto_submissoes" as any) as any)
        .delete()
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["china-mailbox-dataset"] });
      toast.success(`${vars.length} item${vars.length === 1 ? "" : "s"} excluído${vars.length === 1 ? "" : "s"} definitivamente`);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao excluir definitivamente"),
  });
}
