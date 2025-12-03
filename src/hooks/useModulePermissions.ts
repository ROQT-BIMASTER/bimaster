import { useMemo } from "react";
import { usePermissions } from "@/contexts/PermissionsContext";

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
 * Hook para permissões de módulo - agora usa o contexto centralizado
 * Mantido para compatibilidade com componentes existentes
 */
export const useModulePermissions = () => {
  const { modules, loading, hasModulePermission, refreshPermissions } = usePermissions();

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
