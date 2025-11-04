import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { permissionsCache } from "@/lib/utils/permissions-cache";

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

      // Verificar cache primeiro
      const cacheKey = `screens_${user.id}`;
      const cached = permissionsCache.get<{ screens: ScreenPermission[]; isAdmin: boolean }>(cacheKey);
      
      if (cached) {
        setPermissions(cached.screens);
        setIsAdmin(cached.isAdmin);
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

      // Buscar permissões usando função otimizada
      const { data: permissionCodes, error: permError } = await supabase
        .rpc("get_user_screen_permissions", { _user_id: user.id });

      if (permError) {
        console.error("Erro ao buscar permissões:", permError);
        setPermissions([]);
        setLoading(false);
        return;
      }

      const allowedCodes = new Set(permissionCodes?.map((p: { tela_codigo: string }) => p.tela_codigo) || []);

      // Buscar detalhes das telas
      const { data: allScreens, error: screensError } = await supabase
        .from("telas_sistema")
        .select("id, codigo, nome, rota, icone, ordem")
        .eq("ativo", true)
        .order("ordem");

      if (screensError) {
        console.error("Erro ao buscar telas:", screensError);
        setPermissions([]);
        setLoading(false);
        return;
      }

      // Filtrar telas baseado nas permissões
      const filteredScreens = allScreens?.filter(s => allowedCodes.has(s.codigo)) || [];
      setPermissions(filteredScreens);
      
      // Salvar no cache
      permissionsCache.set(cacheKey, { screens: filteredScreens, isAdmin: userIsAdmin });
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
