import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";
import { logger } from "@/lib/logger";

const REASON_MESSAGES: Record<string, string> = {
  role_change: "Seu perfil de acesso foi alterado. Faça login novamente para aplicar as novas permissões.",
  scope_change: "Seu escopo administrativo foi alterado. Faça login novamente para continuar.",
  permission_change: "Suas permissões foram atualizadas. Faça login novamente.",
};

const Auth = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    // Mensagem de reautenticação forçada por mudança de acesso
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("session_invalidated") === "1") {
        const reason = params.get("reason") || "permission_change";
        toast.info(REASON_MESSAGES[reason] || REASON_MESSAGES.permission_change, {
          duration: 8000,
        });
      }
    } catch { /* noop */ }

    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user && isMountedRef.current) {
          // Simple redirect — role-based routing handled by LoginForm and ProtectedRoute
          navigate("/dashboard", { replace: true });
          return;
        }
      } catch (error) {
        logger.error("[Auth] Erro no checkUser:", error);
      } finally {
        if (isMountedRef.current) {
          setChecking(false);
        }
      }
    };

    checkUser();

    return () => {
      isMountedRef.current = false;
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
