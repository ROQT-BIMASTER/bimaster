import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useToggleInboxRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ documento_id, read }: { documento_id: string; read: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      if (read) {
        const { error } = await (supabase
          .from("china_inbox_read_state" as any)
          .upsert({ usuario_id: user.id, documento_id, read_at: new Date().toISOString() }) as any);
        if (error) throw error;
      } else {
        const { error } = await (supabase
          .from("china_inbox_read_state" as any)
          .delete()
          .eq("usuario_id", user.id)
          .eq("documento_id", documento_id) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["china-mailbox-dataset"] }),
  });
}

export function useToggleSubmissaoFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ submissao_id, flagged }: { submissao_id: string; flagged: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      if (flagged) {
        const { error } = await (supabase
          .from("china_submissao_user_flags" as any)
          .upsert({ usuario_id: user.id, submissao_id }) as any);
        if (error) throw error;
      } else {
        const { error } = await (supabase
          .from("china_submissao_user_flags" as any)
          .delete()
          .eq("usuario_id", user.id)
          .eq("submissao_id", submissao_id) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["china-mailbox-dataset"] }),
  });
}
