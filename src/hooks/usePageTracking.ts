import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook que registra automaticamente cada navegação de tela no access_audit_log.
 * Throttle de 2s para evitar registros duplicados em navegação rápida.
 */
export const usePageTracking = () => {
  const { pathname } = useLocation();
  const { session } = useAuth();
  const lastTrackedRef = useRef<string>("");
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!session?.user?.id) return;

    const now = Date.now();
    // Throttle: ignora se mesma rota em menos de 2s
    if (pathname === lastTrackedRef.current && now - lastTimeRef.current < 2000) {
      return;
    }

    lastTrackedRef.current = pathname;
    lastTimeRef.current = now;

    // Extrair módulo do pathname (ex: /dashboard/fabrica/produtos → fabrica)
    const parts = pathname.split("/").filter(Boolean);
    const modulo = parts.length >= 2 ? parts[1] : parts[0] || "dashboard";

    // Fire-and-forget insert
    supabase
      .from("access_audit_log")
      .insert({
        user_id: session.user.id,
        action: "page_view",
        tela_codigo: pathname,
        modulo_codigo: modulo,
        user_agent: navigator.userAgent,
        success: true,
      })
      .then(({ error }) => {
        if (error) {
          console.warn("[usePageTracking] Falha ao registrar acesso:", error.message);
        }
      });
  }, [pathname, session?.user?.id]);
};
