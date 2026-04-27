import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface NotificationPrefs {
  email_enabled: boolean;
  push_enabled: boolean;
  digest_frequency: "instant" | "daily" | "weekly";
  notification_types: Record<string, boolean>;
}

const DEFAULT_PREFS: NotificationPrefs = {
  email_enabled: true,
  push_enabled: true,
  digest_frequency: "daily",
  notification_types: {
    espelho_pendente_sem_doc: true,
    espelho_acao_solicitada: true,
    espelho_concluida_evidencia: true,
  },
};

export function useNotificationPreferences() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: async (): Promise<NotificationPrefs> => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return DEFAULT_PREFS;

      const { data, error } = await (supabase as any)
        .from("notification_preferences")
        .select("*")
        .eq("user_id", userRes.user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return DEFAULT_PREFS;

      return {
        email_enabled: data.email_enabled ?? true,
        push_enabled: data.push_enabled ?? true,
        digest_frequency: data.digest_frequency ?? "daily",
        notification_types: {
          ...DEFAULT_PREFS.notification_types,
          ...(data.notification_types ?? {}),
        },
      };
    },
  });

  const save = useMutation({
    mutationFn: async (prefs: Partial<NotificationPrefs>) => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Não autenticado");

      const current = query.data ?? DEFAULT_PREFS;
      const merged: NotificationPrefs = {
        email_enabled: prefs.email_enabled ?? current.email_enabled,
        push_enabled: prefs.push_enabled ?? current.push_enabled,
        digest_frequency: prefs.digest_frequency ?? current.digest_frequency,
        notification_types: {
          ...current.notification_types,
          ...(prefs.notification_types ?? {}),
        },
      };

      const { error } = await (supabase as any).from("notification_preferences").upsert(
        {
          user_id: userRes.user.id,
          ...merged,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
      return merged;
    },
    onSuccess: () => {
      toast.success("Preferências de notificação salvas");
      qc.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar preferências"),
  });

  return {
    prefs: query.data ?? DEFAULT_PREFS,
    isLoading: query.isLoading,
    save: save.mutate,
    isSaving: save.isPending,
  };
}
