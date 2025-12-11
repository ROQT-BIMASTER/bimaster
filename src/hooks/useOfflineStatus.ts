/**
 * Hook para monitorar status de conexão e sincronização offline
 */

import { useState, useEffect, useCallback } from 'react';
import { getPendingSyncCount } from '@/lib/offline/offlineDatabase';
import { processSyncQueue, setSyncCallback, isSyncInProgress } from '@/lib/offline/syncManager';
import { toast } from 'sonner';

interface OfflineStatus {
  isOnline: boolean;
  pendingSyncCount: number;
  isSyncing: boolean;
  syncProgress: { total: number; synced: number; failed: number } | null;
  triggerSync: () => Promise<void>;
}

export const useOfflineStatus = (): OfflineStatus => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ total: number; synced: number; failed: number } | null>(null);

  // Monitorar status de conexão
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Conexão restabelecida', {
        description: 'Iniciando sincronização de dados pendentes...',
        duration: 3000
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Você está offline', {
        description: 'Seus dados serão salvos localmente e sincronizados quando a conexão voltar.',
        duration: 5000
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Atualizar contador de pendências
  const updatePendingCount = useCallback(async () => {
    try {
      const count = await getPendingSyncCount();
      setPendingSyncCount(count);
    } catch (error) {
      console.error('[useOfflineStatus] Erro ao obter contagem pendente:', error);
    }
  }, []);

  useEffect(() => {
    updatePendingCount();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(updatePendingCount, 30000);
    return () => clearInterval(interval);
  }, [updatePendingCount]);

  // Callback de progresso de sincronização
  useEffect(() => {
    setSyncCallback((progress) => {
      setSyncProgress(progress);
      setIsSyncing(true);
    });

    return () => setSyncCallback(null);
  }, []);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine) {
      toast.error('Sem conexão', {
        description: 'Aguarde a conexão ser restabelecida para sincronizar.'
      });
      return;
    }

    if (isSyncInProgress()) {
      toast.info('Sincronização em andamento...');
      return;
    }

    setIsSyncing(true);
    toast.info('Iniciando sincronização...');

    try {
      const result = await processSyncQueue();
      
      if (result.synced > 0) {
        toast.success(`${result.synced} item(s) sincronizado(s)`, {
          description: result.failed > 0 ? `${result.failed} falha(s)` : undefined
        });
      } else if (result.failed > 0) {
        toast.error(`${result.failed} item(s) falharam ao sincronizar`);
      } else {
        toast.info('Nada para sincronizar');
      }

      await updatePendingCount();
    } catch (error) {
      console.error('[useOfflineStatus] Erro na sincronização:', error);
      toast.error('Erro ao sincronizar dados');
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  }, [updatePendingCount]);

  return {
    isOnline,
    pendingSyncCount,
    isSyncing,
    syncProgress,
    triggerSync
  };
};
