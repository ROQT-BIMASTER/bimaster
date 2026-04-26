import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProjetoCor {
  id: string;
  nome: string;
  cor: string;
  bgCor: string;
}

const FALLBACK_COR = "#3B82F6";
const FALLBACK_BG = "#EFF6FF";

/**
 * Converte hex (#RRGGBB) em rgba com alpha definido.
 */
export function hexToRgba(hex: string | null | undefined, alpha = 0.15): string {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return `rgba(59,130,246,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Busca cor + bg_cor do projeto. Se não houver, devolve fallback do tema.
 * Cache por 5 minutos para evitar reconsultas em listagens.
 */
export function useProjetoCor(projetoId: string | null | undefined) {
  return useQuery({
    queryKey: ["projeto-cor", projetoId],
    enabled: !!projetoId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ProjetoCor> => {
      const { data, error } = await supabase
        .from("projetos")
        .select("id, nome, cor, bg_cor")
        .eq("id", projetoId!)
        .maybeSingle();
      if (error) throw error;
      return {
        id: data?.id || projetoId!,
        nome: data?.nome || "",
        cor: (data as any)?.cor || FALLBACK_COR,
        bgCor: (data as any)?.bg_cor || hexToRgba((data as any)?.cor || FALLBACK_COR, 0.12),
      };
    },
  });
}
