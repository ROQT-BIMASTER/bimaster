/**
 * Sistema otimizado de gerenciamento de permissões
 * Reduz drasticamente consultas ao banco de dados
 */

import { supabase } from '@/integrations/supabase/client';

interface PermissionCache {
  userId: string;
  role: string;
  modules: Set<string>;
  screens: Set<string>;
  timestamp: number;
  isAdmin: boolean;
}

class PermissionsManager {
  private cache: PermissionCache | null = null;
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutos
  private fetchPromise: Promise<PermissionCache> | null = null;

  /**
   * Busca e cacheia permissões do usuário
   */
  async fetchPermissions(userId: string, forceRefresh = false): Promise<PermissionCache> {
    // Se há uma busca em andamento, aguardar ela
    if (this.fetchPromise && !forceRefresh) {
      return this.fetchPromise;
    }

    // Verificar cache válido
    if (this.cache && !forceRefresh) {
      const now = Date.now();
      if (
        this.cache.userId === userId &&
        now - this.cache.timestamp < this.CACHE_DURATION
      ) {
        return this.cache;
      }
    }

    // Criar nova promise de fetch
    this.fetchPromise = this.performFetch(userId);
    
    try {
      const result = await this.fetchPromise;
      return result;
    } finally {
      this.fetchPromise = null;
    }
  }

  private async performFetch(userId: string): Promise<PermissionCache> {
    try {
      // Buscar role, módulos e telas em paralelo
      const [roleRes, modulesRes, screensRes] = await Promise.all([
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase.rpc('get_user_module_permissions', { _user_id: userId }),
        supabase.rpc('get_user_screen_permissions', { _user_id: userId }),
      ]);

      const role = roleRes.data?.role || 'vendedor';
      const isAdmin = role === 'admin';

      // Converter arrays em Sets para lookup O(1)
      const modules = new Set<string>(
        modulesRes.data?.map((m: any) => m.modulo_codigo) || []
      );
      const screens = new Set<string>(
        screensRes.data?.map((s: any) => s.tela_codigo) || []
      );

      const permissions: PermissionCache = {
        userId,
        role,
        modules,
        screens,
        timestamp: Date.now(),
        isAdmin,
      };

      this.cache = permissions;
      return permissions;
    } catch (error) {
      console.error('Error fetching permissions:', error);
      // Retornar cache parcial em caso de erro
      return {
        userId,
        role: 'vendedor',
        modules: new Set(),
        screens: new Set(),
        timestamp: Date.now(),
        isAdmin: false,
      };
    }
  }

  /**
   * Verifica permissão de módulo (O(1) lookup)
   */
  async hasModulePermission(userId: string, moduleCode: string): Promise<boolean> {
    const permissions = await this.fetchPermissions(userId);
    return permissions.isAdmin || permissions.modules.has(moduleCode);
  }

  /**
   * Verifica permissão de tela (O(1) lookup)
   */
  async hasScreenPermission(userId: string, screenCode: string): Promise<boolean> {
    const permissions = await this.fetchPermissions(userId);
    return permissions.isAdmin || permissions.screens.has(screenCode);
  }

  /**
   * Verifica múltiplas permissões de uma vez
   */
  async hasMultiplePermissions(
    userId: string,
    checks: Array<{ type: 'module' | 'screen'; code: string }>
  ): Promise<Record<string, boolean>> {
    const permissions = await this.fetchPermissions(userId);
    const results: Record<string, boolean> = {};

    for (const check of checks) {
      const key = `${check.type}:${check.code}`;
      if (permissions.isAdmin) {
        results[key] = true;
      } else if (check.type === 'module') {
        results[key] = permissions.modules.has(check.code);
      } else {
        results[key] = permissions.screens.has(check.code);
      }
    }

    return results;
  }

  /**
   * Retorna todas as permissões do usuário
   */
  async getAllPermissions(userId: string): Promise<{
    modules: string[];
    screens: string[];
    role: string;
    isAdmin: boolean;
  }> {
    const permissions = await this.fetchPermissions(userId);
    return {
      modules: Array.from(permissions.modules),
      screens: Array.from(permissions.screens),
      role: permissions.role,
      isAdmin: permissions.isAdmin,
    };
  }

  /**
   * Invalida cache de permissões
   */
  invalidate(userId?: string): void {
    if (!userId || (this.cache && this.cache.userId === userId)) {
      this.cache = null;
    }
  }

  /**
   * Força refresh das permissões
   */
  async refresh(userId: string): Promise<void> {
    await this.fetchPermissions(userId, true);
  }

  /**
   * Verifica se é admin (cache otimizado)
   */
  async isAdmin(userId: string): Promise<boolean> {
    const permissions = await this.fetchPermissions(userId);
    return permissions.isAdmin;
  }

  /**
   * Verifica se é admin ou supervisor
   */
  async isAdminOrSupervisor(userId: string): Promise<boolean> {
    const permissions = await this.fetchPermissions(userId);
    return permissions.isAdmin || permissions.role === 'supervisor';
  }

  /**
   * Retorna o role do usuário
   */
  async getRole(userId: string): Promise<string> {
    const permissions = await this.fetchPermissions(userId);
    return permissions.role;
  }
}

export const permissionsManager = new PermissionsManager();

/**
 * Hook-like function para usar em componentes
 */
export async function useOptimizedPermissions(userId: string) {
  const permissions = await permissionsManager.fetchPermissions(userId);
  
  return {
    role: permissions.role,
    isAdmin: permissions.isAdmin,
    hasModule: (code: string) => permissions.isAdmin || permissions.modules.has(code),
    hasScreen: (code: string) => permissions.isAdmin || permissions.screens.has(code),
    modules: Array.from(permissions.modules),
    screens: Array.from(permissions.screens),
  };
}
