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

      // Admins têm acesso a todas as telas
      if (userIsAdmin) {
        const { data: allScreens } = await supabase
          .from("telas_sistema")
          .select("id, codigo, nome, rota, icone, ordem")
          .eq("ativo", true)
          .order("ordem");

        setPermissions(allScreens || []);
      } else {
        // Outros usuários só veem telas com permissão
        const { data: userPermissions } = await supabase
          .from("usuario_permissoes_telas")
          .select(`
            tela_id,
            telas_sistema!inner (
              id,
              codigo,
              nome,
              rota,
              icone,
              ordem,
              ativo
            )
          `)
          .eq("usuario_id", user.id)
          .eq("telas_sistema.ativo", true)
          .order("telas_sistema.ordem");

        const screens = userPermissions?.map(p => p.telas_sistema).flat().filter(Boolean) || [];
        setPermissions(screens as ScreenPermission[]);
      }
    } catch (error) {
      console.error("Error fetching permissions:", error);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (screenCode: string) => {
    // Admins sempre têm permissão
    if (isAdmin) return true;
    
    // Verificar se o código da tela está nas permissões do usuário
    return permissions.some(p => p.codigo === screenCode);
  };

  return { permissions, loading, hasPermission, isAdmin };
};
