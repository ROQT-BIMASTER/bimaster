import { useState, useEffect } from "react";
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
  { code: "precos", path: "/dashboard/precos" },
] as const;

// Fallback screen-based routes for users without module permissions
const SCREEN_FALLBACK_ROUTES = [
  { screen: "fabrica_produtos", path: "/dashboard/fabrica/produtos-acabados" },
  { screen: "fabrica_materias_primas", path: "/dashboard/fabrica/materias-primas" },
  { screen: "fabrica_recebimentos", path: "/dashboard/fabrica/recebimentos" },
  { screen: "fabrica_formulas", path: "/dashboard/fabrica/formulas" },
  { screen: "fabrica_planejamento", path: "/dashboard/fabrica/planejamento" },
  { screen: "fabrica_fiscal", path: "/dashboard/fabrica/fiscal" },
  { screen: "fabrica_ordens", path: "/dashboard/fabrica/ordens-producao" },
  { screen: "fabrica_qualidade", path: "/dashboard/fabrica/qualidade" },
  { screen: "precos_tabelas", path: "/dashboard/precos/tabelas" },
  { screen: "precos_matriz", path: "/dashboard/precos/matriz" },
  { screen: "comercial_lancamentos", path: "/dashboard/comercial/lancamentos" },
  { screen: "trade_admin", path: "/dashboard/trade/admin" },
  { screen: "financeiro_contas_pagar", path: "/dashboard/financeiro/contas-pagar" },
  { screen: "financeiro_contas_receber", path: "/dashboard/financeiro/contas-receber" },
  { screen: "estoque_dashboard", path: "/dashboard/estoque" },
] as const;

// Generic routes any authenticated user can access
const GENERIC_FALLBACK_ROUTES = [
  "/dashboard/instalar-app",
  "/dashboard/configuracoes",
  "/dashboard/tarefas",
  "/dashboard/chat",
] as const;

export const DashboardRedirect = () => {
  const { loading } = usePermissions();
  const { hasModulePermission, hasScreenPermission } = useImpersonation();
  const [timedOut, setTimedOut] = useState(false);

  // Safety timeout: if loading takes more than 5s, force redirect
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setTimedOut(true), 5000);
    return () => clearTimeout(timer);
  }, [loading]);

  if (loading && !timedOut) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // 1. Try module-level redirect
  for (const mod of MODULE_ROUTES) {
    if (hasModulePermission(mod.code)) {
      return <Navigate to={mod.path} replace />;
    }
  }

  // 2. Try screen-level redirect for users with specific screen permissions but no module
  for (const route of SCREEN_FALLBACK_ROUTES) {
    if (hasScreenPermission(route.screen)) {
      return <Navigate to={route.path} replace />;
    }
  }

  // 3. Fallback to a generic route that doesn't require specific permissions
  return <Navigate to={GENERIC_FALLBACK_ROUTES[0]} replace />;
};
