import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { AccessDenied } from "@/components/common/AccessDenied";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";

// Telas cujo acesso negado é auditado (Configurações e correlatas).
const AUDITED_SCREEN_CODES = new Set([
  "admin",
  "configuracoes",
  "config_geral",
  "config_storage",
]);

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
  const location = useLocation();
  const loggedRef = useRef<string | null>(null);

  const denied = !!session && permissionsReady && !hasScreenPermission(screenCode);

  useEffect(() => {
    if (!denied) return;
    if (!AUDITED_SCREEN_CODES.has(screenCode)) return;
    const key = `${screenCode}|${location.pathname}`;
    if (loggedRef.current === key) return;
    loggedRef.current = key;
    supabase.rpc("log_access_denied", {
      _screen_code: screenCode,
      _route: location.pathname + location.search,
      _user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    }).then(({ error }) => {
      if (error) logger.warn("[ScreenProtectedRoute] Falha ao registrar tentativa negada:", error);
    });
  }, [denied, screenCode, location.pathname, location.search]);

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

  if (!hasScreenPermission(screenCode)) {
    logger.log(`[ScreenProtectedRoute] Usuário sem permissão à tela: ${screenCode}`);
    return <AccessDenied message="Você não tem permissão para acessar esta tela." />;
  }

  return <>{children}</>;
};
