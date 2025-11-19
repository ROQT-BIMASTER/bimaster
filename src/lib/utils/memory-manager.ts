/**
 * Gerenciador de memória para prevenir travamentos
 * Limpa caches e listeners antigos periodicamente
 */

class MemoryManager {
  private static instance: MemoryManager;
  private cleanupInterval: number | null = null;
  private readonly CLEANUP_INTERVAL_MS = 3 * 60 * 1000; // 3 minutos (mais frequente)

  private constructor() {
    this.startPeriodicCleanup();
    this.setupVisibilityListener();
  }

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  private startPeriodicCleanup() {
    this.cleanupInterval = window.setInterval(() => {
      this.performCleanup();
    }, this.CLEANUP_INTERVAL_MS);
  }

  private setupVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        // App em background - fazer limpeza agressiva
        this.performCleanup();
      }
    });
  }

  private performCleanup() {
    console.log('🧹 Limpeza de memória iniciada...');

    try {
      // 1. Limpar cache do service worker antigo
      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          cacheNames.forEach(cacheName => {
            // Manter apenas caches essenciais recentes
            if (cacheName.includes('old') || cacheName.includes('outdated')) {
              caches.delete(cacheName).catch(err => 
                console.warn('Erro ao deletar cache:', err)
              );
            }
          });
        }).catch(err => console.warn('Erro ao acessar caches:', err));
      }

      // 2. Limpar localStorage de dados antigos (mais de 7 dias)
      this.cleanOldLocalStorage();

      // 3. Sugerir garbage collection se disponível (apenas em dev/debug)
      if (typeof (window as any).gc === 'function' && import.meta.env.DEV) {
        try {
          (window as any).gc();
        } catch (err) {
          // Ignorar erro se GC não estiver disponível
        }
      }

      console.log('✅ Limpeza de memória concluída');
    } catch (error) {
      console.error('Erro na limpeza de memória:', error);
    }
  }

  private cleanOldLocalStorage() {
    try {
      const keysToCheck = Object.keys(localStorage);
      const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      let cleanedCount = 0;

      keysToCheck.forEach(key => {
        // Não mexer em chaves do Supabase Auth e configurações críticas
        if (
          key.startsWith('sb-') || 
          key === 'supabase.auth.token' ||
          key === 'user_approved_cache'
        ) {
          return;
        }

        try {
          const item = localStorage.getItem(key);
          if (!item) return;

          const data = JSON.parse(item);
          if (data.timestamp && (now - data.timestamp) > ONE_WEEK_MS) {
            localStorage.removeItem(key);
            cleanedCount++;
          }
        } catch {
          // Ignorar itens que não são JSON ou não têm timestamp
        }
      });

      if (cleanedCount > 0) {
        console.log(`🗑️ Removidos ${cleanedCount} itens antigos do localStorage`);
      }
    } catch (error) {
      console.error('Erro ao limpar localStorage:', error);
    }
  }

  forceCleanup() {
    this.performCleanup();
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

export const memoryManager = MemoryManager.getInstance();
