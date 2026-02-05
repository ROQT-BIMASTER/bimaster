import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const isMountedRef = useRef(true);

  // Timeout de segurança - garante que loading nunca fica infinito
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isMountedRef.current) {
        console.log("[Auth] Safety timeout triggered - forcing checking to false");
        setChecking(false);
      }
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, []);

  const redirectBasedOnRole = async (userId: string) => {
    try {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("[Auth] Erro ao verificar role:", error);
        navigate("/dashboard");
        return;
      }

      const userRole = roles?.role;

      if (userRole === "cliente") {
        try {
          await supabase.rpc("registrar_acesso_portal", {
            p_acao: "login",
            p_detalhes: {}
          });
        } catch (e) {
          console.error("[Auth] Erro ao registrar acesso portal:", e);
        }
        navigate("/portal/precos");
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("[Auth] Erro ao redirecionar:", error);
      navigate("/dashboard");
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    
    const checkUser = async () => {
      try {
        console.log("[Auth] Iniciando checkUser");
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("[Auth] Erro ao obter sessão:", error);
          return;
        }
        
        if (session?.user) {
          console.log("[Auth] Sessão encontrada, redirecionando...");
          await redirectBasedOnRole(session.user.id);
        } else {
          console.log("[Auth] Sem sessão ativa");
        }
      } catch (error) {
        console.error("[Auth] Erro no checkUser:", error);
      } finally {
        if (isMountedRef.current) {
          console.log("[Auth] Finalizando checkUser");
          setChecking(false);
        }
      }
    };
    
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user && isMountedRef.current) {
        setTimeout(async () => {
          try {
            await redirectBasedOnRole(session.user.id);
          } catch (error) {
            console.error("[Auth] Erro ao redirecionar após auth change:", error);
          }
        }, 0);
      }
    });

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
};

export default Auth;
