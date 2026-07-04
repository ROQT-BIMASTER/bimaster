import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FilaMembro {
  user_id: string;
  papel: "agente" | "lider";
  ativo: boolean;
  nome: string;
  avatar_url: string | null;
}

/** Membros ATIVOS da fila, com nome/avatar via get_chat_directory. */
export function useFilaMembros(filaId: string | null) {
  return useQuery({
    queryKey: ["suporte", "fila-membros", filaId],
    enabled: !!filaId,
    staleTime: 30_000,
    queryFn: async (): Promise<FilaMembro[]> => {
      const { data: vs, error } = await supabase
        .from("suporte_fila_agentes" as any)
        .select("user_id, papel, ativo")
        .eq("fila_id", filaId!)
        .eq("ativo", true);
      if (error) throw error;
      const rows = ((vs ?? []) as unknown) as Array<{
        user_id: string;
        papel: "agente" | "lider";
        ativo: boolean;
      }>;
      if (rows.length === 0) return [];

      const { data: dir, error: dErr } = await supabase.rpc(
        "get_chat_directory" as any,
        { _ids: rows.map((r) => r.user_id) },
      );
      if (dErr) throw dErr;
      const dirMap = new Map<string, { nome: string; avatar_url: string | null }>(
        ((dir ?? []) as any[]).map((d) => [d.id, { nome: d.nome ?? "", avatar_url: d.avatar_url }]),
      );

      return rows.map((r) => ({
        ...r,
        nome: dirMap.get(r.user_id)?.nome ?? "Usuário",
        avatar_url: dirMap.get(r.user_id)?.avatar_url ?? null,
      }));
    },
  });
}

/** Diretório completo (para o buscador de adicionar). */
export function useChatDirectory(termo: string) {
  return useQuery({
    queryKey: ["suporte", "chat-directory", termo],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_chat_directory" as any);
      if (error) throw error;
      const rows = ((data ?? []) as any[]) as Array<{
        id: string;
        nome: string;
        avatar_url: string | null;
      }>;
      const q = termo.trim().toLowerCase();
      if (!q) return rows.slice(0, 50);
      return rows.filter((r) => (r.nome ?? "").toLowerCase().includes(q)).slice(0, 50);
    },
  });
}

export type AcaoMembro = "adicionar" | "remover" | "papel";

export function useFilaMembrosMutations(filaId: string | null) {
  const qc = useQueryClient();

  const acao = useMutation({
    mutationFn: async (p: {
      user_id: string;
      acao: AcaoMembro;
      papel?: "agente" | "lider";
    }) => {
      const { error } = await supabase.rpc("rpc_suporte_fila_membro" as any, {
        p_fila_id: filaId,
        p_user_id: p.user_id,
        p_acao: p.acao,
        p_papel: p.papel ?? "agente",
      });
      if (error) throw error;
      return true;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["suporte", "fila-membros", filaId] });
      qc.invalidateQueries({ queryKey: ["suporte", "minhas-filas"] });
      qc.invalidateQueries({ queryKey: ["suporte", "chamados-desk"] });
      toast.success(
        vars.acao === "adicionar"
          ? "Membro adicionado."
          : vars.acao === "remover"
          ? "Membro removido."
          : "Papel atualizado.",
      );
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Não foi possível concluir a ação.");
    },
  });

  return { acao };
}
