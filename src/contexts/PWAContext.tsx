import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { checkAndUpdateVersion, APP_VERSION, forceCleanReload, getDeployedVersionFromHtml, isVersionMismatch } from '@/lib/version';
import { isPwaHeartbeatEnabled } from '@/lib/featureFlags';
import { fetchLatestPin, subscribeToReleasePins, isBelowPin, type ReleasePin } from '@/lib/releasePin';
import { isReloadGateActive, onReloadGateClear } from '@/lib/pwaReloadGate';
import { logger } from "@/lib/logger";

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
  autoUpdateOnLogin: () => Promise<void>;
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
        logger.log('[PWA] SW já registrado, ignorando...');
        return;
      }
      swRegistered = true;

      try {
        const { registerSW } = await import('virtual:pwa-register');
        
        const updateSW = registerSW({
          immediate: true,
          onNeedRefresh() {
            logger.log('[PWA] Nova versão disponível - aplicando automaticamente');
            if (mountedRef.current) {
              setState(prev => ({ ...prev, needRefresh: true }));
            }
            updateSWRef?.(true);
          },
          onOfflineReady() {
            logger.log('[PWA] App pronto para uso offline');
            if (mountedRef.current) {
              setState(prev => ({ ...prev, offlineReady: true }));
            }
          },
          onRegisteredSW(swUrl, registration) {
            logger.log('[PWA] Service Worker registrado:', swUrl);
            
            if (registration) {
              swRegistrationRef = registration;
              // Verificar atualizações a cada 2 minutos (antes era 5min)
              setInterval(() => {
                logger.log('[PWA] Verificando atualizações...');
                registration.update();
              }, 2 * 60 * 1000);
            }
          },
          onRegisterError(error) {
            logger.error('[PWA] Erro no registro:', error);
          }
        });

        updateSWRef = updateSW;
      } catch (error) {
        logger.log('[PWA] Service Worker não disponível:', error);
        swRegistered = false;
      }
    };

    registerServiceWorker();

    // Quando o SW novo assume controle (após skipWaiting), recarregar a página
    // automaticamente UMA vez para garantir que o cliente esteja na versão nova.
    let reloadedForNewSW = false;
    const doReload = () => {
      if (reloadedForNewSW) return;
      reloadedForNewSW = true;
      logger.log('[PWA] Novo Service Worker assumiu controle — recarregando para versão nova');
      window.location.reload();
    };
    const handleControllerChange = () => {
      if (reloadedForNewSW) return;
      // Se houver UI sensível aberta (ex.: drawer de tarefa), aguarda fechar
      // antes de recarregar — preserva o contexto do usuário.
      if (isReloadGateActive()) {
        logger.log('[PWA] Reload adiado: UI sensível aberta (reload-gate ativo)');
        const off = onReloadGateClear(() => {
          off();
          doReload();
        });
        return;
      }
      doReload();
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    }

    // Heartbeat de versão (Fase 2 + cache-busting reforçado): compara meta
    // tag do index.html remoto (versão + build-id) com o bundle atual.
    // Quebra o deadlock quando o SW está preso servindo bundle antigo.
    // Auto-reload é aplicado apenas quando reload-gate está livre.
    let notifiedForVersion: string | null = null;
    let mismatchStreak = 0;
    const runHeartbeat = async () => {
      try {
        const remote = await getDeployedVersionFromHtml();
        if (!isVersionMismatch(remote)) {
          mismatchStreak = 0;
          return;
        }
        mismatchStreak += 1;
        const key = `${remote.version || '?'}::${remote.buildId || '?'}`;
        if (notifiedForVersion !== key) {
          notifiedForVersion = key;
          logger.log(`[PWA] Heartbeat: divergência detectada ${APP_VERSION} → ${remote.version} (build ${remote.buildId})`);
        }
        if (!isPwaHeartbeatEnabled() || !mountedRef.current) return;
        setState(prev => ({ ...prev, needRefresh: true }));
        // Auto-recuperação: após 2 checks consecutivos com divergência e sem
        // UI sensível aberta, força limpeza + reload. Se drawer/dialog estiver
        // aberto, aguarda o reload-gate liberar.
        if (mismatchStreak >= 2 && !isReloadGateActive()) {
          logger.log('[PWA] Heartbeat: aplicando forceCleanReload automático');
          void forceCleanReload();
        }
      } catch { /* noop */ }
    };

    // Quando o usuário volta à aba, checar atualização imediatamente
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (swRegistrationRef) swRegistrationRef.update().catch(() => { /* noop */ });
        void runHeartbeat();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    // Primeiro heartbeat ~10s após mount + polling periódico a cada 3 min
    // (equivale ao intervalo de update do SW; ambos são baratos e resilientes).
    const heartbeatBoot = setTimeout(() => { void runHeartbeat(); }, 10_000);
    const heartbeatInterval = setInterval(() => { void runHeartbeat(); }, 3 * 60 * 1000);

    // Kill switch remoto (Fase 4): pull inicial + push Realtime.
    // Só age se a flag pwa_heartbeat estiver ligada (mesma flag da Fase 2/4
    // para rollout unificado e zero risco).
    const handlePin = (pin: ReleasePin) => {
      if (!isBelowPin(pin)) return;
      logger.log(`[PWA] Release pin ativo: ${APP_VERSION} < ${pin.min_version}`);
      if (isPwaHeartbeatEnabled() && mountedRef.current) {
        setState(prev => ({ ...prev, needRefresh: true }));
      }
    };
    void fetchLatestPin().then((pin) => { if (pin) handlePin(pin); });
    const unsubscribePin = subscribeToReleasePins(handlePin);

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
      clearTimeout(heartbeatBoot);
      try { unsubscribePin(); } catch { /* noop */ }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      }
    };
  }, []);

  // Atualizar quando o usuário confirmar ou quando o app detectar drift
  const updateServiceWorker = useCallback(() => {
    logger.log('[PWA] Usuário autorizou atualização');
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
      logger.error('[PWA] Erro ao instalar:', error);
      return false;
    }
  }, []);

  const dismissUpdateNotice = useCallback(() => {
    setState(prev => ({ ...prev, wasUpdated: false, needRefresh: false }));
  }, []);

  const forceUpdate = useCallback(async () => {
    logger.log('[PWA] Forçando atualização completa (autorizado pelo usuário)...');
    await forceCleanReload();
  }, []);

  const checkForUpdate = useCallback(async () => {
    logger.log('[PWA] Verificação manual de atualização...');
    if (swRegistrationRef) {
      try {
        await swRegistrationRef.update();
        logger.log('[PWA] Verificação de SW concluída');
      } catch (error) {
        logger.error('[PWA] Erro ao verificar SW:', error);
      }
    } else {
      logger.log('[PWA] Nenhum SW registrado, forçando reload...');
    }
  }, []);

  const autoUpdateOnLogin = useCallback(async () => {
    if (swRegistrationRef) {
      try {
        await swRegistrationRef.update();
      } catch (error) {
        logger.error('[PWA] Erro ao atualizar no login:', error);
      }
    }
  }, []);

  return (
    <PWAContext.Provider value={{ ...state, updateServiceWorker, promptInstall, dismissUpdateNotice, forceUpdate, checkForUpdate, autoUpdateOnLogin }}>
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
      autoUpdateOnLogin: async () => {},
    };
  }
  return context;
}
