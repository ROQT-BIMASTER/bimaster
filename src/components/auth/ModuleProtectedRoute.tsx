import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";

interface ModuleProtectedRouteProps {
  children: React.ReactNode;
  moduleCode: string;
  redirectTo?: string;
}

/**
 * Protege rotas verificando se o usuário tem permissão ao módulo específico.
 * Deve ser usado DENTRO de ProtectedRoute para autenticação.
 */
export const ModuleProtectedRoute = ({ 
  children, 
  moduleCode,
  redirectTo = "/dashboard"
}: ModuleProtectedRouteProps) => {
  const { session } = useAuth();
  const { hasModulePermission, loading } = usePermissions();

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

  if (!hasModulePermission(moduleCode)) {
    console.log(`[ModuleProtectedRoute] Usuário sem permissão ao módulo: ${moduleCode}`);
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};
