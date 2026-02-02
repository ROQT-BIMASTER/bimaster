import { useMemo } from "react";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";

interface ScreenPermission {
  id: string;
  codigo: string;
  nome: string;
  rota: string;
  icone: string;
  ordem: number;
}

/**
 * Hook para permissões de tela - usa o contexto de impersonação quando ativo
 * Mantido para compatibilidade com componentes existentes
 */
export const useScreenPermissions = () => {
  const { screens: realScreens, loading, isAdmin: realIsAdmin, refreshPermissions } = usePermissions();
  const { 
    hasScreenPermission, 
    isImpersonating, 
    impersonatedPermissions 
  } = useImpersonation();

  // Usar as telas do usuário impersonado se estiver ativo, senão usar as reais
  const screens = useMemo(() => {
    if (isImpersonating && impersonatedPermissions) {
      return impersonatedPermissions.screens;
    }
    return realScreens;
  }, [isImpersonating, impersonatedPermissions, realScreens]);

  // Verificar se é admin (real ou impersonado)
  const effectiveIsAdmin = useMemo(() => {
    if (isImpersonating && impersonatedPermissions) {
      return impersonatedPermissions.isAdmin;
    }
    return realIsAdmin;
  }, [isImpersonating, impersonatedPermissions, realIsAdmin]);

  // Converter array de códigos para array de objetos ScreenPermission (compatibilidade)
  const permissionsAsObjects = useMemo<ScreenPermission[]>(() => 
    screens.map((codigo, index) => ({
      id: codigo,
      codigo,
      nome: codigo,
      rota: `/${codigo}`,
      icone: "circle",
      ordem: index,
    })), 
    [screens]
  );

  return { 
    permissions: permissionsAsObjects, 
    loading, 
    hasPermission: hasScreenPermission, 
    isAdmin: effectiveIsAdmin, 
    refreshPermissions 
  };
};
