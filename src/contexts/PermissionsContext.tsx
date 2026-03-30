import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PermissionsContextType {
  modules: string[];
  screens: string[];
  role: string | null;
  isAdmin: boolean;
  loading: boolean;
  permissionsReady: boolean;
  hasModulePermission: (moduleCode: string) => boolean;
  hasScreenPermission: (screenCode: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | null>(null);

// Cache global para evitar re-fetch em re-renders
let globalPermissionsCache: {
  userId: string | null;
  modules: string[];
  screens: string[];
  role: string | null;
  isAdmin: boolean;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 2 * 60 * 1000; // 2 minutos (aumentado de 30s para reduzir re-fetches)
const SAFETY_TIMEOUT = 5000; // 5s - reduced from 12s
const LOCAL_STORAGE_KEY = "permissions_cache_v1";

// Restore from localStorage on startup for instant loading
const restoreFromLocalStorage = (): typeof globalPermissionsCache => {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Accept localStorage cache for up to 5 minutes for instant boot
      if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
        return parsed;
      }
    }
  } catch {}
  return null;
};

const saveToLocalStorage = (cache: NonNullable<typeof globalPermissionsCache>) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cache));
  } catch {}
};

export const PermissionsProvider = ({ children }: { children: ReactNode }) => {
  // SECURITY: Never pre-populate from localStorage — prevents permission leakage between users
  const [modules, setModules] = useState<string[]>([]);
  const [screens, setScreens] = useState<string[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [permissionsReady, setPermissionsReady] = useState(false);
  const isMountedRef = useRef(true);
  const fetchInProgressRef = useRef(false);

  // Timeout de segurança - garante que loading nunca fica infinito
  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (isMountedRef.current && loading) {
        console.log("[PermissionsContext] Safety timeout triggered - forcing loading to false");
        // SECURITY: Only use localStorage fallback if userId matches current session
        const fallback = restoreFromLocalStorage();
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id;
        if (fallback && fallback.modules.length > 0 && currentUserId && fallback.userId === currentUserId) {
          console.log("[PermissionsContext] Using localStorage cache as fallback (userId verified)");
          setModules(fallback.modules);
          setScreens(fallback.screens);
          setRole(fallback.role);
          setIsAdmin(fallback.isAdmin);
        } else {
          // SECURITY: Clear any stale state from previous user
          console.log("[PermissionsContext] No valid fallback - clearing stale state");
          setModules([]);
          setScreens([]);
          setRole(null);
          setIsAdmin(false);
        }
        setLoading(false);
      }
    }, SAFETY_TIMEOUT);
    
    return () => clearTimeout(timeout);
  }, [loading]);

  const fetchPermissions = useCallback(async (forceRefresh = false) => {
    // Prevent duplicate concurrent fetches
    if (fetchInProgressRef.current && !forceRefresh) {
      console.log("[PermissionsContext] Fetch already in progress, skipping (non-forced)");
      return;
    }
    fetchInProgressRef.current = true;

    try {
      console.log("[PermissionsContext] Iniciando fetchPermissions");
      // Usar getSession (memória) em vez de getUser (rede)
      const { data: { session }, error: userError } = await supabase.auth.getSession();
      const user = session?.user;
      
      if (userError) {
        console.error("[PermissionsContext] Erro ao obter usuário:", userError);
        if (isMountedRef.current) {
          setModules([]);
          setScreens([]);
          setRole(null);
          setIsAdmin(false);
        }
        return;
      }
      
      if (!user) {
        if (isMountedRef.current) {
          setModules([]);
          setScreens([]);
          setRole(null);
          setIsAdmin(false);
        }
        return;
      }

      // Verificar cache
      const now = Date.now();
      if (
        !forceRefresh &&
        globalPermissionsCache &&
        globalPermissionsCache.userId === user.id &&
        now - globalPermissionsCache.timestamp < CACHE_DURATION
      ) {
        if (isMountedRef.current) {
          setModules(globalPermissionsCache.modules);
          setScreens(globalPermissionsCache.screens);
          setRole(globalPermissionsCache.role);
          setIsAdmin(globalPermissionsCache.isAdmin);
        }
        return;
      }

      // Usar RPC otimizada - UMA ÚNICA CHAMADA para tudo
      const { data: permData, error } = await supabase
        .rpc("get_all_user_permissions", { p_user_id: user.id });

      if (error) {
        console.error("[PermissionsContext] Erro ao buscar permissões:", error);
        // Fallback para método antigo em caso de erro
        await fetchPermissionsFallback(user.id);
        return;
      }

      const result = permData?.[0];
      const userRole = result?.role || "vendedor";
      const userIsAdmin = result?.is_admin || false;
      const modulesList = result?.modules || [];
      const screensList = result?.screens || [];

      // Atualizar cache
      globalPermissionsCache = {
        userId: user.id,
        modules: modulesList,
        screens: screensList,
        role: userRole,
        isAdmin: userIsAdmin,
        timestamp: now,
      };
      saveToLocalStorage(globalPermissionsCache);

      if (isMountedRef.current) {
        setModules(modulesList);
        setScreens(screensList);
        setRole(userRole);
        setIsAdmin(userIsAdmin);
      }
    } catch (error) {
      console.error("[PermissionsContext] Erro ao carregar permissões:", error);
    } finally {
      fetchInProgressRef.current = false;
      if (isMountedRef.current) {
        console.log("[PermissionsContext] Finalizando fetchPermissions");
        setLoading(false);
        setPermissionsReady(true);
      }
    }
  }, []);

  // Fallback para compatibilidade
  const fetchPermissionsFallback = async (userId: string) => {
    try {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      const userRole = roleData?.role || "vendedor";
      const userIsAdmin = userRole === "admin";

      // Buscar módulos e telas em paralelo
      const [modulesResult, screensResult] = await Promise.all([
        supabase.rpc("get_user_combined_module_permissions", { _user_id: userId }),
        supabase.rpc("get_user_combined_screen_permissions", { _user_id: userId })
      ]);

      const modulesList = modulesResult.data?.map((p: any) => p.modulo_codigo) || [];
      const screensList = screensResult.data?.map((s: any) => s.tela_codigo) || [];

      globalPermissionsCache = {
        userId,
        modules: modulesList,
        screens: screensList,
        role: userRole,
        isAdmin: userIsAdmin,
        timestamp: Date.now(),
      };
      saveToLocalStorage(globalPermissionsCache);

      if (isMountedRef.current) {
        setModules(modulesList);
        setScreens(screensList);
        setRole(userRole);
        setIsAdmin(userIsAdmin);
      }
    } catch (error) {
      console.error("[PermissionsContext] Erro no fallback de permissões:", error);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    
    fetchPermissions();

    // Listener para mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (!isMountedRef.current) return;
      
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        // SECURITY: Reset state immediately to prevent permission leakage between users
        globalPermissionsCache = null;
        try { localStorage.removeItem(LOCAL_STORAGE_KEY); } catch {}
        setModules([]);
        setScreens([]);
        setRole(null);
        setIsAdmin(false);
        setLoading(true);
        fetchPermissions(true);
      } else if (event === "SIGNED_OUT") {
        globalPermissionsCache = null;
        try { localStorage.removeItem(LOCAL_STORAGE_KEY); } catch {}
        setModules([]);
        setScreens([]);
        setRole(null);
        setIsAdmin(false);
        setLoading(false);
      }
    });

    // Listener para atualizações de permissões via eventos globais
    const handlePermissionsUpdate = () => {
      console.log("[PermissionsContext] Atualizando permissões via evento global");
      globalPermissionsCache = null;
      fetchPermissions(true);
    };

    window.addEventListener("permissions-updated", handlePermissionsUpdate);
    window.addEventListener("modules-updated", handlePermissionsUpdate);

    // Realtime listeners para mudanças nas tabelas de permissões
    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtimeChannel = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId || !isMountedRef.current) return;

      realtimeChannel = supabase
        .channel('permissions-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'usuario_permissoes_modulos', filter: `usuario_id=eq.${userId}` },
          () => {
            console.log("[PermissionsContext] Módulos do usuário atualizados - recarregando");
            handlePermissionsUpdate();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'usuario_permissoes_telas', filter: `usuario_id=eq.${userId}` },
          () => {
            console.log("[PermissionsContext] Telas do usuário atualizadas - recarregando");
            handlePermissionsUpdate();
          }
        )
        // ADV-4: Listen for session invalidation events (role changes force logout)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'session_invalidation_queue', filter: `user_id=eq.${userId}` },
          async (payload) => {
            console.warn("[PermissionsContext] Session invalidation received:", payload.new);
            // Force sign out — role/permissions were changed by an admin
            globalPermissionsCache = null;
            try { localStorage.removeItem(LOCAL_STORAGE_KEY); } catch {}
            await supabase.auth.signOut();
            window.location.href = "/?session_invalidated=1";
          }
        )
        .subscribe();
    };

    setupRealtimeChannel();

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
      window.removeEventListener("permissions-updated", handlePermissionsUpdate);
      window.removeEventListener("modules-updated", handlePermissionsUpdate);
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [fetchPermissions]);

  // Memoizar Set para lookup O(1)
  const modulesSet = useMemo(() => new Set(modules), [modules]);
  const screensSet = useMemo(() => new Set(screens), [screens]);

  const hasModulePermission = useCallback((moduleCode: string): boolean => {
    if (isAdmin) return true;
    return modulesSet.has(moduleCode);
  }, [modulesSet, isAdmin]);

  const hasScreenPermission = useCallback((screenCode: string): boolean => {
    if (isAdmin) return true;
    return screensSet.has(screenCode);
  }, [screensSet, isAdmin]);

  const refreshPermissions = useCallback(async () => {
    globalPermissionsCache = null;
    await fetchPermissions(true);
  }, [fetchPermissions]);

  const value = useMemo(() => ({
    modules,
    screens,
    role,
    isAdmin,
    loading,
    hasModulePermission,
    hasScreenPermission,
    refreshPermissions,
  }), [modules, screens, role, isAdmin, loading, hasModulePermission, hasScreenPermission, refreshPermissions]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error("usePermissions deve ser usado dentro de PermissionsProvider");
  }
  return context;
};

// Hook para carregar dados condicionalmente baseado em permissão de módulo
export const useConditionalModuleData = <T,>(
  moduleCode: string,
  fetchFn: () => Promise<T>,
  deps: any[] = []
): { data: T | null; loading: boolean; refetch: () => void } => {
  const { hasModulePermission, loading: permissionsLoading } = usePermissions();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (permissionsLoading) return;
    
    if (!hasModulePermission(moduleCode)) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await fetchFn();
      setData(result);
    } catch (error) {
      console.error(`Erro ao carregar dados do módulo ${moduleCode}:`, error);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [moduleCode, hasModulePermission, permissionsLoading, ...deps]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading: loading || permissionsLoading, refetch: fetchData };
};
