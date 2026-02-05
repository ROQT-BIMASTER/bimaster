import { useMemo } from "react";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";

type UserType = "admin" | "supervisor" | "vendedor" | "promotor" | "cliente" | null;

/**
 * Hook para role do usuário - respeita o modo de impersonação
 * Elimina chamadas duplicadas ao banco
 */
export const useUserRole = () => {
  const { role: realRole, loading } = usePermissions();
  const { isImpersonating, impersonatedPermissions } = useImpersonation();

  // Usar role do usuário impersonado se estiver ativo
  const effectiveRole = isImpersonating && impersonatedPermissions 
    ? impersonatedPermissions.role 
    : realRole;

  const derivedValues = useMemo(() => {
    // Normalizar "promotora" antigo para "promotor"
    const normalizedRole = effectiveRole === 'promotora' ? 'promotor' : effectiveRole;
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
  }, [effectiveRole]);

  return {
    ...derivedValues,
    loading,
  };
};
