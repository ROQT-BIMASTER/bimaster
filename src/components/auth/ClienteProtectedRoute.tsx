import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ClienteProtectedRouteProps {
  children: React.ReactNode;
}

export const ClienteProtectedRoute = ({ children }: ClienteProtectedRouteProps) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [isCliente, setIsCliente] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          setAuthenticated(false);
          setLoading(false);
          return;
        }

        setAuthenticated(true);

        // Verificar se é cliente
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .maybeSingle();

        const userRole = roles?.role;
        setIsCliente(userRole === "cliente");

        // Se é usuário interno tentando acessar /portal, redirecionar para dashboard
        if (userRole && userRole !== "cliente" && location.pathname.startsWith("/portal")) {
          setIsCliente(false);
        }

      } catch (error) {
        console.error("Error checking auth:", error);
        setAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setAuthenticated(!!session?.user);
        
        if (session?.user) {
          setTimeout(async () => {
            try {
              const { data: roles } = await supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", session.user.id)
                .maybeSingle();
              
              setIsCliente(roles?.role === "cliente");
            } catch (error) {
              setIsCliente(false);
            } finally {
              setLoading(false);
            }
          }, 0);
        } else {
          setIsCliente(false);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [location.pathname]);

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

  // Se é usuário interno tentando acessar portal, redirecionar para dashboard
  if (!isCliente) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
