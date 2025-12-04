import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { offlineManager } from "@/lib/utils/offline-manager";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  approved: boolean;
  loading: boolean;
  isOnline: boolean;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Cache global para evitar re-fetch
let globalAuthCache: {
  userId: string | null;
  approved: boolean;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Inicializar approved com cache do localStorage para evitar flash
  const [session, setSession] = useState<Session | null>(null);
  const [approved, setApproved] = useState(() => {
    // Inicializar com cache para usuários já aprovados
    return localStorage.getItem("user_approved_cache") === "true";
  });
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const isMountedRef = useRef(true);
  const hasCheckedRef = useRef(false);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const fetchApprovalStatus = useCallback(async (userId: string, forceRefresh = false) => {
    const now = Date.now();

    // Verificar cache global
    if (
      !forceRefresh &&
      globalAuthCache &&
      globalAuthCache.userId === userId &&
      now - globalAuthCache.timestamp < CACHE_DURATION
    ) {
      return globalAuthCache.approved;
    }

    // Verificar localStorage cache (para resposta rápida)
    const cachedApproval = localStorage.getItem("user_approved_cache");
    if (!forceRefresh && cachedApproval === "true") {
      // Retornar cache imediatamente, mas verificar em background
      globalAuthCache = {
        userId,
        approved: true,
        timestamp: now,
      };
      return true;
    }

    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("aprovado")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("[AuthContext] Erro ao buscar aprovação:", error);
        // Em caso de erro, confiar no cache
        return cachedApproval === "true";
      }

      const isApproved = profile?.aprovado || false;

      // Atualizar caches
      globalAuthCache = {
        userId,
        approved: isApproved,
        timestamp: now,
      };

      if (isApproved) {
        localStorage.setItem("user_approved_cache", "true");
      } else {
        localStorage.removeItem("user_approved_cache");
      }

      return isApproved;
    } catch (error) {
      console.error("[AuthContext] Erro ao verificar aprovação:", error);
      return cachedApproval === "true";
    }
  }, []);

  const checkAuth = useCallback(async (forceRefresh = false) => {
    // Evitar múltiplas verificações simultâneas
    if (hasCheckedRef.current && !forceRefresh) {
      return;
    }
    
    try {
      console.log("[AuthContext] Iniciando checkAuth");
      
      // Se offline e há cache, usar cache
      if (!isOnline && offlineManager.hasCachedSession()) {
        setSession({ user: { id: "offline" } } as Session);
        setApproved(localStorage.getItem("user_approved_cache") === "true");
        return;
      }

      const { data: { session: currentSession }, error } = await supabase.auth.getSession();

      if (error) {
        console.error("[AuthContext] Erro ao obter sessão:", error);
        setSession(null);
        setApproved(false);
        return;
      }

      if (currentSession?.user) {
        setSession(currentSession);
        const isApproved = await fetchApprovalStatus(currentSession.user.id, forceRefresh);
        if (isMountedRef.current) {
          setApproved(isApproved);
        }
      } else {
        setSession(null);
        setApproved(false);
        globalAuthCache = null;
        localStorage.removeItem("user_approved_cache");
      }
      
      hasCheckedRef.current = true;
    } catch (error) {
      console.error("[AuthContext] Erro ao verificar auth:", error);
      // Fallback para cache offline
      if (!isOnline && offlineManager.hasCachedSession()) {
        setSession({ user: { id: "offline" } } as Session);
        setApproved(localStorage.getItem("user_approved_cache") === "true");
      } else {
        setSession(null);
        // Manter approved do cache se já estava true
        if (localStorage.getItem("user_approved_cache") !== "true") {
          setApproved(false);
        }
      }
    } finally {
      if (isMountedRef.current) {
        console.log("[AuthContext] Finalizando checkAuth");
        setLoading(false);
      }
    }
  }, [isOnline, fetchApprovalStatus]);

  useEffect(() => {
    isMountedRef.current = true;
    hasCheckedRef.current = false;
    
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMountedRef.current) return;
      
      console.log("[AuthContext] Auth state change:", event);
      
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setSession(newSession);
        if (newSession?.user) {
          // Para SIGNED_IN após login, forçar verificação
          const shouldForce = event === "SIGNED_IN";
          
          // Defer to avoid deadlock
          setTimeout(async () => {
            try {
              const isApproved = await fetchApprovalStatus(newSession.user.id, shouldForce);
              if (isMountedRef.current) {
                setApproved(isApproved);
                setLoading(false);
              }
            } catch (error) {
              console.error("[AuthContext] Erro no auth state change:", error);
              if (isMountedRef.current) {
                setLoading(false);
              }
            }
          }, 0);
        }
      } else if (event === "SIGNED_OUT") {
        setSession(null);
        setApproved(false);
        globalAuthCache = null;
        hasCheckedRef.current = false;
        localStorage.removeItem("user_approved_cache");
        localStorage.removeItem("user_role_cache");
        setLoading(false);
      }
    });

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [checkAuth, fetchApprovalStatus]);

  const refreshAuth = useCallback(async () => {
    globalAuthCache = null;
    hasCheckedRef.current = false;
    await checkAuth(true);
  }, [checkAuth]);

  const value = useMemo(() => ({
    session,
    user: session?.user || null,
    approved,
    loading,
    isOnline,
    refreshAuth,
  }), [session, approved, loading, isOnline, refreshAuth]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
};
