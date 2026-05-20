/**
 * useChatSoundNotifications — assina globalmente novas mensagens das
 * conversas do usuário e toca som "plim" suave (respeitando preferências,
 * presença "Não perturbe", horário silencioso e foco da janela).
 *
 * Urgentes não passam por aqui: o som do urgente é tocado pelo trigger de
 * `notifications` (type=chat_urgent) em `useMencoesNotifications` —
 * mantemos a separação para não duplicar.
 */
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { uniqueChannelName } from "@/lib/realtime/channelName";
import { useChatPreferences, isInQuietHours } from "./useChatPreferences";
import { useMyPresenceStatus } from "./usePresenceStatus";
import { useQueryClient } from "@tanstack/react-query";

const SOUND_URL = "/sounds/message.wav";
const THROTTLE_MS = 3000;

/** Toca o "plim" curto, fail-safe (autoplay pode estar bloqueado). */
function playPlim() {
  try {
    const audio = new Audio(SOUND_URL);
    audio.volume = 0.35;
    void audio.play().catch(() => {/* noop */});
    // Vibração curta no mobile (Android Chrome). iOS Safari ignora.
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate(120); } catch {/* noop */}
    }
  } catch {/* noop */}
}

export function useChatSoundNotifications() {
  const { user } = useAuth();
  const { preferences } = useChatPreferences();
  const { data: presence } = useMyPresenceStatus();
  const qc = useQueryClient();
  const lastPlayedRef = useRef<number>(0);
  const conversasIdsRef = useRef<Set<string>>(new Set());

  // Mantém em cache as conversas em que sou participante (filtro de eventos).
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("conversas_participantes")
        .select("conversa_id")
        .eq("usuario_id", user.id)
        .is("saiu_em", null);
      if (cancelled) return;
      conversasIdsRef.current = new Set((data ?? []).map((r: any) => r.conversa_id));
    };
    load();
    // refresca a cada 30s (entra/sai de grupos)
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const ch = supabase
      .channel(uniqueChannelName(`chat-global-${user.id}`))
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensagens" },
        (payload) => {
          const row = payload.new as { id: string; conversa_id: string; remetente_id: string; tipo: string };
          if (!row) return;

          // Invalida lista de conversas pra atualizar badges/última mensagem em tempo real
          qc.invalidateQueries({ queryKey: ["chat", "conversas"] });

          // Filtros de "tocar plim"
          if (row.remetente_id === user.id) return;
          if (!conversasIdsRef.current.has(row.conversa_id)) return;
          if (row.tipo === "urgente") return; // urgente tem som próprio
          if (preferences && preferences.som_mensagens === false) return;
          if (presence?.status === "nao_perturbe") return;
          if (isInQuietHours(preferences)) return;
          if (typeof document !== "undefined" && document.hasFocus()) {
            // Se a aba está em foco E está na conversa ativa, não toca.
            // Heurística simples: rota inclui /chat e a conversa_id está na URL.
            const url = window.location.search + window.location.pathname;
            if (url.includes(row.conversa_id)) return;
          }

          const now = Date.now();
          if (now - lastPlayedRef.current < THROTTLE_MS) return;
          lastPlayedRef.current = now;
          playPlim();
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user?.id, preferences, presence?.status, qc]);
}
