import { useState, useEffect, useCallback } from 'react';
import { registerSW } from 'virtual:pwa-register';

interface PWAState {
  needRefresh: boolean;
  offlineReady: boolean;
  isInstalled: boolean;
  isOnline: boolean;
  canInstall: boolean;
  installProgress: number;
  installStatus: string;
}

interface UsePWAReturn extends PWAState {
  updateServiceWorker: () => void;
  promptInstall: () => Promise<boolean>;
}

let updateSWRef: ((reloadPage?: boolean) => Promise<void>) | null = null;
let deferredPromptRef: any = null;

export function usePWA(): UsePWAReturn {
  const [state, setState] = useState<PWAState>({
    needRefresh: false,
    offlineReady: false,
    isInstalled: false,
    isOnline: navigator.onLine,
    canInstall: false,
    installProgress: 0,
    installStatus: 'Verificando...',
  });

  useEffect(() => {
    // Verificar se já está instalado
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as any).standalone ||
                          document.referrer.includes('android-app://');
      setState(prev => ({ ...prev, isInstalled: isStandalone }));
    };
    
    checkInstalled();

    // Registrar Service Worker com callbacks
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log('[PWA] Nova versão disponível');
        setState(prev => ({ ...prev, needRefresh: true }));
      },
      onOfflineReady() {
        console.log('[PWA] App pronto para uso offline');
        setState(prev => ({ 
          ...prev, 
          offlineReady: true,
          installProgress: 100,
          installStatus: 'Pronto para uso offline!'
        }));
      },
      onRegisteredSW(swUrl, registration) {
        console.log('[PWA] Service Worker registrado:', swUrl);
        setState(prev => ({ 
          ...prev, 
          installProgress: 50,
          installStatus: 'Baixando recursos...'
        }));
        
        // Verificar atualizações periodicamente (a cada 5 minutos)
        if (registration) {
          setInterval(() => {
            registration.update();
          }, 5 * 60 * 1000);
        }
      },
      onRegisterError(error) {
        console.error('[PWA] Erro no registro:', error);
        setState(prev => ({ 
          ...prev, 
          installStatus: 'Erro ao preparar app offline'
        }));
      }
    });

    updateSWRef = updateSW;

    // Capturar evento de instalação
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef = e;
      setState(prev => ({ ...prev, canInstall: true }));
    };

    // Detectar quando o app foi instalado
    const handleAppInstalled = () => {
      setState(prev => ({ 
        ...prev, 
        isInstalled: true, 
        canInstall: false 
      }));
      deferredPromptRef = null;
    };

    // Monitorar status online/offline
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true }));
    };

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Simular progresso de instalação
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 10;
      if (progress <= 90) {
        setState(prev => {
          if (prev.installProgress < progress && !prev.offlineReady) {
            const status = progress < 30 
              ? 'Carregando recursos...' 
              : progress < 60 
                ? 'Preparando cache...' 
                : progress < 90 
                  ? 'Finalizando...'
                  : 'Quase pronto...';
            return { ...prev, installProgress: progress, installStatus: status };
          }
          return prev;
        });
      } else {
        clearInterval(progressInterval);
      }
    }, 500);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(progressInterval);
    };
  }, []);

  const updateServiceWorker = useCallback(() => {
    if (updateSWRef) {
      updateSWRef(true);
    }
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPromptRef) {
      return false;
    }

    try {
      deferredPromptRef.prompt();
      const { outcome } = await deferredPromptRef.userChoice;
      deferredPromptRef = null;
      setState(prev => ({ ...prev, canInstall: false }));
      return outcome === 'accepted';
    } catch (error) {
      console.error('[PWA] Erro ao instalar:', error);
      return false;
    }
  }, []);

  return {
    ...state,
    updateServiceWorker,
    promptInstall,
  };
}
