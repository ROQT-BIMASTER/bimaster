/**
 * Hook para gerenciar notificações push
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PushNotificationState {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
}

export const usePushNotifications = () => {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: 'default',
    isSubscribed: false
  });

  useEffect(() => {
    const checkSupport = async () => {
      const isSupported = 'Notification' in window && 'serviceWorker' in navigator;
      
      if (isSupported) {
        setState(prev => ({
          ...prev,
          isSupported: true,
          permission: Notification.permission
        }));
      }
    };

    checkSupport();
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      toast.error('Notificações não suportadas neste navegador');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));

      if (permission === 'granted') {
        toast.success('Notificações ativadas!');
        return true;
      } else if (permission === 'denied') {
        toast.error('Permissão para notificações negada');
        return false;
      }
      
      return false;
    } catch (error) {
      console.error('[PushNotifications] Erro ao solicitar permissão:', error);
      toast.error('Erro ao ativar notificações');
      return false;
    }
  }, [state.isSupported]);

  const showNotification = useCallback(async (
    title: string, 
    options?: NotificationOptions
  ): Promise<boolean> => {
    if (!state.isSupported || state.permission !== 'granted') {
      console.warn('[PushNotifications] Não pode mostrar notificação - permissão não concedida');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        icon: 'https://storage.googleapis.com/gpt-engineer-file-uploads/1NwGpHGNa6QO1OKR4a0sw8nJT203/uploads/1760024388651-LOGO UNION_VERTICAL_COR 01.png',
        badge: 'https://storage.googleapis.com/gpt-engineer-file-uploads/1NwGpHGNa6QO1OKR4a0sw8nJT203/uploads/1760024388651-LOGO UNION_VERTICAL_COR 01.png',
        ...options
      });
      return true;
    } catch (error) {
      console.error('[PushNotifications] Erro ao mostrar notificação:', error);
      return false;
    }
  }, [state.isSupported, state.permission]);

  // Escutar notificações do Supabase Realtime
  useEffect(() => {
    if (state.permission !== 'granted') return;

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications'
        },
        async (payload) => {
          const notification = payload.new as any;
          
          if (notification && notification.title) {
            await showNotification(notification.title, {
              body: notification.message,
              tag: notification.id,
              data: { url: notification.action_url }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [state.permission, showNotification]);

  return {
    ...state,
    requestPermission,
    showNotification
  };
};
