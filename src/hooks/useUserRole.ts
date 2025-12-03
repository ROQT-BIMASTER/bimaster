import { useMemo } from "react";
import { usePermissions } from "@/contexts/PermissionsContext";

type UserType = "admin" | "supervisor" | "vendedor" | "promotor" | "cliente" | null;

/**
 * Hook para role do usuário - agora usa o contexto centralizado
 * Elimina chamadas duplicadas ao banco
 */
export const useUserRole = () => {
  const { role, isAdmin, loading } = usePermissions();

  const derivedValues = useMemo(() => {
    // Normalizar "promotora" antigo para "promotor"
    const normalizedRole = role === 'promotora' ? 'promotor' : role;
    const userType = normalizedRole as UserType;

    return {
      userType,
      isAdmin: userType === "admin",
      isSupervisor: userType === "supervisor",
      isVendedor: userType === "vendedor",
      isPromotor: userType === "promotor",
      isCliente: userType === "cliente",
      isAdminOrSupervisor: userType === "admin" || userType === "supervisor",
      isSalesTeam: userType === "vendedor" || userType === "promotor",
      isInternal: userType !== null && userType !== "cliente",
    };
  }, [role]);

  return {
    ...derivedValues,
    loading,
  };
};
