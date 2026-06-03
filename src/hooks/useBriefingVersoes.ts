import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BriefingVersao {
  id: string;
  round: number;
  origem: "envio" | "revisao";
  payload_snapshot: Record<string, unknown>;
  body_md: string | null;
  motivo_devolucao: string | null;
  enviado_em: string;
}

export function useBriefingVersoes(briefingId?: string) {
  return useQuery({
    queryKey: ["briefing_versoes", briefingId],
    enabled: !!briefingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("briefing_versoes")
        .select(
          "id, round, origem, payload_snapshot, body_md, motivo_devolucao, enviado_em",
        )
        .eq("briefing_id", briefingId!)
        .order("round", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BriefingVersao[];
    },
  });
}
