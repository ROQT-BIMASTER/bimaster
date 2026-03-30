import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { AccessDenied } from "@/components/common/AccessDenied";

interface ScreenProtectedRouteProps {
  children: React.ReactNode;
  screenCode: string;
  redirectTo?: string;
  showAccessDenied?: boolean;
}

/**
 * Protege rotas verificando se o usuário tem permissão à tela específica.
 * Deve ser usado DENTRO de ProtectedRoute para autenticação.
 * Respeita o modo de impersonação quando ativo.
 */
export const ScreenProtectedRoute = ({ 
  children, 
  screenCode,
  redirectTo = "/dashboard",
  showAccessDenied = true
}: ScreenProtectedRouteProps) => {
  const { session } = useAuth();
  const { loading, permissionsReady } = usePermissions();
  const { hasScreenPermission } = useImpersonation();

  // Se não há sessão, deixa o ProtectedRoute lidar
  if (!session) {
    return <>{children}</>;
  }

  // Aguardar até que as permissões estejam prontas (primeiro fetch completo)
  if (loading || !permissionsReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasScreenPermission(screenCode)) {
    console.log(`[ScreenProtectedRoute] Usuário sem permissão à tela: ${screenCode}`);
    return <AccessDenied message="Você não tem permissão para acessar esta tela." />;
  }

  return <>{children}</>;
};
