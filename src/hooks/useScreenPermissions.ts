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
  const [allowedCodes, setAllowedCodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchPermissions();

    const handlePermissionsUpdate = () => {
      permissionsCache.clear();
      fetchPermissions();
    };

    window.addEventListener('permissions-updated', handlePermissionsUpdate);
    window.addEventListener('modules-updated', handlePermissionsUpdate);

    return () => {
      window.removeEventListener('permissions-updated', handlePermissionsUpdate);
      window.removeEventListener('modules-updated', handlePermissionsUpdate);
    };
  }, []);

  const fetchPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Verificar cache primeiro
      const cacheKey = `combined_screens_${user.id}`;
      const cached = permissionsCache.get<{ screens: ScreenPermission[]; isAdmin: boolean; codes: string[] }>(cacheKey);
      
      if (cached) {
        setPermissions(cached.screens);
        setIsAdmin(cached.isAdmin);
        setAllowedCodes(new Set(cached.codes));
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

      // Usar a nova função que combina role + departamento + individual
      const { data: permissionCodes, error: permError } = await supabase
        .rpc("get_user_combined_screen_permissions", { _user_id: user.id });

      if (permError) {
        console.error("Erro ao buscar permissões combinadas:", permError);
        setPermissions([]);
        setLoading(false);
        return;
      }

      const codes = permissionCodes?.map((p: { tela_codigo: string }) => p.tela_codigo) || [];
      const allowedCodesSet = new Set(codes);
      setAllowedCodes(allowedCodesSet);

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

      const filteredScreens = allScreens?.filter(s => allowedCodesSet.has(s.codigo)) || [];
      setPermissions(filteredScreens);
      
      permissionsCache.set(cacheKey, { screens: filteredScreens, isAdmin: userIsAdmin, codes });
    } catch (error) {
      console.error("Error fetching permissions:", error);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (screenCode: string) => {
    if (isAdmin) return true;
    return allowedCodes.has(screenCode);
  };

  const refreshPermissions = () => {
    permissionsCache.clear();
    fetchPermissions();
  };

  return { permissions, loading, hasPermission, isAdmin, refreshPermissions };
};
