import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { session, approved, loading: authLoading } = useAuth();
  const { role, loading: permLoading } = usePermissions();

  const loading = authLoading || permLoading;
  const isCliente = role === "cliente";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
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
