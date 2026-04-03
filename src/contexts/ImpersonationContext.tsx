import { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "./PermissionsContext";

interface ImpersonatedUser {
  id: string;
  nome: string;
  email: string;
  role: string | null;
}

interface ImpersonatedPermissions {
  modules: string[];
  screens: string[];
  role: string | null;
  isAdmin: boolean;
}

interface ImpersonationContextType {
  isImpersonating: boolean;
  impersonatedUser: ImpersonatedUser | null;
  impersonatedPermissions: ImpersonatedPermissions | null;
  startImpersonation: (userId: string) => Promise<boolean>;
  stopImpersonation: () => void;
  hasModulePermission: (moduleCode: string) => boolean;
  hasScreenPermission: (screenCode: string) => boolean;
  loading: boolean;
}

interface PersistedImpersonationState {
  ownerUserId: string;
  impersonatedUser: ImpersonatedUser;
  impersonatedPermissions: ImpersonatedPermissions;
}

const IMPERSONATION_SESSION_KEY = "impersonation_state_v2";
const LEGACY_IMPERSONATION_USER_KEY = "impersonation_user";
const LEGACY_IMPERSONATION_PERMISSIONS_KEY = "impersonation_permissions";

const ImpersonationContext = createContext<ImpersonationContextType | null>(null);

export const ImpersonationProvider = ({ children }: { children: ReactNode }) => {
  const realPermissions = usePermissions();
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null);
  const [impersonatedPermissions, setImpersonatedPermissions] = useState<ImpersonatedPermissions | null>(null);
  const [loading, setLoading] = useState(false);

  const clearStoredImpersonation = useCallback((resetState = true) => {
    sessionStorage.removeItem(IMPERSONATION_SESSION_KEY);
    sessionStorage.removeItem(LEGACY_IMPERSONATION_USER_KEY);
    sessionStorage.removeItem(LEGACY_IMPERSONATION_PERMISSIONS_KEY);

    if (resetState) {
      setImpersonatedUser(null);
      setImpersonatedPermissions(null);
    }
  }, []);

  // SECURITY: restore impersonation only for the same admin user who created it
  useEffect(() => {
    const restoreImpersonation = async () => {
      if (realPermissions.loading) return;

      // Never allow non-admin users to keep any impersonation residue
      if (!realPermissions.isAdmin) {
        clearStoredImpersonation(true);
        return;
      }

      const stored = sessionStorage.getItem(IMPERSONATION_SESSION_KEY);
      if (!stored) return;

      try {
        const parsed = JSON.parse(stored) as PersistedImpersonationState;
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id;

        if (!currentUserId || parsed.ownerUserId !== currentUserId) {
          clearStoredImpersonation(true);
          return;
        }

        setImpersonatedUser(parsed.impersonatedUser);
        setImpersonatedPermissions(parsed.impersonatedPermissions);
      } catch (e) {
        console.error("[ImpersonationContext] Erro ao restaurar impersonação:", e);
        clearStoredImpersonation(true);
      }
    };

    restoreImpersonation();
  }, [realPermissions.loading, realPermissions.isAdmin, clearStoredImpersonation]);

  // Limpar impersonação em logout ou troca de sessão
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearStoredImpersonation(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [clearStoredImpersonation]);

  const startImpersonation = useCallback(async (userId: string): Promise<boolean> => {
    // Only admins can impersonate
    if (!realPermissions.isAdmin) {
      console.error("[ImpersonationContext] Apenas admins podem usar esta funcionalidade");
      return false;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const ownerUserId = session?.user?.id;

      if (!ownerUserId) {
        console.error("[ImpersonationContext] Sessão inválida para impersonação");
        return false;
      }

      // Fetch user info
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .eq("id", userId)
        .single();

      if (profileError || !profile) {
        console.error("[ImpersonationContext] Usuário não encontrado:", profileError);
        return false;
      }

      // Fetch user permissions using the same RPC
      const { data: permData, error: permError } = await supabase
        .rpc("get_all_user_permissions", { p_user_id: userId });

      if (permError) {
        console.error("[ImpersonationContext] Erro ao buscar permissões:", permError);
        return false;
      }

      const result = permData?.[0];
      const userRole = result?.role || "vendedor";
      const userIsAdmin = result?.is_admin || false;
      const modulesList = result?.modules || [];
      const screensList = result?.screens || [];

      const userData: ImpersonatedUser = {
        id: profile.id,
        nome: profile.nome || profile.email,
        email: profile.email,
        role: userRole,
      };

      const permissions: ImpersonatedPermissions = {
        modules: modulesList,
        screens: screensList,
        role: userRole,
        isAdmin: userIsAdmin,
      };

      setImpersonatedUser(userData);
      setImpersonatedPermissions(permissions);

      const persistedState: PersistedImpersonationState = {
        ownerUserId,
        impersonatedUser: userData,
        impersonatedPermissions: permissions,
      };

      sessionStorage.setItem(IMPERSONATION_SESSION_KEY, JSON.stringify(persistedState));
      // Remove legacy keys to avoid stale restore paths
      sessionStorage.removeItem(LEGACY_IMPERSONATION_USER_KEY);
      sessionStorage.removeItem(LEGACY_IMPERSONATION_PERMISSIONS_KEY);

      console.log(`[ImpersonationContext] Visualizando como: ${userData.nome}`);
      return true;
    } catch (error) {
      console.error("[ImpersonationContext] Erro ao iniciar impersonação:", error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [realPermissions.isAdmin]);

  const stopImpersonation = useCallback(() => {
    clearStoredImpersonation(true);
    console.log("[ImpersonationContext] Voltando à visualização normal");
  }, [clearStoredImpersonation]);

  // Check module permission - impersonation is valid only for admins
  const hasModulePermission = useCallback((moduleCode: string): boolean => {
    if (realPermissions.isAdmin && impersonatedPermissions) {
      if (impersonatedPermissions.isAdmin) return true;
      return impersonatedPermissions.modules.includes(moduleCode);
    }
    return realPermissions.hasModulePermission(moduleCode);
  }, [impersonatedPermissions, realPermissions.isAdmin, realPermissions.hasModulePermission]);

  // Check screen permission - impersonation is valid only for admins
  const hasScreenPermission = useCallback((screenCode: string): boolean => {
    if (realPermissions.isAdmin && impersonatedPermissions) {
      if (impersonatedPermissions.isAdmin) return true;
      return impersonatedPermissions.screens.includes(screenCode);
    }
    return realPermissions.hasScreenPermission(screenCode);
  }, [impersonatedPermissions, realPermissions.isAdmin, realPermissions.hasScreenPermission]);

  const value = useMemo(() => ({
    isImpersonating: realPermissions.isAdmin && !!impersonatedUser,
    impersonatedUser,
    impersonatedPermissions,
    startImpersonation,
    stopImpersonation,
    hasModulePermission,
    hasScreenPermission,
    loading,
  }), [
    realPermissions.isAdmin,
    impersonatedUser,
    impersonatedPermissions,
    startImpersonation,
    stopImpersonation,
    hasModulePermission,
    hasScreenPermission,
    loading,
  ]);

  return (
    <ImpersonationContext.Provider value={value}>
      {children}
    </ImpersonationContext.Provider>
  );
};

export const useImpersonation = () => {
  const context = useContext(ImpersonationContext);
  if (!context) {
    throw new Error("useImpersonation deve ser usado dentro de ImpersonationProvider");
  }
  return context;
};
