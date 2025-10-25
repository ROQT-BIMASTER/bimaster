import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
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
        } else {
          setAuthenticated(false);
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
