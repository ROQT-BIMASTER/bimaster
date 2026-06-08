import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { SignupForm } from "@/components/auth/SignupForm";
import { logger } from "@/lib/logger";

const Signup = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && isMountedRef.current) {
          navigate("/dashboard", { replace: true });
          return;
        }
      } catch (error) {
        logger.error("[Signup] Erro no checkUser:", error);
      } finally {
        if (isMountedRef.current) setChecking(false);
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
      <SignupForm />
    </AuthLayout>
  );
};

export default Signup;
