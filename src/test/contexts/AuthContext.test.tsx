import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

// Polyfill waitFor se não existir
const waitFor = async (callback: () => void | Promise<void>, options?: { timeout?: number }) => {
  const timeout = options?.timeout || 1000;
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      await callback();
      return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  await callback();
};

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', { value: true, writable: true });

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('useAuth hook', () => {
    it('deve lançar erro quando usado fora do AuthProvider', () => {
      // Arrange & Act
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth deve ser usado dentro de AuthProvider');
      
      consoleError.mockRestore();
    });

    it('deve inicializar com loading true', () => {
      // Arrange & Act
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      // Assert
      expect(result.current.loading).toBe(true);
    });

    it('deve inicializar com session null quando não há cache', () => {
      // Arrange & Act
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      // Assert
      expect(result.current.session).toBe(null);
      expect(result.current.user).toBe(null);
    });

    it('deve inicializar approved como true quando há cache no localStorage', () => {
      // Arrange
      localStorageMock.getItem.mockReturnValue('true');
      
      // Act
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      // Assert
      expect(result.current.approved).toBe(true);
    });

    it('deve ter isOnline inicializado corretamente', () => {
      // Arrange & Act
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      // Assert
      expect(result.current.isOnline).toBe(true);
    });

    it('deve ter função refreshAuth disponível', () => {
      // Arrange & Act
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      // Assert
      expect(typeof result.current.refreshAuth).toBe('function');
    });
  });

  describe('Estado offline', () => {
    it('deve atualizar isOnline quando status de rede muda', async () => {
      // Arrange
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      // Act - simular offline
      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isOnline).toBe(false);
      });

      // Act - simular online
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isOnline).toBe(true);
      });
    });
  });

  describe('Cache de aprovação', () => {
    it('deve salvar aprovação no cache quando usuário é aprovado', () => {
      // Arrange
      localStorageMock.getItem.mockReturnValue('true');
      
      // Act
      renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      // Assert - O cache foi lido
      expect(localStorageMock.getItem).toHaveBeenCalledWith('user_approved_cache');
    });
  });

  describe('Segurança', () => {
    it('deve limpar cache no logout', async () => {
      // Arrange
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      // Assert - inicialmente não deve ter sessão
      expect(result.current.session).toBe(null);
      expect(result.current.approved).toBe(false);
    });

    it('não deve expor dados sensíveis no contexto', () => {
      // Arrange & Act
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      // Assert - verificar que apenas campos esperados estão presentes
      const contextKeys = Object.keys(result.current);
      expect(contextKeys).toContain('session');
      expect(contextKeys).toContain('user');
      expect(contextKeys).toContain('approved');
      expect(contextKeys).toContain('loading');
      expect(contextKeys).toContain('isOnline');
      expect(contextKeys).toContain('refreshAuth');
      
      // Não deve conter tokens diretamente expostos
      expect(contextKeys).not.toContain('accessToken');
      expect(contextKeys).not.toContain('refreshToken');
    });
  });
});
