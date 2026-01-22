import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { checkAndUpdateVersion, APP_VERSION, forceCleanReload } from '@/lib/version';

interface PWAState {
  needRefresh: boolean;
  offlineReady: boolean;
  isInstalled: boolean;
  isOnline: boolean;
  canInstall: boolean;
  installProgress: number;
  installStatus: string;
  wasUpdated: boolean;
  appVersion: string;
}

interface PWAContextType extends PWAState {
  updateServiceWorker: () => void;
  promptInstall: () => Promise<boolean>;
  dismissUpdateNotice: () => void;
  forceUpdate: () => Promise<void>;
}

const PWAContext = createContext<PWAContextType | null>(null);

// Flags globais para evitar duplicação
let swRegistered = false;
let deferredPromptRef: any = null;
let updateSWRef: ((reloadPage?: boolean) => Promise<void>) | null = null;

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PWAState>({
    needRefresh: false,
    offlineReady: false,
    isInstalled: false,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    canInstall: false,
    installProgress: 10,
    installStatus: 'Iniciando...',
    wasUpdated: false,
    appVersion: APP_VERSION,
  });

  const progressRef = useRef(10);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Verificar se houve atualização de versão
    const hadVersionUpdate = checkAndUpdateVersion();
    if (hadVersionUpdate) {
      setState(prev => ({ ...prev, wasUpdated: true }));
    }

    // Progresso simulado mais rápido
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        if (!mountedRef.current) return;
        
        progressRef.current += 25;
        if (progressRef.current >= 100) {
          progressRef.current = 100;
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
        setState(prev => ({
          ...prev,
          installProgress: progressRef.current,
          installStatus: progressRef.current < 50 ? 'Carregando...' : 
                        progressRef.current < 100 ? 'Preparando...' : 'Pronto!'
        }));
      }, 200);
    }

    // Verificar se já está instalado
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as any).standalone ||
                          document.referrer.includes('android-app://');
      setState(prev => ({ ...prev, isInstalled: isStandalone }));
    };
    
    checkInstalled();

    // Registrar Service Worker apenas uma vez
    const registerServiceWorker = async () => {
      if (swRegistered) {
        console.log('[PWA] SW já registrado, ignorando...');
        return;
      }
      swRegistered = true;

      try {
        const { registerSW } = await import('virtual:pwa-register');
        
        const updateSW = registerSW({
          immediate: true,
          onNeedRefresh() {
            console.log('[PWA] Nova versão disponível - aplicando automaticamente');
            // Com autoUpdate, aplicar imediatamente
            if (updateSWRef) {
              updateSWRef(true);
            }
          },
          onOfflineReady() {
            console.log('[PWA] App pronto para uso offline');
            if (mountedRef.current) {
              setState(prev => ({ ...prev, offlineReady: true }));
            }
          },
          onRegisteredSW(swUrl, registration) {
            console.log('[PWA] Service Worker registrado:', swUrl);
            
            if (registration) {
              // Verificar atualizações a cada 1 minuto (era 5 minutos)
              setInterval(() => {
                console.log('[PWA] Verificando atualizações...');
                registration.update();
              }, 60 * 1000);
            }
          },
          onRegisterError(error) {
            console.error('[PWA] Erro no registro:', error);
          }
        });

        updateSWRef = updateSW;
      } catch (error) {
        console.log('[PWA] Service Worker não disponível:', error);
        swRegistered = false;
      }
    };

    registerServiceWorker();

    // Event listeners
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef = e;
      if (mountedRef.current) {
        setState(prev => ({ ...prev, canInstall: true }));
      }
    };

    const handleAppInstalled = () => {
      if (mountedRef.current) {
        setState(prev => ({ 
          ...prev, 
          isInstalled: true, 
          canInstall: false 
        }));
      }
      deferredPromptRef = null;
    };

    const handleOnline = () => {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, isOnline: true }));
      }
    };
    
    const handleOffline = () => {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, isOnline: false }));
      }
    };

    // Detectar quando o SW foi atualizado
    const handleControllerChange = () => {
      console.log('[PWA] Service Worker atualizado automaticamente');
      if (mountedRef.current) {
        setState(prev => ({ ...prev, wasUpdated: true }));
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    navigator.serviceWorker?.addEventListener('controllerchange', handleControllerChange);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.serviceWorker?.removeEventListener('controllerchange', handleControllerChange);
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

  const dismissUpdateNotice = useCallback(() => {
    setState(prev => ({ ...prev, wasUpdated: false }));
  }, []);

  const forceUpdate = useCallback(async () => {
    console.log('[PWA] Forçando atualização completa...');
    await forceCleanReload();
  }, []);

  return (
    <PWAContext.Provider value={{ ...state, updateServiceWorker, promptInstall, dismissUpdateNotice, forceUpdate }}>
      {children}
    </PWAContext.Provider>
  );
}

export function usePWA(): PWAContextType {
  const context = useContext(PWAContext);
  if (!context) {
    return {
      needRefresh: false,
      offlineReady: false,
      isInstalled: false,
      isOnline: true,
      canInstall: false,
      installProgress: 100,
      installStatus: 'Pronto!',
      wasUpdated: false,
      appVersion: APP_VERSION,
      updateServiceWorker: () => {},
      promptInstall: async () => false,
      dismissUpdateNotice: () => {},
      forceUpdate: async () => {},
    };
  }
  return context;
}
