import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { offlineManager } from "@/lib/utils/offline-manager";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [approved, setApproved] = useState(false);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Se estamos offline mas há sessão em cache, confiar nela
        if (!isOnline && offlineManager.hasCachedSession()) {
          setAuthenticated(true);
          setApproved(true); // Assumir aprovado quando offline com cache válido
          setLoading(false);
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // Check if user is approved
          const { data: profile } = await supabase
            .from("profiles")
            .select("aprovado")
            .eq("id", session.user.id)
            .single();

          setAuthenticated(true);
          setApproved(profile?.aprovado || false);
          
          // Salvar estado de aprovação em cache para uso offline
          if (profile?.aprovado) {
            localStorage.setItem('user_approved_cache', 'true');
          }
        } else {
          setAuthenticated(false);
        }
      } catch (error) {
        console.error("Error checking auth:", error);
        
        // Se falhou mas estamos offline e há cache, usar cache
        if (!isOnline && offlineManager.hasCachedSession()) {
          setAuthenticated(true);
          setApproved(localStorage.getItem('user_approved_cache') === 'true');
        } else {
          setAuthenticated(false);
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // CRITICAL: Nunca usar async diretamente no callback para evitar deadlock
        setAuthenticated(!!session?.user);
        
        if (session?.user) {
          // Defer Supabase calls com setTimeout para evitar deadlock
          setTimeout(async () => {
            try {
              const { data: profile } = await supabase
                .from("profiles")
                .select("aprovado")
                .eq("id", session.user.id)
                .single();
              
              setApproved(profile?.aprovado || false);
            } catch (error) {
              setApproved(false);
            } finally {
              setLoading(false);
            }
          }, 0);
        } else {
          setApproved(false);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  if (!approved) {
    return <Navigate to="/aguardando-aprovacao" replace />;
  }

  return <>{children}</>;
};
