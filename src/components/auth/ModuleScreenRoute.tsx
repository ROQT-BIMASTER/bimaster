import { ProtectedRoute } from "./ProtectedRoute";
import { ModuleProtectedRoute } from "./ModuleProtectedRoute";
import { ScreenProtectedRoute } from "./ScreenProtectedRoute";

interface ModuleScreenRouteProps {
  children: React.ReactNode;
  moduleCode: string;
  screenCode: string;
}

/**
 * Helper unificado que combina ProtectedRoute + ModuleProtectedRoute + ScreenProtectedRoute.
 * Garante defesa em profundidade: autenticação + módulo + tela.
 */
export const ModuleScreenRoute = ({ children, moduleCode, screenCode }: ModuleScreenRouteProps) => (
  <ProtectedRoute>
    <ModuleProtectedRoute moduleCode={moduleCode}>
      <ScreenProtectedRoute screenCode={screenCode}>
        {children}
      </ScreenProtectedRoute>
    </ModuleProtectedRoute>
  </ProtectedRoute>
);
