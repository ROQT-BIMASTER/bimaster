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

const ImpersonationContext = createContext<ImpersonationContextType | null>(null);

export const ImpersonationProvider = ({ children }: { children: ReactNode }) => {
  const realPermissions = usePermissions();
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null);
  const [impersonatedPermissions, setImpersonatedPermissions] = useState<ImpersonatedPermissions | null>(null);
  const [loading, setLoading] = useState(false);

  // Restore impersonation from sessionStorage on mount
  useEffect(() => {
    const savedImpersonation = sessionStorage.getItem("impersonation_user");
    const savedPermissions = sessionStorage.getItem("impersonation_permissions");
    
    if (savedImpersonation && savedPermissions) {
      try {
        setImpersonatedUser(JSON.parse(savedImpersonation));
        setImpersonatedPermissions(JSON.parse(savedPermissions));
      } catch (e) {
        console.error("[ImpersonationContext] Erro ao restaurar impersonação:", e);
        sessionStorage.removeItem("impersonation_user");
        sessionStorage.removeItem("impersonation_permissions");
      }
    }
  }, []);

  const startImpersonation = useCallback(async (userId: string): Promise<boolean> => {
    // Only admins can impersonate
    if (!realPermissions.isAdmin) {
      console.error("[ImpersonationContext] Apenas admins podem usar esta funcionalidade");
      return false;
    }

    setLoading(true);

    try {
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

      // Save to sessionStorage for persistence across page navigation
      sessionStorage.setItem("impersonation_user", JSON.stringify(userData));
      sessionStorage.setItem("impersonation_permissions", JSON.stringify(permissions));

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
    setImpersonatedUser(null);
    setImpersonatedPermissions(null);
    sessionStorage.removeItem("impersonation_user");
    sessionStorage.removeItem("impersonation_permissions");
    console.log("[ImpersonationContext] Voltando à visualização normal");
  }, []);

  // Check module permission - use impersonated if active, otherwise real
  const hasModulePermission = useCallback((moduleCode: string): boolean => {
    if (impersonatedPermissions) {
      if (impersonatedPermissions.isAdmin) return true;
      return impersonatedPermissions.modules.includes(moduleCode);
    }
    return realPermissions.hasModulePermission(moduleCode);
  }, [impersonatedPermissions, realPermissions]);

  // Check screen permission - use impersonated if active, otherwise real
  const hasScreenPermission = useCallback((screenCode: string): boolean => {
    if (impersonatedPermissions) {
      if (impersonatedPermissions.isAdmin) return true;
      return impersonatedPermissions.screens.includes(screenCode);
    }
    return realPermissions.hasScreenPermission(screenCode);
  }, [impersonatedPermissions, realPermissions]);

  const value = useMemo(() => ({
    isImpersonating: !!impersonatedUser,
    impersonatedUser,
    impersonatedPermissions,
    startImpersonation,
    stopImpersonation,
    hasModulePermission,
    hasScreenPermission,
    loading,
  }), [
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
