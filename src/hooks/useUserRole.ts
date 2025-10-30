import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type UserType = "admin" | "supervisor" | "vendedor" | "promotor" | null;

export const useUserRole = () => {
  const [userType, setUserType] = useState<UserType>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setUserType(null);
          return;
        }

        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();

        // Normalizar "promotora" antigo para "promotor"
        const normalizedRole = roles?.role === 'promotora' ? 'promotor' : roles?.role;
        setUserType(normalizedRole as UserType || null);
      } catch (error) {
        console.error("Erro ao buscar tipo de usuário:", error);
        setUserType(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUserRole();
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    userType,
    loading,
    isAdmin: userType === "admin",
    isSupervisor: userType === "supervisor",
    isVendedor: userType === "vendedor",
    isPromotor: userType === "promotor",
    isAdminOrSupervisor: userType === "admin" || userType === "supervisor",
    isSalesTeam: userType === "vendedor" || userType === "promotor",
  };
};
