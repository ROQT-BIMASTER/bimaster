import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { uniqueChannelName } from "@/lib/realtime/channelName";

export interface PresenceUser { user_id: string; online_at: string }
export interface PresenceState {
  online: Set<string>;
  digitando: Map<string, number>; // user_id -> ts
}

/** Presença global por usuário — alimenta status online/visto-por-último. */
export function useGlobalPresence(): { online: Set<string> } {
  const { user } = useAuth();
  const [online, setOnline] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase.channel(uniqueChannelName("chat-global-presence"), {
      config: { presence: { key: user.id } },
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, any[]>;
      setOnline(new Set(Object.keys(state)));
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ online_at: new Date().toISOString() });
      }
    });
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);
  return { online };
}

/** Presença + digitando por conversa. */
export function useChatRoomPresence(conversaId: string | null) {
  const { user } = useAuth();
  const uid = user?.id;
  const [state, setState] = useState<PresenceState>({ online: new Set(), digitando: new Map() });
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSent = useRef<number>(0);

  useEffect(() => {
    if (!uid || !conversaId) return;
    const ch = supabase.channel(uniqueChannelName(`chat-room-${conversaId}`), {
      config: { presence: { key: uid } },
    });
    channelRef.current = ch;
    ch.on("presence", { event: "sync" }, () => {
      const s = ch.presenceState() as Record<string, any[]>;
      const online = new Set<string>(Object.keys(s));
      const digit = new Map<string, number>();
      Object.entries(s).forEach(([userId, arr]) => {
        const last: any = arr[arr.length - 1];
        if (last?.typing_at) {
          const ts = new Date(last.typing_at).getTime();
          if (Date.now() - ts < 4000 && userId !== uid) digit.set(userId, ts);
        }
      });
      setState({ online, digitando: digit });
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") await ch.track({ online_at: new Date().toISOString() });
    });
    return () => {
      ch.untrack();
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [uid, conversaId]);

  const enviarDigitando = () => {
    const now = Date.now();
    if (now - lastSent.current < 1500) return;
    lastSent.current = now;
    channelRef.current?.track({
      online_at: new Date().toISOString(),
      typing_at: new Date().toISOString(),
    });
  };

  const digitandoUserIds = useMemo(() => Array.from(state.digitando.keys()), [state]);
  return { online: state.online, digitandoUserIds, enviarDigitando };
}
