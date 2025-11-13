import { useState, useEffect } from 'react';
import { offlineManager } from '@/lib/utils/offline-manager';

/**
 * Hook para detectar status online/offline
 * Previne memory leaks e melhora performance
 */
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(() => offlineManager.getStatus());

  useEffect(() => {
    const unsubscribe = offlineManager.subscribe(setIsOnline);
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return isOnline;
};
