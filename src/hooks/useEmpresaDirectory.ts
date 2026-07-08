import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EmpresaMembro {
  id: string;
  nome: string | null;
  avatar_url: string | null;
}

/**
 * Diretório de colaboradores ativos da empresa.
 *
 * Reutiliza a RPC `get_chat_directory` (SECURITY DEFINER) que já é usada
 * pelo chat interno — mesmo escopo de exposição (profiles com status='ativo'
 * e sem honeytoken), sem migration nova.
 *
 * Usado em pickers da Central "Minhas Tarefas" para permitir delegar/marcar
 * qualquer colega em tarefas pessoais (que, por construção, têm apenas o
 * dono em `projeto_membros`). Padrão de mercado: Asana My Tasks, Todoist
 * Inbox, ClickUp Personal, Linear Inbox etc.
 */
export function useEmpresaDirectory(enabled: boolean = true) {
  return useQuery({
    queryKey: ["empresa-directory"],
    queryFn: async (): Promise<EmpresaMembro[]> => {
      const { data, error } = await (supabase as any).rpc("get_chat_directory");
      if (error) throw error;
      return (data || []) as EmpresaMembro[];
    },
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
}
