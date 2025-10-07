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

      if (userIsAdmin) {
        // Admins have access to all screens
        const { data: allScreens } = await supabase
          .from("telas_sistema")
          .select("id, codigo, nome, rota, icone, ordem")
          .eq("ativo", true)
          .order("ordem");

        setPermissions(allScreens || []);
      } else {
        // Get user's screen permissions
        const { data: userPermissions } = await supabase
          .from("usuario_permissoes_telas")
          .select(`
            tela_id,
            telas_sistema (
              id,
              codigo,
              nome,
              rota,
              icone,
              ordem
            )
          `)
          .eq("usuario_id", user.id);

        const screens = userPermissions
          ?.map((p: any) => p.telas_sistema)
          .filter(Boolean)
          .sort((a: any, b: any) => a.ordem - b.ordem) || [];

        setPermissions(screens);
      }
    } catch (error) {
      console.error("Error fetching permissions:", error);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (screenCode: string) => {
    if (isAdmin) return true;
    return permissions.some(p => p.codigo === screenCode);
  };

  return { permissions, loading, hasPermission, isAdmin };
};
