/**
 * Hook para gerenciar notificações nativas do navegador (Notifications API).
 *
 * Cobre 2 cenários:
 *  1. Menções/urgentes (tabela `notifications` com type `*_mention` ou `chat_urgent`).
 *  2. Mensagens novas em conversas das quais o usuário é participante
 *     (tabela `mensagens`), quando a aba não está em foco ou em outra conversa.
 *
 * Push real (app fechado) é tratado por `push-sw.js` + edge `send-push-notification`
 * em fase separada — este hook cobre o caso "app aberto" em qualquer aba.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from "@/lib/logger";
import { uniqueChannelName } from "@/lib/realtime/channelName";
import { useAuth } from "@/contexts/AuthContext";

interface PushNotificationState {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
}

const ICON_URL = 'https://storage.googleapis.com/gpt-engineer-file-uploads/1NwGpHGNa6QO1OKR4a0sw8nJT203/uploads/1760024388651-LOGO UNION_VERTICAL_COR 01.png';

const MENTION_TYPES = ["task_mention", "chat_mention", "process_mention", "chat_urgent"];

/** Vibração curta padrão (mobile). Silencioso onde não houver suporte. */
function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {/* noop */}
}

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: 'default',
    isSubscribed: false
  });

  // Mantém set de conversas do usuário para filtrar eventos de `mensagens`.
  const conversasIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const isSupported = typeof window !== "undefined" && 'Notification' in window && 'serviceWorker' in navigator;
    if (isSupported) {
      setState(prev => ({
        ...prev,
        isSupported: true,
        permission: Notification.permission
      }));
    }
  }, []);

  // Carrega conversas em que sou participante (refresca a cada 30s).
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
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [user?.id]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      toast.error('Notificações não suportadas neste navegador');
      return false;
    }
    try {
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));
      if (permission === 'granted') {
        toast.success('Notificações ativadas');
        return true;
      } else if (permission === 'denied') {
        toast.error('Permissão para notificações negada');
        return false;
      }
      return false;
    } catch (error) {
      logger.error('[PushNotifications] Erro ao solicitar permissão:', error);
      toast.error('Erro ao ativar notificações');
      return false;
    }
  }, [state.isSupported]);

  const showNotification = useCallback(async (
    title: string,
    options?: NotificationOptions & { vibrate?: number | number[] }
  ): Promise<boolean> => {
    if (!state.isSupported || state.permission !== 'granted') return false;
    try {
      // Vibração no mobile (Android Chrome). iOS Safari ignora silenciosamente.
      if (options?.vibrate) vibrate(options.vibrate);

      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        icon: ICON_URL,
        badge: ICON_URL,
        ...options,
      });
      return true;
    } catch (error) {
      logger.error('[PushNotifications] Erro ao mostrar notificação:', error);
      return false;
    }
  }, [state.isSupported, state.permission]);

  /** Heurística: o usuário está olhando esta conversa agora? */
  const isViewingConversa = useCallback((conversaId: string) => {
    if (typeof document === "undefined") return false;
    if (!document.hasFocus()) return false;
    const url = window.location.pathname + window.location.search;
    return url.includes(conversaId);
  }, []);

  // Canal 1: notifications (menções e urgentes)
  useEffect(() => {
    if (state.permission !== 'granted' || !user?.id) return;
    const channel = supabase
      .channel(uniqueChannelName(`push-notifications-${user.id}`))
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        async (payload) => {
          const n = payload.new as any;
          if (!n?.title) return;
          if (!MENTION_TYPES.includes(n.type)) return;
          const isUrgent = n.type === 'chat_urgent';
          await showNotification(n.title, {
            body: n.message,
            tag: n.id,
            requireInteraction: isUrgent,
            data: { url: n.action_url },
            vibrate: isUrgent ? [400, 100, 400, 100, 400] : [200, 100, 200],
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [state.permission, user?.id, showNotification]);

  // Canal 2: mensagens novas em conversas do usuário (toda mensagem, não só menção).
  useEffect(() => {
    if (state.permission !== 'granted' || !user?.id) return;
    const channel = supabase
      .channel(uniqueChannelName(`push-mensagens-${user.id}`))
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensagens' },
        async (payload) => {
          const row = payload.new as { id: string; conversa_id: string; remetente_id: string; tipo: string; conteudo?: string } | null;
          if (!row) return;
          if (row.remetente_id === user.id) return;
          if (!conversasIdsRef.current.has(row.conversa_id)) return;
          if (row.tipo === 'urgente') return; // urgente cai pelo canal de notifications
          if (isViewingConversa(row.conversa_id)) return;

          const body = (row.conteudo ?? '').slice(0, 140) || 'Nova mensagem';
          await showNotification('Nova mensagem', {
            body,
            tag: `conv-${row.conversa_id}`, // colapsa por conversa (WhatsApp-like)
            data: { url: `/dashboard/chat?c=${row.conversa_id}` },
            vibrate: [120, 60, 120],
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [state.permission, user?.id, showNotification, isViewingConversa]);

  return {
    ...state,
    requestPermission,
    showNotification
  };
};
