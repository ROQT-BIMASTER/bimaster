import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PermissionsContextType {
  modules: string[];
  screens: string[];
  role: string | null;
  isAdmin: boolean;
  loading: boolean;
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

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export const PermissionsProvider = ({ children }: { children: ReactNode }) => {
  const [modules, setModules] = useState<string[]>([]);
  const [screens, setScreens] = useState<string[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async (forceRefresh = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setModules([]);
        setScreens([]);
        setRole(null);
        setIsAdmin(false);
        setLoading(false);
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
        setModules(globalPermissionsCache.modules);
        setScreens(globalPermissionsCache.screens);
        setRole(globalPermissionsCache.role);
        setIsAdmin(globalPermissionsCache.isAdmin);
        setLoading(false);
        return;
      }

      // Buscar role do usuário
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      const userRole = roleData?.role || "vendedor";
      const userIsAdmin = userRole === "admin";

      // Buscar permissões usando a RPC otimizada
      const { data: permissionsData } = await supabase
        .rpc("get_user_combined_module_permissions", { _user_id: user.id });

      const modulesList = permissionsData?.map((p: any) => p.codigo) || [];
      
      // Para telas, se admin, tem acesso a todas
      let screensList: string[] = [];
      if (userIsAdmin) {
        const { data: allScreens } = await supabase
          .from("telas_sistema")
          .select("codigo")
          .eq("ativo", true);
        screensList = allScreens?.map(s => s.codigo) || [];
      } else {
        const { data: userScreens } = await supabase
          .from("usuario_permissoes_telas")
          .select("telas_sistema(codigo)")
          .eq("usuario_id", user.id);
        
        const { data: deptScreens } = await supabase
          .from("profiles")
          .select("departamento_id")
          .eq("id", user.id)
          .maybeSingle();
        
        if (deptScreens?.departamento_id) {
          const { data: deptPermissions } = await supabase
            .from("departamento_permissoes_telas")
            .select("telas_sistema(codigo)")
            .eq("departamento_id", deptScreens.departamento_id);
          
          const deptCodes = deptPermissions
            ?.map((p: any) => p.telas_sistema?.codigo)
            .filter(Boolean) || [];
          screensList = [...new Set([...screensList, ...deptCodes])];
        }
        
        const userCodes = userScreens
          ?.map((p: any) => p.telas_sistema?.codigo)
          .filter(Boolean) || [];
        screensList = [...new Set([...screensList, ...userCodes])];
      }

      // Atualizar cache
      globalPermissionsCache = {
        userId: user.id,
        modules: modulesList,
        screens: screensList,
        role: userRole,
        isAdmin: userIsAdmin,
        timestamp: now,
      };

      setModules(modulesList);
      setScreens(screensList);
      setRole(userRole);
      setIsAdmin(userIsAdmin);
    } catch (error) {
      console.error("Erro ao carregar permissões:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();

    // Listener para mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        fetchPermissions(true);
      } else if (event === "SIGNED_OUT") {
        globalPermissionsCache = null;
        setModules([]);
        setScreens([]);
        setRole(null);
        setIsAdmin(false);
      }
    });

    // Listener para atualizações de permissões
    const handlePermissionsUpdate = () => {
      globalPermissionsCache = null;
      fetchPermissions(true);
    };

    window.addEventListener("permissions-updated", handlePermissionsUpdate);
    window.addEventListener("modules-updated", handlePermissionsUpdate);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("permissions-updated", handlePermissionsUpdate);
      window.removeEventListener("modules-updated", handlePermissionsUpdate);
    };
  }, [fetchPermissions]);

  const hasModulePermission = useCallback((moduleCode: string): boolean => {
    if (isAdmin) return true;
    return modules.includes(moduleCode);
  }, [modules, isAdmin]);

  const hasScreenPermission = useCallback((screenCode: string): boolean => {
    if (isAdmin) return true;
    return screens.includes(screenCode);
  }, [screens, isAdmin]);

  const refreshPermissions = useCallback(async () => {
    globalPermissionsCache = null;
    await fetchPermissions(true);
  }, [fetchPermissions]);

  return (
    <PermissionsContext.Provider
      value={{
        modules,
        screens,
        role,
        isAdmin,
        loading,
        hasModulePermission,
        hasScreenPermission,
        refreshPermissions,
      }}
    >
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
