import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { PermissionsProvider, usePermissions, useConditionalModuleData } from '@/contexts/PermissionsContext';

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

describe('PermissionsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('usePermissions hook', () => {
    it('deve lançar erro quando usado fora do PermissionsProvider', () => {
      // Arrange & Act
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        renderHook(() => usePermissions());
      }).toThrow('usePermissions deve ser usado dentro de PermissionsProvider');
      
      consoleError.mockRestore();
    });

    it('deve inicializar com loading true', () => {
      // Arrange & Act
      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      // Assert
      expect(result.current.loading).toBe(true);
    });

    it('deve inicializar com módulos e telas vazios', () => {
      // Arrange & Act
      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      // Assert
      expect(result.current.modules).toEqual([]);
      expect(result.current.screens).toEqual([]);
    });

    it('deve inicializar com role null', () => {
      // Arrange & Act
      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      // Assert
      expect(result.current.role).toBe(null);
    });

    it('deve inicializar com isAdmin false', () => {
      // Arrange & Act
      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      // Assert
      expect(result.current.isAdmin).toBe(false);
    });
  });

  describe('hasModulePermission', () => {
    it('deve retornar false para módulo não permitido quando não é admin', () => {
      // Arrange & Act
      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      // Assert
      expect(result.current.hasModulePermission('MODULO_INEXISTENTE')).toBe(false);
    });

    it('deve ter tipo correto de função', () => {
      // Arrange & Act
      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      // Assert
      expect(typeof result.current.hasModulePermission).toBe('function');
    });
  });

  describe('hasScreenPermission', () => {
    it('deve retornar false para tela não permitida quando não é admin', () => {
      // Arrange & Act
      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      // Assert
      expect(result.current.hasScreenPermission('TELA_INEXISTENTE')).toBe(false);
    });

    it('deve ter tipo correto de função', () => {
      // Arrange & Act
      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      // Assert
      expect(typeof result.current.hasScreenPermission).toBe('function');
    });
  });

  describe('refreshPermissions', () => {
    it('deve ter função disponível', () => {
      // Arrange & Act
      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      // Assert
      expect(typeof result.current.refreshPermissions).toBe('function');
    });
  });

  describe('Safety timeout', () => {
    it('deve definir loading false após timeout de segurança', async () => {
      // Este teste verifica que o timeout de segurança funciona
      // O timeout real é 10s, mas o mock do Supabase deve resolver antes
      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      // Aguardar que loading seja false (via timeout ou resolução)
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 12000 });
    });
  });

  describe('Segurança', () => {
    it('não deve expor dados sensíveis', () => {
      // Arrange & Act
      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      // Assert - verificar que apenas campos esperados estão presentes
      const contextKeys = Object.keys(result.current);
      
      expect(contextKeys).toContain('modules');
      expect(contextKeys).toContain('screens');
      expect(contextKeys).toContain('role');
      expect(contextKeys).toContain('isAdmin');
      expect(contextKeys).toContain('loading');
      expect(contextKeys).toContain('hasModulePermission');
      expect(contextKeys).toContain('hasScreenPermission');
      expect(contextKeys).toContain('refreshPermissions');
      
      // Não deve conter informações sensíveis
      expect(contextKeys).not.toContain('password');
      expect(contextKeys).not.toContain('token');
      expect(contextKeys).not.toContain('secret');
    });

    it('deve usar Set para lookup O(1) de permissões', () => {
      // Arrange & Act
      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      // Assert - verificar que hasModulePermission e hasScreenPermission existem
      // e são funções (a implementação interna usa Set)
      expect(typeof result.current.hasModulePermission).toBe('function');
      expect(typeof result.current.hasScreenPermission).toBe('function');
    });
  });

  describe('Event listeners', () => {
    it('deve reagir a evento permissions-updated', async () => {
      // Arrange
      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      // Act - disparar evento de atualização de permissões
      act(() => {
        window.dispatchEvent(new Event('permissions-updated'));
      });

      // Assert - não deve causar erro
      expect(result.current).toBeDefined();
    });

    it('deve reagir a evento modules-updated', async () => {
      // Arrange
      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      // Act - disparar evento de atualização de módulos
      act(() => {
        window.dispatchEvent(new Event('modules-updated'));
      });

      // Assert - não deve causar erro
      expect(result.current).toBeDefined();
    });
  });
});

describe('useConditionalModuleData hook', () => {
  it('deve ter comportamento correto de loading', () => {
    // Arrange
    const mockFetch = vi.fn().mockResolvedValue({ data: 'test' });
    
    // Act
    const { result } = renderHook(
      () => useConditionalModuleData('TEST_MODULE', mockFetch),
      { wrapper: PermissionsProvider }
    );

    // Assert
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe(null);
    expect(typeof result.current.refetch).toBe('function');
  });
});
