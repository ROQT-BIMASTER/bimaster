import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/contexts/PermissionsContext";

/**
 * Hook que processa a fila de fotos apenas quando:
 * 1. O usuário está autenticado
 * 2. O usuário tem permissão ao módulo Trade
 * 
 * Substitui o processamento incondicional em main.tsx
 */
export function usePhotoQueueProcessor() {
  const { hasModulePermission, loading } = usePermissions();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (loading) return;
    
    // Só iniciar se o usuário tem acesso ao módulo trade
    if (!hasModulePermission("trade")) return;

    const processQueue = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('trigger-photo-queue', {
          body: {},
        });
        if (error) throw error;
        // Processamento silencioso - sem console.log em produção
      } catch {
        // Erro silencioso - evitar poluir console em produção
      }
    };

    // Processar imediatamente
    processQueue();

    // Depois a cada 2 minutos
    intervalRef.current = setInterval(processQueue, 120000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [hasModulePermission, loading]);
}
