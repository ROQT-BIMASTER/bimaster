import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";

interface ScreenProtectedRouteProps {
  children: React.ReactNode;
  screenCode: string;
  redirectTo?: string;
}

/**
 * Protege rotas verificando se o usuário tem permissão à tela específica.
 * Deve ser usado DENTRO de ProtectedRoute para autenticação.
 */
export const ScreenProtectedRoute = ({ 
  children, 
  screenCode,
  redirectTo = "/dashboard"
}: ScreenProtectedRouteProps) => {
  const { session } = useAuth();
  const { hasScreenPermission, loading } = usePermissions();

  // Se não há sessão, deixa o ProtectedRoute lidar
  if (!session) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasScreenPermission(screenCode)) {
    console.log(`[ScreenProtectedRoute] Usuário sem permissão à tela: ${screenCode}`);
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};
