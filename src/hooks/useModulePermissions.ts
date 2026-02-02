import { useMemo } from "react";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";

interface Module {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  icone: string | null;
  ordem: number;
  ativo: boolean;
}

/**
 * Hook para permissões de módulo - usa o contexto de impersonação quando ativo
 * Mantido para compatibilidade com componentes existentes
 */
export const useModulePermissions = () => {
  const { modules: realModules, loading, refreshPermissions } = usePermissions();
  const { 
    hasModulePermission, 
    isImpersonating, 
    impersonatedPermissions 
  } = useImpersonation();

  // Usar os módulos do usuário impersonado se estiver ativo, senão usar os reais
  const modules = useMemo(() => {
    if (isImpersonating && impersonatedPermissions) {
      return impersonatedPermissions.modules;
    }
    return realModules;
  }, [isImpersonating, impersonatedPermissions, realModules]);

  // Converter array de códigos para array de objetos Module (compatibilidade)
  const modulesAsObjects = useMemo<Module[]>(() => 
    modules.map((codigo, index) => ({
      id: codigo,
      codigo,
      nome: codigo,
      descricao: null,
      icone: null,
      ordem: index,
      ativo: true,
    })), 
    [modules]
  );

  return {
    modules: modulesAsObjects,
    loading,
    hasModulePermission,
    refreshPermissions,
  };
};
