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
  const [isCliente, setIsCliente] = useState(false);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Se estamos offline mas há sessão em cache, confiar nela
        if (!isOnline && offlineManager.hasCachedSession()) {
          setAuthenticated(true);
          setApproved(true); // Assumir aprovado quando offline com cache válido
          setIsCliente(localStorage.getItem('user_role_cache') === 'cliente');
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

          // Verificar role do usuário
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .maybeSingle();

          const userRole = roles?.role;
          const isClienteUser = userRole === "cliente";

          setAuthenticated(true);
          setApproved(profile?.aprovado || false);
          setIsCliente(isClienteUser);
          
          // Salvar em cache para uso offline
          if (profile?.aprovado) {
            localStorage.setItem('user_approved_cache', 'true');
          }
          if (userRole) {
            localStorage.setItem('user_role_cache', userRole);
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
          setIsCliente(localStorage.getItem('user_role_cache') === 'cliente');
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

              const { data: roles } = await supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", session.user.id)
                .maybeSingle();
              
              setApproved(profile?.aprovado || false);
              setIsCliente(roles?.role === "cliente");
            } catch (error) {
              setApproved(false);
              setIsCliente(false);
            } finally {
              setLoading(false);
            }
          }, 0);
        } else {
          setApproved(false);
          setIsCliente(false);
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

  // Clientes não podem acessar o dashboard - redirecionar para portal
  if (isCliente) {
    return <Navigate to="/portal/precos" replace />;
  }

  return <>{children}</>;
};
