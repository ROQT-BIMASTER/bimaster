import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { MensalistaOutput } from "@/lib/validations/quadra";
import type { QuadraMensalista } from "@/types/quadra";

const db = () => supabase as any;

export const QUADRA_MENSALISTAS_KEY = ["quadra", "mensalistas"] as const;

export function useQuadraMensalistas(opts: { somenteAtivos?: boolean } = {}) {
  return useQuery({
    queryKey: [...QUADRA_MENSALISTAS_KEY, opts],
    queryFn: async (): Promise<QuadraMensalista[]> => {
      let q = db()
        .from("quadra_mensalistas")
        .select("*")
        .order("ativo", { ascending: false })
        .order("dia_semana", { ascending: true })
        .order("horario_inicio", { ascending: true });
      if (opts.somenteAtivos) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((m: any) => ({ ...m, valor_mensal: Number(m.valor_mensal) }));
    },
  });
}

function invalidarTudo(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["quadra"] });
}

export function useCriarMensalista() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: MensalistaOutput) => {
      const { data, error } = await db().from("quadra_mensalistas").insert(input).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      invalidarTudo(queryClient);
      toast.success("Mensalista cadastrado");
    },
    onError: (e: Error) => toast.error("Não foi possível cadastrar o mensalista", { description: e.message }),
  });
}

export function useAtualizarMensalista() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<MensalistaOutput> & { id: string }) => {
      const { error } = await db().from("quadra_mensalistas").update(input).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidarTudo(queryClient);
      toast.success("Mensalista atualizado");
    },
    onError: (e: Error) => toast.error("Não foi possível atualizar o mensalista", { description: e.message }),
  });
}

export function useExcluirMensalista() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from("quadra_mensalistas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidarTudo(queryClient);
      toast.success("Mensalista excluído");
    },
    onError: (e: Error) => toast.error("Não foi possível excluir o mensalista", { description: e.message }),
  });
}
