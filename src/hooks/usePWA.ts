import { useState, useEffect, useCallback } from 'react';

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
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    canInstall: false,
    installProgress: 10, // Começar em 10% para mostrar progresso imediato
    installStatus: 'Iniciando...',
  });

  useEffect(() => {
    // Progresso simulado imediato para UX
    let progressValue = 10;
    const progressInterval = setInterval(() => {
      progressValue += 15;
      if (progressValue >= 100) {
        progressValue = 100;
        clearInterval(progressInterval);
      }
      setState(prev => ({
        ...prev,
        installProgress: progressValue,
        installStatus: progressValue < 50 ? 'Carregando...' : progressValue < 100 ? 'Preparando...' : 'Pronto!'
      }));
    }, 300);

    // Verificar se já está instalado
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as any).standalone ||
                          document.referrer.includes('android-app://');
      setState(prev => ({ ...prev, isInstalled: isStandalone }));
    };
    
    checkInstalled();

    // Tentar registrar Service Worker de forma segura
    const registerServiceWorker = async () => {
      try {
        const { registerSW } = await import('virtual:pwa-register');
        
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
            }));
          },
          onRegisteredSW(swUrl, registration) {
            console.log('[PWA] Service Worker registrado:', swUrl);
            
            if (registration) {
              setInterval(() => {
                registration.update();
              }, 5 * 60 * 1000);
            }
          },
          onRegisterError(error) {
            console.error('[PWA] Erro no registro:', error);
          }
        });

        updateSWRef = updateSW;
      } catch (error) {
        // PWA não disponível (desenvolvimento ou erro)
        console.log('[PWA] Service Worker não disponível:', error);
      }
    };

    registerServiceWorker();

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
    const handleOnline = () => setState(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setState(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(progressInterval);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const updateServiceWorker = useCallback(() => {
    if (updateSWRef) {
      updateSWRef(true);
    }
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPromptRef) return false;

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
