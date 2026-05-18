import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { toast } from "sonner";
import { uniqueChannelName } from "@/lib/realtime/channelName";

export const MENCAO_TYPES = ["task_mention", "chat_mention", "process_mention", "chat_urgent"] as const;

const SOUND_PREF_KEY = "mencoes:som";
const MENTION_SOUND_URL = "/sounds/mention.mp3";
const URGENT_SOUND_URL = "/sounds/urgent.wav";

function playMentionSound(urgent = false) {
  try {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(SOUND_PREF_KEY) === "off") return;
    const audio = new Audio(urgent ? URGENT_SOUND_URL : MENTION_SOUND_URL);
    audio.volume = urgent ? 0.65 : 0.5;
    void audio.play().catch(() => {/* autoplay pode ser bloqueado antes da 1ª interação */});
  } catch {/* noop */}
}

export interface MencaoItem {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  action_url: string | null;
  read: boolean;
  read_at: string | null;
  created_at: string;
}

/**
 * Lê as menções reais do usuário corrente direto de `notifications`,
 * que é onde os triggers `notify_*_mentions` gravam.
 *
 * Também dispara toast persistente (15s) + som curto quando uma nova menção
 * chega via realtime — esse comportamento é exclusivo deste hook para que o
 * `useNotifications` não duplique o alerta.
 */
export function useMencoesNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ["mencoes-notifications", user?.id];

  const query = useQuery<MencaoItem[]>({
    queryKey,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .in("type", MENCAO_TYPES as unknown as string[])
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as MencaoItem[];
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(uniqueChannelName(`mencoes-${user.id}`))
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as MencaoItem | undefined;
          if (row && (MENCAO_TYPES as readonly string[]).includes(row.type)) {
            playMentionSound();
            toast(row.title || "Você foi mencionado", {
              description: row.message?.substring(0, 140),
              duration: 15000,
              action: row.action_url
                ? {
                    label: "Abrir",
                    onClick: () => { window.location.href = row.action_url!; },
                  }
                : undefined,
            });
          }
          qc.invalidateQueries({ queryKey });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey })
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const marcarLida = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read: true, read_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const remover = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return;
      const { error } = await supabase.from("notifications").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return {
    mencoes: query.data || [],
    isLoading: query.isLoading,
    naoLidas: (query.data || []).filter(m => !m.read).length,
    marcarLida,
    remover,
  };
}
