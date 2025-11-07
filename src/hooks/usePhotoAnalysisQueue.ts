import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface QueueItem {
  id: string;
  photo_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error_message?: string;
  created_at: string;
  processed_at?: string;
}

export function usePhotoAnalysisQueue(userId?: string) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (userId) {
      fetchQueue();
      subscribeToQueue();
    }
  }, [userId]);

  const fetchQueue = async () => {
    try {
      const { data, error } = await supabase
        .from('photo_analysis_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      const typedData = (data || []) as QueueItem[];
      setQueue(typedData);
      setPendingCount(typedData.filter(item => item.status === 'pending').length);
    } catch (error) {
      console.error('Erro ao buscar fila:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToQueue = () => {
    const channel = supabase
      .channel('photo_analysis_queue_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'photo_analysis_queue',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setQueue(prev => [payload.new as QueueItem, ...prev]);
            setPendingCount(prev => prev + 1);
          } else if (payload.eventType === 'UPDATE') {
            setQueue(prev =>
              prev.map(item =>
                item.id === payload.new.id ? (payload.new as QueueItem) : item
              )
            );
            if ((payload.new as QueueItem).status !== 'pending') {
              setPendingCount(prev => Math.max(0, prev - 1));
            }
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  const addToQueue = async (photoId: string, photoUrl: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('photo_analysis_queue')
        .insert({
          photo_id: photoId,
          photo_url: photoUrl,
          created_by: user.id,
        });

      if (error) throw error;
      
      return true;
    } catch (error) {
      console.error('Erro ao adicionar à fila:', error);
      return false;
    }
  };

  const retryFailed = async (queueId: string) => {
    try {
      const { error } = await supabase
        .from('photo_analysis_queue')
        .update({ status: 'pending', attempts: 0 })
        .eq('id', queueId);

      if (error) throw error;
      toast.success('Análise reenviada para processamento');
    } catch (error) {
      toast.error('Erro ao reenviar análise');
    }
  };

  return {
    queue,
    loading,
    pendingCount,
    addToQueue,
    retryFailed,
    refresh: fetchQueue,
  };
}
