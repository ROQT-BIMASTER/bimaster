import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type UserType = "admin" | "supervisor" | "vendedor" | null;

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

        const { data: profile } = await supabase
          .from("profiles")
          .select("tipo_usuario")
          .eq("id", user.id)
          .single();

        setUserType(profile?.tipo_usuario || null);
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
    isAdminOrSupervisor: userType === "admin" || userType === "supervisor",
  };
};
