import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ScreenPermission {
  id: string;
  codigo: string;
  nome: string;
  rota: string;
  icone: string;
  ordem: number;
}

export const useScreenPermissions = () => {
  const [permissions, setPermissions] = useState<ScreenPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Check if user is admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      const userIsAdmin = !!roleData;
      setIsAdmin(userIsAdmin);

      // TODOS os usuários têm acesso a todas as telas por padrão
      const { data: allScreens } = await supabase
        .from("telas_sistema")
        .select("id, codigo, nome, rota, icone, ordem")
        .eq("ativo", true)
        .order("ordem");

      setPermissions(allScreens || []);
    } catch (error) {
      console.error("Error fetching permissions:", error);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (screenCode: string) => {
    // Todos têm acesso a tudo por padrão
    return true;
  };

  return { permissions, loading, hasPermission, isAdmin };
};
