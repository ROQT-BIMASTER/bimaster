import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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

  useEffect(() => {
    fetchModules();
  }, []);

  const fetchModules = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setModules([]);
        setLoading(false);
        return;
      }

      // Buscar todos os módulos
      const { data: allModules } = await supabase
        .from("modulos_sistema")
        .select("*")
        .eq("ativo", true)
        .order("ordem");

      if (!allModules) {
        setModules([]);
        setLoading(false);
        return;
      }

      // Verificar permissões para cada módulo
      const permissionsPromises = allModules.map(async (module) => {
        try {
          const { data, error } = await supabase.rpc("usuario_tem_permissao_modulo", {
            _user_id: user.id,
            _modulo_codigo: module.codigo,
          });

          if (error) {
            console.error(`Erro ao verificar permissão para ${module.codigo}:`, error);
            return null;
          }

          return data ? module : null;
        } catch (err) {
          console.error(`Erro ao verificar permissão para ${module.codigo}:`, err);
          return null;
        }
      });

      const results = await Promise.all(permissionsPromises);
      const allowedModules = results.filter((m) => m !== null) as Module[];

      setModules(allowedModules);
    } catch (error) {
      console.error("Erro ao buscar módulos:", error);
      setModules([]);
    } finally {
      setLoading(false);
    }
  };

  const hasModulePermission = (moduleCode: string): boolean => {
    return modules.some((m) => m.codigo === moduleCode);
  };

  return {
    modules,
    loading,
    hasModulePermission,
  };
};
