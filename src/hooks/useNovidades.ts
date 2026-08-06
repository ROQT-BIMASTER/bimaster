import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Novidade {
  id: string;
  titulo: string;
  descricao: string;
  midia_url: string | null;
  midia_tipo: "imagem" | "video" | null;
  link_destino: string | null;
  versao: string | null;
  publicado: boolean;
  publicado_em: string | null;
  ordem: number;
  created_at: string;
}

const TABLE = "novidades";

/** Novidades publicadas, ordenadas da mais recente para a mais antiga. */
export function useNovidadesPublicadas() {
  return useQuery({
    queryKey: ["novidades", "publicadas"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Novidade[]> => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select("*")
        .eq("publicado", true)
        .order("publicado_em", { ascending: false, nullsFirst: false })
        .order("ordem", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data || []) as Novidade[];
    },
  });
}

/** IDs de novidades já vistas pelo usuário atual. */
export function useNovidadesVistas() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["novidades", "vistas", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await (supabase as any)
        .from("novidades_visualizacoes")
        .select("novidade_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data || []).map((r: { novidade_id: string }) => r.novidade_id);
    },
  });
}

/** Marca uma lista de novidades como vistas pelo usuário atual. */
export function useMarcarNovidadesVistas() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!user?.id || ids.length === 0) return;
      const rows = ids.map((novidade_id) => ({ user_id: user.id, novidade_id }));
      const { error } = await (supabase as any)
        .from("novidades_visualizacoes")
        .upsert(rows, { onConflict: "user_id,novidade_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["novidades", "vistas"] });
    },
  });
}

/** Lista completa para a área administrativa (inclui não publicadas). */
export function useNovidadesAdmin(enabled: boolean) {
  return useQuery({
    queryKey: ["novidades", "admin"],
    enabled,
    queryFn: async (): Promise<Novidade[]> => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select("*")
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Novidade[];
    },
  });
}

/** Gera URL assinada para mídia armazenada na área privada. */
export async function assinarMidiaNovidade(path: string, expiresIn = 3600): Promise<string | null> {
  if (/^https?:\/\//i.test(path)) return path;
  const { data, error } = await supabase.storage
    .from("novidades-midia")
    .createSignedUrl(path, expiresIn);
  if (error) return null;
  return data?.signedUrl ?? null;
}
