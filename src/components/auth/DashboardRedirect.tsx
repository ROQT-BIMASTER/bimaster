import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { usePermissions } from "@/contexts/PermissionsContext";

const MODULE_ROUTES = [
  { code: "prospects", path: "/dashboard/prospects" },
  { code: "trade", path: "/dashboard/trade" },
  { code: "financeiro", path: "/dashboard/financeiro" },
  { code: "fabrica", path: "/dashboard/fabrica" },
  { code: "estoque", path: "/dashboard/estoque" },
  { code: "comercial", path: "/dashboard/comercial" },
  { code: "marketing", path: "/dashboard/marketing" },
] as const;

export const DashboardRedirect = () => {
  const { loading } = usePermissions();
  const { hasModulePermission } = useImpersonation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  for (const mod of MODULE_ROUTES) {
    if (hasModulePermission(mod.code)) {
      return <Navigate to={mod.path} replace />;
    }
  }

  // No module permission — show general dashboard
  return <Navigate to="/dashboard/visao-geral" replace />;
};
