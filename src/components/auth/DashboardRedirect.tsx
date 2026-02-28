import { useState, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Button } from "@/components/ui/button";

// Map of modules that require a specific dashboard screen to access the module root
const MODULE_DASHBOARD_SCREENS: Record<string, string> = {
  fabrica: "fabrica_dashboard",
};

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
  { screen: "fabrica_apontamentos", path: "/dashboard/fabrica/apontamentos" },
  { screen: "fabrica_maquinas", path: "/dashboard/fabrica/maquinas" },
  { screen: "fabrica_operadores", path: "/dashboard/fabrica/operadores" },
  { screen: "fabrica_paradas", path: "/dashboard/fabrica/paradas" },
  { screen: "fabrica_dashboard", path: "/dashboard/fabrica/executivo" },
  { screen: "fabrica_lancamentos", path: "/dashboard/comercial/lancamentos" },
  { screen: "precos_tabelas", path: "/dashboard/precos/tabelas" },
  { screen: "precos_matriz", path: "/dashboard/precos/matriz" },
  { screen: "comercial_lancamentos", path: "/dashboard/comercial/lancamentos" },
  { screen: "trade_admin", path: "/dashboard/trade/admin" },
  { screen: "financeiro_contas_pagar", path: "/dashboard/financeiro/contas-a-pagar" },
  { screen: "financeiro_contas_receber", path: "/dashboard/financeiro/contas-a-receber" },
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
  const { loading, refreshPermissions } = usePermissions();
  const { hasModulePermission, hasScreenPermission } = useImpersonation();
  const [timedOut, setTimedOut] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Safety timeout: if loading takes more than 8s, force redirect
  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, [loading]);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    setTimedOut(false);
    try {
      await refreshPermissions();
    } finally {
      setRetrying(false);
    }
  }, [refreshPermissions]);

  if ((loading || retrying) && !timedOut) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando permissões...</p>
      </div>
    );
  }

  // 1. Try module-level redirect (skip if user lacks the module's dashboard screen)
  for (const mod of MODULE_ROUTES) {
    if (hasModulePermission(mod.code)) {
      const requiredScreen = MODULE_DASHBOARD_SCREENS[mod.code];
      // If this module requires a dashboard screen and user doesn't have it, skip to fallback
      if (requiredScreen && !hasScreenPermission(requiredScreen)) {
        continue;
      }
      return <Navigate to={mod.path} replace />;
    }
  }

  // 2. Try screen-level redirect for users with specific screen permissions but no module
  for (const route of SCREEN_FALLBACK_ROUTES) {
    if (hasScreenPermission(route.screen)) {
      return <Navigate to={route.path} replace />;
    }
  }

  // 3. If timed out with no permissions found, show retry option
  if (timedOut) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Não foi possível carregar suas permissões.</p>
        <Button onClick={handleRetry} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  // 4. Fallback to a generic route that doesn't require specific permissions
  return <Navigate to={GENERIC_FALLBACK_ROUTES[0]} replace />;
};
