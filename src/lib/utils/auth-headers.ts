import { supabase } from "@/integrations/supabase/client";

/**
 * Retorna os headers de autenticação com o JWT do usuário logado.
 * Deve ser usado em todas as chamadas a edge functions para garantir
 * que o usuário seja identificado corretamente no backend.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error("Usuário não autenticado");
  }

  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${session.access_token}`,
  };
}
