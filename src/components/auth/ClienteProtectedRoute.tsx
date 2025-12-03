import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";

interface ClienteProtectedRouteProps {
  children: React.ReactNode;
}

export const ClienteProtectedRoute = ({ children }: ClienteProtectedRouteProps) => {
  const { session, loading: authLoading } = useAuth();
  const { role, loading: permLoading } = usePermissions();
  const location = useLocation();

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

  // Se é usuário interno tentando acessar portal, redirecionar para dashboard
  if (!isCliente && location.pathname.startsWith("/portal")) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
