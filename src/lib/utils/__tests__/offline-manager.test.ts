import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OfflineManager } from '../offline-manager';

describe('OfflineManager', () => {
  let offlineManager: OfflineManager;

  beforeEach(() => {
    offlineManager = OfflineManager.getInstance();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getInstance', () => {
    it('deve retornar sempre a mesma instância (singleton)', () => {
      const instance1 = OfflineManager.getInstance();
      const instance2 = OfflineManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('hasCachedSession', () => {
    it('deve retornar true quando há sessão válida em cache', () => {
      const futureTimestamp = (Date.now() / 1000) + 3600; // 1 hora no futuro
      
      localStorage.setItem('sb-test-project-auth-token', JSON.stringify({
        access_token: 'valid-token',
        expires_at: futureTimestamp,
      }));

      expect(offlineManager.hasCachedSession()).toBe(true);
    });

    it('deve retornar false quando sessão está expirada', () => {
      const pastTimestamp = (Date.now() / 1000) - 3600; // 1 hora no passado
      
      localStorage.setItem('sb-test-project-auth-token', JSON.stringify({
        access_token: 'expired-token',
        expires_at: pastTimestamp,
      }));

      expect(offlineManager.hasCachedSession()).toBe(false);
    });

    it('deve retornar false quando não há chave de auth', () => {
      expect(offlineManager.hasCachedSession()).toBe(false);
    });

    it('deve retornar false quando dados estão malformados', () => {
      localStorage.setItem('sb-test-project-auth-token', 'invalid-json');

      expect(offlineManager.hasCachedSession()).toBe(false);
    });

    it('deve buscar chave de auth dinamicamente', () => {
      const futureTimestamp = (Date.now() / 1000) + 3600;
      
      // Simular chave com nome dinâmico
      localStorage.setItem('sb-dynamic-project-id-auth-token', JSON.stringify({
        access_token: 'valid-token',
        expires_at: futureTimestamp,
      }));

      expect(offlineManager.hasCachedSession()).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('deve retornar status online do navegador', () => {
      expect(offlineManager.getStatus()).toBeDefined();
      expect(typeof offlineManager.getStatus()).toBe('boolean');
    });
  });

  describe('getConnectionQuality', () => {
    it('deve retornar qualidade da conexão', () => {
      const quality = offlineManager.getConnectionQuality();
      
      expect(['good', 'poor', 'offline']).toContain(quality);
    });
  });

  describe('subscribe', () => {
    it('deve permitir subscrição a mudanças de status', () => {
      const listener = vi.fn();
      
      const unsubscribe = offlineManager.subscribe(listener);

      // Listener deve ser chamado imediatamente com status atual
      expect(listener).toHaveBeenCalledWith(expect.any(Boolean));
      expect(typeof unsubscribe).toBe('function');
    });

    it('deve remover listener ao chamar unsubscribe', () => {
      const listener = vi.fn();
      
      const unsubscribe = offlineManager.subscribe(listener);
      listener.mockClear(); // Limpar a chamada inicial
      
      unsubscribe();
      
      // Trigger um evento (não deve chamar listener removido)
      window.dispatchEvent(new Event('online'));
      
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('deve limpar recursos corretamente', () => {
      offlineManager.cleanup();
      
      // Verificar que listeners foram removidos (não deve crashar)
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('offline'));
    });
  });
});
