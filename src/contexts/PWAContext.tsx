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
  checkForUpdate: () => Promise<void>;
}

const PWAContext = createContext<PWAContextType | null>(null);

// Flags globais para evitar duplicação
let swRegistered = false;
let deferredPromptRef: any = null;
let updateSWRef: ((reloadPage?: boolean) => Promise<void>) | null = null;
let swRegistrationRef: ServiceWorkerRegistration | null = null;

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

    // Progresso simulado
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
            // NÃO aplicar automaticamente - exigir confirmação do usuário
            console.log('[PWA] Nova versão disponível - aguardando confirmação do usuário');
            if (mountedRef.current) {
              setState(prev => ({ ...prev, needRefresh: true }));
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
              swRegistrationRef = registration;
              // Verificar atualizações a cada 5 minutos
              setInterval(() => {
                console.log('[PWA] Verificando atualizações...');
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

    // NÃO escutar controllerchange para evitar reloads involuntários

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

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
    };
  }, []);

  // Atualizar SOMENTE quando o usuário confirmar
  const updateServiceWorker = useCallback(() => {
    console.log('[PWA] Usuário autorizou atualização');
    if (updateSWRef) {
      updateSWRef(true);
    }
    setState(prev => ({ ...prev, needRefresh: false }));
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
    setState(prev => ({ ...prev, wasUpdated: false, needRefresh: false }));
  }, []);

  const forceUpdate = useCallback(async () => {
    console.log('[PWA] Forçando atualização completa (autorizado pelo usuário)...');
    await forceCleanReload();
  }, []);

  const checkForUpdate = useCallback(async () => {
    console.log('[PWA] Verificação manual de atualização...');
    if (swRegistrationRef) {
      try {
        await swRegistrationRef.update();
        console.log('[PWA] Verificação de SW concluída');
      } catch (error) {
        console.error('[PWA] Erro ao verificar SW:', error);
      }
    } else {
      console.log('[PWA] Nenhum SW registrado, forçando reload...');
    }
  }, []);

  return (
    <PWAContext.Provider value={{ ...state, updateServiceWorker, promptInstall, dismissUpdateNotice, forceUpdate, checkForUpdate }}>
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
      checkForUpdate: async () => {},
    };
  }
  return context;
}
