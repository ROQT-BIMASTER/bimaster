import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { useUserEmpresas, useAllEmpresas, type Empresa, type UserEmpresa } from "@/hooks/useUserEmpresas";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface EmpresaContextType {
  /** Currently selected empresa, or null meaning "all user's empresas" */
  empresaSelecionada: Empresa | null;
  /** All empresas the user has access to */
  empresasDoUsuario: Empresa[];
  /** Array of empresa IDs for query filters — respects selection */
  empresaIds: number[];
  /** Set selected empresa by ID, or null for "all" */
  setEmpresaSelecionada: (empresaId: number | null) => void;
  /** Loading state */
  loading: boolean;
  /** Whether the user has any empresas at all */
  hasEmpresas: boolean;
}

const EmpresaContext = createContext<EmpresaContextType | null>(null);

const STORAGE_KEY = "empresa-selecionada";

function getStoredEmpresaId(userId: string): number | null {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY}-${userId}`);
    if (stored === null || stored === "null") return null;
    const parsed = parseInt(stored, 10);
    return isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

function storeEmpresaId(userId: string, empresaId: number | null) {
  try {
    localStorage.setItem(`${STORAGE_KEY}-${userId}`, String(empresaId));
  } catch {
    // localStorage may be unavailable
  }
}

export const EmpresaProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const { isImpersonating, impersonatedUser } = useImpersonation();
  const { data: userEmpresas, isLoading: loadingUserEmpresas } = useUserEmpresas();
  const { data: allEmpresas, isLoading: loadingAllEmpresas } = useAllEmpresas();

  // When impersonating, fetch the impersonated user's empresas
  const impersonatedUserId = isImpersonating ? impersonatedUser?.id : null;
  const { data: impersonatedEmpresas, isLoading: loadingImpersonatedEmpresas } = useQuery({
    queryKey: ["impersonated-user-empresas", impersonatedUserId],
    queryFn: async () => {
      if (!impersonatedUserId) return [];
      const { data, error } = await supabase
        .from("user_empresas")
        .select(`
          empresa_id,
          is_primary,
          empresa:empresas(id, nome, cnpj, uf, ativa)
        `)
        .eq("user_id", impersonatedUserId);

      if (error) throw error;
      return (data || []).map(item => ({
        empresa_id: item.empresa_id,
        is_primary: item.is_primary,
        empresa: item.empresa as unknown as Empresa,
      })) as UserEmpresa[];
    },
    enabled: !!impersonatedUserId,
  });

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Determine the list of empresas the user can see
  const empresasDoUsuario = useMemo(() => {
    // When impersonating, always use the impersonated user's empresas
    if (isImpersonating && impersonatedEmpresas) {
      return impersonatedEmpresas.map(ue => ue.empresa).filter(e => e.ativa);
    }
    if (isAdmin) {
      return allEmpresas || [];
    }
    return (userEmpresas || []).map(ue => ue.empresa).filter(e => e.ativa);
  }, [isAdmin, isImpersonating, allEmpresas, userEmpresas, impersonatedEmpresas]);

  // Initialize selection from localStorage or primary empresa
  // Determine effective empresas list for initialization
  const effectiveUserEmpresas = isImpersonating ? impersonatedEmpresas : userEmpresas;

  useEffect(() => {
    const isLoading = isImpersonating 
      ? loadingImpersonatedEmpresas 
      : (isAdmin ? loadingAllEmpresas : loadingUserEmpresas);
    
    if (!user?.id || isLoading) return;
    if (initialized) return;

    const storedId = getStoredEmpresaId(user.id);
    
    // Check if stored ID is valid (user still has access)
    if (storedId !== null && empresasDoUsuario.some(e => e.id === storedId)) {
      setSelectedId(storedId);
    } else if ((!isAdmin || isImpersonating) && effectiveUserEmpresas) {
      // Auto-select primary empresa for non-admins or when impersonating
      const primary = effectiveUserEmpresas.find(ue => ue.is_primary);
      if (primary) {
        setSelectedId(primary.empresa_id);
        storeEmpresaId(user.id, primary.empresa_id);
      }
    }
    
    setInitialized(true);
  }, [user?.id, empresasDoUsuario, effectiveUserEmpresas, isAdmin, isImpersonating, loadingAllEmpresas, loadingUserEmpresas, loadingImpersonatedEmpresas, initialized]);

  // Reset when user changes or impersonation changes
  useEffect(() => {
    setInitialized(false);
    setSelectedId(null);
  }, [user?.id, impersonatedUserId]);

  const empresaSelecionada = useMemo(() => {
    if (selectedId === null) return null;
    return empresasDoUsuario.find(e => e.id === selectedId) || null;
  }, [selectedId, empresasDoUsuario]);

  const empresaIds = useMemo(() => {
    if (selectedId !== null) {
      return [selectedId];
    }
    return empresasDoUsuario.map(e => e.id);
  }, [selectedId, empresasDoUsuario]);

  const setEmpresaSelecionada = useCallback((empresaId: number | null) => {
    setSelectedId(empresaId);
    if (user?.id) {
      storeEmpresaId(user.id, empresaId);
    }
  }, [user?.id]);

  const loading = isAdmin ? loadingAllEmpresas : loadingUserEmpresas;

  const value = useMemo(() => ({
    empresaSelecionada,
    empresasDoUsuario,
    empresaIds,
    setEmpresaSelecionada,
    loading,
    hasEmpresas: empresasDoUsuario.length > 0,
  }), [empresaSelecionada, empresasDoUsuario, empresaIds, setEmpresaSelecionada, loading]);

  return (
    <EmpresaContext.Provider value={value}>
      {children}
    </EmpresaContext.Provider>
  );
};

export function useEmpresaContext() {
  const context = useContext(EmpresaContext);
  if (!context) {
    throw new Error("useEmpresaContext deve ser usado dentro de EmpresaProvider");
  }
  return context;
}
