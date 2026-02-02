import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { AccessDenied } from "@/components/common/AccessDenied";

interface ModuleProtectedRouteProps {
  children: React.ReactNode;
  moduleCode: string;
  redirectTo?: string;
  showAccessDenied?: boolean;
}

/**
 * Protege rotas verificando se o usuário tem permissão ao módulo específico.
 * Deve ser usado DENTRO de ProtectedRoute para autenticação.
 * Respeita o modo de impersonação quando ativo.
 */
export const ModuleProtectedRoute = ({ 
  children, 
  moduleCode,
  redirectTo = "/dashboard",
  showAccessDenied = true
}: ModuleProtectedRouteProps) => {
  const { session } = useAuth();
  const { loading } = usePermissions();
  const { hasModulePermission } = useImpersonation();

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
    return <AccessDenied message="Você não tem permissão para acessar este módulo." />;
  }

  return <>{children}</>;
};
