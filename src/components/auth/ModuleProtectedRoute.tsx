import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { AccessDenied } from "@/components/common/AccessDenied";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";

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
  const { loading, permissionsReady } = usePermissions();
  const { hasModulePermission } = useImpersonation();
  const location = useLocation();
  const loggedRef = useRef<string | null>(null);

  const denied = !!session && permissionsReady && !hasModulePermission(moduleCode);

  useEffect(() => {
    if (!denied) return;
    const key = `module:${moduleCode}|${location.pathname}`;
    if (loggedRef.current === key) return;
    loggedRef.current = key;
    toast.error("Acesso negado", {
      description: "Você não tem permissão para acessar este módulo.",
    });
    supabase.rpc("log_access_denied", {
      _screen_code: `module:${moduleCode}`,
      _route: location.pathname + location.search,
      _user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    }).then(({ error }) => {
      if (error) logger.warn("[ModuleProtectedRoute] Falha ao registrar tentativa negada:", error);
    });
  }, [denied, moduleCode, location.pathname, location.search]);

  // Se não há sessão, deixa o ProtectedRoute lidar
  if (!session) {
    return <>{children}</>;
  }

  // Aguardar apenas o primeiro load. Refreshes em background (TOKEN_REFRESHED)
  // não devem desmontar a árvore — modais/sheets abertos seriam perdidos.
  if (loading && !permissionsReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasModulePermission(moduleCode)) {
    logger.log(`[ModuleProtectedRoute] Usuário sem permissão ao módulo: ${moduleCode}`);
    return <AccessDenied message="Você não tem permissão para acessar este módulo." />;
  }

  return <>{children}</>;
};
