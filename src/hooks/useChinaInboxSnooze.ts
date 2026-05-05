import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SnoozeRow {
  submissao_id: string;
  snooze_until: string;
}

export function useInboxSnoozes() {
  return useQuery({
    queryKey: ["china-inbox-snoozes"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [] as SnoozeRow[];
      const { data, error } = await (supabase.from("china_inbox_snooze" as any) as any)
        .select("submissao_id, snooze_until")
        .eq("usuario_id", user.id);
      if (error) throw error;
      return ((data || []) as any[]) as SnoozeRow[];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useSnoozeSubmissao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ submissao_id, until }: { submissao_id: string; until: Date }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await (supabase.from("china_inbox_snooze" as any) as any)
        .upsert({
          usuario_id: user.id,
          submissao_id,
          snooze_until: until.toISOString(),
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["china-inbox-snoozes"] });
      qc.invalidateQueries({ queryKey: ["china-mailbox-dataset"] });
      toast.success("Submissão adiada");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao adiar"),
  });
}

export function useUnsnoozeSubmissao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (submissao_id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await (supabase.from("china_inbox_snooze" as any) as any)
        .delete()
        .eq("usuario_id", user.id)
        .eq("submissao_id", submissao_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["china-inbox-snoozes"] });
      qc.invalidateQueries({ queryKey: ["china-mailbox-dataset"] });
      toast.success("Submissão devolvida à caixa");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao reativar"),
  });
}
