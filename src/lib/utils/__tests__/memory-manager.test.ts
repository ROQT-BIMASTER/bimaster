import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { memoryManager } from '../memory-manager';

describe('memoryManager', () => {

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('forceCleanup', () => {
    it('deve executar limpeza forçada sem erros', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      memoryManager.forceCleanup();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Limpeza de memória'));
    });
  });

  describe('cleanOldLocalStorage', () => {
    it('deve remover itens antigos do localStorage', () => {
      const OLD_TIMESTAMP = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 dias atrás
      const RECENT_TIMESTAMP = Date.now() - (2 * 24 * 60 * 60 * 1000); // 2 dias atrás

      // Item antigo que deve ser removido
      localStorage.setItem('old-data', JSON.stringify({ 
        timestamp: OLD_TIMESTAMP, 
        data: 'old' 
      }));

      // Item recente que deve ser mantido
      localStorage.setItem('recent-data', JSON.stringify({ 
        timestamp: RECENT_TIMESTAMP, 
        data: 'recent' 
      }));

      memoryManager['cleanOldLocalStorage']();

      expect(localStorage.getItem('old-data')).toBeNull();
      expect(localStorage.getItem('recent-data')).not.toBeNull();
    });

    it('deve preservar chaves críticas do Supabase', () => {
      localStorage.setItem('sb-auth-token', JSON.stringify({ 
        timestamp: Date.now() - (10 * 24 * 60 * 60 * 1000) 
      }));
      localStorage.setItem('supabase.auth.token', 'token');
      localStorage.setItem('user_approved_cache', 'approved');

      memoryManager['cleanOldLocalStorage']();

      expect(localStorage.getItem('sb-auth-token')).not.toBeNull();
      expect(localStorage.getItem('supabase.auth.token')).not.toBeNull();
      expect(localStorage.getItem('user_approved_cache')).not.toBeNull();
    });

    it('deve ignorar itens que não são JSON válido', () => {
      localStorage.setItem('invalid-json', 'not a json');
      
      expect(() => {
        memoryManager['cleanOldLocalStorage']();
      }).not.toThrow();

      expect(localStorage.getItem('invalid-json')).toBe('not a json');
    });
  });

  describe('destroy', () => {
    it('deve limpar recursos corretamente', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      memoryManager.destroy();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});
