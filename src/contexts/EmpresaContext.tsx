import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { useUserEmpresas, useAllEmpresas, type Empresa, type UserEmpresa } from "@/hooks/useUserEmpresas";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useAuth } from "@/contexts/AuthContext";

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
  const { data: userEmpresas, isLoading: loadingUserEmpresas } = useUserEmpresas();
  const { data: allEmpresas, isLoading: loadingAllEmpresas } = useAllEmpresas();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Determine the list of empresas the user can see
  const empresasDoUsuario = useMemo(() => {
    if (isAdmin) {
      return allEmpresas || [];
    }
    return (userEmpresas || []).map(ue => ue.empresa).filter(e => e.ativa);
  }, [isAdmin, allEmpresas, userEmpresas]);

  // Initialize selection from localStorage or primary empresa
  useEffect(() => {
    if (!user?.id || (isAdmin ? loadingAllEmpresas : loadingUserEmpresas)) return;
    if (initialized) return;

    const storedId = getStoredEmpresaId(user.id);
    
    // Check if stored ID is valid (user still has access)
    if (storedId !== null && empresasDoUsuario.some(e => e.id === storedId)) {
      setSelectedId(storedId);
    } else if (!isAdmin && userEmpresas) {
      // Auto-select primary empresa for non-admins
      const primary = userEmpresas.find(ue => ue.is_primary);
      if (primary) {
        setSelectedId(primary.empresa_id);
        storeEmpresaId(user.id, primary.empresa_id);
      }
    }
    
    setInitialized(true);
  }, [user?.id, empresasDoUsuario, userEmpresas, isAdmin, loadingAllEmpresas, loadingUserEmpresas, initialized]);

  // Reset when user changes
  useEffect(() => {
    setInitialized(false);
    setSelectedId(null);
  }, [user?.id]);

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
