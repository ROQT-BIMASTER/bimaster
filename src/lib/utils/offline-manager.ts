/**
 * Gerenciador de estado offline/online
 * Previne memory leaks e melhora performance
 */

export class OfflineManager {
  private static instance: OfflineManager;
  private listeners: Set<(isOnline: boolean) => void> = new Set();
  private isOnline: boolean = navigator.onLine;

  private constructor() {
    this.setupListeners();
  }

  static getInstance(): OfflineManager {
    if (!OfflineManager.instance) {
      OfflineManager.instance = new OfflineManager();
    }
    return OfflineManager.instance;
  }

  private setupListeners() {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  private handleOnline = () => {
    this.isOnline = true;
    this.notifyListeners();
  };

  private handleOffline = () => {
    this.isOnline = false;
    this.notifyListeners();
  };

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.isOnline));
  }

  subscribe(listener: (isOnline: boolean) => void): () => void {
    this.listeners.add(listener);
    // Notifica o estado atual imediatamente
    listener(this.isOnline);
    
    // Retorna função para remover listener
    return () => {
      this.listeners.delete(listener);
    };
  }

  getStatus(): boolean {
    return this.isOnline;
  }

  /**
   * Verifica se há uma sessão em cache no localStorage
   * Útil para modo offline
   */
  hasCachedSession(): boolean {
    try {
      const authStorage = localStorage.getItem('sb-aokkyrgaqjarhlywhjju-auth-token');
      if (!authStorage) return false;
      
      const authData = JSON.parse(authStorage);
      return !!(authData && authData.access_token && authData.expires_at && authData.expires_at > Date.now() / 1000);
    } catch {
      return false;
    }
  }

  cleanup() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    this.listeners.clear();
  }
}

export const offlineManager = OfflineManager.getInstance();
