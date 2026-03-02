import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { offlineManager } from "@/lib/utils/offline-manager";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  approved: boolean;
  isActive: boolean; // NEW: Track if user is active (not blocked)
  loading: boolean;
  isOnline: boolean;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Cache global para evitar re-fetch
let globalAuthCache: {
  userId: string | null;
  approved: boolean;
  isActive: boolean;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 2 * 60 * 1000; // 2 minutos (reduzido para detectar bloqueios mais rápido)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Inicializar approved com cache do localStorage para evitar flash
  const [session, setSession] = useState<Session | null>(null);
  const [approved, setApproved] = useState(() => {
    return localStorage.getItem("user_approved_cache") === "true";
  });
  const [isActive, setIsActive] = useState(() => {
    return localStorage.getItem("user_active_cache") !== "false"; // Default to true if not set
  });
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const isMountedRef = useRef(true);
  const hasCheckedRef = useRef(false);
  const initialCheckDoneRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);

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
      return { approved: globalAuthCache.approved, isActive: globalAuthCache.isActive };
    }

    // SECURITY: Always validate with server - never trust localStorage alone
    // localStorage is only used as initial UI state to prevent flash, 
    // but server validation always runs
    const cachedApproval = localStorage.getItem("user_approved_cache");
    const cachedActive = localStorage.getItem("user_active_cache");

    try {
      // CRITICAL: Fetch both aprovado AND status fields
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("aprovado, status")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("[AuthContext] Erro ao buscar aprovação:", error);
        return { 
          approved: cachedApproval === "true", 
          isActive: cachedActive !== "false" 
        };
      }

      const isApproved = profile?.aprovado || false;
      const userIsActive = profile?.status === "ativo";

      // Atualizar caches
      globalAuthCache = {
        userId,
        approved: isApproved,
        isActive: userIsActive,
        timestamp: now,
      };

      if (isApproved) {
        localStorage.setItem("user_approved_cache", "true");
      } else {
        localStorage.removeItem("user_approved_cache");
      }

      if (userIsActive) {
        localStorage.setItem("user_active_cache", "true");
      } else {
        localStorage.setItem("user_active_cache", "false");
      }

      return { approved: isApproved, isActive: userIsActive };
    } catch (error) {
      console.error("[AuthContext] Erro ao verificar aprovação:", error);
      return { 
        approved: cachedApproval === "true", 
        isActive: cachedActive !== "false" 
      };
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
        setIsActive(localStorage.getItem("user_active_cache") !== "false");
        return;
      }

      const { data: { session: currentSession }, error } = await supabase.auth.getSession();

      if (error) {
        console.error("[AuthContext] Erro ao obter sessão:", error);
        setSession(null);
        setApproved(false);
        setIsActive(false);
        return;
      }

      if (currentSession?.user) {
        setSession(currentSession);
        currentUserIdRef.current = currentSession.user.id;
        const { approved: isApproved, isActive: userIsActive } = await fetchApprovalStatus(currentSession.user.id, forceRefresh);
        if (isMountedRef.current) {
          setApproved(isApproved);
          setIsActive(userIsActive);
          initialCheckDoneRef.current = true;
        }
      } else {
        setSession(null);
        setApproved(false);
        setIsActive(false);
        globalAuthCache = null;
        localStorage.removeItem("user_approved_cache");
        localStorage.removeItem("user_active_cache");
      }
      
      hasCheckedRef.current = true;
    } catch (error) {
      console.error("[AuthContext] Erro ao verificar auth:", error);
      // Fallback para cache offline
      if (!isOnline && offlineManager.hasCachedSession()) {
        setSession({ user: { id: "offline" } } as Session);
        setApproved(localStorage.getItem("user_approved_cache") === "true");
        setIsActive(localStorage.getItem("user_active_cache") !== "false");
      } else {
        setSession(null);
        // Manter approved do cache se já estava true
        if (localStorage.getItem("user_approved_cache") !== "true") {
          setApproved(false);
        }
        if (localStorage.getItem("user_active_cache") === "false") {
          setIsActive(false);
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
          currentUserIdRef.current = newSession.user.id;
          
          // NEVER set loading=true here — it causes the infinite spinner.
          // The initial checkAuth already handles loading. 
          // Approval check runs in background without blocking UI.
          const shouldForce = event === "SIGNED_IN";
          
          fetchApprovalStatus(newSession.user.id, shouldForce)
            .then(({ approved: isApproved, isActive: userIsActive }) => {
              if (isMountedRef.current) {
                setApproved(isApproved);
                setIsActive(userIsActive);
                initialCheckDoneRef.current = true;
              }
            })
            .catch((error) => {
              console.error("[AuthContext] Erro no auth state change:", error);
            })
            .finally(() => {
              // Always ensure loading is false after auth state change
              if (isMountedRef.current) {
                setLoading(false);
              }
            });
        }
      } else if (event === "SIGNED_OUT") {
        setSession(null);
        setApproved(false);
        setIsActive(false);
        globalAuthCache = null;
        hasCheckedRef.current = false;
        initialCheckDoneRef.current = false;
        currentUserIdRef.current = null;
        localStorage.removeItem("user_approved_cache");
        localStorage.removeItem("user_active_cache");
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
    isActive,
    loading,
    isOnline,
    refreshAuth,
  }), [session, approved, isActive, loading, isOnline, refreshAuth]);

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
