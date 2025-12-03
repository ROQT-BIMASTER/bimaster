import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type UserRole = "admin" | "supervisor" | "vendedor" | "promotor" | "cliente" | null;

export const useClienteRole = () => {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setUserRole(null);
          setUserId(null);
          return;
        }

        setUserId(user.id);

        const { data: roles, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Erro ao buscar role do usuário:", error);
          setUserRole(null);
          return;
        }

        setUserRole(roles?.role as UserRole || null);
      } catch (error) {
        console.error("Erro ao buscar tipo de usuário:", error);
        setUserRole(null);
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
    userRole,
    userId,
    loading,
    isCliente: userRole === "cliente",
    isInternal: userRole !== null && userRole !== "cliente",
    isAdmin: userRole === "admin",
    isSupervisor: userRole === "supervisor",
  };
};
