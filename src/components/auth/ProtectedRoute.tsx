import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useState, useEffect } from "react";
import { logger } from "@/lib/logger";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const SAFETY_TIMEOUT_MS = 5000;

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { session, approved, isActive, loading: authLoading } = useAuth();
  const { role, loading: permLoading, permissionsReady } = usePermissions();
  const [timedOut, setTimedOut] = useState(false);

  // Bloqueia render apenas até o PRIMEIRO load. Refreshes em background
  // (ex: TOKEN_REFRESHED) não desmontam a árvore: permissionsReady já estará true.
  const loading = authLoading || (permLoading && !permissionsReady);
  const isCliente = role === "cliente";

  // Safety timeout: prevent infinite white screen
  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }

    const timer = setTimeout(() => {
      if (loading) {
        logger.warn("[ProtectedRoute] Safety timeout triggered after 5s - forcing render");
        setTimedOut(true);
      }
    }, SAFETY_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [loading]);

  // Show loader only if still loading AND not timed out
  if (loading && !timedOut) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Safety timeout triggered while still loading — only check session
  // approved/isActive may be stale defaults, so skip those guards
  if (timedOut && loading) {
    if (!session) {
      return <Navigate to="/auth/login" replace />;
    }
    return <>{children}</>;
  }

  if (!session) {
    return <Navigate to="/auth/login" replace />;
  }

  // TEMP: travas de aprovação/atividade desabilitadas (pagamento em processamento, regulariza em até 2 dias).
  // Reativar após confirmação financeira restaurando os guards abaixo:
  // if (!approved) return <Navigate to="/aguardando-aprovacao" replace />;
  // if (!isActive) return <Navigate to="/usuario-bloqueado" replace />;
  void approved;
  void isActive;

  // Clientes não podem acessar o dashboard - redirecionar para portal
  if (isCliente) {
    return <Navigate to="/portal/precos" replace />;
  }

  return <>{children}</>;
};
