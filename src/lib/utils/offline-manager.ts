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

  /**
   * Verifica a qualidade da conexão
   */
  getConnectionQuality(): 'good' | 'poor' | 'offline' {
    if (!this.isOnline) return 'offline';
    
    // @ts-ignore - navigator.connection pode não existir em todos os browsers
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    if (!connection) return 'good'; // Assumir boa se não temos info
    
    // Verificar tipo de conexão
    const slowTypes = ['slow-2g', '2g', '3g'];
    if (slowTypes.includes(connection.effectiveType)) {
      return 'poor';
    }
    
    // Verificar RTT (Round Trip Time)
    if (connection.rtt && connection.rtt > 500) {
      return 'poor';
    }
    
    return 'good';
  }

  cleanup() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    this.listeners.clear();
  }
}

export const offlineManager = OfflineManager.getInstance();
