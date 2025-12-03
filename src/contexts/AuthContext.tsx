import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
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
  const [session, setSession] = useState<Session | null>(null);
  const [approved, setApproved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

    // Verificar cache
    if (
      !forceRefresh &&
      globalAuthCache &&
      globalAuthCache.userId === userId &&
      now - globalAuthCache.timestamp < CACHE_DURATION
    ) {
      return globalAuthCache.approved;
    }

    // Verificar localStorage cache primeiro (para offline)
    const cachedApproval = localStorage.getItem("user_approved_cache");
    if (!isOnline && cachedApproval === "true") {
      return true;
    }

    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("aprovado")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar aprovação:", error);
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
      console.error("Erro ao verificar aprovação:", error);
      return cachedApproval === "true";
    }
  }, [isOnline]);

  const checkAuth = useCallback(async (forceRefresh = false) => {
    try {
      // Se offline e há cache, usar cache
      if (!isOnline && offlineManager.hasCachedSession()) {
        setSession({ user: { id: "offline" } } as Session);
        setApproved(localStorage.getItem("user_approved_cache") === "true");
        setLoading(false);
        return;
      }

      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (currentSession?.user) {
        setSession(currentSession);
        const isApproved = await fetchApprovalStatus(currentSession.user.id, forceRefresh);
        setApproved(isApproved);
      } else {
        setSession(null);
        setApproved(false);
        globalAuthCache = null;
      }
    } catch (error) {
      console.error("Erro ao verificar auth:", error);
      // Fallback para cache offline
      if (!isOnline && offlineManager.hasCachedSession()) {
        setSession({ user: { id: "offline" } } as Session);
        setApproved(localStorage.getItem("user_approved_cache") === "true");
      } else {
        setSession(null);
        setApproved(false);
      }
    } finally {
      setLoading(false);
    }
  }, [isOnline, fetchApprovalStatus]);

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setSession(newSession);
        if (newSession?.user) {
          const isApproved = await fetchApprovalStatus(newSession.user.id, true);
          setApproved(isApproved);
        }
      } else if (event === "SIGNED_OUT") {
        setSession(null);
        setApproved(false);
        globalAuthCache = null;
        localStorage.removeItem("user_approved_cache");
        localStorage.removeItem("user_role_cache");
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [checkAuth, fetchApprovalStatus]);

  const refreshAuth = useCallback(async () => {
    globalAuthCache = null;
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
