import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Rotinas + fila_id, para posicionar cada etapa na swimlane correta. */
export function useRotinasBasicasByIds(ids: string[]) {
  const key = [...ids].sort().join(",");
  return useQuery({
    enabled: ids.length > 0,
    queryKey: ["suporte", "rotinas-basicas", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suporte_rotinas_fixas" as any)
        .select("id, titulo, fila_id, responsavel_user_id")
        .in("id", ids);
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        id: string;
        titulo: string;
        fila_id: string;
        responsavel_user_id: string | null;
      }>;
    },
  });
}

/** Persiste posição da etapa após drag. */
export function useSalvarPosicaoEtapa() {
  return useMutation({
    mutationFn: async (args: { id: string; posicao_x: number; posicao_y: number }) => {
      const { error } = await supabase
        .from("processo_etapas" as any)
        .update({ posicao_x: args.posicao_x, posicao_y: args.posicao_y } as any)
        .eq("id", args.id);
      if (error) throw error;
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar posição."),
  });
}

/** Cria uma ligação (edge) entre duas etapas. */
export function useCriarLigacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      processo_id: string;
      de_etapa_id: string;
      para_etapa_id: string;
      condicao?: "sempre" | "se_concluida" | "em_excecao";
      sla_handoff_minutos?: number | null;
    }) => {
      const { error } = await supabase.from("processo_ligacoes" as any).insert({
        processo_id: args.processo_id,
        de_etapa_id: args.de_etapa_id,
        para_etapa_id: args.para_etapa_id,
        condicao: args.condicao ?? "se_concluida",
        sla_handoff_minutos: args.sla_handoff_minutos ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_, args) => {
      qc.invalidateQueries({ queryKey: ["processo", args.processo_id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar ligação."),
  });
}

/** Remove uma ligação. */
export function useDeletarLigacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; processo_id: string }) => {
      const { error } = await supabase.from("processo_ligacoes" as any).delete().eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_, args) => {
      qc.invalidateQueries({ queryKey: ["processo", args.processo_id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover ligação."),
  });
}

/** Remove uma etapa (ligações caem em cascade). */
export function useDeletarEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; processo_id: string }) => {
      const { error } = await supabase.from("processo_etapas" as any).delete().eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_, args) => {
      qc.invalidateQueries({ queryKey: ["processo", args.processo_id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover etapa."),
  });
}
