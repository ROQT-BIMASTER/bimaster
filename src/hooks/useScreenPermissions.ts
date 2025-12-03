import { useMemo } from "react";
import { usePermissions } from "@/contexts/PermissionsContext";

interface ScreenPermission {
  id: string;
  codigo: string;
  nome: string;
  rota: string;
  icone: string;
  ordem: number;
}

/**
 * Hook para permissões de tela - agora usa o contexto centralizado
 * Mantido para compatibilidade com componentes existentes
 */
export const useScreenPermissions = () => {
  const { screens, loading, hasScreenPermission, isAdmin, refreshPermissions } = usePermissions();

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
    isAdmin, 
    refreshPermissions 
  };
};
