import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { permissionsCache } from "@/lib/utils/permissions-cache";

interface Module {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  icone: string | null;
  ordem: number;
  ativo: boolean;
}

export const useModulePermissions = () => {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowedCodes, setAllowedCodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchModules();

    const handleModulesUpdate = () => {
      permissionsCache.clear();
      fetchModules();
    };

    window.addEventListener('modules-updated', handleModulesUpdate);
    window.addEventListener('permissions-updated', handleModulesUpdate);

    return () => {
      window.removeEventListener('modules-updated', handleModulesUpdate);
      window.removeEventListener('permissions-updated', handleModulesUpdate);
    };
  }, []);

  const fetchModules = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setModules([]);
        setLoading(false);
        return;
      }

      // Verificar cache primeiro
      const cacheKey = `combined_modules_${user.id}`;
      const cached = permissionsCache.get<{ modules: Module[]; codes: string[] }>(cacheKey);
      
      if (cached) {
        setModules(cached.modules);
        setAllowedCodes(new Set(cached.codes));
        setLoading(false);
        return;
      }

      // Usar a nova função que combina role + departamento + individual
      const { data: permissions, error: permError } = await supabase
        .rpc("get_user_combined_module_permissions", { _user_id: user.id });

      if (permError) {
        console.error("Erro ao buscar permissões combinadas:", permError);
        setModules([]);
        setLoading(false);
        return;
      }

      const codes = permissions?.map((p: { modulo_codigo: string }) => p.modulo_codigo) || [];
      const allowedCodesSet = new Set(codes);
      setAllowedCodes(allowedCodesSet);

      // Buscar detalhes dos módulos permitidos
      const { data: allModules, error: modulesError } = await supabase
        .from("modulos_sistema")
        .select("*")
        .eq("ativo", true)
        .order("ordem");

      if (modulesError) {
        console.error("Erro ao buscar módulos:", modulesError);
        setModules([]);
        setLoading(false);
        return;
      }

      const filteredModules = allModules?.filter(m => allowedCodesSet.has(m.codigo)) || [];
      setModules(filteredModules);
      
      permissionsCache.set(cacheKey, { modules: filteredModules, codes });
    } catch (error) {
      console.error("Erro ao buscar módulos:", error);
      setModules([]);
    } finally {
      setLoading(false);
    }
  };

  const hasModulePermission = (moduleCode: string): boolean => {
    return allowedCodes.has(moduleCode);
  };

  const refreshPermissions = () => {
    permissionsCache.clear();
    fetchModules();
  };

  return {
    modules,
    loading,
    hasModulePermission,
    refreshPermissions,
  };
};
