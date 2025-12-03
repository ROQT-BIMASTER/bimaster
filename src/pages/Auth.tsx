import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isSignup = location.pathname === "/auth/signup";
  const [checking, setChecking] = useState(true);

  const redirectBasedOnRole = async (userId: string) => {
    try {
      // Verificar a role do usuário
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      const userRole = roles?.role;

      // Clientes vão para o portal isolado
      if (userRole === "cliente") {
        // Registrar acesso ao portal
        await supabase.rpc("registrar_acesso_portal", {
          p_acao: "login",
          p_detalhes: {}
        });
        navigate("/portal/precos");
      } else {
        // Usuários internos vão para o dashboard
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Erro ao verificar role:", error);
      // Fallback para dashboard se houver erro
      navigate("/dashboard");
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await redirectBasedOnRole(session.user.id);
      }
      setChecking(false);
    };
    
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        // Defer para evitar deadlock
        setTimeout(async () => {
          await redirectBasedOnRole(session.user.id);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
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
      {isSignup ? <SignupForm /> : <LoginForm />}
    </AuthLayout>
  );
};

export default Auth;
